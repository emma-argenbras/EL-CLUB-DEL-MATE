import { describe, expect, it } from 'vitest'
import {
  ETIQUETA_ROL,
  QUE_HACE_CADA_ROL,
  esDueno,
  estaAlMando,
  puedeBorrarTodo,
  puedeDefinirSueldos,
  puedeImportarRespaldo,
  puedeTocarUsuarioConRol,
  puedeVerSueldos,
  rolesQuePuedeAsignar,
  esRolDeDueno,
  soloMira,
  tieneMiSueldo,
  veLosNumeros,
} from './permisos'
import { seccionesVisibles } from './sesion'
import type { Perfil } from './sesion'

const DUENO: Perfil = { nombre: 'Emmanuel', rol: 'owner' }
const ENCARGADA: Perfil = { nombre: 'Sandra', rol: 'encargado' }
const EMPLEADA: Perfil = { nombre: 'Gabriela', rol: 'empleado' }
const SOCIA: Perfil = { nombre: 'Elena', rol: 'socio' }

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

  it('puede asignar todos los roles, también el de dueño que solo mira', () => {
    expect(rolesQuePuedeAsignar(DUENO)).toEqual(['owner', 'socio', 'encargado', 'empleado'])
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
  it('un dueño ve las cuatro opciones, encargado entre ellas', () => {
    const opciones = rolesQuePuedeAsignar(DUENO).map((r) => QUE_HACE_CADA_ROL[r])
    expect(opciones).toHaveLength(4)
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

describe('sueldos: quién ve, quién define y quién tiene «Mi sueldo» (19/11)', () => {
  it('los ven los dueños y quien está de encargado; una empleada no', () => {
    expect(puedeVerSueldos(DUENO)).toBe(true)
    expect(puedeVerSueldos(ENCARGADA)).toBe(true)
    expect(puedeVerSueldos(EMPLEADA)).toBe(false)
    expect(puedeVerSueldos(null)).toBe(false)
  })

  it('lo acordado lo define solo un dueño: la encargada lo ve y no lo cambia, ni el suyo', () => {
    expect(puedeDefinirSueldos(DUENO)).toBe(true)
    expect(puedeDefinirSueldos(ENCARGADA)).toBe(false)
    expect(puedeDefinirSueldos(EMPLEADA)).toBe(false)
    expect(puedeDefinirSueldos(null)).toBe(false)
  })

  it('«Mi sueldo» lo tiene quien trabaja y no es dueño: un dueño retira, no cobra sueldo', () => {
    expect(tieneMiSueldo(EMPLEADA)).toBe(true)
    expect(tieneMiSueldo(ENCARGADA)).toBe(true)
    expect(tieneMiSueldo(DUENO)).toBe(false)
    expect(tieneMiSueldo(null)).toBe(false)
  })
})

describe('un dueño que solo mira (20/11)', () => {
  it('ve el Panel y los Reportes, nada más', () => {
    expect(seccionesVisibles(SOCIA)).toEqual(['panel', 'reportes'])
  })

  it('ve los números como un dueño, pero no está al mando: no carga, no edita, no borra', () => {
    expect(soloMira(SOCIA)).toBe(true)
    expect(veLosNumeros(SOCIA)).toBe(true)
    expect(estaAlMando(SOCIA)).toBe(false)
    expect(esDueno(SOCIA)).toBe(false)
    expect(puedeBorrarTodo(SOCIA)).toBe(false)
    expect(puedeImportarRespaldo(SOCIA)).toBe(false)
    expect(rolesQuePuedeAsignar(SOCIA)).toEqual([])
    expect(puedeTocarUsuarioConRol(SOCIA, 'empleado')).toBe(false)
  })

  it('no ve sueldos acordados ni tiene «Mi sueldo»: un dueño retira', () => {
    expect(puedeVerSueldos(SOCIA)).toBe(false)
    expect(puedeDefinirSueldos(SOCIA)).toBe(false)
    expect(tieneMiSueldo(SOCIA)).toBe(false)
  })

  it('los demás no solo miran, y ven los números solo los que están al mando', () => {
    expect([DUENO, ENCARGADA, EMPLEADA, null].map(soloMira)).toEqual([false, false, false, false])
    expect([DUENO, ENCARGADA, EMPLEADA].map(veLosNumeros)).toEqual([true, true, false])
  })

  it('es dueño para los retiros, y la encargada no lo toca ni lo puede asignar', () => {
    expect(esRolDeDueno('socio')).toBe(true)
    expect(esRolDeDueno('owner')).toBe(true)
    expect(esRolDeDueno('encargado')).toBe(false)
    expect(puedeTocarUsuarioConRol(ENCARGADA, 'socio')).toBe(false)
    expect(rolesQuePuedeAsignar(ENCARGADA)).not.toContain('socio')
    expect(puedeTocarUsuarioConRol(DUENO, 'socio')).toBe(true)
  })
})
