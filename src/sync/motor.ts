import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import Dexie from 'dexie'
import {
  comoRemoto,
  db,
  engancharAutor,
  engancharSync,
  guardarAjuste,
  nuevoId,
  type AccionCambio,
  type NombreTabla,
  type Rol,
  type SeccionId,
} from '../db/db'
import { aClaveDeNube, aClaveLocal } from './claves'
import { ID_NEGOCIO } from './config'
import { anotarRechazoVisible, fijarEstadoNube } from './estado'
import {
  camposParaConservar,
  motivosDelRechazo,
  textoDelRechazo,
  type MotivoRechazo,
} from './motivoRechazo'
import { crearAuthSecundario, obtenerAuth, obtenerFirestore } from './firebase'
import { autorDeLaSesion, fijarSesion, obtenerSesion } from './sesion'

const TABLAS: NombreTabla[] = [
  'productos',
  'jornadas',
  'ventas',
  'movimientos',
  'proveedores',
  'usuarios',
  'historialProductos',
  'movimientosProveedor',
  // El historial sincroniza: el dueño tiene que ver en su pantalla los
  // cambios que hizo otra persona en otro dispositivo, que es el punto
  // de tener un historial.
  'historial',
  // Los borrados a proposito. Tienen que viajar: son la unica forma de
  // que un dispositivo que estuvo desconectado no vuelva a subir lo que
  // se borro mientras no miraba.
  'borrados',
]

/**
 * Los unicos dos mails que pueden auto-asignarse el rol "owner" la primera
 * vez que se loguean (arranque de la cuenta). Tiene que ser exactamente
 * la misma lista que en firestore.rules: si se suma un socio nuevo hay
 * que agregarlo en los dos lugares.
 */
export const EMAILS_FUNDADORES = ['emmanuel@elclubdelmate.com', 'sebastian@elclubdelmate.com']

/**
 * Clave donde cada dispositivo anota cuando fue la ultima vez que
 * recibio datos del servidor. Vive en "ajustes", que a proposito NO se
 * sincroniza: es informacion de ESTE aparato, y justamente sirve para
 * detectar que este aparato se quedo atras.
 */
export const CLAVE_ULTIMA_SYNC = 'ultimaSync'

/**
 * Cada cuanto se anota. Sin esto se escribiria en la base local con
 * cada snapshot que llega, que en un dia normal son cientos: para saber
 * "hace cuantos dias que no sincroniza" alcanza con la precision de
 * unos minutos.
 */
const CADA_CUANTO_ANOTAR = 5 * 60 * 1000
let ultimaAnotacion = 0

async function anotarSincronizacion(): Promise<void> {
  const ahora = Date.now()
  if (ahora - ultimaAnotacion < CADA_CUANTO_ANOTAR) return
  ultimaAnotacion = ahora
  await guardarAjuste(CLAVE_ULTIMA_SYNC, String(ahora))
}

/**
 * Claves cuya escritura el servidor rechazo hace poco.
 *
 * Firestore revierte su cache local cuando una escritura se rechaza, y
 * esa reversion llega al listener como un 'removed'. Sin esta lista no
 * hay forma de distinguir eso de un borrado real hecho por otra persona,
 * y la app terminaba borrando localmente lo que la persona acababa de
 * cargar.
 *
 * Se limpian solas: si el problema se arregla y el dato sube bien, el
 * eco siguiente ya no es un rechazo.
 */
const rechazosRecientes = new Set<string>()

let desuscribirColecciones: Unsubscribe[] = []
let motorIniciado = false
let controlPeriodico: ReturnType<typeof setInterval> | null = null

/** Cada cuanto se vuelve a controlar si quedo algo sin subir. */
const CADA_CUANTO_CONTROLAR = 5 * 60 * 1000

/** Convierte undefined en null: Firestore no acepta valores undefined. */
function limpiar(obj: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(obj)) {
    limpio[clave] = valor === undefined ? null : valor
  }
  return limpio
}

