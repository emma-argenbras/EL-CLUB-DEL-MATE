import { describe, expect, it } from 'vitest'
import { AYUDA, ayudaParaPerfil, buscarAyuda } from './ayuda'

const TODAS: typeof AYUDA = AYUDA

describe('ayudaParaPerfil', () => {
  it('un dueño ve la guia completa', () => {
    expect(ayudaParaPerfil(TODAS, true, []).length).toBe(TODAS.length)
  })

  it('un empleado no ve las preguntas de dueño', () => {
    const suyas = ayudaParaPerfil(TODAS, false, ['caja', 'productos', 'proveedores', 'gastos'])
    expect(suyas.some((e) => e.soloOwner)).toBe(false)
    expect(suyas.some((e) => e.id === 'crear-usuario')).toBe(false)
    expect(suyas.some((e) => e.id === 'desactivar-usuario')).toBe(false)
  })

  it('un empleado sin Proveedores no ve como registrar una compra', () => {
    const suyas = ayudaParaPerfil(TODAS, false, ['caja', 'productos'])
    expect(suyas.some((e) => e.id === 'registrar-compra')).toBe(false)
    expect(suyas.some((e) => e.id === 'cuenta-corriente-proveedor')).toBe(false)
    // Pero si sigue viendo lo de su caja.
    expect(suyas.some((e) => e.id === 'cerrar-turno')).toBe(true)
  })

  it('un empleado sin Reportes no ve el margen de contribucion', () => {
    const suyas = ayudaParaPerfil(TODAS, false, ['caja'])
    expect(suyas.some((e) => e.id === 'margen-contribucion')).toBe(false)
  })

  it('las preguntas generales las ve todo el mundo', () => {
    const suyas = ayudaParaPerfil(TODAS, false, [])
    expect(suyas.some((e) => e.id === 'que-es')).toBe(true)
    expect(suyas.some((e) => e.id === 'instalar')).toBe(true)
    expect(suyas.some((e) => e.id === 'olvide-contrasena')).toBe(true)
  })
})

describe('buscarAyuda', () => {
  it('busca sobre el conjunto que se le pasa, no sobre todo', () => {
    const soloEmpleado = ayudaParaPerfil(TODAS, false, ['caja'])
    const resultados = buscarAyuda('usuario nuevo equipo', soloEmpleado)
    expect(resultados.some((e) => e.id === 'crear-usuario')).toBe(false)
  })

  it('sin consulta no devuelve nada', () => {
    expect(buscarAyuda('')).toEqual([])
  })

  it('encuentra por palabra clave, no solo por la pregunta', () => {
    const resultados = buscarAyuda('backup')
    expect(resultados.length).toBeGreaterThan(0)
  })
})
