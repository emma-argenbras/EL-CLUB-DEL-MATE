import { describe, expect, it } from 'vitest'
import { seccionesVisibles, type Perfil } from './sesion'

describe('seccionesVisibles', () => {
  it('un owner ve todas las secciones configurables', () => {
    const perfil: Perfil = { nombre: 'Emma', rol: 'owner' }
    expect(seccionesVisibles(perfil)).toEqual([
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
    expect(visibles).toEqual(['caja', 'productos', 'proveedores', 'gastos'])
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