function pushCambio(tabla: NombreTabla, accion: AccionCambio, clave: string, doc_: unknown) {
  const auth = obtenerAuth()
  if (!auth.currentUser) return
  const firestore = obtenerFirestore()

  // La clave se escapa para nombrar el documento (ver claves.ts): hay
  // 34 codigos de producto con barra, y la barra es el separador de
  // rutas de Firestore. Sin esto, doc() TIRA --no rechaza, tira-- y la
  // excepcion ni siquiera llegaba a avisarRechazo: el producto se
  // guardaba local y no subia nunca, en silencio.
  const idEnLaNube = aClaveDeNube(clave)
  let referencia
  try {
    referencia = doc(firestore, 'negocios', ID_NEGOCIO, tabla, idEnLaNube)
  } catch (e) {
    avisarRechazo(tabla, clave, e)
    return
  }
  if (accion === 'borrar') {
    deleteDoc(referencia).catch((e) =>
      avisarRechazo(tabla, clave, e, { accion, referencia, enviado: null }),
    )
  } else {
    const datos = limpiar(doc_ as Record<string, unknown>)
    setDoc(referencia, datos).catch((e) =>
      avisarRechazo(tabla, clave, e, { accion, referencia, enviado: datos }),
    )
  }
}

/** Lo que se intento mandar, para poder explicar despues por que no entro. */
interface IntentoRechazado {
  accion: AccionCambio
  referencia: DocumentReference
  enviado: Record<string, unknown> | null
}

function esPermisoDenegado(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'permission-denied'
}

/**
 * Cuando el servidor rechaza una escritura.
 *
 * Esto pasaba en silencio: un console.warn que nadie mira. Y el rechazo
 * no es inocuo --Firestore revierte la escritura optimista de su cache y
 * eso llega como un cambio 'removed', o sea que el dato desaparece de la
 * pantalla-- asi que quedaba como "lo cargue y se borro", sin ninguna
 * pista de por que. Una vez costo varias semanas de trabajo de una
 * persona: cargaba la caja de la mañana y se le iba.
 *
 * Ahora el estado de la nube pasa a 'error' con el motivo, que es lo que
 * el Panel y la campana ya muestran. No arregla la causa, pero la hace
 * visible el primer dia en vez de a las tres semanas.
 */
function avisarRechazo(
  tabla: NombreTabla,
  clave: string,
  error: unknown,
  intento?: IntentoRechazado,
): void {
  const mensaje = error instanceof Error ? error.message : String(error)
  // Se anota con el nombre que tiene el documento en la nube, que es el
  // que va a venir en el snapshot cuando llegue el eco del rechazo.
  rechazosRecientes.add(`${tabla}/${aClaveDeNube(clave)}`)
  console.warn(`El servidor rechazo un cambio en ${tabla}:`, error)
  const texto = `El servidor rechazó un cambio en ${tabla} (${clave}). Lo que cargaste puede no haberse guardado. (${mensaje})`
  fijarEstadoNube({ estado: 'error', error: texto })
  // En el cartel va sin el mensaje tecnico de Firebase, que es largo y
  // no le dice nada a quien esta en el mostrador. El completo queda en
  // la constancia del servidor.
  const textoCorto = `El servidor no aceptó un cambio en ${tabla} (${clave}). Lo que cargaste puede no haberse guardado.`

  // En productos se averigua el motivo exacto: la regla tiene varias
  // condiciones y Firestore no dice cual fallo. Ver motivoRechazo.ts.
  if (tabla === 'productos' && intento && esPermisoDenegado(error)) {
    // Fuera de la transaccion de Dexie: el envio salio de un gancho de
    // la base local, y esa transaccion ya termino. Sin esto, lo que
    // esta funcion escribe en la base local tira TransactionInactiveError
    // (la prueba contra el emulador lo agarro: el servidor quedaba bien
    // y este dispositivo seguia mostrando lo viejo).
    Dexie.ignoreTransaction(() => explicarRechazoDeProducto(clave, intento, mensaje)).catch((e) => {
      console.warn('No se pudo averiguar el motivo del rechazo:', e)
      anotarRechazoVisible(textoCorto)
      void dejarConstanciaDelRechazo(tabla, clave, intento.accion, texto, null, 'no')
    })
    return
  }
  // El aviso de arriba lo borra el proximo snapshot --que en un rechazo
  // es justamente la reversion, milisegundos despues--, asi que hasta
  // el 22/10 nadie llegaba a verlo. Este queda hasta que la persona lo
  // lee.
  anotarRechazoVisible(textoCorto)
  void dejarConstanciaDelRechazo(tabla, clave, intento?.accion ?? 'guardar', texto, null, 'no')
}

