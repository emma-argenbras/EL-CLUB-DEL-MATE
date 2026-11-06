import { CODIGO_RECARGO, type Venta } from '../db/db'

/**
 * Los productos que mas salen, para tenerlos a un toque en la caja de la
 * compu (opcion B, 06/11). Cuenta en cuantas ventas aparece cada uno, no
 * cuantas unidades: diez bombillas a un mismo cliente no lo hacen el mas
 * vendido. A igualdad, el de mas unidades.
 *
 * No cuentan los recargos de tarjeta, lo que volvio en un cambio
 * (cantidad negativa) ni lo vendido sin codigo.
 */
export function masVendidos(ventas: Pick<Venta, 'codigo' | 'cantidad'>[], cuantos: number): string[] {
  const cuenta = new Map<string, { veces: number; unidades: number }>()
  for (const v of ventas) {
    if (!v.codigo || v.codigo === CODIGO_RECARGO || v.cantidad <= 0) continue
    const c = cuenta.get(v.codigo) ?? { veces: 0, unidades: 0 }
    c.veces += 1
    c.unidades += v.cantidad
    cuenta.set(v.codigo, c)
  }
  return [...cuenta]
    .sort(([ca, a], [cb, b]) => b.veces - a.veces || b.unidades - a.unidades || ca.localeCompare(cb))
    .slice(0, cuantos)
    .map(([codigo]) => codigo)
}
