import { describe, expect, it } from 'vitest'
import { CODIGO_RECARGO } from '../db/db'
import { masVendidos } from './masVendidos'

const v = (codigo: string, cantidad = 1) => ({ codigo, cantidad })

describe('lo más vendido', () => {
  it('por cuántas veces se vendió; a igualdad, por unidades; después por código', () => {
    const ventas = [
      v('MATE'), v('MATE'), v('MATE'),
      v('BOMBILLA', 10), // una sola venta, aunque sean diez
      v('TERMO'), v('TERMO', 2),
      v('YERBERA'), v('YERBERA'),
      v('AAA'), v('ZZZ'),
    ]
    expect(masVendidos(ventas, 4)).toEqual(['MATE', 'TERMO', 'YERBERA', 'BOMBILLA'])
    expect(masVendidos([v('ZZZ'), v('AAA')], 2)).toEqual(['AAA', 'ZZZ'])
  })

  it('sin recargos, sin lo que volvió en un cambio y sin lo vendido sin código', () => {
    const ventas = [v(CODIGO_RECARGO), v(CODIGO_RECARGO), v('MATE', -1), v('MATE', -1), v(''), v(''), v('TERMO')]
    expect(masVendidos(ventas, 6)).toEqual(['TERMO'])
  })
})