/**
 * Le pregunta al servidor --no a la copia local-- como esta el producto
 * y como figura el perfil propio, y con eso dice que condicion de la
 * regla fallo.
 *
 * Si lo unico que fallaba era un dato que el cambio dejaba vacio, lo
 * vuelve a mandar sin esos campos: el servidor conserva lo que tenia y
 * el resto de la edicion (el precio, el costo, el desarchivado) entra.
 */
async function explicarRechazoDeProducto(
  clave: string,
  intento: IntentoRechazado,
  mensajeOriginal: string,
): Promise<void> {
  const firestore = obtenerFirestore()
  const uid = obtenerAuth().currentUser?.uid
  const [enElServidor, perfil] = await Promise.all([
    getDocFromServer(intento.referencia),
    uid
      ? getDocFromServer(doc(firestore, 'negocios', ID_NEGOCIO, 'usuarios', uid))
      : Promise.resolve(null),
  ])
  const servidor = enElServidor.exists() ? enElServidor.data() : null
  const motivos = motivosDelRechazo(
    intento.accion,
    intento.enviado,
    servidor,
    perfil && perfil.exists() ? perfil.data() : null,
  )

  // Un borrado que no entra sobre un producto que en el servidor ya esta
  // archivado es lo esperado mientras las reglas no permitan borrar
  // productos: es el segundo paso de cambiar un codigo, y el primero
  // (archivarlo) ya entro. No hay nada que la persona tenga que hacer.
  const borradoEsperable =
    intento.accion === 'borrar' &&
    servidor?.archivado === true &&
    motivos.length === 1 &&
    motivos[0].tipo === 'borrar-no-permitido'

  const conservar = intento.enviado ? camposParaConservar(motivos) : null
  let reintento: 'entro' | 'no' | null = null
  if (conservar && intento.enviado) {
    const sinVacios = Object.fromEntries(
      Object.entries(intento.enviado).filter(([campo]) => !conservar.includes(campo)),
    )
    try {
      await setDoc(intento.referencia, sinVacios, { merge: true })
      reintento = 'entro'
      // El rechazo ya le devolvio a este dispositivo lo viejo del
      // servidor. Lo que quedo alla ahora es lo nuevo con lo conservado:
      // se trae, porque el eco de una escritura propia no llega por el
      // listener.
      const fresco = await getDocFromServer(intento.referencia)
      if (fresco.exists()) {
        await comoRemoto(async () => {
          await db.table('productos').put({ ...fresco.data() })
        })
      }
    } catch (e) {
      console.warn('Tampoco entro sin los campos vacios:', e)
      reintento = 'no'
    }
  }

  let texto = textoDelRechazo(clave, motivos)
  if (reintento === 'entro') {
    texto += ' Se volvió a mandar sin esos campos --quedaron como estaban en el servidor-- y el resto del cambio entró.'
  } else if (borradoEsperable) {
    texto += ' El producto ya está archivado en el servidor: no se ve en ningún lado.'
  } else if (reintento === 'no') {
    // Si sin esos campos tampoco entro, la cuenta de esta app no cierra
    // con lo que dice el servidor: lo mas probable es que las reglas
    // publicadas no sean las que esta app conoce.
    texto +=
      ' Se volvió a mandar sin esos campos y tampoco entró: el servidor tiene otra condición que esta versión de la app no conoce. El cambio no se guardó.'
  } else {
    texto += ' El cambio no se guardó: en este dispositivo vuelve a verse lo que hay en el servidor.'
  }

  if (reintento !== 'entro' && !borradoEsperable) anotarRechazoVisible(texto)
  else fijarEstadoNube({ error: null })
  await dejarConstanciaDelRechazo(
    'productos',
    clave,
    intento.accion,
    texto,
    motivos,
    reintento ?? (borradoEsperable ? 'esperable' : 'no'),
    mensajeOriginal,
  )
}

