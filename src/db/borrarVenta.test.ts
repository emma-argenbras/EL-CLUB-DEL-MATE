import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, engancharSync, historialAlDia, type Producto, type Venta } from './db'
import {
  borrarVenta,
  MOTIVO_DESHACER_VENTA,
  quedaParaDeshacer,
  SEGUNDOS_PARA_DESHACER,
} from './borrarVenta'

function prod(codigo: string, stock: number | null): Producto {
  return {
    codigo, descripcion: 'MATE IMPERIAL', proveedor: null, proveedorId: null, fechaCompra: null,
    precioCompra: 20000, rentabilidad: null, precioVenta: 45000, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock, activo: true,
  }
}

function venta(id: string, codigo: string, cantidad = 1): Venta {
  return {
    id, jornadaId: 'j1', fecha: '2026-10-22', hora: '17:10', codigo, descripcion: 'MATE IMPERIAL',
    cantidad, precioUnitario: 45000, costoUnitario: 20000, medioPago: 'EFECTIVO',
    total: 45000 * cantidad, vendedor: 'Gabriela',
  } as Venta
}

beforeEach(async () => {
  await Promise.all([db.ventas.clear(), db.productos.clear(), db.borrados.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'sucursalconcordia@elclubdelmate.com', nombre: 'Gabriela', rol: 'empleado' }))
})

describe('borrarVenta', () => {
  it('borra la venta y devuelve el stock', async () => {
    await db.productos.put(prod('TM015', 2))
    await db.ventas.put(venta('v1', 'TM015', 2))
    expect(await borrarVenta('v1', MOTIVO_DESHACER_VENTA, null)).toBe(true)
    expect(await db.ventas.get('v1')).toBeUndefined()
    expect((await db.productos.get('TM015'))?.stock).toBe(4)
  })

  it('si el producto no lleva stock, no le inventa uno', async () => {
    await db.productos.put(prod('TM015', null))
    await db.ventas.put(venta('v1', 'TM015'))
    await borrarVenta('v1', MOTIVO_DESHACER_VENTA, null)
    expect((await db.productos.get('TM015'))?.stock).toBeNull()
  })

  it('DEJA CONSTANCIA EN BORRADOS, y viaja antes que el borrado', async () => {
    await db.productos.put(prod('TM015', null))
    await db.ventas.put(venta('v1', 'TM015'))
    const enviados: string[] = []
    engancharSync((tabla, accion, clave) => enviados.push(`${accion} ${tabla}/${clave}`))
    try {
      await borrarVenta('v1', MOTIVO_DESHACER_VENTA, 'sucursalconcordia@elclubdelmate.com')
    } finally {
      engancharSync(() => {})
    }
    const constancia = await db.borrados.get('ventas/v1')
    expect(constancia).toMatchObject({ tabla: 'ventas', clave: 'v1', motivo: MOTIVO_DESHACER_VENTA })
    expect(constancia?.quien).toBe('sucursalconcordia@elclubdelmate.com')
    const iConstancia = enviados.indexOf('guardar borrados/ventas/v1')
    expect(iConstancia).toBeGreaterThanOrEqual(0)
    expect(enviados.indexOf('borrar ventas/v1')).toBeGreaterThan(iConstancia)
  })

  it('queda en el historial con su motivo', async () => {
    await db.productos.put(prod('TM015', null))
    await db.ventas.put(venta('v1', 'TM015'))
    await borrarVenta('v1', MOTIVO_DESHACER_VENTA, null)
    await historialAlDia()
    const borro = (await db.historial.toArray()).find((r) => r.tabla === 'ventas' && r.accion === 'borro')
    expect(borro?.motivo).toBe(MOTIVO_DESHACER_VENTA)
    expect(borro?.quienNombre).toBe('Gabriela')
  })

  it('si la venta ya no esta, no toca nada', async () => {
    await db.productos.put(prod('TM015', 2))
    expect(await borrarVenta('fantasma', MOTIVO_DESHACER_VENTA, null)).toBe(false)
    expect((await db.productos.get('TM015'))?.stock).toBe(2)
    expect(await db.borrados.count()).toBe(0)
  })
})

describe('quedaParaDeshacer', () => {
  it('cuenta para atras y no baja de cero', () => {
    const t = 1_000_000
    expect(quedaParaDeshacer(t, t)).toBe(SEGUNDOS_PARA_DESHACER)
    expect(quedaParaDeshacer(t, t + 10_500)).toBe(20)
    expect(quedaParaDeshacer(t, t + SEGUNDOS_PARA_DESHACER * 1000)).toBe(0)
    expect(quedaParaDeshacer(t, t + 999_999)).toBe(0)
  })
})
