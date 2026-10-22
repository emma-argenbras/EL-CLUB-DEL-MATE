import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  engancharAutor,
  historialAlDia,
  type MovimientoProveedor,
  type Producto,
  type Venta,
} from './db'
import {
  armarUnionProductos,
  MOTIVO_UNION_PRODUCTOS,
  textoDeConfirmacionUnionProductos,
  unirProductos,
} from './unirProductos'

function prod(codigo: string, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion: 'MATERA RECTANGULAR', proveedor: 'LUIS SUAREZ', proveedorId: 'luis-suarez',
    fechaCompra: '2026-10-01', precioCompra: 12000, rentabilidad: 1.3, precioVenta: 28000,
    fechaPrecioVenta: null, busqueda: `${codigo.toLowerCase()} matera rectangular`, stock: null,
    activo: true, ...extra,
  }
}

function venta(id: string, codigo: string): Venta {
  return {
    id, jornadaId: 'j1', fecha: '2026-10-22', hora: '10:00', codigo, descripcion: 'MATERA RECTANGULAR',
    cantidad: 1, precioUnitario: 28000, costoUnitario: 12000, medioPago: 'EFECTIVO',
    total: 28000, vendedor: null,
  } as Venta
}

function compra(id: string, codigos: string[]): MovimientoProveedor {
  return {
    id, proveedorId: 'luis-suarez', tipo: 'compra', fecha: '2026-10-01', monto: 1000,
    medioPago: null, notas: null,
    items: codigos.map((c) => ({ codigo: c, descripcion: 'X', cantidad: 1, costoUnitario: 100 })),
  } as MovimientoProveedor
}

beforeEach(async () => {
  await Promise.all([db.productos.clear(), db.ventas.clear(), db.movimientosProveedor.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'emmanuel@elclubdelmate.com', nombre: 'Emmanuel', rol: 'owner' }))
})

// El caso del 22/10: LST016 quedo vivo al lado de LST014.
async function sembrar(stock16: number | null = null, stock14: number | null = null) {
  await db.productos.bulkPut([
    prod('LST014', { stock: stock14, precioVenta: 30000 }),
    prod('LST016', { stock: stock16, descripcion: 'MATERA RECTANGULAR VIEJA' }),
  ])
  await db.ventas.bulkPut([venta('v1', 'LST016'), venta('v2', 'LST014'), venta('v3', 'OTRO')])
  await db.movimientosProveedor.bulkPut([compra('c1', ['LST016', 'OTRO']), compra('c2', ['OTRO'])])
}

describe('la vista previa', () => {
  it('cuenta las ventas y compras del que se va, no las del que queda', () => {
    const v = armarUnionProductos(
      prod('LST014'), prod('LST016'),
      [venta('v1', 'LST016'), venta('v2', 'LST014')],
      [compra('c1', ['LST016']), compra('c2', ['LST014'])],
    )
    expect(v.ventas).toBe(1)
    expect(v.compras).toBe(1)
  })

  it('suma el stock solo si el que se va tiene', () => {
    expect(armarUnionProductos(prod('A', { stock: 2 }), prod('B', { stock: 3 }), [], []).stockFinal).toBe(5)
    expect(armarUnionProductos(prod('A', { stock: null }), prod('B', { stock: 3 }), [], []).stockFinal).toBe(3)
    const sinStock = armarUnionProductos(prod('A', { stock: 2 }), prod('B', { stock: null }), [], [])
    expect(sinStock.sumaStock).toBe(false)
    expect(sinStock.stockFinal).toBe(2)
  })

  it('la confirmación dice cuántos registros toca y quién manda', () => {
    const texto = textoDeConfirmacionUnionProductos(
      armarUnionProductos(prod('LST014'), prod('LST016'), [venta('v1', 'LST016')], []),
    )
    expect(texto).toContain('1 ventas de LST016 pasan a LST014')
    expect(texto).toContain('LST014 conserva su descripción, su costo y su precio')
    expect(texto).toContain('LST016 queda archivado')
    expect(texto).toContain(MOTIVO_UNION_PRODUCTOS)
  })
})

describe('unirProductos', () => {
  it('SE LLEVA LAS VENTAS: ninguna queda en el código que se va', async () => {
    await sembrar()
    expect(await unirProductos('LST016', 'LST014')).toEqual({ ventasTocadas: 1, comprasTocadas: 1 })
    expect(await db.ventas.where('codigo').equals('LST016').count()).toBe(0)
    expect(await db.ventas.where('codigo').equals('LST014').count()).toBe(2)
    expect((await db.ventas.get('v3'))?.codigo).toBe('OTRO')
  })

  it('corrige las líneas de las compras, sin tocar las demás', async () => {
    await sembrar()
    await unirProductos('LST016', 'LST014')
    expect((await db.movimientosProveedor.get('c1'))?.items?.map((i) => i.codigo)).toEqual(['LST014', 'OTRO'])
    expect((await db.movimientosProveedor.get('c2'))?.items?.map((i) => i.codigo)).toEqual(['OTRO'])
  })

  it('el que se va queda archivado, inactivo y sin stock: no se borra', async () => {
    await sembrar(3)
    await unirProductos('LST016', 'LST014')
    const seFue = await db.productos.get('LST016')
    expect(seFue).toMatchObject({ archivado: true, activo: false, stock: null })
  })

  it('el que queda manda: conserva descripción y precio, y suma el stock', async () => {
    await sembrar(3, 2)
    await unirProductos('LST016', 'LST014')
    const queda = await db.productos.get('LST014')
    expect(queda?.descripcion).toBe('MATERA RECTANGULAR')
    expect(queda?.precioVenta).toBe(30000)
    expect(queda?.stock).toBe(5)
    expect(queda?.archivado).not.toBe(true)
  })

  it('no hace nada si es el mismo, o si falta alguno', async () => {
    await sembrar()
    expect(await unirProductos('LST014', 'LST014')).toBe('es-el-mismo')
    expect(await unirProductos('FANTASMA', 'LST014')).toBe('no-existe')
    expect(await unirProductos('LST016', 'FANTASMA')).toBe('no-existe')
    expect(await db.ventas.where('codigo').equals('LST016').count()).toBe(1)
  })

  it('queda en el historial con su motivo', async () => {
    await sembrar()
    await unirProductos('LST016', 'LST014')
    await historialAlDia()
    const renglones = await db.historial.toArray()
    const archivo = renglones.find(
      (r) => r.tabla === 'productos' && r.clave === 'LST016' && r.accion === 'archivo',
    )
    expect(archivo?.motivo).toBe(MOTIVO_UNION_PRODUCTOS)
    expect(archivo?.quienNombre).toBe('Emmanuel')
    const ventaMovida = renglones.find(
      (r) => r.tabla === 'ventas' && r.clave === 'v1' && r.accion === 'edito' && r.campo === 'codigo',
    )
    expect(ventaMovida?.motivo).toBe(MOTIVO_UNION_PRODUCTOS)
    expect(ventaMovida?.valorNuevo).toBe('LST014')
  })
})
