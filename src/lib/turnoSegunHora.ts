import type { Turno } from '../db/db'
import { fechaLinda } from './formato'

/**
 * Qué turno corresponde según la hora, y la pregunta antes de abrir el
 * que no corresponde.
 *
 * El 23/10 a las 9:13 se abrió el turno TARDE. La pantalla de Caja
 * elegía mañana o tarde por la hora, pero solo en el momento de abrirse:
 * la PC del local deja la app abierta de un día para el otro, así que a
 * la mañana seguía mostrando el turno de la tarde anterior, y abrirlo
 * era un toque.
 *
 * Se usa la hora del dispositivo, igual que la fecha y la hora que se
 * guardan en el turno: si se usara otra, las dos podrían no coincidir.
 */

/** Antes de esta hora es el turno de la mañana. */
export const HORA_CAMBIO_DE_TURNO = 14

export function turnoSegunHora(ahora: Date): Turno {
  return ahora.getHours() < HORA_CAMBIO_DE_TURNO ? 'M' : 'T'
}

export function nombreTurno(turno: Turno): string {
  return turno === 'M' ? 'MAÑANA' : 'TARDE'
}

function isoDe(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** "9:13", "17:05": como se dice la hora en los avisos. */
export function horaDe(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * La pregunta antes de abrir un turno que no es el de ahora, o null si
 * es el que corresponde.
 *
 * Un turno de otro día también pregunta: a veces es a propósito (cargar
 * uno que quedó sin cargar), pero casi siempre es la pantalla que quedó
 * en el día anterior.
 */
export function preguntaAlAbrirTurno(fecha: string, turno: Turno, ahora: Date): string | null {
  const hoy = isoDe(ahora)
  if (fecha !== hoy) {
    return (
      `Estás abriendo un turno del ${fechaLinda(fecha)}, y hoy es ${fechaLinda(hoy)}.\n\n` +
      '¿Seguro que es ese día?'
    )
  }
  if (turno !== turnoSegunHora(ahora)) {
    return `Son las ${horaDe(ahora)} y estás abriendo el turno ${nombreTurno(turno)}.\n\n¿Seguro?`
  }
  return null
}
