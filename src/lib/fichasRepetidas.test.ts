import { describe, expect, it } from 'vitest'
import type { Proveedor } from '../db/db'
import { planDeRepetidas, quedaEntreVacias } from './fichasRepetidas'
import { idDeProveedor } from './idProveedor'

const prov = (id: string, nombre: string): Proveedor => ({ id, nombre, contacto: null, notas: null, activo: true })
const prod = (proveedorId: string | null) => ({ proveedorId })
const mov = (proveedorId: string) => ({ proveedorId })

describe('las fichas de proveedor repetidas', () => {
  it('una ficha vacía con el mismo nombre exacto que otra que tiene datos se une a esa', () => {
    const plan = planDeRepetidas(
      [prov('hugo-1', 'HUGO'), prov('hugo-2', 'HUGO '), prov('ana', 'ANA')],
      [prod('hugo-1'), prod('hugo-1'), prod('ana')],
      [],
    )
    expect(plan.vacias.map((r) => `${r.vacia.id}→${r.gemela.proveedor.id}:${r.gemela.productos}`)).toEqual(['hugo-2→hugo-1:2'])
    expect(plan.aMano).toEqual([])
  })

  it('la gemela puede tener solo compras o pagos, sin productos', () => {
    const plan = planDeRepetidas([prov('a', 'ARANDU'), prov('b', 'ARANDU')], [], [mov('b'), mov('b')])
    expect(plan.vacias.map((r) => `${r.vacia.id}→${r.gemela.proveedor.id}:${r.gemela.movimientos}`)).toEqual(['a→b:2'])
  })

  it('si dos del mismo nombre tienen datos, el grupo entero va a mano (con la vacía también)', () => {
    const plan = planDeRepetidas(
      [prov('h1', 'HUGO-LA ENTRERRIANA'), prov('h2', 'HUGO-LA ENTRERRIANA'), prov('h3', 'HUGO-LA ENTRERRIANA')],
      [prod('h2'), prod('h1'), prod('h1')],
      [mov('h2')],
    )
    expect(plan.vacias).toEqual([])
    expect(plan.aMano).toHaveLength(1)
    expect(plan.aMano[0].fichas.map((f) => f.proveedor.id)).toEqual(['h1', 'h2', 'h3'])
  })

  it('si ninguna del nombre tiene datos (20/11), queda una y las demás se le unen en la misma pasada', () => {
    const plan = planDeRepetidas([prov('x1', 'XX'), prov('x2', 'XX'), prov('x3', 'XX')], [], [])
    expect(plan.vacias.map((r) => `${r.vacia.id}→${r.gemela.proveedor.id}:${r.todasVacias}`)).toEqual(['x2→x1:true', 'x3→x1:true'])
    // Las que tienen gemela con datos lo dicen al revés.
    const otra = planDeRepetidas([prov('a', 'ARANDU'), prov('b', 'ARANDU')], [prod('b')], [])
    expect(otra.vacias[0].todasVacias).toBe(false)
  })

  it('entre vacías queda la del id de su nombre; si no, la de más datos, la activa, la más vieja', () => {
    const id = idDeProveedor('LA YERBERA')
    const con = (p: Proveedor, extra: Partial<Proveedor>) => ({ ...p, ...extra })
    const a = prov('a-azar', 'LA YERBERA'), b = prov(id, 'LA YERBERA'), c = prov('c-azar', 'LA YERBERA')
    expect(quedaEntreVacias('LA YERBERA', [con(a, { contacto: '11 5555', ciudad: 'X' }), b, c]).id).toBe(id)
    expect(quedaEntreVacias('LA YERBERA', [a, con(c, { aliasCbu: 'la.yerbera' })]).id).toBe('c-azar')
    expect(quedaEntreVacias('LA YERBERA', [a, con(c, { alias: ['YERBERA'] })]).id).toBe('c-azar')
    expect(quedaEntreVacias('LA YERBERA', [a, con(c, { contacto: '   ' })]).id).toBe('a-azar') // un espacio no es un dato
    expect(quedaEntreVacias('LA YERBERA', [con(a, { activo: false }), c]).id).toBe('c-azar')
    expect(quedaEntreVacias('LA YERBERA', [con(a, { creadoEn: 200 }), con(c, { creadoEn: 100 })]).id).toBe('c-azar')
    expect(quedaEntreVacias('LA YERBERA', [con(a, { creadoEn: 200 }), c]).id).toBe('a-azar') // sin fecha, al final
    expect(quedaEntreVacias('LA YERBERA', [c, a]).id).toBe('a-azar')
  })

  it('los parecidos no son repetidos: SALDO y SALDOS, o con otra mayúscula', () => {
    const plan = planDeRepetidas([prov('s1', 'SALDO'), prov('s2', 'SALDOS'), prov('m1', 'Mohicano'), prov('m2', 'MOHICANO')], [prod('s1'), prod('m1')], [])
    expect(plan).toEqual({ vacias: [], aMano: [] })
  })

  it('varias vacías del mismo nombre van todas a la misma gemela, ordenadas por nombre', () => {
    const plan = planDeRepetidas(
      [prov('z2', 'ZETA'), prov('z1', 'ZETA'), prov('z3', 'ZETA'), prov('b1', 'BETA'), prov('b2', 'BETA')],
      [prod('z1'), prod('b2')],
      [],
    )
    expect(plan.vacias.map((r) => `${r.vacia.id}→${r.gemela.proveedor.id}`)).toEqual(['b1→b2', 'z2→z1', 'z3→z1'])
  })
})
