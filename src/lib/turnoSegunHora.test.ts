import { describe, expect, it } from 'vitest'
import { preguntaAlAbrirTurno, turnoSegunHora } from './turnoSegunHora'

// Hora local del dispositivo, como la que usa la app.
const a = (dia: number, hora: number, minutos = 0) => new Date(2026, 9, dia, hora, minutos)

describe('turnoSegunHora', () => {
  it('antes de las 14 es la mañana, desde las 14 la tarde', () => {
    expect(turnoSegunHora(a(23, 9, 13))).toBe('M')
    expect(turnoSegunHora(a(23, 13, 59))).toBe('M')
    expect(turnoSegunHora(a(23, 14, 0))).toBe('T')
    expect(turnoSegunHora(a(23, 17, 30))).toBe('T')
  })
})

describe('preguntaAlAbrirTurno', () => {
  it('el caso del 23/10: a las 9:13, el turno TARDE pregunta', () => {
    expect(preguntaAlAbrirTurno('2026-10-23', 'T', a(23, 9, 13))).toBe(
      'Son las 9:13 y estás abriendo el turno TARDE.\n\n¿Seguro?',
    )
  })

  it('a la tarde, el turno MAÑANA tambien pregunta', () => {
    expect(preguntaAlAbrirTurno('2026-10-23', 'M', a(23, 17, 5))).toContain(
      'Son las 17:05 y estás abriendo el turno MAÑANA.',
    )
  })

  it('el turno que corresponde se abre sin preguntar', () => {
    expect(preguntaAlAbrirTurno('2026-10-23', 'M', a(23, 9, 13))).toBeNull()
    expect(preguntaAlAbrirTurno('2026-10-23', 'T', a(23, 17, 5))).toBeNull()
  })

  it('un turno de otro dia pregunta por el dia', () => {
    const texto = preguntaAlAbrirTurno('2026-10-22', 'M', a(23, 9, 13))
    expect(texto).toContain('22/10/2026')
    expect(texto).toContain('hoy es 23/10/2026')
  })
})
