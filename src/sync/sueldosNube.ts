import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { fichaDesdeDatos, type FichaSueldo } from '../lib/sueldos'
import { ID_NEGOCIO } from './config'
import { obtenerFirestore } from './firebase'

/**
 * Los sueldos acordados, en el servidor (19/11).
 *
 * Es la única colección que NO pasa por el motor de sincronización, y es
 * a propósito: el motor baja cada tabla a todos los aparatos, y cuánto
 * cobra cada persona no tiene que estar en el celular de las demás. Acá
 * no hay base local ni ganchos: la pantalla Sueldos, que ve solo el
 * dueño, lee y escribe directo contra el servidor. La cache de Firestore
 * alcanza para verla sin internet en el aparato del dueño.
 *
 * Tampoco pasa por el historial compartido, por el mismo motivo: un
 * renglón «cambió el sueldo de 900 a 1.000» lo leería todo el que ve el
 * historial. La historia queda adentro de la ficha (sus acuerdos).
 *
 * En `firestore.rules` la colección `sueldos` es solo del dueño. Mientras
 * esas reglas no estén publicadas en la consola, lo único que la protege
 * es que la app no la muestra ni la baja a nadie más.
 */
const COLECCION = 'sueldos'

/** Cuánto se espera la respuesta del servidor antes de decir «quedó en cola». */
const ESPERA_DE_LA_SUBIDA = 8000

function comoMensaje(error: unknown): string {
  const codigo = (error as { code?: unknown } | null)?.code
  if (codigo === 'permission-denied') {
    return 'El servidor no deja ver ni cambiar los sueldos con esta cuenta: es solo para el dueño.'
  }
  return error instanceof Error ? error.message : String(error)
}

/** Avisa las fichas cada vez que cambian. Devuelve cómo dejar de escuchar. */
export function escucharFichasDeSueldo(
  alCambiar: (fichas: FichaSueldo[], confirmadoPorElServidor: boolean) => void,
  alFallar: (mensaje: string) => void,
): () => void {
  return onSnapshot(
    collection(obtenerFirestore(), 'negocios', ID_NEGOCIO, COLECCION),
    (instantanea) =>
      alCambiar(
        instantanea.docs.map((d) => fichaDesdeDatos(d.id, d.data())),
        !instantanea.metadata.fromCache,
      ),
    (error) => {
      console.warn('No se pudieron leer los sueldos:', error)
      alFallar(comoMensaje(error))
    },
  )
}

/**
 * Guarda la ficha entera. 'guardado' es que el servidor la aceptó;
 * 'en-cola', que no contestó a tiempo (sin internet): queda en este
 * aparato y sube sola. Si el servidor la rechaza, tira; si la rechaza
 * tarde, cuando ya se dijo «en cola», avisa por `alRechazarTarde`.
 */
export async function guardarFichaDeSueldo(
  ficha: FichaSueldo,
  alRechazarTarde: (mensaje: string) => void,
): Promise<'guardado' | 'en-cola'> {
  const referencia = doc(obtenerFirestore(), 'negocios', ID_NEGOCIO, COLECCION, ficha.id)
  let enCola = false
  const subida = setDoc(referencia, { ...ficha }).then(
    () => 'guardado' as const,
    (error: unknown) => {
      if (enCola) {
        alRechazarTarde(comoMensaje(error))
        return 'en-cola' as const
      }
      throw new Error(comoMensaje(error))
    },
  )
  let reloj: ReturnType<typeof setTimeout> | undefined
  const espera = new Promise<'en-cola'>((resolver) => {
    reloj = setTimeout(() => {
      enCola = true
      resolver('en-cola')
    }, ESPERA_DE_LA_SUBIDA)
  })
  return Promise.race([subida, espera]).finally(() => clearTimeout(reloj))
}