/**
 * Deja el rechazo anotado en el servidor (coleccion `rechazos`), para
 * que el dueño lo vea desde la consola de Firebase sin tener que
 * pedirle a nadie que le saque una foto a la pantalla. Si tampoco se
 * puede escribir ahi (perfil desactivado, sin internet), se sigue: es
 * una constancia, no parte del trabajo.
 */
async function dejarConstanciaDelRechazo(
  tabla: NombreTabla,
  clave: string,
  accion: AccionCambio,
  texto: string,
  motivos: MotivoRechazo[] | null,
  reintento: 'entro' | 'no' | 'esperable',
  mensajeOriginal?: string,
): Promise<void> {
  try {
    const usuario = obtenerAuth().currentUser
    await setDoc(doc(obtenerFirestore(), 'negocios', ID_NEGOCIO, 'rechazos', nuevoId()), {
      cuando: Date.now(),
      quien: usuario?.email ?? null,
      uid: usuario?.uid ?? null,
      tabla,
      clave,
      accion,
      texto,
      motivos: motivos ? JSON.parse(JSON.stringify(motivos)) : null,
      reintento,
      mensajeOriginal: mensajeOriginal ?? null,
    })
  } catch (e) {
    console.warn('No se pudo dejar constancia del rechazo:', e)
  }
}

/**
 * Sube todo lo que ya hay en el dispositivo. Se usa una vez, al iniciar
 * sesion — puede ser el primer catalogo entero (miles de productos), asi
 * que va en lotes (limite de Firestore: 500 operaciones por lote) en vez
 * de un pedido de red por cada fila, que en el primer login real se
 * volvia lentisimo y saturaba la base local con el eco de cada escritura.
 *
 * Solo sube lo que el servidor NO tiene todavia. Es la diferencia entre
 * "traigo lo mio" y "piso lo de todos": un celular recien instalado
 * arranca con el catalogo semilla, que es una foto vieja, y subirlo tal
 * cual dejaria el catalogo del negocio con los precios de esa foto. Lo
 * que ya esta en el servidor es de todos y manda.
 *
 * El costo de esto es que una edicion hecha en este dispositivo SIN
 * sesion iniciada, sobre algo que ya existe en el servidor, no sube en
 * este momento. Es la decision correcta: entre perder una edicion suelta
 * y pisar el catalogo entero con datos viejos, se pierde la edicion. Con
 * la sesion abierta no aplica: ahi cada cambio sube solo, incluso sin
 * internet (Firestore lo encola y lo manda cuando vuelve).
 */
async function empujarTodoLocal() {
  const firestore = obtenerFirestore()
  const operaciones: { tabla: NombreTabla; clave: string; datos: Record<string, unknown> }[] = []

  // Lo que se borro a proposito, preguntado AL SERVIDOR y no a la copia
  // local: este es justamente el caso en que la copia local esta
  // atrasada. Sin esto, un dispositivo que estuvo apagado mientras se
  // borraba un turno lo vuelve a subir al encenderse, y el borrado se
  // deshace solo.
  const borrados = new Set<string>()
  try {
    const docs = await getDocs(collection(firestore, 'negocios', ID_NEGOCIO, 'borrados'))
    for (const d of docs.docs) borrados.add(aClaveLocal(d.id))
  } catch (e) {
    // Si no se pueden leer, se sube igual: perder un dato por no poder
    // leer una lista seria peor que revivir uno borrado, que al menos
    // se vuelve a borrar.
    console.warn('No se pudo leer la lista de borrados:', e)
  }

  for (const tabla of TABLAS) {
    const enElServidor = new Set(
      (await getDocs(collection(firestore, 'negocios', ID_NEGOCIO, tabla))).docs.map((d) => d.id),
    )
    const filas = await db.table(tabla).toArray()
    for (const fila of filas) {
      const clave =
        tabla === 'productos' ? (fila as { codigo: string }).codigo : (fila as { id: string }).id
      // Se compara contra el nombre que el documento tiene alla, no el
      // de aca: para los codigos con barra no son el mismo.
      if (enElServidor.has(aClaveDeNube(clave))) continue
      if (borrados.has(`${tabla}/${clave}`)) continue
      operaciones.push({ tabla, clave, datos: limpiar(fila as Record<string, unknown>) })
    }
  }

  const TAMANO_LOTE = 400
  const rechazadas: string[] = []
  for (let i = 0; i < operaciones.length; i += TAMANO_LOTE) {
    const lote = writeBatch(firestore)
    for (const { tabla, clave, datos } of operaciones.slice(i, i + TAMANO_LOTE)) {
      // Cada referencia va en su propio try. doc() tira al armar la
      // referencia, no al enviarla, asi que antes una sola clave mala
      // cortaba el armado del lote y con el se cortaba todo lo que
      // venia despues en la cola: el resto de los productos, los
      // turnos, las ventas y los proveedores. Por eso quedaron
      // productos apuntando a proveedores que en el servidor no
      // existen. Ahora una clave mala se saltea sola y el resto sube.
      try {
        lote.set(doc(firestore, 'negocios', ID_NEGOCIO, tabla, aClaveDeNube(clave)), datos)
      } catch (e) {
        rechazadas.push(`${tabla}/${clave}`)
        console.warn(`No se pudo armar la referencia de ${tabla}/${clave}:`, e)
      }
    }
    await lote.commit().catch((e) => console.warn('No se pudo subir un lote de datos:', e))
  }
  if (rechazadas.length > 0) {
    fijarEstadoNube({
      estado: 'error',
      error: `Quedaron ${rechazadas.length} registros sin subir porque su clave no es válida para el servidor (${rechazadas.slice(0, 3).join(', ')}…).`,
    })
  }
}

