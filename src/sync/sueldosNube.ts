import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore/lite'
import { FORMA_DE_LA_FICHA, fichaDesdeDatos, type FichaSueldo } from '../lib/sueldos'
import { ID_NEGOCIO } from './config'
import { obtenerAuth } from './firebase'

/**
 * Los sueldos acordados, en el servidor (19/11).
 *
 * Es la única colección que NO pasa por el motor de sincronización, y es
 * a propósito: el motor baja cada tabla a todos los aparatos, y cuánto
 * cobra cada persona no tiene que estar en el celular de las demás. Acá
 * no hay base local ni ganchos: las pantallas Sueldos y «Mi sueldo» leen
 * y escriben directo contra el servidor.
 *
 * **Y no dejan nada guardado en el aparato.** Se usa la versión liviana de
 * Firestore (`firebase/firestore/lite`), que pide y contesta y nada más:
 * no tiene cache ni cola. La primera versión usaba la de siempre, que
 * guarda en el disco todo lo que lee. Mientras Sueldos la veía solo el
 * dueño, en su aparato, daba igual. Desde que la ve también la encargada
 * y cada persona ve lo suyo, alguna de esas pantallas se va a abrir en la
 * compu del local, que es de todos: lo acordado no puede quedar ahí.
 *
 * El costo: sin conexión no se ve ni se guarda. Es el costo correcto para
 * este dato.
 *
 * Tampoco pasa por el historial compartido, por el mismo motivo: un
 * renglón «cambió el sueldo de 900 a 1.000» lo leería todo el que ve el
 * historial. La historia queda adentro de la ficha (sus acuerdos).
 *
 * Quién puede qué lo decide la regla de `sueldos` en `firestore.rules`:
 * leen los dueños y quien está de encargado, y cada persona su ficha;
 * escribe solo un dueño, y con la versión del formato que corresponde.
 */
const COLECCION = 'sueldos'

/** Cuánto se espera al servidor antes de decir que no contesta. */
const ESPERA = 12000

let liviana: Firestore | null = null

function base(): Firestore {
  if (!liviana) {
    // La misma app que el resto: usa la sesión que ya está abierta.
    liviana = getFirestore(obtenerAuth().app)
    if (import.meta.env.VITE_FIREBASE_EMULADOR) connectFirestoreEmulator(liviana, '127.0.0.1', 8080)
  }
  return liviana
}

/** Lo que pasó, en palabras para la pantalla. */
export function mensajeDeSueldos(error: unknown): string {
  const codigo = (error as { code?: unknown } | null)?.code
  if (codigo === 'permission-denied') {
    // Con la regla de sueldos que puede estar en la consola (19/11, solo el
    // dueño), a la encargada y a «Mi sueldo» les toca esto. Nadie va a
    // pegar reglas a mano (decisión del 19/11): el mensaje no lo pide.
    return 'El servidor no deja ver lo acordado con tu cuenta: hoy lo ve solo un dueño.'
  }
  if (codigo === 'sin-respuesta' || codigo === 'unavailable' || codigo === 'deadline-exceeded') {
    return 'No hay conexión con el servidor. Lo acordado no se guarda en este aparato, así que sin conexión no se puede ver ni cambiar. Probá de nuevo en un rato.'
  }
  return error instanceof Error ? error.message : String(error)
}

function conLimite<T>(pedido: Promise<T>): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(Object.assign(new Error('sin respuesta'), { code: 'sin-respuesta' })), ESPERA)
  })
  return Promise.race([pedido, limite]).finally(() => clearTimeout(reloj))
}

async function pedir<T>(pedido: () => Promise<T>): Promise<T> {
  try {
    return await conLimite(pedido())
  } catch (error) {
    console.warn('Sueldos: el servidor no lo aceptó o no contestó:', error)
    throw new Error(mensajeDeSueldos(error))
  }
}

/** Todas las fichas. Solo para quien el servidor deja: dueños y encargada. */
export function leerFichasDeSueldo(): Promise<FichaSueldo[]> {
  return pedir(async () => {
    const todas = await getDocs(collection(base(), 'negocios', ID_NEGOCIO, COLECCION))
    return todas.docs.map((d) => fichaDesdeDatos(d.id, d.data()))
  })
}

/** La ficha de UNA persona (para «Mi sueldo», la propia). null si todavía no tiene. */
export function leerFichaDeSueldo(id: string): Promise<FichaSueldo | null> {
  return pedir(async () => {
    const ficha = await getDoc(doc(base(), 'negocios', ID_NEGOCIO, COLECCION, id))
    return ficha.exists() ? fichaDesdeDatos(ficha.id, ficha.data()) : null
  })
}

/**
 * Guarda la ficha entera. Vuelve cuando el servidor la aceptó; si no, tira
 * con el motivo. Va con la versión del formato, que la regla exige: es lo
 * que impide que una versión vieja de la app pise la ficha.
 */
export function guardarFichaDeSueldo(ficha: FichaSueldo): Promise<void> {
  return pedir(() =>
    setDoc(doc(base(), 'negocios', ID_NEGOCIO, COLECCION, ficha.id), { ...ficha, forma: FORMA_DE_LA_FICHA }),
  )
}
