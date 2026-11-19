import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, engancharSync, historialAlDia, type Producto } from './db'
import { importarRespaldo, preguntaAntesDeImportar, type Respaldo } from './importarRespaldo'

const prod = (codigo: string, precioVenta = 1000): Producto => ({
  codigo, descripcion: `Producto ${codigo}`, proveedor: null, proveedorId: null, fechaCompra: null,
  precioCompra: 400, rentabilidad: 1.3, precioVenta, fechaPrecioVenta: null, busqueda: codigo.toLowerCase(),
  stock: 1, activo: true,
})
const turno = (id: string) => ({
  id, fecha: '2026-11-10', turno: 'M' as const, estado: 'cerrado' as const, vendedor: 'Gabriela', cajaInicial: 0,
  horaApertura: '09:00', horaCierre: '13:00', arqueoApertura: null, arqueoCierre: null, notas: null,
})
const venta = (id: string) => ({
  id, jornadaId: 'j1', fecha: '2026-11-10', hora: '10:00', codigo: 'A', descripcion: 'x', cantidad: 1,
  precioUnitario: 1000, costoUnitario: null, medioPago: 'EFECTIVO' as const, total: 1000, vendedor: null,
})

const respaldo = (extra: Partial<Respaldo> = {}): Respaldo => ({
  app: 'el-club-del-mate', version: 2, fecha: '2026-11-18T22:10:00.000Z', ...extra,
})

let subidos: string[] = []

beforeEach(async () => {
  engancharSync(() => {})
  engancharAutor(() => null)
  await Promise.all([db.productos.clear(), db.jornadas.clear(), db.ventas.clear(), db.movimientos.clear()])
  await historialAlDia()
  await db.historial.clear()
  // Lo que hay hoy en el aparato: dos productos y un turno con una venta.
  await db.productos.bulkPut([prod('A', 5000), prod('SOLO-ACA')])
  await db.jornadas.put(turno('j1'))
  await db.ventas.put(venta('v1'))
  // Desde acá, con la sesión abierta: alguien al mando y la subida prendida.
  subidos = []
  engancharSync((tabla, accion, clave) => {
    if (tabla !== 'historial') subidos.push(`${accion} ${tabla}/${clave}`)
  })
  engancharAutor(() => ({ email: 'dueno@elclubdelmate.com', nombre: 'Emmanuel', rol: 'owner' }))
})

describe('importar un respaldo', () => {
  it('deja en el aparato lo que dice el archivo, y nada más', async () => {
    const r = await importarRespaldo(
      respaldo({ productos: [prod('A', 4000), prod('SOLO-ARCHIVO')], jornadas: [turno('j1')], ventas: [] }),
    )
    expect((await db.productos.toArray()).map((p) => `${p.codigo}:${p.precioVenta}`).sort()).toEqual([
      'A:4000',
      'SOLO-ARCHIVO:1000',
    ])
    expect(await db.ventas.count()).toBe(0)
    expect(r.filas).toBe(3)
    expect(r.importadas).toEqual(['productos', 'jornadas', 'ventas'])
  })

  it('NO LE BORRA NI LE PISA NADA AL SERVIDOR: no sube un solo cambio y no deja historial', async () => {
    // Sin esto, vaciar cada tabla manda un borrado por fila y llenarla un
    // alta por fila: el servidor queda borrado a medias, para todos.
    await importarRespaldo(
      respaldo({ productos: [prod('A', 4000), prod('SOLO-ARCHIVO')], jornadas: [], ventas: [venta('v9')] }),
    )
    await historialAlDia()
    expect(subidos).toEqual([])
    expect(await db.historial.count()).toBe(0)
  })

  it('lo que se carga después de importar vuelve a subir como siempre', async () => {
    await importarRespaldo(respaldo({ productos: [prod('A', 4000)] }))
    await db.productos.update('A', { precioVenta: 4500 })
    await historialAlDia()
    expect(subidos).toEqual(['actualizar productos/A'])
    expect((await db.historial.toArray()).map((h) => `${h.accion} ${h.clave}.${h.campo}`)).toEqual(['edito A.precioVenta'])
  })

  it('un respaldo viejo que no trae todas las tablas deja las que faltan como estaban', async () => {
    const r = await importarRespaldo(respaldo({ version: 1, productos: [prod('A', 4000)] }))
    expect(r.faltantes).toContain('ventas')
    expect(r.faltantes).toContain('jornadas')
    expect(await db.ventas.count()).toBe(1)
    expect(await db.jornadas.count()).toBe(1)
    expect((await db.productos.toArray()).map((p) => p.codigo)).toEqual(['A'])
  })

  it('un archivo que no es de la app no toca nada', async () => {
    await expect(importarRespaldo({ app: 'otra-cosa', productos: [] })).rejects.toThrow(/no es un respaldo/)
    await expect(importarRespaldo(null)).rejects.toThrow(/no es un respaldo/)
    await expect(importarRespaldo([prod('A')])).rejects.toThrow(/no es un respaldo/)
    expect(() => preguntaAntesDeImportar({ app: 'otra-cosa' })).toThrow(/no es un respaldo/)
    expect(await db.productos.count()).toBe(2)
  })

  it('si el archivo está roto a la mitad, el aparato queda como estaba', async () => {
    // Una fila sin clave en la segunda tabla: no puede quedar la primera
    // ya reemplazada y la segunda vacía.
    const { id: _sinId, ...ventaRota } = venta('x')
    await expect(
      importarRespaldo(respaldo({ productos: [prod('NUEVO')], ventas: [ventaRota] })),
    ).rejects.toThrow()
    expect((await db.productos.toArray()).map((p) => p.codigo).sort()).toEqual(['A', 'SOLO-ACA'])
    expect(await db.ventas.count()).toBe(1)
  })

  it('antes de importar dice de cuándo es el archivo, cuánto trae y que el servidor no se toca', () => {
    const texto = preguntaAntesDeImportar(
      respaldo({
        productos: Array.from({ length: 1336 }, (_, i) => prod(`P${i}`)),
        jornadas: [turno('j1')],
        ventas: [venta('v1'), venta('v2')],
        ajustes: [{ clave: 'x', valor: 'y' }],
      }),
    )
    expect(texto).toContain('ESTE aparato')
    expect(texto).toContain('del 18/11/2026')
    expect(texto).toContain('1.336 productos, 1 turno, 2 ventas.')
    expect(texto).not.toContain('ajuste')
    expect(texto).toMatch(/En el servidor no se borra ni se pisa nada/)
    expect(texto).toMatch(/lo que tenga el archivo y el servidor no, se sube/)
  })
})
