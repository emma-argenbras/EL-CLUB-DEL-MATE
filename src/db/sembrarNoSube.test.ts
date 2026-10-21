import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, engancharAutor, engancharSync, historialAlDia, type NombreTabla } from './db'
import { sembrarCatalogo } from './sembrar'

/**
 * Sembrar el catalogo NO sube nada a la nube.
 *
 * Esta es la prueba del incidente del 20/10/2026. Un celular al que le
 * borraron los datos volvio a entrar, se rearmo desde el catalogo
 * publico --que no lleva costos ni proveedores-- y al restaurarse la
 * sesion empezo a subir esos productos vacios, pisando en el servidor
 * los costos y los proveedores de ~280 productos.
 *
 * Lo que se prueba no es que el catalogo se siembre bien: es que al
 * sembrarlo el motor de sincronizacion NO se entera.
 */
describe('sembrar el catalogo no sube nada', () => {
  beforeEach(async () => {
    // El orden importa y cuesta un rato darse cuenta: vaciar la tabla
    // de productos dispara el gancho de borrado, que deja sus propios
    // renglones de historial. Asi que primero se vacian los productos,
    // despues se deja aterrizar lo que eso genero, y recien al final se
    // limpia el historial. Al reves, la prueba ve los borrados de su
    // propia limpieza y parece que el sembrado dejo rastro.
    await Promise.all([db.productos.clear(), db.ajustes.clear()])
    await historialAlDia()
    await db.historial.clear()
    engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
  })

  it('no avisa al motor por ninguno de los productos sembrados', async () => {
    const avisos: { tabla: NombreTabla; clave: string }[] = []
    engancharSync((tabla, _accion, clave) => avisos.push({ tabla, clave }))

    const fetchOriginal = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [
        { c: 'TM015', d: 'MATE IMPERIAL', p: 45000, b: 'tm015 mate imperial' },
        { c: 'MR001', d: 'MATE RAFAEL', p: 21000, b: 'mr001 mate rafael' },
      ],
    }) as unknown as typeof fetch

    try {
      const cuantos = await sembrarCatalogo()
      expect(cuantos).toBe(2)
      // Se sembraron, pero el motor no se entero de ninguno.
      expect(await db.productos.count()).toBe(2)
      expect(avisos).toEqual([])
    } finally {
      globalThis.fetch = fetchOriginal
      engancharSync(() => {})
    }
  })

  it('tampoco deja renglones en el historial', async () => {
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [{ c: 'TM015', d: 'MATE', p: 45000, b: 'tm015 mate' }],
    }) as unknown as typeof fetch

    try {
      await sembrarCatalogo()
      await historialAlDia()
      expect(await db.historial.count()).toBe(0)
    } finally {
      globalThis.fetch = fetchOriginal
    }
  })

  it('los productos sembrados vienen sin costo ni proveedor, que es el peligro', async () => {
    // Si alguna vez el catalogo publico empezara a traer costos, esta
    // prueba se pone en rojo y hay que mirar por que.
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [{ c: 'TM015', d: 'MATE', p: 45000, b: 'tm015 mate' }],
    }) as unknown as typeof fetch

    try {
      await sembrarCatalogo()
      const p = await db.productos.get('TM015')
      expect(p?.precioCompra).toBeNull()
      expect(p?.proveedorId).toBeNull()
      expect(p?.proveedor).toBeNull()
      expect(p?.precioVenta).toBe(45000)
    } finally {
      globalThis.fetch = fetchOriginal
    }
  })
})
