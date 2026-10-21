import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Producto, type Proveedor } from './db'
import { asociarFantasma, fichaParecida, productosDelFantasma } from './asociarFantasmas'

function prov(id: string, nombre: string, extra: Partial<Proveedor> = {}): Proveedor {
  return { id, nombre, contacto: null, notas: null, activo: true, ...extra }
}

function prod(codigo: string, proveedorId: string | null, nombre: string | null, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion: codigo, proveedor: nombre, proveedorId,
    fechaCompra: '2026-01-01', precioCompra: 1000, rentabilidad: 1.3,
    precioVenta: 2500, fechaPrecioVenta: '2026-01-01', busqueda: codigo.toLowerCase(),
    stock: 7, activo: true, ...extra,
  }
}

beforeEach(async () => {
  await Promise.all([db.productos.clear(), db.proveedores.clear(), db.historial.clear()])
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('fichaParecida', () => {
  it('ofrece THOR MATES para THOR MATES BRIAN AGUIAR', () => {
    // El caso que pidio Emmanuel: asegurarProveedor NO los junta,
    // porque son nombres distintos y dan ids distintos.
    const encontrada = fichaParecida('THOR MATES BRIAN AGUIAR', [prov('prov-thor-mates', 'THOR MATES')])
    expect(encontrada?.nombre).toBe('THOR MATES')
  })

  it('tambien al reves: el fantasma corto y la ficha larga', () => {
    const encontrada = fichaParecida('THOR MATES', [prov('x', 'THOR MATES BRIAN AGUIAR')])
    expect(encontrada?.nombre).toBe('THOR MATES BRIAN AGUIAR')
  })

  it('no ofrece una que solo comparte la primera palabra', () => {
    // "MATES RAFAEL" y "MATES DEL LITORAL" empiezan igual y no son el
    // mismo proveedor. El criterio pide que las palabras del corto
    // sean el comienzo EXACTO del largo.
    expect(fichaParecida('MATES RAFAEL', [prov('x', 'MATES DEL LITORAL')])).toBeNull()
  })

  it('no ofrece la que coincide exacto: esa ya la encuentra asegurarProveedor', () => {
    expect(fichaParecida('MOHICANO', [prov('prov-mohicano', 'MOHICANO')])).toBeNull()
  })

  it('entre varias, la mas especifica', () => {
    const encontrada = fichaParecida('THOR MATES BRIAN AGUIAR CONCORDIA', [
      prov('a', 'THOR'),
      prov('b', 'THOR MATES BRIAN'),
    ])
    expect(encontrada?.nombre).toBe('THOR MATES BRIAN')
  })

  it('sin candidatas, null', () => {
    expect(fichaParecida('MOHICANO', [prov('x', 'GOMECITO')])).toBeNull()
  })
})

describe('productosDelFantasma', () => {
  it('trae solo los de ese nombre, y solo los que no tienen ficha', async () => {
    await db.proveedores.add(prov('prov-mohicano', 'MOHICANO'))
    await db.productos.bulkAdd([
      prod('A', 'id-perdido-1', 'SALDOS'),
      prod('B', 'id-perdido-2', 'saldos '),
      prod('C', 'prov-mohicano', 'MOHICANO'),
      prod('D', 'id-perdido-3', 'PAISA'),
      prod('E', null, null),
    ])
    const encontrados = await productosDelFantasma('SALDOS')
    expect(encontrados.map((p) => p.codigo)).toEqual(['A', 'B'])
  })

  it('no trae archivados', async () => {
    await db.productos.bulkAdd([
      prod('A', 'perdido', 'SALDOS'),
      prod('B', 'perdido', 'SALDOS', { archivado: true }),
    ])
    expect((await productosDelFantasma('SALDOS')).map((p) => p.codigo)).toEqual(['A'])
  })
})

describe('asociarFantasma', () => {
  it('crea la ficha y engancha los productos', async () => {
    await db.productos.bulkAdd([prod('A', 'perdido', 'PAISA'), prod('B', 'perdido', 'PAISA')])

    const r = await asociarFantasma('PAISA')

    expect(r).toMatchObject({ fichaNombre: 'PAISA', creada: true, productos: 2 })
    expect((await db.proveedores.get('prov-paisa'))?.nombre).toBe('PAISA')
    const productos = await db.productos.toArray()
    expect(productos.every((p) => p.proveedorId === 'prov-paisa')).toBe(true)
  })

  it('reusa la ficha que ya existe con ese nombre, en vez de crear otra', async () => {
    await db.proveedores.add(prov('prov-mohicano', 'MOHICANO', { contacto: '345 4123456' }))
    await db.productos.add(prod('A', 'id-de-otro-celular', 'mohicano '))

    const r = await asociarFantasma('mohicano ')

    expect(r.creada).toBe(false)
    expect(r.fichaId).toBe('prov-mohicano')
    expect(await db.proveedores.count()).toBe(1)
    // Y no le pisa los datos que ya tenia.
    expect((await db.proveedores.get('prov-mohicano'))?.contacto).toBe('345 4123456')
  })

  it('con una ficha elegida, usa esa y guarda el nombre como otro nombre', async () => {
    // Asi la proxima vez que aparezca "THOR MATES BRIAN AGUIAR" cae
    // sola en THOR MATES, sin que nadie se acuerde.
    const thor = prov('prov-thor-mates', 'THOR MATES')
    await db.proveedores.add(thor)
    await db.productos.add(prod('A', 'perdido', 'THOR MATES BRIAN AGUIAR'))

    const r = await asociarFantasma('THOR MATES BRIAN AGUIAR', thor)

    expect(r.fichaId).toBe('prov-thor-mates')
    expect(await db.proveedores.count()).toBe(1)
    expect((await db.proveedores.get('prov-thor-mates'))?.alias).toContain('THOR MATES BRIAN AGUIAR')
    expect((await db.productos.get('A'))?.proveedor).toBe('THOR MATES')
  })

  it('NO toca precios, costos ni stock', async () => {
    await db.productos.add(prod('A', 'perdido', 'PAISA'))
    const antes = await db.productos.get('A')

    await asociarFantasma('PAISA')

    const despues = await db.productos.get('A')
    expect(despues!.precioVenta).toBe(antes!.precioVenta)
    expect(despues!.precioCompra).toBe(antes!.precioCompra)
    expect(despues!.rentabilidad).toBe(antes!.rentabilidad)
    expect(despues!.fechaCompra).toBe(antes!.fechaCompra)
    expect(despues!.fechaPrecioVenta).toBe(antes!.fechaPrecioVenta)
    expect(despues!.stock).toBe(antes!.stock)
  })

  it('no toca los productos de OTRO proveedor fantasma', async () => {
    await db.productos.bulkAdd([prod('A', 'p1', 'PAISA'), prod('B', 'p2', 'SALDOS')])

    await asociarFantasma('PAISA')

    expect((await db.productos.get('B'))?.proveedorId).toBe('p2')
  })

  it('queda en el historial con el motivo', async () => {
    await db.productos.add(prod('A', 'perdido', 'PAISA'))
    await historialAlDia()
    await db.historial.clear()

    await asociarFantasma('PAISA')
    await historialAlDia()

    const renglones = await db.historial.toArray()
    const elCambio = renglones.find((r) => r.tabla === 'productos' && r.campo === 'proveedorId')
    expect(elCambio).toBeDefined()
    expect(elCambio!.valorNuevo).toBe('prov-paisa')
    expect(elCambio!.motivo).toBe('Asociación de productos a PAISA')
    expect(elCambio!.quienNombre).toBe('Sandra')
  })

  it('despues de asociarlos ya no quedan fantasmas de ese nombre', async () => {
    await db.productos.bulkAdd([prod('A', 'p1', 'PAISA'), prod('B', 'p2', 'PAISA')])
    await asociarFantasma('PAISA')
    expect(await productosDelFantasma('PAISA')).toEqual([])
  })

  it('avisa si ya no queda ninguno', async () => {
    await expect(asociarFantasma('NO EXISTE')).rejects.toThrow('No quedan productos')
  })
})
