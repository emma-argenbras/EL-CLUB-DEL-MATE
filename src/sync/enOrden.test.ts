import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, engancharSync, type Producto } from '../db/db'
import { aplicarCambiosRemotos, type CambioRemoto } from './aplicarRemotos'
import { colaPorClave } from './enOrden'

const espera = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms))

describe('una cola por clave', () => {
  it('las tareas de una misma clave corren de a una y en el orden en que se pidieron', async () => {
    const cola = colaPorClave<string>()
    const pasos: string[] = []
    const tarea = (nombre: string, ms: number) => async () => {
      pasos.push(`empieza ${nombre}`)
      await espera(ms)
      pasos.push(`termina ${nombre}`)
    }
    // La primera es la lenta: sin cola, la segunda terminaría antes.
    await Promise.all([cola.encolar('productos', tarea('A', 30)), cola.encolar('productos', tarea('B', 1)), cola.encolar('productos', tarea('C', 1))])
    expect(pasos).toEqual(['empieza A', 'termina A', 'empieza B', 'termina B', 'empieza C', 'termina C'])
  })

  it('claves distintas no se esperan entre sí', async () => {
    const cola = colaPorClave<string>()
    const pasos: string[] = []
    await Promise.all([
      cola.encolar('productos', async () => { await espera(30); pasos.push('productos') }),
      cola.encolar('ventas', async () => { pasos.push('ventas') }),
    ])
    expect(pasos).toEqual(['ventas', 'productos'])
  })

  it('una tarea que falla avisa y no frena a las que vienen atrás', async () => {
    const cola = colaPorClave<string>()
    const pasos: string[] = []
    const fallas: string[] = []
    const rota = cola.encolar('productos', async () => { throw new Error('se rompió') }, (e) => fallas.push((e as Error).message))
    const siguiente = cola.encolar('productos', async () => { pasos.push('la siguiente corrió') })
    await expect(rota).resolves.toBeUndefined()
    await siguiente
    expect(fallas).toEqual(['se rompió'])
    expect(pasos).toEqual(['la siguiente corrió'])
  })

  it('después de vaciar, lo nuevo no espera a lo que quedó corriendo', async () => {
    const cola = colaPorClave<string>()
    const pasos: string[] = []
    const vieja = cola.encolar('productos', async () => { await espera(30); pasos.push('la vieja') })
    cola.vaciar()
    await cola.encolar('productos', async () => { pasos.push('la nueva') })
    expect(pasos).toEqual(['la nueva'])
    await vieja
    expect(pasos).toEqual(['la nueva', 'la vieja'])
  })
})

describe('lo que baja de una tabla se guarda en orden', () => {
  const prod = (codigo: string, extra: Partial<Producto> = {}): Record<string, unknown> => ({
    codigo, descripcion: `Producto ${codigo}`, proveedor: null, proveedorId: null, fechaCompra: null, precioCompra: 2000,
    rentabilidad: 1, precioVenta: 45000, fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: 3, activo: true, ...extra,
  })
  const llega = (datos: Record<string, unknown>, pendiente = false): CambioRemoto => ({ tipo: 'modified', id: String(datos.codigo), datos, pendiente })
  // Al abrir la app: la tabla entera, con TM015 y BORRADO al final.
  const tablaEntera = () => [
    ...Array.from({ length: 300 }, (_, i) => llega(prod(`P${String(i).padStart(3, '0')}`))),
    llega(prod('TM015')),
    llega(prod('BORRADO')),
  ]
  const guardar = (cambios: CambioRemoto[]) => aplicarCambiosRemotos('productos', cambios, () => false, () => {}).then(() => {})

  beforeEach(async () => {
    engancharSync(() => {})
    engancharAutor(() => null)
    await db.productos.clear()
    await db.productos.bulkPut([prod('TM015'), prod('BORRADO')] as unknown as Producto[])
  })

  // Los ecos de lo que la persona acaba de hacer: el precio nuevo de
  // TM015 (todavía sin confirmar) y el borrado de BORRADO. Llegan
  // enseguida, cuando el aviso largo recién empieza a guardarse.
  const ecoDelPrecio = () => [llega(prod('TM015', { precioVenta: 52000 }), true)]
  const ecoDelBorrado = (): CambioRemoto[] => [{ tipo: 'removed', id: 'BORRADO', datos: null, pendiente: false }]

  it('SIN ORDEN, el aviso largo del arranque pisa lo que la persona acaba de cambiar y revive lo que borró', async () => {
    // Así era: cada aviso se guardaba por su cuenta, todos a la vez. Los
    // cortos terminan primero y el largo, que llega a esas filas al
    // final, las deja como estaban antes.
    await Promise.all([guardar(tablaEntera()), guardar(ecoDelPrecio()), guardar(ecoDelBorrado())])
    expect((await db.productos.get('TM015'))?.precioVenta).toBe(45000)
    expect(await db.productos.get('BORRADO')).toBeDefined()
  })

  it('EN ORDEN, lo último que llegó es lo que queda: el precio nuevo, y lo borrado sigue borrado', async () => {
    const cola = colaPorClave<string>()
    await Promise.all([
      cola.encolar('productos', () => guardar(tablaEntera())),
      cola.encolar('productos', () => guardar(ecoDelPrecio())),
      cola.encolar('productos', () => guardar(ecoDelBorrado())),
    ])
    expect((await db.productos.get('TM015'))?.precioVenta).toBe(52000)
    expect(await db.productos.get('BORRADO')).toBeUndefined()
    expect(await db.productos.count()).toBe(301)
  })
})
