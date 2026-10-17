import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { asegurarProveedor, db } from './db'
import { idDeProveedor } from '../lib/idProveedor'

/**
 * El unico camino por el que se crea un proveedor desde un nombre.
 * Lo usan el alta de Proveedores, el "+ Proveedor nuevo..." de
 * Productos y --cuando este-- la importacion del Excel.
 */
describe('asegurarProveedor', () => {
  beforeEach(async () => {
    await db.proveedores.clear()
  })

  it('crea la ficha con el id derivado del nombre', async () => {
    const id = await asegurarProveedor('MOHICANO')
    expect(id).toBe(idDeProveedor('MOHICANO'))
    expect((await db.proveedores.get(id!))?.nombre).toBe('MOHICANO')
  })

  it('la crea activa', async () => {
    const id = await asegurarProveedor('GOMECITO')
    expect((await db.proveedores.get(id!))?.activo).toBe(true)
  })

  it('llamarlo dos veces no crea dos fichas', async () => {
    const a = await asegurarProveedor('RINGO VAINAS')
    const b = await asegurarProveedor('RINGO VAINAS')
    expect(a).toBe(b)
    expect(await db.proveedores.count()).toBe(1)
  })

  it('reconoce el mismo nombre escrito distinto', async () => {
    // El caso de la importacion: la planilla trae "MOHICANO " con un
    // espacio al final y la app ya tiene "Mohicano".
    const a = await asegurarProveedor('Mohicano')
    const b = await asegurarProveedor('MOHICANO ')
    expect(b).toBe(a)
    expect(await db.proveedores.count()).toBe(1)
  })

  it('reusa una ficha vieja que todavia tiene id al azar', async () => {
    // Mientras no se aplique la limpieza, las fichas de hoy siguen con
    // su id aleatorio. La importacion tiene que caer sobre ESAS, no
    // crear una segunda al lado.
    await db.proveedores.add({
      id: '0c8f1b7e-9a2d-4f3c-8b1a-5d6e7f809a1b',
      nombre: 'WALTER ADAMOLI',
      contacto: null,
      notas: null,
      activo: true,
    })
    const id = await asegurarProveedor('walter adamoli')
    expect(id).toBe('0c8f1b7e-9a2d-4f3c-8b1a-5d6e7f809a1b')
    expect(await db.proveedores.count()).toBe(1)
  })

  it('encuentra por alias en vez de crear una ficha nueva', async () => {
    // El caso de ARANDU / ARANDUPO: la importacion del Excel va a leer
    // "ARANDUPO" en la planilla y tiene que caer sobre ARANDU, no
    // crear otra vez la ficha que acabamos de unificar.
    await db.proveedores.add({
      id: 'prov-arandu',
      nombre: 'ARANDU',
      contacto: null,
      notas: null,
      activo: true,
      alias: ['ARANDUPÒ'],
    })
    const id = await asegurarProveedor('ARANDUPÒ')
    expect(id).toBe('prov-arandu')
    expect(await db.proveedores.count()).toBe(1)
  })

  it('el alias tambien aguanta que lo escriban distinto', async () => {
    await db.proveedores.add({
      id: 'prov-arandu',
      nombre: 'ARANDU',
      contacto: null,
      notas: null,
      activo: true,
      alias: ['ARANDUPÒ'],
    })
    expect(await asegurarProveedor(' arandupo ')).toBe('prov-arandu')
    expect(await db.proveedores.count()).toBe(1)
  })

  it('sin el alias, crea la otra ficha', async () => {
    await db.proveedores.add({
      id: 'prov-arandu',
      nombre: 'ARANDU',
      contacto: null,
      notas: null,
      activo: true,
    })
    expect(await asegurarProveedor('ARANDUPÒ')).toBe('prov-arandupo')
    expect(await db.proveedores.count()).toBe(2)
  })

  it('un nombre vacio no crea nada', async () => {
    expect(await asegurarProveedor('   ')).toBe(null)
    expect(await db.proveedores.count()).toBe(0)
  })

  it('dos proveedores distintos son dos fichas', async () => {
    await asegurarProveedor('MOHICANO')
    await asegurarProveedor('GOMECITO')
    expect(await db.proveedores.count()).toBe(2)
  })
})
