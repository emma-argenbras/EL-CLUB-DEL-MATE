import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Producto, type Proveedor } from './db'
import { aplicarPlanProveedores, MOTIVO } from './limpiarProveedores'
import { armarPlanProveedores } from '../lib/planProveedores'
import { normalizar } from '../lib/formato'

function prov(id: string, nombre: string, activo = true, extra: Partial<Proveedor> = {}): Proveedor {
  return { id, nombre, contacto: null, notas: null, activo, creadoEn: 1, ...extra }
}

function prod(codigo: string, proveedorId: string | null, nombre: string | null, extra: Partial<Producto> = {}): Producto {
  return {
    codigo,
    descripcion: codigo,
    proveedor: nombre,
    proveedorId,
    fechaCompra: null,
    precioCompra: null,
    rentabilidad: null,
    precioVenta: null,
    fechaPrecioVenta: null,
    busqueda: normalizar(codigo),
    stock: null,
    activo: true,
    ...extra,
  }
}

async function sembrar(proveedores: Proveedor[], productos: Producto[]) {
  await db.proveedores.clear()
  await db.productos.clear()
  await db.historial.clear()
  await db.proveedores.bulkAdd(proveedores)
  await db.productos.bulkAdd(productos)
  await historialAlDia()
  await db.historial.clear()
}

async function planDeAhora() {
  return armarPlanProveedores(await db.proveedores.toArray(), await db.productos.toArray())
}

