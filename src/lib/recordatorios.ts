import { db } from '../db/db'
import { hoyISO } from './formato'
import type { Hallazgo } from './auditoria'

/**
 * Recordatorios del navegador.
 *
 * Aviso honesto sobre el alcance: son notificaciones LOCALES. Aparecen
 * mientras la app esta abierta (aunque sea en otra pestaña o minimizada).
 * Para que llegaran con la app cerrada haria falta un servidor de push,
 * que este proyecto no tiene: la app funciona sola, sin backend propio.
 *
 * Con la app instalada en la computadora del local —que es como se usa
 * todo el dia— alcanza para lo que hace falta: recordar cerrar la caja,
 * avisar de un producto que se vende a perdida, etc.
 */

const CLAVE_AVISADO = 'recordatorio_avisado_'

export type PermisoRecordatorios = 'no-soportado' | 'default' | 'granted' | 'denied'

export function estadoPermiso(): PermisoRecordatorios {
  if (typeof Notification === 'undefined') return 'no-soportado'
  return Notification.permission as PermisoRecordatorios
}

/** Pide permiso para avisar. Solo tiene efecto si lo toca la persona. */
export async function pedirPermiso(): Promise<PermisoRecordatorios> {
  if (typeof Notification === 'undefined') return 'no-soportado'
  try {
    return (await Notification.requestPermission()) as PermisoRecordatorios
  } catch {
    return 'denied'
  }
}

/**
 * Avisa una sola vez por dia de cada hallazgo urgente. Si ya se avisó
 * hoy, no vuelve a molestar: un recordatorio que se repite cada vez que
 * se abre la app deja de leerse a los dos dias.
 */
export async function recordarUrgentes(hallazgos: Hallazgo[]): Promise<number> {
  if (estadoPermiso() !== 'granted') return 0

  const urgentes = hallazgos.filter((h) => h.nivel === 'critico')
  let avisados = 0

  for (const hallazgo of urgentes) {
    const clave = `${CLAVE_AVISADO}${hallazgo.id}`
    const ultimo = await db.ajustes.get(clave)
    if (ultimo?.valor === hoyISO()) continue

    try {
      new Notification('El Club del Mate', {
        body: `${hallazgo.titulo}. ${hallazgo.comoSeResuelve}`,
        icon: 'icono-192.png',
        tag: hallazgo.id,
      })
      await db.ajustes.put({ clave, valor: hoyISO() })
      avisados++
    } catch {
      // Si el navegador no deja mostrarla, no se rompe nada: el aviso
      // sigue estando en el Panel y en la campana.
      return avisados
    }
  }

  return avisados
}
