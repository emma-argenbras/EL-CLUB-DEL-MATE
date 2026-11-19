import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, engancharSync, type Producto } from '../db/db'
import { aplicarCambiosRemotos, type CambioRemoto } from './aplicarRemotos'
import { colaPorClave, esperarLoBajado } from './enOrden'

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

describe('saber cuándo terminó de guardarse lo que estaba encolado', () => {
  it('alDia espera a lo que había encolado al preguntar, y no a lo que se encola después', async () => {
    const cola = colaPorClave<string>()
    const pasos: string[] = []
    void cola.encolar('productos', async () => { await espera(20); pasos.push('la primera') })
    void cola.encolar('productos', async () => { await espera(5); pasos.push('la segunda') })
    const alDia = cola.alDia('productos')
    // Encolada después de preguntar: no tiene por qué esperarla.
    const tardia = cola.encolar('productos', async () => { await espera(40); pasos.push('la tardía') })
    await alDia
    expect(pasos).toEqual(['la primera', 'la segunda'])
    await tardia
  })

  it('sin nada encolado para esa clave, se cumple enseguida', async () => {
    const cola = colaPorClave<string>()
    void cola.encolar('ventas', () => espera(50))
    let listo = false
    void cola.alDia('productos').then(() => { listo = true })
    await espera(1)
    expect(listo).toBe(true)
  })

  it('no rechaza aunque lo encolado haya fallado', async () => {
    const cola = colaPorClave<string>()
    void cola.encolar('productos', async () => { throw new Error('se rompió') }, () => {})
    await expect(cola.alDia('productos')).resolves.toBeUndefined()
  })

  it('esperarLoBajado da true cuando termina antes del límite', async () => {
    const cola = colaPorClave<string>()
    let guardado = false
    void cola.encolar('productos', async () => { await espera(15); guardado = true })
    expect(await esperarLoBajado(cola, 'productos', 2000)).toBe(true)
    expect(guardado).toBe(true)
  })

  it('esperarLoBajado da false si se cumple el límite y todavía se está guardando', async () => {
    const cola = colaPorClave<string>()
    let guardado = false
    const lenta = cola.encolar('productos', async () => { await espera(80); guardado = true })
    expect(await esperarLoBajado(cola, 'productos', 10)).toBe(false)
    expect(guardado).toBe(false)
    await lenta
  })
})

/**
 * Lo que pasaba (19/11): un aparato que estaba cerrado mientras otro
 * borraba un gasto lo volvía a subir al abrirse. La subida del arranque
 * compara lo que hay acá contra lo que hay en el servidor; si lee lo de
 * acá antes de que termine de guardarse lo que bajó, la fila borrada
 * todavía está y parece «la tengo yo y el servidor no».
 */
describe('UN APARATO ATRASADO NO VUELVE A SUBIR LO QUE OTRO BORRÓ', () => {
  const prod = (codigo: string): Record<string, unknown> => ({
    codigo, descripcion: `Producto ${codigo}`, proveedor: null, proveedorId: null, fechaCompra: null, precioCompra: 2000,
    rentabilidad: 1, precioVenta: 45000, fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: 3, activo: true,
  })
  const llega = (codigo: string): CambioRemoto => ({ tipo: 'added', id: codigo, datos: prod(codigo), pendiente: false })
  const guardar = (cambios: CambioRemoto[]) => aplicarCambiosRemotos('productos', cambios, () => false, () => {}).then(() => {})
  const codigos = [...Array.from({ length: 600 }, (_, i) => `P${String(i).padStart(3, '0')}`), 'BORRADO-EN-OTRO']
  // Lo que el servidor tiene: todo menos lo que el otro aparato borró.
  const enElServidor = new Set(codigos.filter((c) => c !== 'BORRADO-EN-OTRO'))
  // Lo que haría la subida: lo que está acá y el servidor no tiene.
  const loQueSubiria = async () => (await db.productos.toArray()).map((p) => p.codigo).filter((c) => !enElServidor.has(c))

  let cola: ReturnType<typeof colaPorClave<string>>
  let todo: Promise<unknown>

  beforeEach(async () => {
    engancharSync(() => {})
    engancharAutor(() => null)
    await db.productos.clear()
    // El aparato atrasado: tiene todo, también lo que ya borraron.
    await db.productos.bulkPut(codigos.map(prod) as unknown as Producto[])
    cola = colaPorClave<string>()
    // Al abrir: primero lo que Firestore tenía guardado (la tabla
    // entera, con la fila borrada adentro) y después lo del servidor,
    // que trae el borrado.
    todo = Promise.all([
      cola.encolar('productos', () => guardar(codigos.map(llega))),
      cola.encolar('productos', () => guardar([{ tipo: 'removed', id: 'BORRADO-EN-OTRO', datos: null, pendiente: false }])),
    ])
  })

  it('SIN ESPERAR, la subida todavía ve la fila borrada y la volvería a subir', async () => {
    expect(await loQueSubiria()).toEqual(['BORRADO-EN-OTRO'])
    await todo
  })

  it('ESPERANDO a que termine de guardarse lo que bajó, no hay nada para subir', async () => {
    expect(await esperarLoBajado(cola, 'productos', 5000)).toBe(true)
    expect(await loQueSubiria()).toEqual([])
    await todo
  })

  it('y si se cumple el límite, avisa que no se puede comparar todavía', async () => {
    expect(await esperarLoBajado(cola, 'productos', 0)).toBe(false)
    await todo
  })
})

