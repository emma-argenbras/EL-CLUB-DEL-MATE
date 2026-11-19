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

  it('sueldos: cada uno ve la ayuda de lo que puede hacer (19/11)', () => {
    const esta = (lista: typeof AYUDA, id: string) => lista.some((e) => e.id === id)
    // Definir o cambiar lo acordado y agregar un dueño sin cuenta es lo único que queda solo para el dueño.
    expect(TODAS.filter((e) => e.soloDueno).map((e) => e.id)).toEqual(['definir-sueldo', 'dueno-sin-cuenta'])
    const delDueno = ayudaParaPerfil(TODAS, true, [], true)
    for (const id of ['sueldos', 'definir-sueldo', 'retiros-de-los-duenos', 'apodos', 'dueno-sin-cuenta']) {
      expect(esta(delDueno, id)).toBe(true)
    }
    expect(buscarAyuda('dueño que no usa la app', delDueno).map((e) => e.id)).toContain('dueno-sin-cuenta')
    // La encargada ve Sueldos, los retiros y los apodos; cómo definir un sueldo, no.
    const deLaEncargada = ayudaParaPerfil(TODAS, true, [], false)
    for (const id of ['sueldos', 'retiros-de-los-duenos', 'apodos', 'mi-sueldo', 'crear-usuario']) {
      expect(esta(deLaEncargada, id)).toBe(true)
    }
    expect(esta(deLaEncargada, 'definir-sueldo')).toBe(false)
    expect(esta(deLaEncargada, 'dueno-sin-cuenta')).toBe(false)
    expect(deLaEncargada.length).toBe(TODAS.length - 2)
    // Una empleada: «Mi sueldo» y cómo anotar su retiro. Nada de lo de los demás.
    const deLaEmpleada = ayudaParaPerfil(TODAS, false, ['caja'], false)
    expect(esta(deLaEmpleada, 'mi-sueldo')).toBe(true)
    expect(esta(deLaEmpleada, 'retiro-de-sueldo')).toBe(true)
    for (const id of ['sueldos', 'definir-sueldo', 'retiros-de-los-duenos', 'apodos', 'dueno-sin-cuenta']) {
      expect(esta(deLaEmpleada, id)).toBe(false)
    }
    // Y se encuentra como lo van a buscar.
    expect(buscarAyuda('cuanto me falta cobrar', deLaEmpleada).map((e) => e.id)).toContain('mi-sueldo')
    expect(buscarAyuda('semana', deLaEmpleada).map((e) => e.id)).toContain('retiro-de-sueldo')
    expect(buscarAyuda('retiros de los socios', deLaEncargada).map((e) => e.id)).toContain('retiros-de-los-duenos')
  })

  it('la planilla del proveedor la ve quien está al mando: una empleada con Proveedores, no (19/11)', () => {
    // La pantalla es solo para quien está al mando: explicársela a quien
    // no puede entrar sería mandarla a un lugar que la rebota.
    expect(ayudaParaPerfil(TODAS, false, ['caja', 'proveedores']).some((e) => e.id === 'planilla-del-proveedor')).toBe(false)
    expect(ayudaParaPerfil(TODAS, true, [], false).some((e) => e.id === 'planilla-del-proveedor')).toBe(true)
    // Y se encuentra buscándola como la llaman: «el Excel».
    expect(buscarAyuda('excel', ayudaParaPerfil(TODAS, true, [], false)).map((e) => e.id)).toContain('planilla-del-proveedor')
  })

  it('por qué no aparece «Borrar» lo ve quien tiene Gastos, sea o no quien manda (19/11)', () => {
    // La que se queda sin botón es la empleada: es ella la que lo va a buscar.
    expect(ayudaParaPerfil(TODAS, false, ['caja', 'gastos']).some((e) => e.id === 'borrar-gasto')).toBe(true)
    expect(ayudaParaPerfil(TODAS, false, ['caja']).some((e) => e.id === 'borrar-gasto')).toBe(false)
  })

  it('«Cómo venimos» es de quien está al mando: una empleada no lo ve (19/11)', () => {
    expect(ayudaParaPerfil(TODAS, false, ['caja', 'gastos', 'reportes']).some((e) => e.id === 'como-venimos')).toBe(false)
    expect(ayudaParaPerfil(TODAS, true, [], false).some((e) => e.id === 'como-venimos')).toBe(true)
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
