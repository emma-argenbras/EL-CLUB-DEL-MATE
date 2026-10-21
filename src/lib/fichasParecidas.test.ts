import { describe, expect, it } from 'vitest'
import type { Proveedor } from '../db/db'
import { distancia, fichasParecidas, palabrasClave } from './fichasParecidas'

function prov(nombre: string, id = nombre.toLowerCase().replace(/\s+/g, '-')): Proveedor {
  return { id, nombre, contacto: null, notas: null, activo: true }
}

/** Busca el par de la lista, en cualquier orden. */
function par(pares: ReturnType<typeof fichasParecidas>, a: string, b: string) {
  return pares.find(
    (p) =>
      (p.a.nombre === a && p.b.nombre === b) || (p.a.nombre === b && p.b.nombre === a),
  )
}

describe('palabrasClave', () => {
  it('saca acentos, puntuacion y relleno', () => {
    expect(palabrasClave('DISTRIBUIDORA DE MATES')).toEqual(['distribuidora', 'mate'])
    expect(palabrasClave('DISTRIBUIDORA MATES')).toEqual(['distribuidora', 'mate'])
  })

  it('saca el plural solo en palabras largas', () => {
    expect(palabrasClave('SALDOS')).toEqual(['saldo'])
    expect(palabrasClave('MAS')).toEqual(['mas'])
  })
})

describe('distancia', () => {
  it('cuenta las letras que cambian', () => {
    expect(distancia('estebanez', 'estevanez')).toBe(1)
    expect(distancia('saldo', 'saldo')).toBe(0)
    expect(distancia('mohicano', 'paisa')).toBeGreaterThan(3)
  })
})

describe('fichasParecidas: LOS CASOS REALES DEL 21/10', () => {
  const todos = [
    prov('SALDO'),
    prov('SALDOS'),
    prov('VICTOR ESTEBANEZ'),
    prov('VICTOR ESTEVANEZ'),
    prov('ARIEL GARCIA'),
    prov('ARIEL GARCIA MISIONES'),
    prov('DISTRIBUIDORA DE MATES'),
    prov('DISTRIBUIDORA MATES'),
    prov('A MATEAR ALEJO', 'uno'),
    prov('A MATEAR ALEJO', 'dos'),
    prov('MOHICANO'),
    prov('PAISA'),
    prov('THOR MATES'),
  ]
  const pares = fichasParecidas(todos)

  it('SALDO y SALDOS', () => {
    expect(par(pares, 'SALDO', 'SALDOS')?.por).toBe('mismo-nombre')
  })

  it('VICTOR ESTEBANEZ y VICTOR ESTEVANEZ', () => {
    expect(par(pares, 'VICTOR ESTEBANEZ', 'VICTOR ESTEVANEZ')?.por).toBe('casi-igual')
  })

  it('ARIEL GARCIA y ARIEL GARCIA MISIONES', () => {
    expect(par(pares, 'ARIEL GARCIA', 'ARIEL GARCIA MISIONES')?.por).toBe('empieza-igual')
  })

  it('DISTRIBUIDORA DE MATES y DISTRIBUIDORA MATES', () => {
    expect(par(pares, 'DISTRIBUIDORA DE MATES', 'DISTRIBUIDORA MATES')?.por).toBe('mismo-nombre')
  })

  it('las dos fichas de A MATEAR ALEJO', () => {
    const p = pares.find((x) => x.a.nombre === 'A MATEAR ALEJO' && x.b.nombre === 'A MATEAR ALEJO')
    expect(p?.por).toBe('mismo-nombre')
  })

  it('y no inventa ninguno mas', () => {
    expect(pares).toHaveLength(5)
  })

  it('los mas parecidos van primero', () => {
    expect(pares[0].por).toBe('mismo-nombre')
    expect(pares[pares.length - 1].por).toBe('empieza-igual')
  })
})

describe('fichasParecidas: lo que NO tiene que sugerir', () => {
  it('dos proveedores distintos que empiezan parecido', () => {
    // El caso que ya conociamos de asociarFantasmas: comparten la
    // primera palabra pero no son el mismo.
    expect(fichasParecidas([prov('MATES RAFAEL'), prov('MATES DEL LITORAL')])).toHaveLength(0)
  })

  it('una letra de diferencia en una palabra corta', () => {
    expect(fichasParecidas([prov('MATE'), prov('MATA')])).toHaveLength(0)
  })

  it('dos letras de diferencia ya es otro nombre', () => {
    expect(fichasParecidas([prov('MOHICANO'), prov('MEHICANE')])).toHaveLength(0)
  })

  it('nombres sin nada en comun', () => {
    expect(fichasParecidas([prov('MOHICANO'), prov('PAISA'), prov('THOR MATES')])).toHaveLength(0)
  })

  it('una ficha sin nombre util no se compara con nadie', () => {
    expect(fichasParecidas([prov('   '), prov('MOHICANO')])).toHaveLength(0)
  })
})