/**
 * Cuenta cuantos registros tiene este dispositivo que el servidor no.
 *
 * Compara CANTIDADES, no documento por documento: una consulta de
 * conteo por tabla en vez de traerse miles de ids. Es barato --nueve
 * lecturas en total-- asi que se puede correr seguido.
 *
 * No dice CUALES faltan, y para el unico proposito que tiene alcanza:
 * avisarle a quien esta cargando que lo que carga no esta llegando a
 * ningun lado. Eso es lo que no se vio durante tres dias en el celular
 * de Gabi.
 *
 * Si el servidor tiene mas que el dispositivo --lo normal en un
 * telefono recien instalado-- da cero: lo que falta aca lo trae la
 * sincronizacion sola, y no es un problema de nadie.
 */
export async function contarSinSubir(): Promise<number | null> {
  const auth = obtenerAuth()
  if (!auth.currentUser) return null
  const firestore = obtenerFirestore()

  try {
    let total = 0
    for (const tabla of TABLAS) {
      const [aca, alla] = await Promise.all([
        db.table(tabla).count(),
        getCountFromServer(collection(firestore, 'negocios', ID_NEGOCIO, tabla)).then(
          (r) => r.data().count,
        ),
      ])
      if (aca > alla) total += aca - alla
    }
    return total
  } catch (e) {
    // Sin internet no se puede saber, y no saber no es lo mismo que
    // estar al dia: queda en null y el cartel no dice nada.
    console.warn('No se pudo controlar lo que falta subir:', e)
    return null
  }
}

/**
 * Si esa clave ya existe en el servidor. null = no se pudo averiguar.
 *
 * Por que hace falta mirar el servidor y no alcanza con la base local:
 * un dispositivo que estuvo un rato sin internet NO tiene los productos
 * que se crearon mientras tanto. Si alguien carga ahi un producto con un
 * codigo que ya existe, la base local dice que esta libre, el motor lo
 * sube con setDoc --que pisa-- y el producto del servidor desaparece
 * debajo del nuevo. Es el mismo final del 20/10 por otro camino.
 *
 * Las tres respuestas son distintas y las tres importan: true es "ya
 * existe", false es "esta libre", y null es "no se pudo saber", que NO
 * es lo mismo que estar libre y por eso no se confunden.
 */
export async function existeEnLaNube(tabla: NombreTabla, clave: string): Promise<boolean | null> {
  const auth = obtenerAuth()
  if (!auth.currentUser) return null
  try {
    const referencia = doc(obtenerFirestore(), 'negocios', ID_NEGOCIO, tabla, aClaveDeNube(clave))
    return (await getDoc(referencia)).exists()
  } catch (e) {
    console.warn('No se pudo controlar si la clave ya existe en el servidor:', e)
    return null
  }
}

