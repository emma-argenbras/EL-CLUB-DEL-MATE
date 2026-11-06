import { conMotivo, db, nuevoId, tipoSegunCuenta, type CuentaDePago, type Movimiento, type Vencimiento } from './db'
import { nombreDelMes } from '../lib/vencimientos'

/**
 * Las escrituras de la agenda de vencimientos (ver lib/vencimientos.ts).
 */

export type DatosVencimiento = Pick<
  Vencimiento,
  'concepto' | 'dia' | 'montoAproximado' | 'categoria' | 'cuenta' | 'esVariable' | 'avisarDiasAntes' | 'notas'
>

export function problemaDelVencimiento(d: DatosVencimiento): string | null {
  if (!d.concepto.trim()) return 'Poné qué se paga: alquiler, luz, contador…'
  if (!Number.isInteger(d.dia) || d.dia < 1 || d.dia > 31) return 'El día del mes va del 1 al 31.'
  if (d.montoAproximado != null && (!Number.isFinite(d.montoAproximado) || d.montoAproximado < 0)) {
    return 'El monto no puede ser negativo.'
  }
  if (!Number.isInteger(d.avisarDiasAntes) || d.avisarDiasAntes < 0 || d.avisarDiasAntes > 15) {
    return 'Avisar entre 0 y 15 días antes.'
  }
  return null
}

/** Alta o edicion. Devuelve el id. */
export async function guardarVencimiento(d: DatosVencimiento, hoy: string, id?: string): Promise<string> {
  const problema = problemaDelVencimiento(d)
  if (problema) throw new Error(problema)
  const limpio = {
    concepto: d.concepto.trim(),
    dia: d.dia,
    montoAproximado: d.montoAproximado ?? null,
    categoria: d.categoria,
    cuenta: d.cuenta,
    esVariable: d.esVariable,
    avisarDiasAntes: d.avisarDiasAntes,
    notas: d.notas?.trim() || null,
  }
  if (id) {
    await db.vencimientos.update(id, limpio)
    return id
  }
  const nuevo = nuevoId()
  await db.vencimientos.add({ id: nuevo, ...limpio, desde: hoy, activo: true })
  return nuevo
}

/** Sacarlo de la agenda sin borrar sus pagos (que son gastos). */
export async function archivarVencimiento(id: string, activo: boolean): Promise<void> {
  await db.vencimientos.update(id, { activo })
}

export function conceptoDelPago(v: Pick<Vencimiento, 'concepto'>, periodo: string, hoy: string): string {
  return `${v.concepto} (${nombreDelMes(periodo, hoy)})`
}

/**
 * Lo marca pagado cargando el gasto, con su categoria y su cuenta, y
 * enganchado al mes que paga. Si sale del cajon, va contra el turno
 * abierto (el cierre lo descuenta solo), como el pago a un proveedor.
 */
export async function marcarPagado(
  v: Vencimiento,
  periodo: string,
  pago: { fecha: string; monto: number; cuenta: CuentaDePago; jornadaId: string | null; hoy: string },
): Promise<string> {
  if (!(pago.monto > 0)) throw new Error('Poné cuánto se pagó.')
  if (pago.cuenta === 'cajon' && !pago.jornadaId) {
    throw new Error('No hay ningún turno abierto, así que la plata no puede salir del cajón.')
  }
  const id = nuevoId()
  const movimiento: Movimiento = {
    id,
    fecha: pago.fecha,
    tipo: tipoSegunCuenta(pago.cuenta),
    cuenta: pago.cuenta,
    concepto: conceptoDelPago(v, periodo, pago.hoy),
    monto: Math.round(pago.monto * 100) / 100,
    categoria: v.categoria,
    jornadaId: pago.cuenta === 'cajon' ? pago.jornadaId : null,
    esVariable: v.esVariable,
    vencimiento: { id: v.id, periodo },
  }
  await conMotivo(`Pago de ${conceptoDelPago(v, periodo, pago.hoy)}, desde Vencimientos`, () =>
    db.movimientos.add(movimiento),
  )
  return id
}

/** Ya estaba cargado a mano en Gastos: se engancha ese, no se carga otro. */
export async function engancharGasto(movimientoId: string, v: Vencimiento, periodo: string, hoy: string): Promise<void> {
  const m = await db.movimientos.get(movimientoId)
  if (!m) throw new Error('Ese gasto ya no está.')
  if (m.vencimiento) throw new Error('Ese gasto ya es el pago de otro vencimiento.')
  await conMotivo(`Es el pago de ${conceptoDelPago(v, periodo, hoy)}`, () =>
    db.movimientos.update(movimientoId, { vencimiento: { id: v.id, periodo } }),
  )
}
