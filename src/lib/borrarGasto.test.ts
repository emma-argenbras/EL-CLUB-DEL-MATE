import { describe, expect, it } from 'vitest'
import { esVariablePorDefecto, permisoParaBorrarGasto } from './borrarGasto'

describe('con qué arranca un gasto: fijo o variable', () => {
  it('un pago a proveedores arranca variable, igual que el que se carga desde Proveedores', () => {
    expect(esVariablePorDefecto('PROVEEDORES')).toBe(true)
    expect(esVariablePorDefecto('OTROS')).toBe(true)
  })

  it('alquiler, sueldos y servicios arrancan fijos', () => {
    expect(esVariablePorDefecto('ALQUILER')).toBe(false)
    expect(esVariablePorDefecto('SUELDOS')).toBe(false)
    expect(esVariablePorDefecto('SERVICIOS')).toBe(false)
  })
})

describe('borrar un gasto desde la lista de Gastos', () => {
  const cerrado = { estado: 'cerrado' as const, fecha: '2026-11-10', turno: 'M' as const }
  const abierto = { estado: 'abierto' as const, fecha: '2026-11-19', turno: 'T' as const }

  it('un gasto de caja grande, que no es de ningún turno, se borra como siempre', () => {
    expect(permisoParaBorrarGasto({ jornadaId: null }, undefined, false)).toEqual({ puede: true, aviso: null })
    expect(permisoParaBorrarGasto({ jornadaId: null }, undefined, true)).toEqual({ puede: true, aviso: null })
  })

  it('el de un turno abierto, también: todavía se está cargando', () => {
    expect(permisoParaBorrarGasto({ jornadaId: 'j1' }, abierto, false)).toEqual({ puede: true, aviso: null })
  })

  it('el de un turno cerrado no lo borra una empleada', () => {
    const r = permisoParaBorrarGasto({ jornadaId: 'j1' }, cerrado, false)
    expect(r.puede).toBe(false)
    expect(r).toMatchObject({ porQue: expect.stringMatching(/turno cerrado/) })
  })

  it('quien está al mando sí, pero avisado de que mueve el arqueo de ese turno', () => {
    const r = permisoParaBorrarGasto({ jornadaId: 'j1' }, cerrado, true)
    expect(r.puede).toBe(true)
    expect(r).toMatchObject({ aviso: expect.stringMatching(/turno MAÑANA del 10\/11\/2026.*arqueo/) })
  })

  it('si el turno no está en este aparato, se trata como cerrado', () => {
    expect(permisoParaBorrarGasto({ jornadaId: 'j-que-no-esta' }, undefined, false).puede).toBe(false)
    const r = permisoParaBorrarGasto({ jornadaId: 'j-que-no-esta' }, undefined, true)
    expect(r).toMatchObject({ puede: true, aviso: expect.stringMatching(/de un turno, que ya está cerrado/) })
  })
})