/** Controla y deja el resultado en el estado de la nube. */
export async function controlarSinSubir(): Promise<void> {
  fijarEstadoNube({ sinSubir: await contarSinSubir() })
}

/**
 * Si el perfil propio (usuarios/{uid}) cambio en la nube, actualiza la
 * sesion. Se llama tanto al loguearse como cada vez que llega un cambio
 * remoto de la coleccion "usuarios" — asi, si un owner desactiva a
 * alguien mientras esta usando la app, se entera al toque (no hace
 * falta esperar a que cierre y vuelva a abrir).
 */
async function actualizarPerfilPropio(): Promise<void> {
  const uid = obtenerAuth().currentUser?.uid
  if (!uid) return
  const fila = await db.usuarios.get(uid)
  if (!fila) return

  if (fila.activo === false) {
    fijarSesion({ cargando: false, perfil: null, sinPerfil: false, desactivada: true })
    await signOut(obtenerAuth())
    return
  }

  fijarSesion({
    cargando: false,
    perfil: { nombre: fila.nombre, rol: fila.rol, secciones: fila.secciones },
    sinPerfil: false,
    desactivada: false,
  })
}

function escucharColecciones() {
  const firestore = obtenerFirestore()

  desuscribirColecciones.forEach((f) => f())
  desuscribirColecciones = TABLAS.map((tabla) => {
    const referencia = collection(firestore, 'negocios', ID_NEGOCIO, tabla)
    return onSnapshot(
      referencia,
      (instantanea) => {
        comoRemoto(async () => {
          for (const cambio of instantanea.docChanges()) {
            // Un cambio "pendiente" es el eco de una escritura que salio de
            // este mismo dispositivo: el dato ya esta en la base local
            // (de ahi salio), asi que reescribirlo de nuevo es trabajo de
            // mas — y con miles de filas, es lo que saturaba la app en el
            // primer login real.
            if (cambio.doc.metadata.hasPendingWrites) continue
            if (cambio.type === 'removed') {
              // Un 'removed' puede ser dos cosas muy distintas: alguien
              // borro el dato de verdad, o el servidor rechazo una
              // escritura de ESTE dispositivo y Firestore esta
              // revirtiendo su cache. En el segundo caso, borrar la fila
              // local es destruir lo que la persona acaba de cargar por
              // un problema de permisos. Ante la duda no se borra: el
              // dato queda y el estado de la nube ya quedo en error.
              if (rechazosRecientes.has(`${tabla}/${cambio.doc.id}`)) continue
              // El id viene escapado si la clave tenia barra: se
              // desescapa para borrar la fila local correcta.
              await db.table(tabla).delete(aClaveLocal(cambio.doc.id))
            } else {
              rechazosRecientes.delete(`${tabla}/${cambio.doc.id}`)
              await db.table(tabla).put({ ...cambio.doc.data() })
            }
          }
          if (tabla === 'usuarios') await actualizarPerfilPropio()
        }).catch((e) => console.warn(`Error aplicando cambios remotos de ${tabla}:`, e))
        fijarEstadoNube({ estado: 'sincronizado', error: null, ultimaRecepcion: Date.now() })
        anotarSincronizacion().catch(() => {
          /* Si no se puede anotar, la app sigue: es solo para el aviso. */
        })
      },
      (error) => {
        console.warn(`Error escuchando ${tabla}:`, error)
        fijarEstadoNube({ estado: 'error', error: error.message })
      },
    )
  })
}

function dejarDeEscuchar() {
  desuscribirColecciones.forEach((f) => f())
  desuscribirColecciones = []
}

/**
 * Si es un mail fundador y todavia no tiene perfil, se lo crea el mismo
 * como owner (arranque de la cuenta). Para cualquier otra persona el
 * perfil lo tiene que crear un owner ya existente, desde Ajustes.
 */
async function intentarArrancarFundador(usuario: User): Promise<void> {
  const correo = (usuario.email ?? '').toLowerCase()
  if (!EMAILS_FUNDADORES.includes(correo)) return
  const existente = await db.usuarios.get(usuario.uid)
  if (existente) return
  await db.usuarios.add({
    id: usuario.uid,
    email: correo,
    nombre: correo.split('@')[0],
    rol: 'owner',
    activo: true,
  })
}

