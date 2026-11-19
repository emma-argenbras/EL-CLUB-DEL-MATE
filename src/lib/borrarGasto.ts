import type { CategoriaGasto, Jornada, Movimiento } from '../db/db'
import { fechaLinda } from './formato'
import { nombreTurno } from './turnoSegunHora'

/**
 * Dos reglas de la pantalla de Gastos que salieron de la auditoria del
 * 19/11. Van aca, sueltas de la pantalla, para poder probarlas.
 */

/** Gastos que suelen ser fijos: no cambian con cuanto se vende. */
export const FIJOS_POR_DEFECTO: CategoriaGasto[] = [
  'ALQUILER',
  'SERVICIOS',
  'SUELDOS',
  'CONTADOR',
  'IMPUESTOS',
  'MANTENIMIENTO',
]

/**
 * Si un gasto de esa categoria arranca como variable.
 *
 * El formulario abria con PROVEEDORES elegido y «Fijo» marcado: la
 * sugerencia solo se aplicaba al CAMBIAR de categoria, y la que venia
 * puesta nunca se cambiaba. Un pago a proveedor cargado desde Gastos
 * quedaba fijo, y el mismo pago cargado desde Proveedores, variable: el
 * margen de contribucion del mes dependia de por donde se cargaba.
 */
export function esVariablePorDefecto(categoria: CategoriaGasto): boolean {
  return !FIJOS_POR_DEFECTO.includes(categoria)
}

export type PermisoParaBorrar =
  | { puede: true; aviso: string | null }
  | { puede: false; porQue: string }

/**
 * Si se puede borrar un gasto desde la lista de Gastos, y que hay que
 * avisar antes.
 *
 * Un gasto que salio de la caja de un turno es parte de la cuenta de ese
 * turno: cuanto efectivo tenia que haber al cerrar. En la Caja, un turno
 * cerrado no deja borrar nada. Desde Gastos se podia igual, cualquiera
 * con la seccion, y el arqueo de un turno ya cerrado y revisado dejaba
 * de coincidir sin que nadie se enterara.
 *
 * - Sin turno, o con el turno abierto: se borra como siempre.
 * - Turno cerrado: solo quien esta al mando, y sabiendo que mueve el
 *   arqueo.
 * - Con turno pero sin poder verlo en este aparato: se trata como
 *   cerrado. No se puede afirmar que este abierto.
 */
export function permisoParaBorrarGasto(
  movimiento: Pick<Movimiento, 'jornadaId'>,
  turno: Pick<Jornada, 'estado' | 'fecha' | 'turno'> | undefined,
  alMando: boolean,
): PermisoParaBorrar {
  if (!movimiento.jornadaId) return { puede: true, aviso: null }
  if (turno?.estado === 'abierto') return { puede: true, aviso: null }
  if (!alMando) {
    return { puede: false, porQue: 'Es de un turno cerrado: lo borra quien está al mando.' }
  }
  const cual = turno ? `del turno ${nombreTurno(turno.turno)} del ${fechaLinda(turno.fecha)}` : 'de un turno'
  return {
    puede: true,
    aviso: `Salió de la caja ${cual}, que ya está cerrado. Si lo borrás, cambia el efectivo que ese turno tenía que tener y su arqueo deja de coincidir.`,
  }
}
