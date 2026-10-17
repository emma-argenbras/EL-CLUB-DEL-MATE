import { describe, expect, it } from 'vitest'
import { esElMismoProveedor, idDeProveedor, tieneElIdQueLeCorresponde } from './idProveedor'

describe('idDeProveedor', () => {
  it('da el mismo id para el mismo nombre', () => {
    expect(idDeProveedor('MOHICANO')).toBe(idDeProveedor('MOHICANO'))
  })

  it('se puede leer', () => {
    // No es capricho: cuando algo salga raro, en la consola se tiene
    // que poder ver de que proveedor se trata sin ir a buscarlo.
    expect(idDeProveedor('MOHICANO')).toBe('prov-mohicano')
    expect(idDeProveedor('A MATEAR ALEJO')).toBe('prov-a-matear-alejo')
  })

  it('ignora mayusculas, acentos y espacios de mas', () => {
    const esperado = 'prov-angel-malagueno'
    expect(idDeProveedor('ANGEL MALAGUEÑO')).toBe(esperado)
    expect(idDeProveedor('Ángel  Malagueño')).toBe(esperado)
    expect(idDeProveedor('  ANGEL MALAGUENO  ')).toBe(esperado)
  })

  it('junta los que difieren solo en un separador', () => {
    // "HUGO-LA ENTRERRIANA" y "HUGO LA ENTRERRIANA" son el mismo
    // proveedor escrito de dos formas, y esto los junta a proposito.
    expect(esElMismoProveedor('HUGO-LA ENTRERRIANA', 'HUGO LA ENTRERRIANA')).toBe(true)
    expect(esElMismoProveedor('RUPESTRE CUERO ', 'Rupestre  Cuero')).toBe(true)
  })

  it('hasta aca llega: un signo que saca una letra de su palabra, no', () => {
    // "S.A" se parte en "s" y "a", y "SA" es una sola palabra, asi que
    // dan ids distintos. Juntarlos pediria colapsar las letras sueltas,
    // y esa regla tambien juntaria nombres que no son el mismo. Queda
    // asi, anotado: si aparece el caso, se arregla escribiendo el
    // nombre igual en los dos lados, que es mas seguro que adivinar.
    expect(esElMismoProveedor('AFILA FACIL SHARPEN S.A', 'AFILA FACIL SHARPEN SA')).toBe(false)
  })

  it('no junta a dos que son distintos', () => {
    expect(esElMismoProveedor('MOHICANO', 'GOMECITO')).toBe(false)
    expect(esElMismoProveedor('VAINAS RINGO', 'RINGO VAINAS')).toBe(false)
  })

  it('nunca deja un id con barra, que rompe Firestore', () => {
    const nombres = ['A/B PROVEEDORES', 'HUGO/LA ENTRERRIANA', '100% CUERO']
    for (const n of nombres) expect(idDeProveedor(n)).not.toMatch(/[/%]/)
  })

  it('un nombre sin letras ni numeros igual da un id, y distinto para cada uno', () => {
    const a = idDeProveedor('---')
    const b = idDeProveedor('???')
    expect(a).toMatch(/^prov-/)
    expect(b).toMatch(/^prov-/)
    expect(a).not.toBe(b)
  })

  it('un nombre larguisimo se corta pero sigue siendo unico', () => {
    const base = 'PROVEEDOR DE ARTICULOS REGIONALES DEL LITORAL ARGENTINO SOCIEDAD'
    const a = idDeProveedor(`${base} ANONIMA`)
    const b = idDeProveedor(`${base} COLECTIVA`)
    expect(a.length).toBeLessThanOrEqual(75)
    expect(a).not.toBe(b)
  })

  it('los nombres reales del negocio dan ids distintos entre si', () => {
    const nombres = [
      'MOHICANO', 'GOMECITO', 'RINGO VAINAS', 'WALTER ADAMOLI', 'HUGO-LA ENTRERRIANA',
      'MAXIMILIANO VAINAS', 'ROBLEDO MATIAS', 'IRUPE BOMBILLAS', 'RUPESTRE CUERO ',
      'A MATEAR ALEJO', 'ABEL', 'ALBERTO BALDUGA', 'ANGEL MALAGUEÑO', 'ALDEA CUEROS',
      'ELEVEN ONCE', 'EL CLUB DEL MATE', 'SALDOS', 'ARIEL GARCIA', 'BARNECHE',
      'DELTA LITORAL', 'IMPORT PLUS JUAN ', 'FABRICA DE MATES ', 'VICTOR ESTEBANEZ',
    ]
    const ids = nombres.map(idDeProveedor)
    expect(new Set(ids).size).toBe(nombres.length)
  })
})

describe('tieneElIdQueLeCorresponde', () => {
  it('reconoce al que tiene id aleatorio', () => {
    expect(
      tieneElIdQueLeCorresponde({ id: '0c8f1b7e-9a2d-4f3c-8b1a-5d6e7f809a1b', nombre: 'MOHICANO' }),
    ).toBe(false)
  })

  it('reconoce al que ya esta bien', () => {
    expect(tieneElIdQueLeCorresponde({ id: 'prov-mohicano', nombre: 'MOHICANO' })).toBe(true)
  })
})
