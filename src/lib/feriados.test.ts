import { describe, expect, it } from 'vitest'
import { feriadoDe, seEsperaCaja } from './feriados'

describe('los feriados (20/11)', () => {
  it('el lunes 23/11/2026 es feriado: el Día de la Soberanía Nacional, trasladado del viernes 20', () => {
    expect(feriadoDe('2026-11-23')).toBe('Día de la Soberanía Nacional')
    expect(seEsperaCaja('2026-11-23')).toBe(false)
    // El 20, su fecha original, es un viernes común: el local abre.
    expect(feriadoDe('2026-11-20')).toBeNull()
    expect(seEsperaCaja('2026-11-20')).toBe(true)
  })

  it('el 9/11/2026 fue feriado nacional por la visita del papa', () => {
    expect(feriadoDe('2026-11-09')).toMatch(/papa/)
    expect(seEsperaCaja('2026-11-09')).toBe(false)
  })

  it('los trasladables están en el día en que se observan', () => {
    expect(seEsperaCaja('2026-06-15')).toBe(false) // Güemes: el miércoles 17 pasó al lunes
    expect(seEsperaCaja('2026-06-17')).toBe(true)
    expect(seEsperaCaja('2027-08-16')).toBe(false) // San Martín 2027: el martes 17 pasa al lunes
    expect(seEsperaCaja('2027-08-17')).toBe(true)
  })

  it('los días no laborables con fines turísticos no son feriado: el comercio puede abrir', () => {
    for (const dia of ['2026-03-23', '2026-07-10', '2026-12-07']) {
      expect(feriadoDe(dia)).toBeNull()
      expect(seEsperaCaja(dia)).toBe(true)
    }
  })

  it('los domingos tampoco se espera caja; los sábados sí', () => {
    expect(seEsperaCaja('2026-11-22')).toBe(false) // domingo
    expect(seEsperaCaja('2026-11-21')).toBe(true) // sábado
    expect(seEsperaCaja('2026-11-24')).toBe(true) // martes después del feriado
  })

  it('un día que no existe no espera nada: el navegador lo convertiría en otro día', () => {
    expect(seEsperaCaja('2026-02-29')).toBe(false)
    expect(seEsperaCaja('2026-02-30')).toBe(false)
    expect(seEsperaCaja('2026-11-31')).toBe(false)
    expect(seEsperaCaja('2026-13-01')).toBe(false)
    expect(seEsperaCaja('20/11/2026')).toBe(false)
    expect(seEsperaCaja('')).toBe(false)
  })
})
