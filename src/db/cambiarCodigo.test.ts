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
  armarCambioCodigo,
  cambiarCodigo,
  MOTIVO_CAMBIO_CODIGO,
  textoDeConfirmacionCambioCodigo,
} from './cambiarCodigo'

function prod(codigo: string, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion: 'MATERA BOLSO', proveedor: 'LUIS SUAREZ', proveedorId: 'luis-suarez',
    fechaCompra: '2026-04-24', precioCompra: 40000, rentabilidad: 1.3, precioVenta: 88000,
    fechaPrecioVenta: null, busqueda: `${codigo.toLowerCase()} matera bolso`, stock: 3,
    activo: true, ...extra,
  }
}

function venta(id: string, codigo: string): Venta {
  return {
    id, jornadaId: 'j1', fecha: '2026-10-20', hora: '10:00', codigo, descripcion: 'MATERA BOLSO',
    cantidad: 1, precioUnitario: 88000, costoUnitario: 40000, medioPago: 'EFECTIVO',
    total: 88000, vendedor: null,
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
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('armarCambioCodigo (la vista previa)', () => {
  it('cuenta ventas, compras y los renglones de historial que quedan', () => {
    const v = armarCambioCodigo(
      prod('LST009'), 'LST015',
      [venta('v1', 'LST009'), venta('v2', 'LST009'), venta('v3', 'OTRO')],
      [compra('c1', ['LST009', 'X']), compra('c2', ['X'])],
      7,
    )
    expect(v.ventas).toBe(2)
    expect(v.compras).toBe(1)
    expect(v.historialQueQueda).toBe(7)
  })
})

describe('textoDeConfirmacionCambioCodigo', () => {
  it('dice a qué pasa, cuántos registros toca y que el viejo queda libre', () => {
    const t = textoDeConfirmacionCambioCodigo(
      armarCambioCodigo(prod('LST009'), 'LST015', [venta('v1', 'LST009')], [], 3),
    )
    expect(t).toContain('de LST009 a LST015')
    expect(t).toContain('1 ventas')
    expect(t).toContain('el código LST009 queda libre')
    expect(t).toContain(MOTIVO_CAMBIO_CODIGO)
  })

  it('avisa que el historial viejo no se mueve', () => {
    const t = textoDeConfirmacionCambioCodigo(
      armarCambioCodigo(prod('LST009'), 'LST015', [], [], 3),
    )
    expect(t).toContain('el historial no se puede editar')
  })
})

describe('cambiarCodigo', () => {
  async function sembrar() {
    await db.productos.put(prod('LST009'))
    await db.ventas.bulkPut([venta('v1', 'LST009'), venta('v2', 'LST009'), venta('v3', 'OTRO')])
    await db.movimientosProveedor.bulkPut([compra('c1', ['LST009', 'OTRO']), compra('c2', ['OTRO'])])
  }

  it('el producto queda con el código nuevo y el viejo libre', async () => {
    await sembrar()
    expect(await cambiarCodigo('LST009', 'LST015')).toEqual({ ventasTocadas: 2, comprasTocadas: 1 })
    expect(await db.productos.get('LST009')).toBeUndefined()
    expect((await db.productos.get('LST015'))!.descripcion).toBe('MATERA BOLSO')
  })

  it('SE LLEVA LAS VENTAS: si no, el reporte pierde el producto', async () => {
    await sembrar()
    await cambiarCodigo('LST009', 'LST015')
    expect(await db.ventas.where('codigo').equals('LST015').count()).toBe(2)
    expect(await db.ventas.where('codigo').equals('LST009').count()).toBe(0)
    // y no toca las de otros productos
    expect((await db.ventas.get('v3'))!.codigo).toBe('OTRO')
  })

  it('corrige las líneas de las compras, sin tocar las demás', async () => {
    await sembrar()
    await cambiarCodigo('LST009', 'LST015')
    const c1 = await db.movimientosProveedor.get('c1')
    expect(c1!.items!.map((i) => i.codigo)).toEqual(['LST015', 'OTRO'])
    const c2 = await db.movimientosProveedor.get('c2')
    expect(c2!.items!.map((i) => i.codigo)).toEqual(['OTRO'])
  })

  it('rehace la búsqueda, que lleva el código adentro', async () => {
    await sembrar()
    await cambiarCodigo('LST009', 'LST015')
    const p = await db.productos.get('LST015')
    expect(p!.busqueda).toContain('lst015')
    expect(p!.busqueda).not.toContain('lst009')
  })

  it('conserva todo lo demás del producto', async () => {
    await sembrar()
    await cambiarCodigo('LST009', 'LST015')
    const p = await db.productos.get('LST015')
    expect(p!.precioCompra).toBe(40000)
    expect(p!.precioVenta).toBe(88000)
    expect(p!.stock).toBe(3)
    expect(p!.proveedorId).toBe('luis-suarez')
    expect(p!.fechaCompra).toBe('2026-04-24')
  })

  it('normaliza el código nuevo', async () => {
    await sembrar()
    await cambiarCodigo('LST009', '  lst015  ')
    expect(await db.productos.get('LST015')).toBeDefined()
  })

  it('NO PISA un código ocupado', async () => {
    await sembrar()
    await db.productos.put(prod('LST015', { descripcion: 'OTRA COSA' }))
    expect(await cambiarCodigo('LST009', 'LST015')).toBe('ocupado')
    expect((await db.productos.get('LST015'))!.descripcion).toBe('OTRA COSA')
    expect(await db.productos.get('LST009')).toBeDefined()
  })

  it('no hace nada si es el mismo código', async () => {
    await sembrar()
    expect(await cambiarCodigo('LST009', 'LST009')).toBe('es-el-mismo')
    expect(await db.productos.get('LST009')).toBeDefined()
  })

  it('si el producto ya no está, no inventa uno', async () => {
    expect(await cambiarCodigo('FANTASMA', 'NUEVO')).toBe('no-existe')
    expect(await db.productos.get('NUEVO')).toBeUndefined()
  })

  it('queda en el historial con su motivo y con quien lo hizo', async () => {
    await sembrar()
    await cambiarCodigo('LST009', 'LST015')
    await historialAlDia()
    const renglones = await db.historial.toArray()
    const borrado = renglones.find((r) => r.tabla === 'productos' && r.accion === 'borro')
    expect(borrado?.motivo).toBe(MOTIVO_CAMBIO_CODIGO)
    expect(borrado?.quienNombre).toBe('Sandra')
    expect(renglones.some((r) => r.tabla === 'productos' && r.accion === 'creo')).toBe(true)
  })
})
