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
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  comoRemoto,
  db,
  engancharAutor,
  engancharSync,
  type AccionCambio,
  type NombreTabla,
  type Rol,
  type SeccionId,
} from '../db/db'
import { ID_NEGOCIO } from './config'
import { fijarEstadoNube } from './estado'
import { crearAuthSecundario, obtenerAuth, obtenerFirestore } from './firebase'
import { fijarSesion, obtenerSesion } from './sesion'

const TABLAS: NombreTabla[] = [
  'productos',
  'jornadas',
  'ventas',
  'movimientos',
  'proveedores',
  'usuarios',
  'historialProductos',
  'movimientosProveedor',
]

/**
 * Los unicos dos mails que pueden auto-asignarse el rol "owner" la primera
 * vez que se loguean (arranque de la cuenta). Tiene que ser exactamente
 * la misma lista que en firestore.rules: si se suma un socio nuevo hay
 * que agregarlo en los dos lugares.
 */
export const EMAILS_FUNDADORES = ['emmanuel@elclubdelmate.com', 'sebastian@elclubdelmate.com']

let desuscribirColecciones: Unsubscribe[] = []
let motorIniciado = false

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

  const referencia = doc(firestore, 'negocios', ID_NEGOCIO, tabla, clave)
  if (accion === 'borrar') {
    deleteDoc(referencia).catch((e) => console.warn(`No se pudo sincronizar el borrado en ${tabla}:`, e))
  } else {
    setDoc(referencia, limpiar(doc_ as Record<string, unknown>)).catch((e) =>
      console.warn(`No se pudo sincronizar ${tabla}:`, e),
    )
  }
}

/**
 * Sube todo lo que ya hay en el dispositivo. Se usa una vez, al iniciar
 * sesion — puede ser el primer catalogo entero (miles de productos), asi
 * que va en lotes (limite de Firestore: 500 operaciones por lote) en vez
 * de un pedido de red por cada fila, que en el primer login real se
 * volvia lentisimo y saturaba la base local con el eco de cada escritura.
 */
async function empujarTodoLocal() {
  const firestore = obtenerFirestore()
  const operaciones: { tabla: NombreTabla; clave: string; datos: Record<string, unknown> }[] = []

  for (const tabla of TABLAS) {
    const filas = await db.table(tabla).toArray()
    for (const fila of filas) {
      const clave =
        tabla === 'productos' ? (fila as { codigo: string }).codigo : (fila as { id: string }).id
      operaciones.push({ tabla, clave, datos: limpiar(fila as Record<string, unknown>) })
    }
  }

  const TAMANO_LOTE = 400
  for (let i = 0; i < operaciones.length; i += TAMANO_LOTE) {
    const lote = writeBatch(firestore)
    for (const { tabla, clave, datos } of operaciones.slice(i, i + TAMANO_LOTE)) {
      lote.set(doc(firestore, 'negocios', ID_NEGOCIO, tabla, clave), datos)
    }
    await lote.commit().catch((e) => console.warn('No se pudo subir un lote de datos:', e))
  }
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
              await db.table(tabla).delete(cambio.doc.id)
            } else {
              await db.table(tabla).put({ ...cambio.doc.data() })
            }
          }
          if (tabla === 'usuarios') await actualizarPerfilPropio()
        }).catch((e) => console.warn(`Error aplicando cambios remotos de ${tabla}:`, e))
        fijarEstadoNube({ estado: 'sincronizado', error: null, ultimaRecepcion: Date.now() })
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
  engancharAutor(() => {
    const s = obtenerSesion()
    return s.email && s.perfil ? { email: s.email, nombre: s.perfil.nombre } : null
  })

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
      empujarTodoLocal().catch((e) => console.warn('No se pudo subir el estado inicial:', e))
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
      fijarEstadoNube({ estado: 'desconectado', email: null })
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
