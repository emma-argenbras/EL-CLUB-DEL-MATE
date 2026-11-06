import { describe, expect, it } from 'vitest'
import type { Hallazgo } from './auditoria'
import { agruparPorPlazo, avanceDe, contarParaHoy } from './agruparAvisos'

const h = (id: string, nivel: Hallazgo['nivel'], extra: Partial<Hallazgo> = {}): Hallazgo => ({
  id, nivel, modulo: 'caja', titulo: id, detalle: '', comoSeResuelve: '', ruta: '/', ...extra,
})

describe('los avisos por plazo', () => {
  const todos = [h('a', 'aviso'), h('b', 'critico'), h('c', 'importante'), h('d', 'critico')]

  it('van en orden: para hoy, esta semana, cuando puedas', () => {
    expect(agruparPorPlazo(todos).map((g) => [g.plazo, g.hallazgos.map((x) => x.id)])).toEqual([
      ['hoy', ['b', 'd']],
      ['semana', ['c']],
      ['cuandoPuedas', ['a']],
    ])
  })

  it('un plazo sin avisos no aparece', () => {
    expect(agruparPorPlazo([h('x', 'aviso')]).map((g) => g.plazo)).toEqual(['cuandoPuedas'])
  })

  it('la campana cuenta solo lo de hoy', () => {
    expect(contarParaHoy(todos)).toBe(2)
    expect(contarParaHoy([h('x', 'aviso'), h('y', 'importante')])).toBe(0)
  })
})

describe('el mantenimiento como avance', () => {
  it('532 sin remarcar de 1337: el 60 % esta al dia', () => {
    expect(avanceDe({ cantidad: 532, total: 1337 })).toBe(60)
  })
  it('1207 costos vencidos de 1337: el 10 %', () => {
    expect(avanceDe({ cantidad: 1207, total: 1337 })).toBe(10)
  })
  it('sin total no es un avance', () => {
    expect(avanceDe({ cantidad: 3 })).toBeNull()
  })
})