describe('aplicarPlanProveedores', () => {
  beforeEach(async () => {
    await db.proveedores.clear()
    await db.productos.clear()
    await db.historial.clear()
    // Sin autor enganchado el historial no anota nada, a proposito: un
    // cambio sin nadie logueado no se le puede atribuir a nadie. La
    // limpieza la corre una persona desde Ajustes, asi que siempre hay.
    engancharAutor(() => ({
      email: 'emmanuel@elclubdelmate.com',
      nombre: 'Emmanuel',
      rol: 'owner',
    }))
  })

  it('unifica dos fichas en una, con el id del nombre', async () => {
    await sembrar(
      [prov('uuid-1', 'ABEL'), prov('uuid-2', 'ABEL')],
      [prod('a', 'uuid-1', 'ABEL'), prod('b', 'uuid-1', 'ABEL'), prod('c', 'uuid-2', 'ABEL')],
    )
    const resultado = await aplicarPlanProveedores()

    const fichas = await db.proveedores.toArray()
    expect(fichas).toHaveLength(1)
    expect(fichas[0].id).toBe('prov-abel')
    expect(resultado.fichasBorradas).toBe(2)
    expect(resultado.fichasCreadas).toBe(1)

    const productos = await db.productos.toArray()
    expect(productos.every((p) => p.proveedorId === 'prov-abel')).toBe(true)
  })

  it('no deja ningun producto apuntando a una ficha que no existe', async () => {
    // La prueba que mas importa: despues de aplicar, cada proveedorId
    // tiene que corresponder a una ficha de verdad.
    await sembrar(
      [prov('uuid-moh', 'MOHICANO', false), prov('uuid-gom', 'GOMECITO')],
      [
        prod('a', 'uuid-moh', 'MOHICANO'),
        prod('b', 'id-perdido-de-otro-celu', 'MOHICANO'),
        prod('c', 'otro-perdido', 'SALDOS'),
        prod('d', 'uuid-gom', 'GOMECITO'),
      ],
    )
    await aplicarPlanProveedores()

    const ids = new Set((await db.proveedores.toArray()).map((p) => p.id))
    const productos = await db.productos.toArray()
    for (const p of productos) {
      expect(p.proveedorId, `producto ${p.codigo}`).not.toBeNull()
      expect(ids.has(p.proveedorId!), `producto ${p.codigo} -> ${p.proveedorId}`).toBe(true)
    }
  })

  it('crea una sola ficha aunque haya tres ids perdidos con el mismo nombre', async () => {
    await sembrar(
      [],
      [
        prod('a', 'perdido-1', 'SALDOS'),
        prod('b', 'perdido-2', 'SALDOS'),
        prod('c', 'perdido-3', 'saldos '),
      ],
    )
    await aplicarPlanProveedores()
    const fichas = await db.proveedores.toArray()
    expect(fichas).toHaveLength(1)
    expect(fichas[0].id).toBe('prov-saldos')
    expect((await db.productos.toArray()).every((p) => p.proveedorId === 'prov-saldos')).toBe(true)
  })

  it('reactiva al inactivo que termina con productos vigentes', async () => {
    await sembrar([prov('uuid-ariel', 'ARIEL GARCIA', false)], [
      ...Array.from({ length: 18 }, (_, i) => prod(`g${i}`, 'perdido', 'ARIEL GARCIA')),
    ])
    await aplicarPlanProveedores()
    expect((await db.proveedores.get('prov-ariel-garcia'))?.activo).toBe(true)
  })

  it('no reactiva al que termina con todo descontinuado', async () => {
    await sembrar(
      [prov('uuid-x', 'ABEL', false)],
      [prod('a', 'uuid-x', 'ABEL', { descontinuado: true })],
    )
    await aplicarPlanProveedores()
    expect((await db.proveedores.get('prov-abel'))?.activo).toBe(false)
  })

  it('rescata el contacto y las notas de la ficha absorbida', async () => {
    await sembrar(
      [
        prov('grande', 'ABEL'),
        prov('chica', 'ABEL', true, { contacto: '345 4123456', notas: 'Entrega los martes' }),
      ],
      [prod('a', 'grande', 'ABEL'), prod('b', 'grande', 'ABEL')],
    )
    await aplicarPlanProveedores()
    const ficha = await db.proveedores.get('prov-abel')
    expect(ficha?.contacto).toBe('345 4123456')
    expect(ficha?.notas).toBe('Entrega los martes')
  })

  it('el nombre de la absorbida queda como alias', async () => {
    await sembrar(
      [prov('uuid-arandu', 'ARANDU', true, { alias: ['ARANDUPÒ'] }), prov('uuid-ap', 'ARANDUPÒ')],
      [prod('a', 'uuid-arandu', 'ARANDU'), prod('b', 'uuid-ap', 'ARANDUPÒ')],
    )
    await aplicarPlanProveedores()
    const fichas = await db.proveedores.toArray()
    expect(fichas).toHaveLength(1)
    expect(fichas[0].id).toBe('prov-arandu')
    expect(fichas[0].nombre).toBe('ARANDU')
    expect(fichas[0].alias).toContain('ARANDUPÒ')
    // Y los tres productos quedan con el nombre bueno escrito.
    expect((await db.productos.toArray()).every((p) => p.proveedor === 'ARANDU')).toBe(true)
  })

  it('deja todo en el historial con el motivo', async () => {
    await sembrar([prov('uuid-1', 'ABEL')], [prod('a', 'uuid-1', 'ABEL')])
    await aplicarPlanProveedores()
    await historialAlDia()

    const renglones = await db.historial.toArray()
    expect(renglones.length).toBeGreaterThan(0)
    expect(renglones.every((r) => r.motivo === MOTIVO)).toBe(true)
    expect(renglones.some((r) => r.tabla === 'productos' && r.campo === 'proveedorId')).toBe(true)
  })

  it('no toca ningun producto ni ninguna venta de mas', async () => {
    await sembrar(
      [prov(/* ya esta bien */ 'prov-abel', 'ABEL')],
      [prod('a', 'prov-abel', 'ABEL')],
    )
    const resultado = await aplicarPlanProveedores()
    expect(resultado.productosTocados).toBe(0)
    expect(resultado.fichasBorradas).toBe(0)
    expect(await db.productos.count()).toBe(1)
  })

  it('aplicarlo dos veces no cambia nada la segunda', async () => {
    // Si no fuera idempotente, un doble toque del boton podria dejar
    // la base distinta de lo que mostro la pantalla.
    await sembrar(
      [prov('uuid-1', 'ABEL'), prov('uuid-2', 'ABEL'), prov('uuid-3', 'MOHICANO', false)],
      [
        prod('a', 'uuid-1', 'ABEL'),
        prod('b', 'uuid-2', 'ABEL'),
        prod('c', 'perdido', 'SALDOS'),
        prod('d', 'uuid-3', 'MOHICANO'),
      ],
    )
    await aplicarPlanProveedores()
    const despues = await db.proveedores.toArray()
    const productos = await db.productos.toArray()

    const segunda = await aplicarPlanProveedores()
    expect(segunda.productosTocados).toBe(0)
    expect(segunda.fichasBorradas).toBe(0)
    expect(segunda.fichasCreadas).toBe(0)
    expect(segunda.fichasActualizadas).toBe(0)
    expect(await db.proveedores.toArray()).toEqual(despues)
    expect(await db.productos.toArray()).toEqual(productos)
  })

  it('despues de aplicar, el plan no propone nada mas', async () => {
    await sembrar(
      [prov('uuid-1', 'ABEL'), prov('uuid-2', 'ABEL'), prov('uuid-3', 'MOHICANO', false)],
      [prod('a', 'uuid-1', 'ABEL'), prod('b', 'perdido', 'SALDOS'), prod('c', 'uuid-3', 'MOHICANO')],
    )
    await aplicarPlanProveedores()
    const plan = await planDeAhora()
    expect(plan.unificar).toEqual([])
    expect(plan.reenganchar).toEqual([])
    expect(plan.crear).toEqual([])
    expect(plan.reactivar).toEqual([])
    expect(plan.idsPerdidos).toEqual([])
  })

  it('los productos sin proveedor quedan como estaban', async () => {
    await sembrar([prov('uuid-1', 'ABEL')], [prod('a', 'uuid-1', 'ABEL'), prod('z', null, null)])
    await aplicarPlanProveedores()
    const suelto = await db.productos.get('z')
    expect(suelto?.proveedorId).toBe(null)
    expect(suelto?.proveedor).toBe(null)
  })
})
