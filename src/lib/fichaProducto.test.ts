import { describe, expect, it } from 'vitest'
import type { CompraDeProducto } from '../db/ingresoMercaderia'
import { alcanzaPara, variacionDelCosto, ventasDelProducto } from './fichaProducto'

const v = (fecha: string, cantidad = 1, hora = '11:00') => ({ fecha, hora, cantidad })
const compra = (fecha: string, costoUnitario: number, costoConFlete: number | null = null): CompraDeProducto => ({
  fecha, proveedorId: 'p', cantidad: 3, costoUnitario, costoConFlete, comprobante: null,
})

describe('las ventas del producto', () => {
  it('30 días con hoy incluido, menos lo que volvió; la última venta sin contar devoluciones', () => {
    const r = ventasDelProducto(
      [
        v('2026-11-06', 2, '10:00'),
        v('2026-11-06', 1, '17:42'),
        v('2026-11-06', -1, '18:00'), // volvió en un cambio
        v('2026-10-08', 4), // el día 30 contando hoy
        v('2026-10-07', 9), // el 31: ya no
      ],
      '2026-11-06',
    )
    expect(r.vendidos30).toBe(6)
    expect(r.ultima).toEqual({ fecha: '2026-11-06', hora: '17:42' })
  })

  it('sin ventas: cero y nada; si solo volvió algo, cero y no negativo', () => {
    expect(ventasDelProducto([], '2026-11-06')).toEqual({ vendidos30: 0, ultima: null })
    expect(ventasDelProducto([v('2026-11-05', -2)], '2026-11-06')).toEqual({ vendidos30: 0, ultima: null })
  })
})

describe('para cuánto alcanza', () => {
  it('días, semanas o meses, al ritmo de los últimos 30 días', () => {
    expect(alcanzaPara(null, 5)).toBeNull()
    expect(alcanzaPara(0, 5)).toBe('No queda')
    expect(alcanzaPara(4, 0)).toBe('Sin ventas en 30 días')
    expect(alcanzaPara(1, 30)).toBe('Un día')
    expect(alcanzaPara(5, 30)).toBe('Unos 5 días')
    expect(alcanzaPara(4, 6)).toBe('Unas 3 semanas') // 20 días
    expect(alcanzaPara(7, 30)).toBe('Una semana')
    expect(alcanzaPara(60, 30)).toBe('Más de dos meses')
    // 7 unidades a 48 por mes: 4,4 días (con 31 serían 4,5 y redondearía a 5).
    expect(alcanzaPara(7, 48)).toBe('Unos 4 días')
  })
})

describe('cuánto subió el costo', () => {
  it('de la compra más vieja a la más nueva, con el flete si lo tiene', () => {
    expect(variacionDelCosto([compra('2026-11-06', 9000, 9800), compra('2026-09-02', 7600), compra('2026-10-12', 8200)])).toEqual({
      pct: 29,
      desde: '2026-09-02',
    })
    expect(variacionDelCosto([compra('2026-11-06', 9000)])).toBeNull()
  })
})
