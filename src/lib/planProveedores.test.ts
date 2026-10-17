import { describe, expect, it } from 'vitest'
import { armarPlanProveedores } from './planProveedores'
import type { Producto, Proveedor } from '../db/db'
import { normalizar } from './formato'

function prov(id: string, nombre: string, activo = true, creadoEn = 1): Proveedor {
  return { id, nombre, contacto: null, notas: null, activo, creadoEn }
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

describe('duplicados', () => {
  it('junta los que tienen el mismo nombre con distinto id', () => {
    const plan = armarPlanProveedores(
      [prov('a', 'ABEL'), prov('b', 'ABEL'), prov('c', 'MOHICANO')],
      [prod('1', 'a', 'ABEL'), prod('2', 'a', 'ABEL'), prod('3', 'b', 'ABEL')],
    )
    expect(plan.duplicados).toHaveLength(1)
    expect(plan.duplicados[0].sobrevive.proveedor.id).toBe('a')
    expect(plan.duplicados[0].absorbidos.map((x) => x.proveedor.id)).toEqual(['b'])
    expect(plan.duplicados[0].productosAMover).toBe(1)
  })

  it('no le importan los acentos ni las mayusculas', () => {
    const plan = armarPlanProveedores([prov('a', 'A Matear Alejo'), prov('b', 'A MATEAR ALEJO')], [])
    expect(plan.duplicados).toHaveLength(1)
  })

  it('sobrevive el que mas productos tiene, no el primero', () => {
    const plan = armarPlanProveedores(
      [prov('pocos', 'ABEL'), prov('muchos', 'ABEL')],
      [prod('1', 'muchos', 'ABEL'), prod('2', 'muchos', 'ABEL'), prod('3', 'pocos', 'ABEL')],
    )
    expect(plan.duplicados[0].sobrevive.proveedor.id).toBe('muchos')
  })

  it('a igualdad de productos sobrevive el mas viejo', () => {
    const plan = armarPlanProveedores(
      [prov('nuevo', 'ABEL', true, 2000), prov('viejo', 'ABEL', true, 1000)],
      [],
    )
    expect(plan.duplicados[0].sobrevive.proveedor.id).toBe('viejo')
  })

  it('uno solo con ese nombre no es un duplicado', () => {
    const plan = armarPlanProveedores([prov('a', 'ABEL')], [prod('1', 'a', 'ABEL')])
    expect(plan.duplicados).toEqual([])
  })
})

describe('ids huerfanos', () => {
  it('encuentra el proveedorId que ningun documento tiene', () => {
    const plan = armarPlanProveedores([prov('existe', 'MOHICANO')], [prod('1', 'fantasma', 'GOMECITO')])
    expect(plan.huerfanos).toHaveLength(1)
    expect(plan.huerfanos[0].id).toBe('fantasma')
    expect(plan.huerfanos[0].productos).toBe(1)
  })

  it('lo engancha al proveedor que ya existe con ese nombre', () => {
    // Es el caso de todos los dias: el documento del proveedor se
    // perdio en un dispositivo, pero en otro existe con el mismo
    // nombre. No hay que crear nada, hay que reapuntar.
    const plan = armarPlanProveedores(
      [prov('bueno', 'MOHICANO')],
      [prod('1', 'id-de-otro-celular', 'MOHICANO')],
    )
    expect(plan.huerfanos[0].seEnganchaA?.id).toBe('bueno')
    expect(plan.aCrear).toEqual([])
  })

  it('si no hay ninguno con ese nombre, hay que crearlo', () => {
    const plan = armarPlanProveedores([prov('otro', 'MOHICANO')], [prod('1', 'perdido', 'RINGO VAINAS')])
    expect(plan.aCrear).toHaveLength(1)
    expect(plan.aCrear[0].nombre).toBe('RINGO VAINAS')
  })

  it('un producto sin proveedorId no es un huerfano, es un sin proveedor', () => {
    const plan = armarPlanProveedores([], [prod('1', null, null)])
    expect(plan.huerfanos).toEqual([])
    expect(plan.sinProveedor).toBe(1)
  })
})

describe('reactivar', () => {
  it('propone revivir a un inactivo que todavia tiene productos vivos', () => {
    const plan = armarPlanProveedores([prov('a', 'ABEL', false)], [prod('1', 'a', 'ABEL')])
    expect(plan.aReactivar.map((x) => x.proveedor.id)).toEqual(['a'])
  })

  it('no propone revivir a uno cuyos productos estan todos descontinuados', () => {
    // Si se marco inactivo y sus productos quedaron descontinuados, la
    // decision fue deliberada y no hay que deshacerla sola.
    const plan = armarPlanProveedores(
      [prov('a', 'ABEL', false)],
      [prod('1', 'a', 'ABEL', { descontinuado: true })],
    )
    expect(plan.aReactivar).toEqual([])
  })

  it('no propone revivir a uno sin productos', () => {
    const plan = armarPlanProveedores([prov('a', 'ABEL', false)], [])
    expect(plan.aReactivar).toEqual([])
  })
})

describe('los archivados no cuentan', () => {
  it('un producto archivado no suma ni a su proveedor ni al plan', () => {
    const plan = armarPlanProveedores(
      [prov('a', 'ABEL')],
      [prod('1', 'a', 'ABEL', { archivado: true }), prod('2', 'a', 'ABEL')],
    )
    expect(plan.conUso[0].productos).toBe(1)
  })
})

describe('el panorama del 17/10', () => {
  it('reproduce la forma del problema real', () => {
    // 3 proveedores vivos y 33 inactivos, duplicados entre ellos, y
    // productos apuntando a ids que no existen.
    const proveedores = [
      prov('moh-1', 'MOHICANO', false),
      prov('moh-2', 'MOHICANO', false),
      prov('abel', 'ABEL', false),
      prov('gom', 'GOMECITO'),
    ]
    const productos = [
      ...Array.from({ length: 10 }, (_, i) => prod(`m${i}`, 'moh-1', 'MOHICANO')),
      prod('m10', 'moh-2', 'MOHICANO'),
      prod('a1', 'abel', 'ABEL'),
      // El id que puso otro celular y cuyo documento nunca subio.
      prod('g1', 'id-fantasma', 'GOMECITO'),
      prod('x1', 'solo-en-otro-celu', 'RINGO VAINAS'),
      prod('s1', null, null),
    ]
    const plan = armarPlanProveedores(proveedores, productos)

    expect(plan.activos).toBe(1)
    expect(plan.inactivos).toBe(3)
    expect(plan.duplicados).toHaveLength(1)
    expect(plan.duplicados[0].productosAMover).toBe(1)
    expect(plan.huerfanos).toHaveLength(2)
    // GOMECITO se reengancha solo; RINGO VAINAS hay que crearlo.
    expect(plan.aCrear.map((h) => h.nombre)).toEqual(['RINGO VAINAS'])
    expect(plan.aReactivar.map((c) => c.proveedor.nombre).sort()).toEqual(['ABEL', 'MOHICANO', 'MOHICANO'])
    expect(plan.sinProveedor).toBe(1)
    expect(plan.productosAfectados).toBe(3)
  })
})
