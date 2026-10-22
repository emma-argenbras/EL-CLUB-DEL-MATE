import { db, type NombreTabla } from '../db/db'
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
 */

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
  for (const cambio of cambios) {
    // Un cambio "pendiente" es el eco de una escritura que salio de
    // este mismo dispositivo: el dato ya esta en la base local (de ahi
    // salio), asi que reescribirlo es trabajo de mas — y con miles de
    // filas, es lo que saturaba la app en el primer login real.
    if (cambio.pendiente) continue
    try {
      if (cambio.tipo === 'removed') {
        // Un 'removed' puede ser dos cosas muy distintas: alguien borro
        // el dato de verdad, o el servidor rechazo una escritura de ESTE
        // dispositivo y Firestore esta revirtiendo su cache. En el
        // segundo caso, borrar la fila local es destruir lo que la
        // persona acaba de cargar por un problema de permisos. Ante la
        // duda no se borra.
        if (esReversionDeRechazo(cambio.id)) continue
        // El id viene escapado si la clave tenia barra: se desescapa
        // para borrar la fila local correcta.
        await db.table(tabla).delete(aClaveLocal(cambio.id))
      } else {
        alRecibir(cambio.id)
        await db.table(tabla).put({ ...cambio.datos })
      }
    } catch (e) {
      fallos.push({ id: cambio.id, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) })
    }
  }
  return fallos
}
