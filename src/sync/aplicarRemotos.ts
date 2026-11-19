import { comoRemoto, db, type NombreTabla } from '../db/db'
import { aClaveLocal } from './claves'

/**
 * Guardar en este dispositivo lo que llega del servidor.
 *
 * Vive aparte del motor para poder probarlo sin Firebase: es la mitad
 * de la sincronización que nunca tuvo pruebas, y la que explica por qué
 * un dispositivo puede quedar con datos viejos sin que nadie se entere.
 *
 * Hasta el 22/10 los cambios de un snapshot se guardaban en un solo
 * recorrido, y el primero que fallaba cortaba el recorrido entero: todo
 * lo que venía después en ese snapshot no se guardaba. Al abrir la app
 * el primer snapshot trae la colección completa --miles de productos,
 * en orden de código--, así que un solo documento malo dejaba atrasados
 * a todos los que venían detrás, en cada arranque, con un console.warn
 * como única señal. Es la explicación más probable de que la copia de
 * Sandra tuviera vacíos datos que el servidor sí tenía.
 *
 * Ahora cada cambio va por su cuenta: el que falla se anota y el resto
 * se guarda igual.
 *
 * Y se guardan marcados como remotos en transacciones propias (19/11,
 * ver comoRemoto en db/db.ts): no vuelven a subir ni dejan historial,
 * y lo que la persona cargue mientras dura el recorrido --al abrir la
 * app es la tabla entera-- sigue siendo suyo.
 *
 * Van en tandas (ver TANDA). La primera version de ese arreglo abria
 * una transaccion por documento, y con la tabla entera eran miles: en
 * la prueba con 3.000 ventas, la primera sincronizacion pasaba de 130 s
 * a 180 s. En tandas de 200 son 10 s.
 */

/**
 * Cuantos documentos se guardan en una misma transaccion. Al abrir la app
 * llega cada tabla entera: de a uno eran miles de transacciones. Es un
 * numero chico a proposito: mientras dura una tanda, lo que la persona
 * quiera escribir en esa tabla espera a que termine.
 */
export const TANDA = 200

export interface CambioRemoto {
  tipo: 'added' | 'modified' | 'removed'
  /** El nombre del documento en el servidor (escapado si la clave tenía barra). */
  id: string
  datos: Record<string, unknown> | null
  /** El eco de una escritura de este mismo dispositivo, todavía sin confirmar. */
  pendiente: boolean
}

export interface FalloAlRecibir {
  id: string
  error: string
}

export async function aplicarCambiosRemotos(
  tabla: NombreTabla,
  cambios: CambioRemoto[],
  /** Un 'removed' que es la reversión de un rechazo propio, no un borrado. */
  esReversionDeRechazo: (id: string) => boolean,
  /** Llega el dato bueno: el rechazo de esa clave ya no hace falta recordarlo. */
  alRecibir: (id: string) => void,
): Promise<FalloAlRecibir[]> {
  const fallos: FalloAlRecibir[] = []
  const t = db.table(tabla)
  const anotarFallo = (cambio: CambioRemoto, e: unknown) =>
    fallos.push({ id: cambio.id, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) })

  /** Guarda un cambio. Va adentro de una transaccion remota (ver comoRemoto). */
  const guardar = async (cambio: CambioRemoto) => {
    if (cambio.tipo === 'removed') {
      // El id viene escapado si la clave tenia barra: se desescapa
      // para borrar la fila local correcta.
      await t.delete(aClaveLocal(cambio.id))
    } else {
      await t.put({ ...cambio.datos })
    }
  }

  // Lo que de verdad hay que guardar, en el orden en que llego.
  const paraGuardar: CambioRemoto[] = []
  for (const cambio of cambios) {
    // Un cambio "pendiente" es el eco de una escritura que salio de
    // este mismo dispositivo. Un alta pendiente ya esta en la base local
    // tal cual (de ahi salio): reescribirla es trabajo de mas, y con
    // miles de filas es lo que saturaba la app en el primer login real.
    //
    // Una modificacion pendiente es distinta desde el 31/10: las
    // ediciones mandan solo los campos que cambiaron, asi que lo que
    // Firestore muestra mientras espera la confirmacion es lo del
    // servidor con lo nuestro encima, y puede traer campos que otro
    // dispositivo cambio mientras este estaba sin señal. Si se saltea,
    // y despues la confirmacion no cambia el contenido, no llega ningun
    // otro aviso: el celular se quedaria con el precio viejo hasta
    // recargar la app (paso en la prueba contra los emuladores).
    if (cambio.pendiente && cambio.tipo !== 'modified') continue
    // Un 'removed' puede ser dos cosas muy distintas: alguien borro
    // el dato de verdad, o el servidor rechazo una escritura de ESTE
    // dispositivo y Firestore esta revirtiendo su cache. En el
    // segundo caso, borrar la fila local es destruir lo que la
    // persona acaba de cargar por un problema de permisos. Ante la
    // duda no se borra.
    if (cambio.tipo === 'removed' && esReversionDeRechazo(cambio.id)) continue
    if (cambio.tipo !== 'removed') alRecibir(cambio.id)
    paraGuardar.push(cambio)
  }

  for (let i = 0; i < paraGuardar.length; i += TANDA) {
    const tanda = paraGuardar.slice(i, i + TANDA)
    const fallosDeLaTanda: [CambioRemoto, unknown][] = []
    try {
      // La tanda entera en UNA transaccion remota: abrir una por
      // documento era lo que hacia lento el arranque. Cada cambio sigue
      // por su cuenta: el que falla se anota y los demas se guardan.
      await comoRemoto(t, async () => {
        for (const cambio of tanda) {
          try {
            await guardar(cambio)
          } catch (e) {
            fallosDeLaTanda.push([cambio, e])
          }
        }
      })
      for (const [cambio, e] of fallosDeLaTanda) anotarFallo(cambio, e)
    } catch {
      // La transaccion no llego a cerrar (uno malo la tiro abajo, o el
      // navegador la corto): no quedo nada de la tanda. Se guarda de a
      // uno, cada cual en su transaccion, como se hizo siempre.
      for (const cambio of tanda) {
        try {
          await comoRemoto(t, () => guardar(cambio))
        } catch (e) {
          anotarFallo(cambio, e)
        }
      }
    }
  }
  return fallos
}
