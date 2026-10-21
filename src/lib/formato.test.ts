import { describe, expect, it } from 'vitest'
import { haceCuanto, leerNumero } from './formato'

describe('haceCuanto', () => {
  const ahora = new Date('2026-08-21T20:00:00Z').getTime()
  const hace = (ms: number) => haceCuanto(ahora - ms, ahora)

  it('lo de recién no se cuenta en minutos', () => {
    expect(hace(0)).toBe('recién')
    expect(hace(45_000)).toBe('recién')
  })

  it('minutos, horas y días, en singular y plural', () => {
    expect(hace(60_000)).toBe('hace 1 minuto')
    expect(hace(25 * 60_000)).toBe('hace 25 minutos')
    expect(hace(60 * 60_000)).toBe('hace 1 hora')
    expect(hace(5 * 60 * 60_000)).toBe('hace 5 horas')
    expect(hace(26 * 60 * 60_000)).toBe('hace 1 día')
    expect(hace(3 * 24 * 60 * 60_000)).toBe('hace 3 días')
  })

  it('sin nada recibido lo dice, no muestra una fecha de 1970', () => {
    expect(haceCuanto(null, ahora)).toBe('todavía nada')
    expect(haceCuanto(0, ahora)).toBe('todavía nada')
  })

  it('un reloj adelantado no dice "hace -3 minutos"', () => {
    expect(haceCuanto(ahora + 200_000, ahora)).toBe('recién')
  })
})

describe('leerNumero', () => {
  it('EL BUG: el punto de los miles, que es como se escribe acá', () => {
    expect(leerNumero('31.000')).toBe(31000)
    expect(leerNumero('1.500.000')).toBe(1500000)
    expect(leerNumero('$ 31.000')).toBe(31000)
  })

  it('pero un punto decimal sigue siendo decimal', () => {
    expect(leerNumero('3.5')).toBe(3.5)
    expect(leerNumero('3.50')).toBe(3.5)
    expect(leerNumero('0.5')).toBe(0.5)
  })

  it('la coma es el decimal de siempre', () => {
    expect(leerNumero('31000,50')).toBe(31000.5)
    expect(leerNumero('31.000,50')).toBe(31000.5)
    expect(leerNumero('0,5')).toBe(0.5)
  })

  it('un número pelado no cambia', () => {
    expect(leerNumero('31000')).toBe(31000)
    expect(leerNumero('0')).toBe(0)
    expect(leerNumero('-250')).toBe(-250)
  })

  it('vacío o basura da null', () => {
    expect(leerNumero('')).toBeNull()
    expect(leerNumero('abc')).toBeNull()
  })
})
