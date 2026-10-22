import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import {
  claveBorradorCompra,
  descartarBorradorCompra,
  guardarBorradorCompra,
  leerBorradorCompra,
  tieneContenido,
} from './borradorCompra'

const VACIA = { codigo: '', cantidad: '1', costoUnitario: '' }

beforeEach(async () => {
  await db.ajustes.clear()
})

describe('tieneContenido', () => {
  it('el formulario recien abierto no cuenta', () => {
    expect(tieneContenido({ lineas: [VACIA], notas: '' })).toBe(false)
  })

  it('un producto elegido, un costo, una cantidad distinta o una nota, si', () => {
    expect(tieneContenido({ lineas: [{ ...VACIA, codigo: 'MR001' }], notas: '' })).toBe(true)
    expect(tieneContenido({ lineas: [{ ...VACIA, costoUnitario: '9500' }], notas: '' })).toBe(true)
    expect(tieneContenido({ lineas: [{ ...VACIA, cantidad: '12' }], notas: '' })).toBe(true)
    expect(tieneContenido({ lineas: [VACIA], notas: 'Remito 4411' })).toBe(true)
  })
})

describe('el borrador de la compra', () => {
  it('se guarda y se recupera tal cual, por proveedor', async () => {
    const lineas = [
      { codigo: 'MR001', cantidad: '12', costoUnitario: '9500' },
      { codigo: 'MR002', cantidad: '6', costoUnitario: '11.000' },
    ]
    await guardarBorradorCompra('mohicano', { fecha: '2026-10-22', lineas, notas: 'Remito 4411' })
    const b = await leerBorradorCompra('mohicano')
    expect(b?.lineas).toEqual(lineas)
    expect(b?.notas).toBe('Remito 4411')
    expect(b?.fecha).toBe('2026-10-22')
    expect(typeof b?.guardadoEn).toBe('number')
    expect(await leerBorradorCompra('otro-proveedor')).toBeNull()
  })

  it('si se vacia, se borra: no queda un borrador fantasma', async () => {
    await guardarBorradorCompra('mohicano', { fecha: '2026-10-22', lineas: [{ ...VACIA, codigo: 'MR001' }], notas: '' })
    await guardarBorradorCompra('mohicano', { fecha: '2026-10-22', lineas: [VACIA], notas: '' })
    expect(await db.ajustes.get(claveBorradorCompra('mohicano'))).toBeUndefined()
  })

  it('descartar lo borra', async () => {
    await guardarBorradorCompra('mohicano', { fecha: '2026-10-22', lineas: [{ ...VACIA, codigo: 'MR001' }], notas: '' })
    await descartarBorradorCompra('mohicano')
    expect(await leerBorradorCompra('mohicano')).toBeNull()
  })

  it('uno ilegible no frena nada: es como si no hubiera', async () => {
    await db.ajustes.put({ clave: claveBorradorCompra('mohicano'), valor: '{roto' })
    expect(await leerBorradorCompra('mohicano')).toBeNull()
  })
})
