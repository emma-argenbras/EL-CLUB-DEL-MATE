import { describe, expect, it } from 'vitest'
import { anotarSinGuardar, loQueEstaSinGuardar, preguntaAntesDeActualizar } from './sinGuardar'

describe('lo que está sin guardar', () => {
  it('se anota y se saca', () => {
    const sacar = anotarSinGuardar('la compra')
    expect(loQueEstaSinGuardar()).toEqual(['la compra'])
    sacar()
    expect(loQueEstaSinGuardar()).toEqual([])
  })

  it('dos formularios iguales se nombran una vez, y sacar uno no saca el otro', () => {
    const a = anotarSinGuardar('un producto')
    const b = anotarSinGuardar('un producto')
    expect(loQueEstaSinGuardar()).toEqual(['un producto'])
    a()
    expect(loQueEstaSinGuardar()).toEqual(['un producto'])
    b()
    expect(loQueEstaSinGuardar()).toEqual([])
  })

  it('sacar dos veces no rompe nada', () => {
    const a = anotarSinGuardar('el cierre de caja')
    a()
    a()
    expect(loQueEstaSinGuardar()).toEqual([])
  })
})

describe('preguntaAntesDeActualizar', () => {
  it('sin nada cargado no pregunta: se actualiza directo', () => {
    expect(preguntaAntesDeActualizar([])).toBeNull()
  })

  it('dice qué se perdería', () => {
    const texto = preguntaAntesDeActualizar(['la compra'])
    expect(texto).toContain('Tenés sin guardar la compra.')
    expect(texto).toContain('se pierde')
  })

  it('con varios, los nombra a todos', () => {
    expect(preguntaAntesDeActualizar(['la compra', 'un gasto', 'una venta'])).toContain(
      'la compra, un gasto y una venta',
    )
  })
})
