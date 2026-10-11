import { describe, expect, it } from 'vitest'
import {
  ETIQUETA_ROL,
  QUE_HACE_CADA_ROL,
  esDueno,
  estaAlMando,
  puedeBorrarTodo,
  puedeImportarRespaldo,
  puedeTocarUsuarioConRol,
  rolesQuePuedeAsignar,
} from './permisos'
import { seccionesVisibles } from './sesion'
import type { Perfil } from './sesion'

const DUENO: Perfil = { nombre: 'Emmanuel', rol: 'owner' }
const ENCARGADA: Perfil = { nombre: 'Sandra', rol: 'encargado' }
const EMPLEADA: Perfil = { nombre: 'Gabriela', rol: 'empleado' }

describe('encargado: maneja la operacion como un dueño', () => {
  it('esta al mando', () => {
    expect(estaAlMando(ENCARGADA)).toBe(true)
  })

  it('ve todas las secciones, igual que un dueño', () => {
    expect(seccionesVisibles(ENCARGADA)).toEqual(seccionesVisibles(DUENO))
  })

  it('puede dar de alta encargados y empleados', () => {
    expect(rolesQuePuedeAsignar(ENCARGADA)).toEqual(['encargado', 'empleado'])
  })

  it('puede tocar a un empleado y a otro encargado', () => {
    expect(puedeTocarUsuarioConRol(ENCARGADA, 'empleado')).toBe(true)
    expect(puedeTocarUsuarioConRol(ENCARGADA, 'encargado')).toBe(true)
  })
})

describe('encargado: las tres cosas que no puede', () => {
  it('no borra todos los datos', () => {
    expect(puedeBorrarTodo(ENCARGADA)).toBe(false)
  })

  it('no importa un respaldo: pisa todo, es borrar mas despacio', () => {
    expect(puedeImportarRespaldo(ENCARGADA)).toBe(false)
  })

  it('no toca a un dueño', () => {
    expect(puedeTocarUsuarioConRol(ENCARGADA, 'owner')).toBe(false)
  })

  it('no puede asignar el rol de dueño: no esta ni en la lista', () => {
    expect(rolesQuePuedeAsignar(ENCARGADA)).not.toContain('owner')
  })

  it('no es dueño', () => {
    expect(esDueno(ENCARGADA)).toBe(false)
  })
})

describe('el rol nuevo no le aflojo nada al empleado', () => {
  it('sigue sin estar al mando', () => {
    expect(estaAlMando(EMPLEADA)).toBe(false)
  })

  it('sigue sin poder dar de alta a nadie', () => {
    expect(rolesQuePuedeAsignar(EMPLEADA)).toEqual([])
    expect(puedeTocarUsuarioConRol(EMPLEADA, 'empleado')).toBe(false)
  })

  it('sigue con sus secciones y no con todas', () => {
    expect(seccionesVisibles(EMPLEADA)).not.toContain('reportes')
  })
})

describe('el dueño no perdio nada', () => {
  it('puede las tres cosas reservadas', () => {
    expect(puedeBorrarTodo(DUENO)).toBe(true)
    expect(puedeImportarRespaldo(DUENO)).toBe(true)
    expect(puedeTocarUsuarioConRol(DUENO, 'owner')).toBe(true)
  })

  it('puede asignar los tres roles', () => {
    expect(rolesQuePuedeAsignar(DUENO)).toEqual(['owner', 'encargado', 'empleado'])
  })
})

describe('sin nube no hay roles: quien abre la app es el dueño', () => {
  it('un perfil nulo puede todo, como antes de que existieran los roles', () => {
    expect(estaAlMando(null)).toBe(true)
    expect(esDueno(null)).toBe(true)
    expect(puedeBorrarTodo(null)).toBe(true)
    expect(puedeImportarRespaldo(null)).toBe(true)
  })
})

describe('los tres roles tienen nombre para mostrar', () => {
  it('ninguno queda sin etiqueta', () => {
    expect(ETIQUETA_ROL.owner).toBe('Dueño/a')
    expect(ETIQUETA_ROL.encargado).toBe('Encargado/a')
    expect(ETIQUETA_ROL.empleado).toBe('Empleado/a')
  })
})

describe('el alta de usuarios ofrece el rol de encargado', () => {
  it('un dueño ve las tres opciones, encargado entre ellas', () => {
    const opciones = rolesQuePuedeAsignar(DUENO).map((r) => QUE_HACE_CADA_ROL[r])
    expect(opciones).toHaveLength(3)
    expect(opciones.some((o) => o.startsWith('Encargado/a'))).toBe(true)
  })

  it('ninguna opcion del menu queda vacia', () => {
    // Un rol sin etiqueta sale como una opcion en blanco, imposible de
    // elegir a ciegas. Vale para los tres roles y para cualquiera nuevo.
    for (const perfil of [DUENO, ENCARGADA]) {
      for (const rol of rolesQuePuedeAsignar(perfil)) {
        expect(QUE_HACE_CADA_ROL[rol]).toBeTruthy()
      }
    }
  })

  it('a un encargado el menu no le ofrece dueño', () => {
    const opciones = rolesQuePuedeAsignar(ENCARGADA).map((r) => QUE_HACE_CADA_ROL[r])
    expect(opciones.some((o) => o.startsWith('Dueño/a'))).toBe(false)
  })
})
