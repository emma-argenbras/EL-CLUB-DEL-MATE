import type { Venta } from '../db/db'
import type { CompraDeProducto } from '../db/ingresoMercaderia'
import { sumarDias } from './tablero'

/**
 * Las cuentas de la ficha del producto en la compu (opcion B, 06/11):
 * cuanto se vendio, para cuanto alcanza lo que hay y cuanto subio el costo.
 */

export interface VentasDelProducto {
  /** Unidades vendidas en los ultimos 30 dias, hoy incluido, menos lo que volvio en un cambio. */
  vendidos30: number
  /** La venta mas nueva (no cuenta lo que volvio en un cambio). */
  ultima: { fecha: string; hora: string } | null
}

export function ventasDelProducto(ventas: Pick<Venta, 'fecha' | 'hora' | 'cantidad'>[], hoy: string): VentasDelProducto {
  const desde = sumarDias(hoy, -29)
  let vendidos30 = 0
  let ultima: VentasDelProducto['ultima'] = null
  for (const v of ventas) {
    if (v.fecha >= desde && v.fecha <= hoy) vendidos30 += v.cantidad
    if (v.cantidad > 0 && (!ultima || `${v.fecha} ${v.hora}` > `${ultima.fecha} ${ultima.hora}`)) {
      ultima = { fecha: v.fecha, hora: v.hora }
    }
  }
  return { vendidos30: Math.max(0, vendidos30), ultima }
}

/** Para cuanto alcanza el stock al ritmo de los ultimos 30 dias. null si no lleva stock. */
export function alcanzaPara(stock: number | null | undefined, vendidos30: number): string | null {
  if (stock === null || stock === undefined) return null
  if (stock <= 0) return 'No queda'
  if (vendidos30 <= 0) return 'Sin ventas en 30 días'
  const dias = stock / (vendidos30 / 30)
  if (dias < 7) {
    const n = Math.max(1, Math.round(dias))
    return n === 1 ? 'Un día' : `Unos ${n} días`
  }
  if (dias < 60) {
    const n = Math.round(dias / 7)
    return n === 1 ? 'Una semana' : `Unas ${n} semanas`
  }
  return 'Más de dos meses'
}

/**
 * Cuanto cambio el costo entre la compra mas vieja y la mas nueva (con el
 * flete, si lo tiene). null con menos de dos compras.
 */
export function variacionDelCosto(compras: CompraDeProducto[]): { pct: number; desde: string } | null {
  if (compras.length < 2) return null
  const orden = [...compras].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const costo = (c: CompraDeProducto) => c.costoConFlete ?? c.costoUnitario
  const primera = orden[0]
  const ultima = orden[orden.length - 1]
  if (!(costo(primera) > 0)) return null
  return { pct: Math.round(((costo(ultima) - costo(primera)) / costo(primera)) * 100), desde: primera.fecha }
}