/**
 * Arranca el motor de sincronizacion. Se llama solo despues de confirmar
 * que la nube esta configurada (ver App.tsx), asi que aca ya se puede
 * usar Firebase sin chequear de nuevo.
 */
export function iniciarMotor(): void {
  if (motorIniciado) return
  motorIniciado = true

  engancharSync(pushCambio)
  engancharAutor(() => autorDeLaSesion(obtenerSesion()))

  onAuthStateChanged(obtenerAuth(), (usuario: User | null) => {
    if (usuario) {
      fijarEstadoNube({ estado: 'conectando', email: usuario.email, error: null })
      fijarSesion({
        cargando: true,
        uid: usuario.uid,
        email: usuario.email,
        sinPerfil: false,
        desactivada: false,
      })
      escucharColecciones()
      empujarTodoLocal()
        .catch((e) => console.warn('No se pudo subir el estado inicial:', e))
        // Recien despues de intentar subir tiene sentido contar lo que
        // quedo: si se controlara antes, el numero seria el de lo que
        // esta por subirse y asustaria sin motivo.
        .finally(() => {
          void controlarSinSubir()
          // Y cada tanto despues: lo que no sube no avisa solo, asi que
          // hay que ir a preguntar.
          if (controlPeriodico) clearInterval(controlPeriodico)
          controlPeriodico = setInterval(() => void controlarSinSubir(), CADA_CUANTO_CONTROLAR)
        })
      ;(async () => {
        await intentarArrancarFundador(usuario)
        await actualizarPerfilPropio()
        if (!(await db.usuarios.get(usuario.uid))) {
          // Ni tiene perfil en la nube ni es fundador: alguien con acceso
          // a Firebase creo la cuenta pero nadie le asigno rol todavia.
          fijarSesion({ cargando: false, sinPerfil: true })
        }
      })()
    } else {
      dejarDeEscuchar()
      if (controlPeriodico) {
        clearInterval(controlPeriodico)
        controlPeriodico = null
      }
      fijarEstadoNube({ estado: 'desconectado', email: null, sinSubir: null })
      fijarSesion({ cargando: false, uid: null, email: null, perfil: null, sinPerfil: false })
    }
  })
}

export async function iniciarSesion(email: string, contrasena: string): Promise<void> {
  const auth = obtenerAuth()
  const correo = email.trim().toLowerCase()
  try {
    await signInWithEmailAndPassword(auth, correo, contrasena)
  } catch (e) {
    const codigo = (e as { code?: string }).code
    const puedeArrancarCuenta =
      EMAILS_FUNDADORES.includes(correo) &&
      (codigo === 'auth/user-not-found' || codigo === 'auth/invalid-credential')
    if (puedeArrancarCuenta) {
      await createUserWithEmailAndPassword(auth, correo, contrasena)
    } else {
      throw e
    }
  }
}

export async function cerrarSesion(): Promise<void> {
  await signOut(obtenerAuth())
}

/** Manda un mail para elegir una contraseña nueva, si ese mail tiene cuenta. */
export async function recuperarContrasena(email: string): Promise<void> {
  await sendPasswordResetEmail(obtenerAuth(), email.trim().toLowerCase())
}

/**
 * Da de alta a una persona nueva (Gabriela, otro socio, etc.): crea su
 * login y su perfil con el rol elegido. Solo tiene efecto real si quien
 * llama a esto ya es un owner (lo valida Firestore, no esta funcion).
 */
export async function crearUsuario(
  email: string,
  contrasena: string,
  nombre: string,
  rol: Rol,
  secciones?: SeccionId[] | null,
): Promise<void> {
  const correo = email.trim().toLowerCase()
  const { auth: authSecundaria, limpiar } = crearAuthSecundario()
  try {
    const credencial = await createUserWithEmailAndPassword(authSecundaria, correo, contrasena)
    await db.usuarios.add({
      id: credencial.user.uid,
      email: correo,
      nombre: nombre.trim(),
      rol,
      activo: true,
      secciones: rol === 'empleado' ? (secciones ?? null) : null,
    })
  } finally {
    await limpiar()
  }
}
