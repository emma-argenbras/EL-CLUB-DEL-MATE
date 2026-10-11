import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  engancharAutor,
  ID_ARRANQUE_HISTORIAL,
  marcarArranqueDelHistorial,
  nuevoId,
  type Producto,
} from './db'

/**
 * El historial de modificaciones, probado contra una IndexedDB de verdad
 * (fake-indexeddb) y no contra una maqueta.
 *
 * Por que existe este archivo: la tabla historialProductos estaba en la
 * app desde agosto y tenia CERO registros en produccion. Ninguna prueba
 * la tocaba, porque los ganchos de Dexie no son una funcion pura que se
 * pueda llamar sola: dependen de correr dentro de una transaccion. Y ahi
 * estaba el problema, justamente.
 */

function producto(parcial: Partial<Producto> = {}): Producto {
  return {
    codigo: 'TM015',
    descripcion: 'MATE IMPERIAL VIROLA ALPACA',
    proveedor: null,
    proveedorId: null,
    fechaCompra: null,
    precioCompra: 20000,
    rentabilidad: 1.3,
    precioVenta: 45000,
    fechaPrecioVenta: null,
    busqueda: 'tm015 mate imperial virola alpaca',
    stock: 3,
    activo: true,
    ...parcial,
  }
}

beforeEach(async () => {
  await db.productos.clear()
  await db.historialProductos.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra' }))
})

describe('historial de productos', () => {
  it('anota el cambio de precio con quien, cuando y los dos valores', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000 })

    const historial = await db.historialProductos.toArray()
    expect(historial).toHaveLength(1)
    expect(historial[0]).toMatchObject({
      codigo: 'TM015',
      campo: 'precioVenta',
      valorAnterior: 45000,
      valorNuevo: 52000,
      quien: 'ventas@elclubdelmate.com',
      quienNombre: 'Sandra',
    })
    expect(historial[0].cuando).toBeGreaterThan(0)
  })

  it('anota un renglon por cada campo que cambio, no uno por edicion', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', {
      precioVenta: 52000,
      precioCompra: 24000,
      stock: 7,
    })

    const campos = (await db.historialProductos.toArray()).map((h) => h.campo).sort()
    expect(campos).toEqual(['precioCompra', 'precioVenta', 'stock'])
  })

  it('no anota nada si el valor no cambio de verdad', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 45000 })
    expect(await db.historialProductos.count()).toBe(0)
  })

  it('anota el archivado, que es lo mas parecido a un borrado', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { archivado: true })

    const historial = await db.historialProductos.toArray()
    expect(historial).toHaveLength(1)
    expect(historial[0].campo).toBe('archivado')
    expect(historial[0].valorNuevo).toBe(true)
  })

  it('sin nadie logueado no anota: no se puede firmar un cambio sin autor', async () => {
    engancharAutor(() => null)
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000 })
    expect(await db.historialProductos.count()).toBe(0)
  })

  it('el historial no se puede editar ni borrar desde la app', async () => {
    // La regla del servidor ya lo prohibe; esto cubre el otro lado, que
    // es que la app no tenga una via para hacerlo sin querer.
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000 })
    const antes = await db.historialProductos.toArray()
    expect(antes).toHaveLength(1)

    // Lo que SI tiene que poder: leerse completo.
    const leido = await db.historialProductos.get(antes[0].id)
    expect(leido?.valorNuevo).toBe(52000)
  })

  it('aguanta varias ediciones seguidas sin perder ninguna', async () => {
    await db.productos.add(producto())
    for (const precio of [46000, 47000, 48000, 49000, 50000]) {
      await db.productos.update('TM015', { precioVenta: precio })
    }
    const historial = await db.historialProductos.orderBy('cuando').toArray()
    expect(historial).toHaveLength(5)
    expect(historial.map((h) => h.valorNuevo)).toEqual([46000, 47000, 48000, 49000, 50000])
  })

  it('anota igual cuando la edicion viene dentro de una transaccion propia', async () => {
    // Asi edita el importador de precios: abre su transaccion y toca
    // muchos productos. Si el historial solo funcionara en el camino
    // simple, la importacion entera quedaria sin registrar --que es
    // justo lo que no puede pasar.
    await db.productos.bulkAdd([
      producto(),
      producto({ codigo: 'TM016', descripcion: 'OTRO MATE', precioVenta: 30000 }),
    ])

    await db.transaction('rw', db.productos, db.historialProductos, async () => {
      await db.productos.update('TM015', { precioVenta: 52000 })
      await db.productos.update('TM016', { precioVenta: 33000 })
    })

    const historial = await db.historialProductos.toArray()
    expect(historial).toHaveLength(2)
    expect(historial.map((h) => h.codigo).sort()).toEqual(['TM015', 'TM016'])
  })

  it('un id nuevo nunca repite el de otra entrada', async () => {
    const ids = new Set(Array.from({ length: 500 }, () => nuevoId()))
    expect(ids.size).toBe(500)
  })
})

describe('el renglon que dice desde cuando el historial registra', () => {
  it('queda con la fecha del arranque y se explica solo', async () => {
    await marcarArranqueDelHistorial()
    const marca = await db.historialProductos.get(ID_ARRANQUE_HISTORIAL)
    expect(marca).toBeDefined()
    expect(marca!.valorAnterior).toContain('no hay registro')
    expect(new Date(marca!.cuando).toISOString().slice(0, 10)).toBe('2026-10-11')
  })

  it('no se duplica aunque lo escriban varios dispositivos', async () => {
    await marcarArranqueDelHistorial()
    await marcarArranqueDelHistorial()
    await marcarArranqueDelHistorial()
    expect(await db.historialProductos.count()).toBe(1)
  })

  it('la fecha no se mueve si lo reescribe otro dispositivo despues', async () => {
    await marcarArranqueDelHistorial()
    const primera = (await db.historialProductos.get(ID_ARRANQUE_HISTORIAL))!.cuando
    await marcarArranqueDelHistorial()
    const segunda = (await db.historialProductos.get(ID_ARRANQUE_HISTORIAL))!.cuando
    expect(segunda).toBe(primera)
  })

  it('no se confunde con un cambio real: queda ordenado antes que todo', async () => {
    await marcarArranqueDelHistorial()
    await db.productos.add({
      codigo: 'TM015',
      descripcion: 'MATE',
      proveedor: null,
      proveedorId: null,
      fechaCompra: null,
      precioCompra: 1,
      rentabilidad: 1,
      precioVenta: 2,
      fechaPrecioVenta: null,
      busqueda: 'tm015 mate',
      stock: 1,
      activo: true,
    })
    await db.productos.update('TM015', { precioVenta: 3 })

    const todo = await db.historialProductos.orderBy('cuando').toArray()
    expect(todo).toHaveLength(2)
    expect(todo[0].id).toBe(ID_ARRANQUE_HISTORIAL)
  })
})
