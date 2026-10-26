import type { Movimiento } from '../db/db'
import { plata } from './formato'

/**
 * El mismo egreso del cajón, cargado dos veces.
 *
 * El 23/10 el pago a Dosanto por $37.500 se registró desde Proveedores
 * con la plata del cajón --eso ya lo descuenta del turno-- y después se
 * cargó a mano como egreso en Caja. El cierre lo descontó dos veces.
 *
 * No se frena: dos egresos iguales el mismo día pueden ser de verdad
 * (dos compras de bolsas). Se pregunta, diciendo cuál es el que ya está.
 */

/** Un egreso del cajón de ese día por el mismo monto, si hay. */
export function egresoIgual(
  monto: number,
  fecha: string,
  movimientos: Movimiento[],
): Movimiento | null {
  return (
    movimientos.find(
      (m) => m.tipo === 'EGRESO_CAJA' && m.fecha === fecha && Math.abs(m.monto - monto) < 0.005,
    ) ?? null
  )
}

/** Si el que ya está salió de un pago a proveedor (Proveedores → Registrar pago). */
function esPagoAProveedor(m: Movimiento): boolean {
  return m.categoria === 'PROVEEDORES' && m.concepto.startsWith('Pago a ')
}

/** La pregunta al cargar un egreso en Caja, con el que ya está. */
export function preguntaEgresoRepetido(existente: Movimiento): string {
  if (esPagoAProveedor(existente)) {
    return (
      `Hoy ya salieron ${plata(existente.monto)} del cajón por «${existente.concepto}», ` +
      'cargado desde Proveedores. Si es ese mismo pago, no lo cargues de nuevo: el cierre ya lo descuenta.\n\n' +
      '¿Es otro egreso distinto?'
    )
  }
  return (
    `Hoy ya hay un egreso del cajón de ${plata(existente.monto)}: «${existente.concepto}».\n\n` +
    '¿Es otro distinto?'
  )
}

/** La pregunta al registrar un pago a proveedor con plata del cajón. */
export function preguntaPagoRepetido(existente: Movimiento): string {
  return (
    `Hoy ya hay un egreso del cajón de ${plata(existente.monto)}: «${existente.concepto}».\n\n` +
    'Si es este mismo pago, no lo registres de nuevo: el cierre lo descontaría dos veces. ' +
    '¿Es otro pago distinto?'
  )
}
