import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Producto, type Venta } from './db'
import { asignarVentaSinCodigo, motivoAsignacion } from './asignarVentaSinCodigo'

function prod(codigo: string, stock: number | null): Producto {
  return {
    codigo, descripcion: 'BOMBILLA ALPACA', proveedor: 'MOHICANO', proveedorId: 'mohicano', fechaCompra: null,
    precioCompra: 4000, rentabilidad: null, precioVenta: 9000, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock, activo: true,
  }
}

function venta(codigo = '', cantidad = 2): Venta {
  return {
    id: 'v1', jornadaId: 'j1', fecha: '2026-10-24', hora: '10:00', codigo, descripcion: 'bombilla de alpaca',
    cantidad, precioUnitario: 9000, costoUnitario: null, medioPago: 'EFECTIVO', total: 9000 * cantidad, vendedor: null,
  }
}

beforeEach(async () => {
  await Promise.all([db.ventas.clear(), db.productos.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('asignarVentaSinCodigo', () => {
  it('la venta pasa a ser del producto: codigo, nombre y costo, sin tocar lo cobrado', async () => {
    await db.productos.put(prod('BA001', null))
    await db.ventas.put(venta())
    expect(await asignarVentaSinCodigo('v1', 'BA001')).toEqual({ estado: 'asignada' })
    const v = await db.ventas.get('v1')
    expect(v).toMatchObject({ codigo: 'BA001', descripcion: 'BOMBILLA ALPACA', costoUnitario: 4000, total: 18000, precioUnitario: 9000 })
  })

  it('si el producto lleva stock, descuenta ahora lo que salio entonces', async () => {
    await db.productos.put(prod('BA001', 5))
    await db.ventas.put(venta('', 2))
    await asignarVentaSinCodigo('v1', 'BA001')
    expect((await db.productos.get('BA001'))?.stock).toBe(3)
  })

  it('si alguien ya la resolvio, no la pisa', async () => {
    await db.productos.put(prod('BA001', 5))
    await db.ventas.put(venta('OTRO'))
    expect(await asignarVentaSinCodigo('v1', 'BA001')).toEqual({ estado: 'ya-tiene-codigo', codigo: 'OTRO' })
    expect((await db.productos.get('BA001'))?.stock).toBe(5)
  })

  it('producto o venta que no existen: no inventa nada', async () => {
    await db.ventas.put(venta())
    expect(await asignarVentaSinCodigo('v1', 'FANTASMA')).toEqual({ estado: 'producto-no-existe' })
    expect(await asignarVentaSinCodigo('fantasma', 'BA001')).toEqual({ estado: 'no-existe' })
    expect((await db.ventas.get('v1'))?.codigo).toBe('')
  })

  it('queda en el historial lo que decia antes, con quien y por que', async () => {
    await db.productos.put(prod('BA001', null))
    await db.ventas.put(venta())
    await asignarVentaSinCodigo('v1', 'BA001')
    await historialAlDia()
    const renglones = (await db.historial.toArray()).filter((r) => r.tabla === 'ventas' && r.clave === 'v1')
    const desc = renglones.find((r) => r.campo === 'descripcion')
    expect(desc?.valorAnterior).toBe('bombilla de alpaca')
    expect(desc?.motivo).toBe(motivoAsignacion('bombilla de alpaca', 'BA001'))
    expect(desc?.quienNombre).toBe('Sandra')
  })
})
