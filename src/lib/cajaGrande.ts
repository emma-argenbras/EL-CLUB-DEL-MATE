import type { ArqueoCuenta, CuentaDePago, Movimiento, Venta } from '../db/db'

/**
 * El saldo de la caja grande (punto 13 del pedido del 06/11: «la grande
 * ¿donde se ve? no la encontramos»).
 *
 * La app anotaba lo que entraba y salia de la caja grande --pases desde
 * el cajon, gastos pagados con ella, ingresos-- pero nunca calculo
 * cuanto habia. Para calcularlo hace falta un punto de partida que solo
 * da un conteo: el saldo es lo ultimo que se conto, mas lo que entro y
 * menos lo que salio despues.
 *
 * Sirve igual para cualquier cuenta (banco, Mercado Pago): por ahora la
 * pantalla es la de la caja grande.
 */

/** Cuanto mueve un movimiento en esa cuenta: positivo entra, negativo sale, 0 no la toca. */
export function efectoEnCuenta(cuenta: CuentaDePago, m: Movimiento): number {
  switch (m.tipo) {
    case 'A_CAJA_GRANDE':
      return cuenta === 'cajaGrande' ? m.monto : cuenta === 'cajon' ? -m.monto : 0
    case 'INGRESO_CAJA_GRANDE':
      return (m.cuenta ?? 'cajaGrande') === cuenta ? m.monto : 0
    case 'GASTO_CAJA_GRANDE':
      // Los anteriores al 21/10 no dicen de que cuenta salieron: el tipo
      // dice caja grande, y desde el primer conteo en adelante todos la
      // traen.
      return (m.cuenta ?? 'cajaGrande') === cuenta ? -m.monto : 0
    case 'PASE_ENTRE_CUENTAS':
      if (m.cuenta === cuenta) return -m.monto
      if (m.cuentaDestino === cuenta) return m.monto
      return 0
    case 'EGRESO_CAJA':
      return cuenta === 'cajon' ? -m.monto : 0
    default:
      return 0
  }
}

/** Si el movimiento se cargo despues de ese conteo. */
export function esPosteriorAlConteo(m: Pick<Movimiento, 'fecha' | 'creadoEn'>, conteo: Pick<ArqueoCuenta, 'fecha' | 'cuando'>): boolean {
  if (typeof m.creadoEn === 'number') return m.creadoEn > conteo.cuando
  return m.fecha > conteo.fecha
}

export interface SaldoDeCuenta {
  /** null mientras nunca se conto: no hay de donde partir. */
  saldo: number | null
  ultimoConteo: ArqueoCuenta | null
  /** Lo que la movio desde el ultimo conteo, con su efecto, lo mas nuevo primero. */
  movimientos: { movimiento: Movimiento; efecto: number }[]
}

export function saldoDeCuenta(
  cuenta: CuentaDePago,
  conteos: ArqueoCuenta[],
  movimientos: Movimiento[],
): SaldoDeCuenta {
  const ultimoConteo =
    conteos.filter((c) => c.cuenta === cuenta).sort((a, b) => b.cuando - a.cuando).at(0) ?? null
  if (!ultimoConteo) return { saldo: null, ultimoConteo: null, movimientos: [] }
  const desde = movimientos
    .filter((m) => esPosteriorAlConteo(m, ultimoConteo))
    .map((m) => ({ movimiento: m, efecto: efectoEnCuenta(cuenta, m) }))
    .filter((x) => x.efecto !== 0)
    .sort((a, b) => (b.movimiento.creadoEn ?? 0) - (a.movimiento.creadoEn ?? 0) || b.movimiento.fecha.localeCompare(a.movimiento.fecha))
  const saldo = Math.round((ultimoConteo.contado + desde.reduce((s, x) => s + x.efecto, 0)) * 100) / 100
  return { saldo, ultimoConteo, movimientos: desde }
}

/** La caja virtual: lo cobrado que no es efectivo, por medio de pago. */
export function cajaVirtual(ventas: Pick<Venta, 'medioPago' | 'total'>[]): { medio: Venta['medioPago']; total: number }[] {
  const porMedio = new Map<Venta['medioPago'], number>()
  for (const v of ventas) {
    if (v.medioPago === 'EFECTIVO') continue
    porMedio.set(v.medioPago, (porMedio.get(v.medioPago) ?? 0) + v.total)
  }
  return [...porMedio.entries()]
    .map(([medio, total]) => ({ medio, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}
