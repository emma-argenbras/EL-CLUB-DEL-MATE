import { describe, expect, it } from 'vitest'
import type { Producto, Venta } from '../db/db'
import {
  comodinesConVentas,
  esComodin,
  problemaDescripcionSuelta,
  ventasSinCodigo,
} from './ventaSinCodigo'

function prod(codigo: string, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion: codigo, proveedor: 'MOHICANO', proveedorId: 'mohicano', fechaCompra: null,
    precioCompra: 1000, rentabilidad: null, precioVenta: 2000, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock: null, activo: true, ...extra,
  }
}

function venta(id: string, codigo: string, fecha: string, hora = '10:00', total = 1000): Venta {
  return {
    id, jornadaId: 'j1', fecha, hora, codigo, descripcion: codigo || 'Bombilla de alpaca',
    cantidad: 1, precioUnitario: total, costoUnitario: null, medioPago: 'EFECTIVO', total, vendedor: null,
  }
}

describe('problemaDescripcionSuelta: que diga que es', () => {
  it('lo que usaba Sandra no alcanza', () => {
    for (const t of ['saldos', 'SALDOS – DE TODO', 'de todo', 'varios', 'DIF', 'diferencia', 'otro producto', 'x']) {
      expect(problemaDescripcionSuelta(t), t).not.toBeNull()
    }
  })

  it('muy corto tampoco', () => {
    expect(problemaDescripcionSuelta('ab')).not.toBeNull()
    expect(problemaDescripcionSuelta('   ')).not.toBeNull()
  })

  it('algo que dice que es, si', () => {
    for (const t of ['Bombilla de alpaca', 'mate torpedo', 'termo stanley', 'yerba suelta 1kg', 'saldo de bombillas']) {
      expect(problemaDescripcionSuelta(t), t).toBeNull()
    }
  })
})

describe('ventasSinCodigo', () => {
  it('trae solo las sin codigo cargadas en la app, de la mas nueva a la mas vieja', () => {
    const lista = ventasSinCodigo([
      venta('a', '', '2026-10-20', '10:00'),
      venta('b', 'TM015', '2026-10-21'),
      venta('c', '', '2026-08-15'),
      venta('d', '', '2026-10-21', '09:00'),
      venta('e', '', '2026-10-21', '18:30'),
    ])
    expect(lista.map((v) => v.id)).toEqual(['e', 'd', 'a'])
  })
})

describe('los productos comodin', () => {
  const SALDOS = prod('SALDOS', { descripcion: 'SALDOS – DE TODO', proveedor: null, proveedorId: null, precioCompra: null, precioVenta: null })
  const DIF = prod('DIF', { descripcion: 'DIF – Diferencia por cambio', proveedor: null, proveedorId: null, precioCompra: null, precioVenta: 0 })

  it('sin proveedor, costo ni precio es comodin; uno que tiene algo de eso, no', () => {
    expect(esComodin(SALDOS)).toBe(true)
    expect(esComodin(DIF)).toBe(true)
    expect(esComodin(prod('TM015'))).toBe(false)
    expect(esComodin({ ...SALDOS, precioVenta: 5000 })).toBe(false)
    expect(esComodin({ ...SALDOS, archivado: true })).toBe(false)
  })

  it('los del 26/10: DIF con 1 venta y SALDOS con 4, ordenados por plata', () => {
    const ventas = [
      venta('1', 'DIF', '2026-10-26', '10:00', 39700),
      venta('2', 'SALDOS', '2026-10-22', '10:00', 15000),
      venta('3', 'SALDOS', '2026-10-22', '11:00', 15000),
      venta('4', 'SALDOS', '2026-10-22', '12:00', 16000),
      venta('5', 'SALDOS', '2026-10-24', '10:00', 15000),
      venta('6', 'TM015', '2026-10-24', '10:00', 15000),
    ]
    const lista = comodinesConVentas([SALDOS, DIF, prod('TM015')], ventas)
    expect(lista.map((c) => [c.producto.codigo, c.ventas, c.monto])).toEqual([
      ['SALDOS', 4, 61000],
      ['DIF', 1, 39700],
    ])
  })

  it('un comodin sin ventas no molesta', () => {
    expect(comodinesConVentas([SALDOS], [])).toEqual([])
  })
})
