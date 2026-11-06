import type { MedioPago } from '../db/db'

/**
 * Las tarjetas y sus planes (punto 7 del pedido del 06/11).
 *
 * Los recargos de Consumax y Club del Este son los que dio Emmanuel el
 * 06/11: 5 % en un pago y 15 % en tres. Las tarjetas bancarias van sin
 * recargo. Por ahora la lista vive aca; cuando Sandra junte los datos de
 * las liquidaciones (que se queda el procesador, en cuantos dias se
 * acredita), pasa a una pantalla para editarla.
 *
 * Ojo legal, anotado en el plan del 06/11: la ley 25.065 pide no hacer
 * diferencias de precio entre contado y tarjeta de credito. Como se
 * presenta el recargo lo decide Emmanuel con el contador.
 */
export interface PlanTarjeta {
  id: string
  tarjeta: string
  nombre: string
  medio: Extract<MedioPago, 'CREDITO' | 'DEBITO'>
  cuotas: number
  recargoPct: number
}

export const PLANES_TARJETA: PlanTarjeta[] = [
  { id: 'debito', tarjeta: 'Débito', nombre: 'débito', medio: 'DEBITO', cuotas: 1, recargoPct: 0 },
  { id: 'credito-1', tarjeta: 'Crédito bancaria', nombre: '1 pago', medio: 'CREDITO', cuotas: 1, recargoPct: 0 },
  { id: 'consumax-1', tarjeta: 'Consumax', nombre: '1 pago', medio: 'CREDITO', cuotas: 1, recargoPct: 5 },
  { id: 'consumax-3', tarjeta: 'Consumax', nombre: '3 pagos', medio: 'CREDITO', cuotas: 3, recargoPct: 15 },
  { id: 'club-del-este-1', tarjeta: 'Club del Este', nombre: '1 pago', medio: 'CREDITO', cuotas: 1, recargoPct: 5 },
  { id: 'club-del-este-3', tarjeta: 'Club del Este', nombre: '3 pagos', medio: 'CREDITO', cuotas: 3, recargoPct: 15 },
]

export function planPorId(id: string | null | undefined): PlanTarjeta | null {
  return PLANES_TARJETA.find((p) => p.id === id) ?? null
}

export function planesDe(medio: MedioPago): PlanTarjeta[] {
  return PLANES_TARJETA.filter((p) => p.medio === medio)
}

/**
 * El plan que queda puesto al elegir un medio: el debito tiene uno solo;
 * la credito no tiene ninguno, para que se elija la tarjeta en cada venta
 * y no se pase un recargo por olvido.
 */
export function planAlElegirMedio(medio: MedioPago): string | null {
  const planes = planesDe(medio)
  return planes.length === 1 ? planes[0].id : null
}

/** El recargo de pagar ese monto con ese plan, redondeado al peso. */
export function recargoDe(monto: number, plan: PlanTarjeta | null): number {
  if (!plan || plan.recargoPct <= 0) return 0
  return Math.round((monto * plan.recargoPct) / 100)
}

export function nombreDelPlan(plan: PlanTarjeta): string {
  return plan.medio === 'DEBITO' ? 'Débito' : `${plan.tarjeta} ${plan.nombre}`
}
