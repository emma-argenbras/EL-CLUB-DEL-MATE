import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, engancharSync, type AccionCambio, type Producto } from './db'

function prod(codigo: string): Producto {
  return {
    codigo, descripcion: 'MATE IMPERIAL', proveedor: 'MOHICANO', proveedorId: 'mohicano', fechaCompra: null,
    precioCompra: 20000, rentabilidad: 1.3, precioVenta: 45000, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock: 3, activo: true,
  }
}

interface Enviado { tabla: string; accion: AccionCambio; clave: string; doc: Record<string, unknown> | null }

let todos: Enviado[] = []
/** Lo que viajo de esa tabla (el historial tambien viaja, y no es lo que se mira aca). */
const enviadosDe = (tabla: string) => todos.filter((e) => e.tabla === tabla)

beforeEach(async () => {
  await Promise.all([db.productos.clear(), db.jornadas.clear()])
  engancharAutor(() => ({ email: 'sucursalconcordia@elclubdelmate.com', nombre: 'Gabriela', rol: 'empleado' }))
  todos = []
  engancharSync((tabla, accion, clave, doc) =>
    todos.push({ tabla, accion, clave, doc: doc as Record<string, unknown> | null }),
  )
})

describe('lo que viaja al servidor en cada edicion', () => {
  it('UNA VENTA DESCUENTA STOCK Y MANDA SOLO EL STOCK: el precio viejo del celular no viaja', async () => {
    await db.productos.put(prod('TM015'))
    todos = []
    await db.productos.update('TM015', { stock: 2 })
    const enviados = enviadosDe('productos')
    expect(enviados).toHaveLength(1)
    expect(enviados[0].accion).toBe('actualizar')
    expect(Object.keys(enviados[0].doc!).sort()).toEqual(['actualizadoEn', 'actualizadoPor', 'stock'])
    expect(enviados[0].doc!.stock).toBe(2)
    expect(enviados[0].doc!.actualizadoPor).toBe('sucursalconcordia@elclubdelmate.com')
  })

  it('guardar el formulario entero manda solo lo que cambio', async () => {
    await db.productos.put(prod('TM015'))
    todos = []
    await db.productos.put({ ...prod('TM015'), descripcion: 'MATE IMPERIAL ALPACA', stock: 1 })
    const enviados = enviadosDe('productos')
    expect(enviados[0].accion).toBe('actualizar')
    expect(Object.keys(enviados[0].doc!).sort()).toEqual([
      'actualizadoEn', 'actualizadoPor', 'creadoEn', 'creadoPor', 'descripcion', 'stock',
    ])
  })

  it('guardar el formulario no borra quien creo el producto ni cuando', async () => {
    await db.productos.put(prod('TM015'))
    const antes = await db.productos.get('TM015')
    expect(antes?.creadoPor).toBe('sucursalconcordia@elclubdelmate.com')
    todos = []
    // El formulario arma el objeto de cero, sin creadoEn ni creadoPor.
    await db.productos.put({ ...prod('TM015'), descripcion: 'MATE IMPERIAL ALPACA' })
    const despues = await db.productos.get('TM015')
    expect(despues?.creadoPor).toBe('sucursalconcordia@elclubdelmate.com')
    expect(despues?.creadoEn).toBe(antes?.creadoEn)
    const enviado = enviadosDe('productos')[0].doc!
    expect(enviado.creadoPor).toBe('sucursalconcordia@elclubdelmate.com')
    expect(enviado.creadoEn).toBe(antes?.creadoEn)
  })

  it('un alta sigue mandando el documento entero', async () => {
    await db.productos.put(prod('TM015'))
    const enviados = enviadosDe('productos')
    expect(enviados[0].accion).toBe('guardar')
    expect(enviados[0].doc!.precioVenta).toBe(45000)
    expect(enviados[0].doc!.creadoPor).toBe('sucursalconcordia@elclubdelmate.com')
  })

  it('un campo que se vacia viaja como vacio, no desaparece', async () => {
    // Asi la regla "no se pisa con vacio" lo sigue viendo.
    await db.productos.put(prod('TM015'))
    todos = []
    await db.productos.update('TM015', { proveedor: null })
    expect(enviadosDe('productos')[0].doc).toHaveProperty('proveedor', null)
  })

  it('una ruta con punto (nadie la usa hoy) vuelve al documento entero', async () => {
    await db.jornadas.put({
      id: 'j1', fecha: '2026-10-31', turno: 'M', estado: 'abierto', vendedor: null, cajaInicial: 0,
      horaApertura: '09:00', horaCierre: null, arqueoApertura: { billetes: { '1000': 1 }, monedas: 0 },
      arqueoCierre: null, notas: null,
    })
    todos = []
    // Dexie acepta rutas con punto aunque el tipo no las declare.
    await db.jornadas.update('j1', { 'arqueoApertura.monedas': 500 } as never)
    const enviados = enviadosDe('jornadas')
    expect(enviados[0].accion).toBe('guardar')
    expect(enviados[0].doc!.id).toBe('j1')
    expect(enviados[0].doc!.fecha).toBe('2026-10-31')
  })

  it('en las tablas sin autor tambien va parcial', async () => {
    await db.jornadas.put({
      id: 'j1', fecha: '2026-10-31', turno: 'M', estado: 'abierto', vendedor: null, cajaInicial: 0,
      horaApertura: '09:00', horaCierre: null, arqueoApertura: null, arqueoCierre: null, notas: null,
    })
    todos = []
    await db.jornadas.update('j1', { turno: 'T' })
    const enviados = enviadosDe('jornadas')
    expect(enviados[0].accion).toBe('actualizar')
    expect(Object.keys(enviados[0].doc!).sort()).toEqual(['actualizadoEn', 'turno'])
  })
})
