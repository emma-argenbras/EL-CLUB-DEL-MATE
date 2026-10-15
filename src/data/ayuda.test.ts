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

  it('un empleado no ve nada del historial de cambios', () => {
    // El historial es una herramienta de control sobre el propio
    // trabajo de quien lo lee. Explicarle a un empleado como se
    // consulta quien edito que no le sirve para su turno, y le muestra
    // una pantalla a la que no entra.
    const suyas = ayudaParaPerfil(TODAS, false, ['caja', 'productos', 'proveedores', 'gastos'])
    expect(suyas.some((e) => e.categoria === 'Historial de cambios')).toBe(false)
  })

  it('quien esta al mando si ve el historial, incluido un encargado', () => {
    // ayudaParaPerfil recibe "esta al mando", no "es dueño": un
    // encargado tiene que poder leer como se consulta el historial,
    // porque la pantalla la tiene.
    const delMando = ayudaParaPerfil(TODAS, true, [])
    const delHistorial = delMando.filter((e) => e.categoria === 'Historial de cambios')
    expect(delHistorial.length).toBeGreaterThanOrEqual(5)
    expect(delHistorial.some((e) => e.id === 'historial-borrar')).toBe(true)
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
