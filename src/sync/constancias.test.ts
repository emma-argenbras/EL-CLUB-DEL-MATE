import { describe, expect, it } from 'vitest'
import { avisoDeConstancias, enTandas, resumenDeConstancias } from './constancias'

describe('las constancias de las fichas unidas, contra el servidor', () => {
  it('se preguntan de a 30, que es lo que acepta Firestore', () => {
    const ids = Array.from({ length: 94 }, (_, i) => `p${i}`)
    const tandas = enTandas(ids, 30)
    expect(tandas.map((t) => t.length)).toEqual([30, 30, 30, 4])
    expect(tandas.flat()).toEqual(ids)
    expect(enTandas([], 30)).toEqual([])
  })

  it('si están todas, lo dice en verde', () => {
    expect(avisoDeConstancias({ pedidas: 94, faltan: [], enElServidor: 94 })).toEqual({
      tipo: 'ok',
      texto: 'Las 94 constancias ya están en el servidor: ningún aparato atrasado va a volver a subir esas fichas.',
    })
    expect(avisoDeConstancias({ pedidas: 1, faltan: [], enElServidor: 7 }).texto).toBe(
      'La constancia ya está en el servidor: ningún aparato atrasado va a volver a subir esa ficha.',
    )
  })

  it('si falta alguna, en rojo, cuántas, y que no se repita la limpieza', () => {
    const ninguna = avisoDeConstancias({ pedidas: 94, faltan: Array(94).fill('x'), enElServidor: 0 })
    expect(ninguna.tipo).toBe('error')
    expect(ninguna.texto).toMatch(/^Ninguna de las 94 constancias llegó al servidor\. /)
    expect(ninguna.texto).toContain('No repitas la limpieza')
    expect(avisoDeConstancias({ pedidas: 94, faltan: ['a', 'b'], enElServidor: 92 }).texto).toMatch(
      /^Faltan 2 de las 94 constancias en el servidor\. Sin ellas/,
    )
    expect(avisoDeConstancias({ pedidas: 1, faltan: ['a'], enElServidor: 0 }).texto).toMatch(
      /^La constancia no llegó al servidor\. Sin ella, un aparato atrasado puede volver a subir esa ficha\. /,
    )
    // Si falta una sola de varias, también en singular.
    expect(avisoDeConstancias({ pedidas: 3, faltan: ['a'], enElServidor: 2 }).texto).toMatch(
      /^Falta 1 de las 3 constancias en el servidor\. Sin ella, /,
    )
  })

  it('si no se pudo preguntar, no dice ni que sí ni que no', () => {
    const a = avisoDeConstancias(null)
    expect(a.tipo).toBe('ojo')
    expect(a.texto).toContain('No se pudo confirmar')
  })

  it('el renglón fijo: el total del servidor, y lo que falta de este aparato', () => {
    expect(resumenDeConstancias({ pedidas: 0, faltan: [], enElServidor: 0 })).toEqual({
      tipo: 'ok',
      texto: 'En el servidor hay 0 constancias de fichas unidas.',
    })
    const falta = resumenDeConstancias({ pedidas: 5, faltan: ['a'], enElServidor: 4 })
    expect(falta.tipo).toBe('error')
    expect(falta.texto).toMatch(/^En el servidor hay 4 constancias de fichas unidas\. Falta 1 de las que se unieron desde este aparato\./)
    expect(resumenDeConstancias({ pedidas: 5, faltan: ['a', 'b'], enElServidor: 1 }).texto).toMatch(
      /^En el servidor hay 1 constancia de fichas unidas\. Faltan 2 de/,
    )
  })
})
