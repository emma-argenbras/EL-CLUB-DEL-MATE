import { describe, expect, it } from 'vitest'
import { autorDeLaSesion, seccionesVisibles, type Perfil, type Sesion } from './sesion'

describe('seccionesVisibles', () => {
  it('un owner ve todas las secciones configurables', () => {
    const perfil: Perfil = { nombre: 'Emma', rol: 'owner' }
    expect(seccionesVisibles(perfil)).toEqual([
      'panel',
      'caja',
      'productos',
      'proveedores',
      'gastos',
      'reportes',
    ])
  })

  it('sin perfil (todavia cargando), se asume owner por defecto', () => {
    expect(seccionesVisibles(null)).toContain('reportes')
  })

  it('un empleado sin secciones configuradas usa el default de siempre (sin reportes)', () => {
    const perfil: Perfil = { nombre: 'Gabriela', rol: 'empleado' }
    const visibles = seccionesVisibles(perfil)
    expect(visibles).toEqual(['panel', 'caja', 'productos', 'proveedores', 'gastos'])
    expect(visibles).not.toContain('reportes')
  })

  it('un empleado con secciones configuradas usa exactamente esas', () => {
    const perfil: Perfil = { nombre: 'Gabriela', rol: 'empleado', secciones: ['caja', 'reportes'] }
    expect(seccionesVisibles(perfil)).toEqual(['caja', 'reportes'])
  })

  it('un empleado con secciones vacias (todo destildado) no ve ninguna', () => {
    const perfil: Perfil = { nombre: 'Gabriela', rol: 'empleado', secciones: [] }
    expect(seccionesVisibles(perfil)).toEqual([])
  })
})

describe('autorDeLaSesion', () => {
  const sesion = (parcial: Partial<Sesion> = {}): Sesion => ({
    cargando: false,
    uid: 'uid-sandra',
    email: 'ventas@elclubdelmate.com',
    perfil: { nombre: 'Sandra', rol: 'encargado' },
    sinPerfil: false,
    desactivada: false,
    ...parcial,
  })

  it('firma con el mail, el nombre Y el rol', () => {
    // El rol es el que faltaba: durante dos semanas el historial guardo
    // "Sandra" sin decir con que rol habia hecho el cambio. Una
    // constancia que no dice el rol sirve a medias, y era justo lo que
    // se habia pedido cuando se creo el rol de encargado.
    expect(autorDeLaSesion(sesion())).toEqual({
      email: 'ventas@elclubdelmate.com',
      nombre: 'Sandra',
      rol: 'encargado',
    })
  })

  it('guarda el rol de cada uno, no uno fijo', () => {
    expect(autorDeLaSesion(sesion({ perfil: { nombre: 'Emmanuel', rol: 'owner' } }))?.rol).toBe(
      'owner',
    )
    expect(autorDeLaSesion(sesion({ perfil: { nombre: 'Gabriela', rol: 'empleado' } }))?.rol).toBe(
      'empleado',
    )
  })

  it('sin perfil no firma nada', () => {
    // Sin perfil no hay a quien atribuirle el cambio, y el historial
    // prefiere no anotar antes que anotar a nombre de nadie.
    expect(autorDeLaSesion(sesion({ perfil: null }))).toBeNull()
  })

  it('sin mail tampoco', () => {
    expect(autorDeLaSesion(sesion({ email: null }))).toBeNull()
  })
})
