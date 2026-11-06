import { describe, expect, it } from 'vitest'
import type { Producto, Venta } from '../db/db'
import {
  comodinesConVentas,
  descripcionesAnteriores,
  descripcionParaVender,
  esComodin,
  pideDescripcionAlVender,
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

  it('una generica con algo de relleno corto no alcanza', () => {
    expect(problemaDescripcionSuelta('saldos zz')).not.toBeNull()
    expect(problemaDescripcionSuelta('varios x2')).not.toBeNull()
    expect(problemaDescripcionSuelta('mate x2')).toBeNull()
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

describe('los genericos piden que salio al venderlos (06/11)', () => {
  const producto = (extra: Partial<Producto> = {}): Producto => ({
    codigo: 'TM015', descripcion: 'MATE TORPEDO', proveedor: 'MOHICANO', proveedorId: 'mohicano',
    fechaCompra: null, precioCompra: 20000, rentabilidad: 1, precioVenta: 45000, fechaPrecioVenta: null,
    busqueda: 'tm015 mate torpedo', stock: null, activo: true, ...extra,
  })
  const saldos = producto({
    codigo: 'SALDOS', descripcion: 'SALDOS – DE TODO', proveedor: null, proveedorId: null,
    precioCompra: null, precioVenta: null,
  })

  it('un producto comun se vende con su descripcion, sin preguntar', () => {
    expect(pideDescripcionAlVender(producto())).toBe(false)
    expect(descripcionParaVender(producto(), '')).toEqual({ descripcion: 'MATE TORPEDO' })
  })

  it('el comodin pide que salio, aunque no tenga la marca', () => {
    expect(pideDescripcionAlVender(saldos)).toBe(true)
    expect(descripcionParaVender(saldos, ' bombilla de alpaca ')).toEqual({ descripcion: 'bombilla de alpaca' })
  })

  it('un producto marcado como generico tambien, aunque tenga proveedor y precio', () => {
    expect(pideDescripcionAlVender(producto({ generico: true }))).toBe(true)
  })

  it('«saldos» o vacio no alcanza: no dice que salio', () => {
    expect(descripcionParaVender(saldos, 'saldos')).toHaveProperty('problema')
    expect(descripcionParaVender(saldos, '')).toHaveProperty('problema')
  })

  it('sugiere lo que se escribio otras veces, sin repetir y lo mas nuevo primero', () => {
    const v = (id: string, fecha: string, descripcion: string, codigo = 'SALDOS') => ({
      id, jornadaId: 'j', fecha, hora: '10:00', codigo, descripcion, cantidad: 1, precioUnitario: 1,
      costoUnitario: null, medioPago: 'EFECTIVO' as const, total: 1, vendedor: null,
    })
    expect(
      descripcionesAnteriores('SALDOS', [
        v('1', '2026-11-01', 'bombilla de alpaca'),
        v('2', '2026-11-03', 'Yerbera de cuero'),
        v('3', '2026-11-04', 'Bombilla de alpaca'),
        v('4', '2026-11-05', 'mate imperial', 'TM015'),
      ]),
    ).toEqual(['Bombilla de alpaca', 'Yerbera de cuero'])
  })
})
