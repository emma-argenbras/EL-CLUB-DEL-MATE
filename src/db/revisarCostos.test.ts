import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Producto } from './db'
import {
  confirmarCosto,
  guardarCosto,
  MOTIVO_COSTO_CONFIRMADO,
  MOTIVO_REVISION_COSTOS,
  productosParaRevisar,
} from './revisarCostos'

function prod(codigo: string, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion: `Producto ${codigo}`, proveedor: null, proveedorId: null,
    fechaCompra: null, precioCompra: null, rentabilidad: null, precioVenta: 20000,
    fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: null, activo: true, ...extra,
  }
}

/** Una fecha de hace tantos meses, para que la prueba no caduque. */
function haceMeses(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().slice(0, 10)
}

beforeEach(async () => {
  await db.productos.clear()
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('productosParaRevisar', () => {
  it('trae los sin costo y los vencidos, y deja afuera los que estan bien', () => {
    const lista = productosParaRevisar(
      [
        prod('A'),
        prod('B', { precioCompra: 100, fechaCompra: haceMeses(14) }),
        prod('C', { precioCompra: 100, fechaCompra: haceMeses(1) }),
      ],
      null,
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['A', 'B'])
    expect(lista.map((x) => x.motivo)).toEqual(['sin-costo', 'vencido'])
  })

  it('los sin costo van primero, y los vencidos del mas viejo al mas nuevo', () => {
    const lista = productosParaRevisar(
      [
        prod('V1', { precioCompra: 100, fechaCompra: haceMeses(10) }),
        prod('V2', { precioCompra: 100, fechaCompra: haceMeses(30) }),
        prod('S1'),
      ],
      null,
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['S1', 'V2', 'V1'])
  })

  it('filtra por proveedor', () => {
    const lista = productosParaRevisar(
      [prod('A', { proveedorId: 'mohicano' }), prod('B', { proveedorId: 'paisa' })],
      'mohicano',
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['A'])
  })

  it('no mira archivados ni descontinuados', () => {
    const lista = productosParaRevisar(
      [prod('A', { archivado: true }), prod('B', { descontinuado: true }), prod('C')],
      null,
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['C'])
  })
})

describe('guardarCosto', () => {
  it('guarda el costo y le pone la fecha de hoy', async () => {
    await db.productos.put(prod('A'))
    expect(await guardarCosto('A', 31000, null)).toEqual({ estado: 'guardado' })
    const a = await db.productos.get('A')
    expect(a!.precioCompra).toBe(31000)
    expect(a!.fechaCompra).toBe(new Date().toISOString().slice(0, 10))
  })

  it('NO toca nada mas que el costo y su fecha', async () => {
    await db.productos.put(
      prod('A', { precioVenta: 71900, rentabilidad: 1.3, stock: 5, proveedorId: 'mohicano', proveedor: 'MOHICANO' }),
    )
    await guardarCosto('A', 31000, null)
    const a = await db.productos.get('A')
    expect(a!.precioVenta).toBe(71900)
    expect(a!.rentabilidad).toBe(1.3)
    expect(a!.stock).toBe(5)
    expect(a!.proveedorId).toBe('mohicano')
    expect(a!.proveedor).toBe('MOHICANO')
  })

  it('no pisa lo que alguien cambio entre la lista y el guardado', async () => {
    await db.productos.put(prod('A', { precioCompra: 1000 }))
    // la lista se dibujo cuando el costo era 1000, pero ya es 2000
    await db.productos.update('A', { precioCompra: 2000 })
    const r = await guardarCosto('A', 31000, 1000)
    expect(r).toEqual({ estado: 'cambio-mientras-tanto', costoAhora: 2000 })
    expect((await db.productos.get('A'))!.precioCompra).toBe(2000)
  })

  it('si el producto ya no esta, no lo crea', async () => {
    expect(await guardarCosto('FANTASMA', 100, null)).toEqual({ estado: 'no-existe' })
    expect(await db.productos.get('FANTASMA')).toBeUndefined()
  })

  it('queda en el historial, con su motivo y con quien lo hizo', async () => {
    await db.productos.put(prod('A'))
    await guardarCosto('A', 31000, null)
    await historialAlDia()
    const renglones = await db.historial.where('tabla').equals('productos').toArray()
    const costo = renglones.find((r) => r.campo === 'precioCompra')
    expect(costo).toBeDefined()
    expect(costo!.motivo).toBe(MOTIVO_REVISION_COSTOS)
    expect(costo!.valorNuevo).toBe(31000)
    expect(costo!.quienNombre).toBe('Sandra')
  })
})

describe('confirmarCosto: "sigue valiendo lo mismo"', () => {
  it('renueva la fecha y el producto sale de la lista de vencidos', async () => {
    await db.productos.put(prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8) }))
    expect(productosParaRevisar(await db.productos.toArray(), null)).toHaveLength(1)
    expect(await confirmarCosto('A', 9500)).toEqual({ estado: 'guardado' })
    const a = await db.productos.get('A')
    expect(a!.fechaCompra).toBe(new Date().toISOString().slice(0, 10))
    expect(productosParaRevisar(await db.productos.toArray(), null)).toHaveLength(0)
  })

  it('NO toca el costo ni nada mas', async () => {
    await db.productos.put(
      prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8), precioVenta: 21000, rentabilidad: 1.3, stock: 2 }),
    )
    await confirmarCosto('A', 9500)
    const a = await db.productos.get('A')
    expect(a!.precioCompra).toBe(9500)
    expect(a!.precioVenta).toBe(21000)
    expect(a!.rentabilidad).toBe(1.3)
    expect(a!.stock).toBe(2)
  })

  it('si el costo cambio mientras tanto, no confirma un numero que nadie vio', async () => {
    await db.productos.put(prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8) }))
    await db.productos.update('A', { precioCompra: 12000 })
    expect(await confirmarCosto('A', 9500)).toEqual({ estado: 'cambio-mientras-tanto', costoAhora: 12000 })
    expect((await db.productos.get('A'))!.fechaCompra).toBe(haceMeses(8))
  })

  it('si el producto ya no esta, no lo crea', async () => {
    expect(await confirmarCosto('FANTASMA', 100)).toEqual({ estado: 'no-existe' })
    expect(await db.productos.get('FANTASMA')).toBeUndefined()
  })

  it('queda en el historial con su propio motivo, distinto de una correccion', async () => {
    await db.productos.put(prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8) }))
    await confirmarCosto('A', 9500)
    await historialAlDia()
    const renglones = await db.historial.where('tabla').equals('productos').toArray()
    const fecha = renglones.find((r) => r.campo === 'fechaCompra')
    expect(fecha?.motivo).toBe(MOTIVO_COSTO_CONFIRMADO)
    expect(fecha?.quienNombre).toBe('Sandra')
    expect(renglones.some((r) => r.campo === 'precioCompra')).toBe(false)
  })
})
