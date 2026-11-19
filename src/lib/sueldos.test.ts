import { describe, expect, it } from 'vitest'
import {
  acordadoEnElMes,
  acuerdoEnPalabras,
  apodoPosible,
  apodosLimpios,
  categoriaQueSugiere,
  comoFigura,
  comoSeCalcula,
  conAcuerdo,
  diaLindo,
  duenosParaRetiro,
  esDia,
  esPagoDeSueldo,
  esRetiroDeSocio,
  estadoDeMiSaldo,
  estadoDelSaldo,
  fichaDesdeDatos,
  mesDelPago,
  miSueldoDelMes,
  parecenRetiro,
  parecenSueldo,
  personasParaSueldo,
  porQueNoCambia,
  preguntaDeLaSugerencia,
  problemaDelAcuerdo,
  queParece,
  resumenDeRetiros,
  resumenDeSueldos,
  sabadosDelMes,
  sueldoDelMes,
  sugerenciaAplicada,
  textoDeConfirmacionSueldo,
  type AcuerdoSueldo,
  type FichaSueldo,
  type PersonaConSueldo,
} from './sueldos'
import { plata } from './formato'

/** Un acuerdo por mes: `desde` es un mes. */
const acuerdo = (desde: string, monto: number, anotadoEl = 1): AcuerdoSueldo => ({
  desde,
  monto,
  cada: 'mes',
  anotadoEl,
  por: 'dueno@ejemplo.com',
})
/** Un acuerdo por semana: `desde` es un día, y cuentan los sábados desde ahí. */
const porSemana = (desde: string, monto: number, anotadoEl = 1): AcuerdoSueldo => ({
  desde,
  monto,
  cada: 'semana',
  anotadoEl,
  por: 'dueno@ejemplo.com',
})
const ficha = (id: string, nombre: string, ...acuerdos: AcuerdoSueldo[]): FichaSueldo => ({
  id,
  nombre,
  acuerdos,
  actualizadoEn: 1,
})
const persona = (id: string, nombre: string, activo = true): PersonaConSueldo => ({ id, nombre, activo })

let n = 0
const pago = (fecha: string, monto: number, extra: Record<string, unknown> = {}) => ({
  id: `m${++n}`,
  fecha,
  tipo: 'EGRESO_CAJA' as const,
  concepto: 'retiro',
  monto,
  categoria: 'SUELDOS' as const,
  cuenta: 'cajon' as const,
  persona: null as string | null,
  periodoSueldo: null as string | null,
  ...extra,
})

describe('lo acordado para un mes', () => {
  it('sin ningún acuerdo, o con uno que empieza después, no hay sueldo definido', () => {
    expect(sueldoDelMes([], '2026-11')).toBeNull()
    expect(sueldoDelMes([acuerdo('2026-12', 900_000)], '2026-11')).toBeNull()
  })

  it('rige desde su mes en adelante, hasta que otro lo cambia', () => {
    const acuerdos = [acuerdo('2026-11', 900_000), acuerdo('2027-02', 1_000_000)]
    expect(sueldoDelMes(acuerdos, '2026-11')).toBe(900_000)
    expect(sueldoDelMes(acuerdos, '2027-01')).toBe(900_000)
    expect(sueldoDelMes(acuerdos, '2027-02')).toBe(1_000_000)
    expect(sueldoDelMes(acuerdos, '2028-06')).toBe(1_000_000)
    // El orden en que están guardados no importa.
    expect(sueldoDelMes([...acuerdos].reverse(), '2027-01')).toBe(900_000)
  })

  it('dos para el mismo mes: vale el que se cargó último (una corrección)', () => {
    const acuerdos = [acuerdo('2026-11', 900_000, 100), acuerdo('2026-11', 950_000, 200)]
    expect(sueldoDelMes(acuerdos, '2026-11')).toBe(950_000)
    expect(sueldoDelMes([...acuerdos].reverse(), '2026-11')).toBe(950_000)
  })

  it('cero es «desde ese mes no cobra», no «sin definir»', () => {
    const acuerdos = [acuerdo('2026-11', 900_000), acuerdo('2027-01', 0)]
    expect(sueldoDelMes(acuerdos, '2027-01')).toBe(0)
    expect(sueldoDelMes(acuerdos, '2026-12')).toBe(900_000)
  })
})

describe('cargar un acuerdo', () => {
  it('pide el monto y el mes, y no acepta negativos', () => {
    expect(problemaDelAcuerdo(null, '2026-11', 'mes')).toMatch(/monto del sueldo/)
    expect(problemaDelAcuerdo(Number.NaN, '2026-11', 'mes')).toMatch(/monto/)
    expect(problemaDelAcuerdo(-1, '2026-11', 'mes')).toMatch(/negativo/)
    expect(problemaDelAcuerdo(900_000, '', 'mes')).toMatch(/mes/)
    expect(problemaDelAcuerdo(900_000, '2026-13', 'mes')).toMatch(/mes/)
    expect(problemaDelAcuerdo(900_000, '2026-11', 'mes')).toBeNull()
    expect(problemaDelAcuerdo(0, '2026-11', 'mes')).toBeNull()
    // Por mes rige desde un mes, no desde un día.
    expect(problemaDelAcuerdo(900_000, '2026-11-07', 'mes')).toMatch(/qué mes/)
  })

  it('por semana pide el monto de la semana y el día desde el que rige', () => {
    expect(problemaDelAcuerdo(null, '2026-11-07', 'semana')).toMatch(/monto de la semana/)
    expect(problemaDelAcuerdo(-1, '2026-11-07', 'semana')).toMatch(/negativo/)
    expect(problemaDelAcuerdo(100, '', 'semana')).toMatch(/qué día/)
    expect(problemaDelAcuerdo(100, '2026-11', 'semana')).toMatch(/qué día/)
    expect(problemaDelAcuerdo(100, '2026-02-30', 'semana')).toMatch(/qué día/)
    expect(problemaDelAcuerdo(100, '2026-11-07', 'semana')).toBeNull()
    expect(problemaDelAcuerdo(0, '2026-11-07', 'semana')).toBeNull()
  })

  it('un cambio se agrega: los acuerdos anteriores quedan', () => {
    const primera = conAcuerdo(null, { id: 'u1', nombre: 'Ana' }, acuerdo('2026-11', 900_000, 10))
    expect(primera).toEqual({ id: 'u1', nombre: 'Ana', acuerdos: [acuerdo('2026-11', 900_000, 10)], actualizadoEn: 10 })
    const segunda = conAcuerdo(primera, { id: 'u1', nombre: 'Ana María' }, acuerdo('2027-02', 1_000_000, 20))
    expect(segunda.acuerdos.map((a) => a.desde)).toEqual(['2026-11', '2027-02'])
    expect(segunda.nombre).toBe('Ana María')
    expect(segunda.actualizadoEn).toBe(20)
    // La que se recibió no se toca.
    expect(primera.acuerdos).toHaveLength(1)
  })

  it('la confirmación dice a quién, cuánto, desde cuándo y qué había', () => {
    const nuevo = textoDeConfirmacionSueldo('Ana', acuerdo('2026-11', 900_000), [])
    expect(nuevo).toContain(`¿Dejar el sueldo de Ana en ${plata(900_000)} por mes desde noviembre 2026?`)
    expect(nuevo).toContain('no tenía un sueldo definido')
    expect(nuevo).toContain('Los meses anteriores no cambian')
    const anteriores = [acuerdo('2026-11', 900_000, 1)]
    const cambio = textoDeConfirmacionSueldo('Ana', acuerdo('2027-02', 1_000_000, 2), anteriores)
    expect(cambio).toContain(`Para ese mes tenía ${plata(900_000)}.`)
    expect(textoDeConfirmacionSueldo('Ana', acuerdo('2027-03', 0, 2), anteriores)).toContain(
      '¿Dejar a Ana sin sueldo desde marzo 2027?',
    )
  })

  it('POR SEMANA, la confirmación dice desde qué día y cuánto le queda correspondiendo ese mes, con los sábados contados', () => {
    const texto = textoDeConfirmacionSueldo('Ana', porSemana('2026-11-07', 100), [])
    expect(texto).toContain(
      `¿Dejar el sueldo de Ana en ${plata(100)} por semana, que cobra cada sábado, desde el sábado 07/11/2026?`,
    )
    expect(texto).toContain(`En noviembre 2026 le corresponden ${plata(400)}: ${plata(100)} por semana × 4 sábados.`)
    expect(texto).toContain('no tenía un sueldo definido')
    expect(texto).toContain('Lo anterior a ese día no cambia')
    expect(texto).not.toContain('Los meses anteriores')
    // Empezando a mitad de mes se ve antes de guardar que son menos sábados.
    expect(textoDeConfirmacionSueldo('Ana', porSemana('2026-11-16', 100), [])).toContain(
      `desde el lunes 16/11/2026?\n\nEn noviembre 2026 le corresponden ${plata(200)}: ${plata(100)} por semana × 2 sábados.`,
    )
    // Un aumento: dice lo que tenía y cómo queda el mes.
    const aumento = textoDeConfirmacionSueldo('Ana', porSemana('2026-11-21', 150, 2), [porSemana('2026-11-01', 100, 1)])
    expect(aumento).toContain(`Para ese mes tenía ${plata(400)}.`)
    expect(aumento).toContain(`le corresponden ${plata(500)}: 2 sábados a ${plata(100)} y 2 sábados a ${plata(150)}.`)
    // Después del último sábado: ese mes no cambia, y se dice.
    expect(textoDeConfirmacionSueldo('Ana', porSemana('2026-11-30', 100), [])).toContain(
      'Desde ese día ya no queda ningún sábado en noviembre 2026: empieza a contar el mes siguiente.',
    )
    // Lo mismo si hasta ahí cobraba por mes: noviembre sigue por mes, y no se le inventa una cuenta de sábados.
    const trasElUltimoSabado = textoDeConfirmacionSueldo('Ana', porSemana('2026-11-30', 100, 2), [acuerdo('2026-10', 1000, 1)])
    expect(trasElUltimoSabado).toContain('Desde ese día ya no queda ningún sábado en noviembre 2026')
    expect(trasElUltimoSabado).not.toContain('le corresponden')
    expect(trasElUltimoSabado).toContain(`Para ese mes tenía ${plata(1000)}.`)
    expect(
      textoDeConfirmacionSueldo('Ana', porSemana('2026-11-21', 0, 2), [porSemana('2026-11-01', 100, 1)]),
    ).toContain('¿Dejar a Ana sin sueldo desde el sábado 21/11/2026?')
  })
})

describe('el mes de sueldos', () => {
  const personas = [persona('ana', 'Ana'), persona('beto', 'Beto'), persona('caro', 'Caro', false)]
  const fichas = [ficha('ana', 'Ana', acuerdo('2026-11', 900_000))]

  it('qué es un pago de sueldo: un gasto de categoría SUELDOS, salga del cajón o de otra cuenta', () => {
    expect(esPagoDeSueldo({ tipo: 'EGRESO_CAJA', categoria: 'SUELDOS' })).toBe(true)
    expect(esPagoDeSueldo({ tipo: 'GASTO_CAJA_GRANDE', categoria: 'SUELDOS' })).toBe(true)
    expect(esPagoDeSueldo({ tipo: 'EGRESO_CAJA', categoria: 'OTROS' })).toBe(false)
    expect(esPagoDeSueldo({ tipo: 'A_CAJA_GRANDE', categoria: 'SUELDOS' })).toBe(false)
  })

  it('cada persona: lo acordado, lo que lleva cobrado y lo que falta', () => {
    const r = resumenDeSueldos(
      personas,
      fichas,
      [
        pago('2026-11-06', 200_000, { persona: 'ana' }),
        pago('2026-11-13', 250_000, { persona: 'ana' }),
        pago('2026-11-14', 80_000, { persona: 'beto' }),
        pago('2026-10-30', 999, { persona: 'ana' }), // de octubre: no cuenta
        pago('2026-11-10', 5_000, { persona: 'ana', categoria: 'OTROS' }), // no es sueldo
      ],
      '2026-11',
    )
    expect(r.renglones.map((x) => [x.persona.nombre, x.acordado, x.pagado, x.saldo])).toEqual([
      ['Ana', 900_000, 450_000, 450_000],
      ['Beto', null, 80_000, null],
    ])
    expect(r.renglones[0].pagos.map((p) => p.fecha)).toEqual(['2026-11-06', '2026-11-13'])
    expect([r.acordado, r.pagado, r.falta]).toEqual([900_000, 530_000, 450_000])
    expect(r.sinAsignar).toEqual([])
  })

  it('un pago que dice a qué mes corresponde cuenta en ese mes y no en el de su fecha', () => {
    const movimientos = [pago('2026-12-03', 450_000, { persona: 'ana', periodoSueldo: '2026-11' })]
    expect(mesDelPago(movimientos[0])).toBe('2026-11')
    expect(mesDelPago(pago('2026-12-03', 1))).toBe('2026-12')
    expect(mesDelPago(pago('2026-12-03', 1, { periodoSueldo: 'cualquiera' }))).toBe('2026-12')
    const noviembre = resumenDeSueldos(personas, fichas, movimientos, '2026-11')
    expect(noviembre.renglones[0]).toMatchObject({ pagado: 450_000, saldo: 450_000 })
    const diciembre = resumenDeSueldos(personas, fichas, movimientos, '2026-12')
    expect(diciembre.renglones[0]).toMatchObject({ pagado: 0, saldo: 900_000 })
  })

  it('un pago sin persona, o a nombre de alguien que no figura, queda «sin asignar» y suma al total', () => {
    const r = resumenDeSueldos(
      personas,
      fichas,
      [pago('2026-11-06', 70_000), pago('2026-11-07', 30_000, { persona: 'nadie' }), pago('2026-11-08', 10_000, { persona: 'ana' })],
      '2026-11',
    )
    expect(r.sinAsignar.map((m) => m.monto)).toEqual([70_000, 30_000])
    expect(r.pagado).toBe(110_000)
    expect(r.renglones.find((x) => x.persona.id === 'ana')?.pagado).toBe(10_000)
  })

  it('quien ya no está activo aparece solo si tiene sueldo definido o cobró ese mes', () => {
    const sinNada = resumenDeSueldos(personas, fichas, [], '2026-11')
    expect(sinNada.renglones.map((x) => x.persona.nombre)).toEqual(['Ana', 'Beto'])
    const cobro = resumenDeSueldos(personas, fichas, [pago('2026-11-02', 50_000, { persona: 'caro' })], '2026-11')
    expect(cobro.renglones.map((x) => x.persona.nombre)).toEqual(['Ana', 'Beto', 'Caro'])
    // Con ficha pero sin usuario (se borró): se muestra con el nombre de la ficha.
    const borrada = resumenDeSueldos(personas, [...fichas, ficha('dani', 'Dani', acuerdo('2026-10', 500_000))], [], '2026-11')
    expect(borrada.renglones.map((x) => [x.persona.nombre, x.acordado])).toContainEqual(['Dani', 500_000])
  })

  it('lo que uno cobró de más no tapa lo que le falta a otro', () => {
    const r = resumenDeSueldos(
      personas,
      [...fichas, ficha('beto', 'Beto', acuerdo('2026-11', 400_000))],
      [pago('2026-11-06', 1_000_000, { persona: 'ana' }), pago('2026-11-06', 100_000, { persona: 'beto' })],
      '2026-11',
    )
    expect(r.renglones.map((x) => x.saldo)).toEqual([-100_000, 300_000])
    expect(r.falta).toBe(300_000)
  })

  it('el saldo, en palabras: qué pasa y cuánto, siempre en positivo', () => {
    expect(estadoDelSaldo({ acordado: null, saldo: null })).toEqual({ etiqueta: 'Sin sueldo definido', monto: null })
    expect(estadoDelSaldo({ acordado: 900_000, saldo: 450_000 })).toEqual({ etiqueta: 'Falta pagar', monto: 450_000 })
    expect(estadoDelSaldo({ acordado: 900_000, saldo: -100_000 })).toEqual({ etiqueta: 'Cobró de más', monto: 100_000 })
    expect(estadoDelSaldo({ acordado: 900_000, saldo: 0 })).toEqual({ etiqueta: 'Al día', monto: 0 })
  })
})

describe('gastos que parecen un sueldo y están en otra categoría', () => {
  const personas = [persona('ana', 'Ana Paula'), persona('beto', 'Beto')]

  it('sugiere los que nombran a alguien del equipo o dicen sueldo o adelanto', () => {
    const lista = parecenSueldo(
      [
        pago('2026-11-03', 50_000, { categoria: 'OTROS', concepto: 'Retiro ANA' }),
        pago('2026-11-04', 60_000, { categoria: 'OTROS', concepto: 'adelanto' }),
        pago('2026-11-05', 70_000, { categoria: 'OTROS', concepto: 'Sueldo de Betó' }),
        pago('2026-11-06', 1_000, { categoria: 'OTROS', concepto: 'café y bananas' }), // "ana" adentro de otra palabra
        pago('2026-11-07', 2_000, { categoria: 'SUELDOS', concepto: 'sueldo ana' }), // ya es sueldo
        pago('2026-11-08', 3_000, { categoria: 'RETIRO SOCIOS', concepto: 'retiro beto' }), // no es sueldo
        pago('2026-10-08', 4_000, { categoria: 'OTROS', concepto: 'adelanto' }), // otro mes
        pago('2026-11-09', 5_000, { categoria: 'OTROS', concepto: 'adelanto', tipo: 'A_CAJA_GRANDE' }), // no es gasto
      ],
      personas,
      '2026-11',
    )
    expect(lista.map((x) => [x.movimiento.monto, x.sugerida?.id ?? null])).toEqual([
      [50_000, 'ana'],
      [60_000, null],
      [70_000, 'beto'],
    ])
  })
})

describe('a quién se le puede cargar un pago', () => {
  it('a los activos, por nombre', () => {
    const lista = personasParaSueldo([persona('z', 'Zoe'), persona('c', 'Caro', false), persona('a', 'Ana')])
    expect(lista.map((p) => p.nombre)).toEqual(['Ana', 'Zoe'])
  })
})

describe('una ficha como viene del servidor', () => {
  it('se lee entera cuando está bien', () => {
    const datos = { nombre: 'Ana', acuerdos: [acuerdo('2026-11', 900_000, 7)], actualizadoEn: 7 }
    expect(fichaDesdeDatos('ana', datos)).toEqual({
      id: 'ana',
      nombre: 'Ana',
      acuerdos: [acuerdo('2026-11', 900_000, 7)],
      actualizadoEn: 7,
    })
  })

  it('lo que no se entiende se saltea, sin romper', () => {
    const rota = fichaDesdeDatos('ana', {
      nombre: 5,
      acuerdos: [
        { desde: '2026-11', monto: '900000' }, // el monto no es un número
        { desde: 'noviembre', monto: 1 }, // el mes no es un mes
        { desde: '2026-11', monto: -5 }, // negativo
        null,
        { desde: '2026-12', monto: 800_000 }, // este sí
      ],
    })
    expect(rota).toEqual({
      id: 'ana',
      nombre: '',
      acuerdos: [{ desde: '2026-12', monto: 800_000, cada: 'mes', anotadoEl: 0, por: null }],
      actualizadoEn: 0,
    })
    expect(fichaDesdeDatos('x', null).acuerdos).toEqual([])
    expect(fichaDesdeDatos('x', { acuerdos: 'nada' }).acuerdos).toEqual([])
  })

  it('un acuerdo por semana se lee con su día; uno sin «cada» es por mes', () => {
    const leida = fichaDesdeDatos('ana', {
      nombre: 'Ana',
      acuerdos: [
        { desde: '2026-11-07', monto: 100, cada: 'semana', anotadoEl: 3, por: 'dueno@ejemplo.com' },
        { desde: '2026-10', monto: 1000 },
      ],
    })
    expect(leida.acuerdos).toEqual([porSemana('2026-11-07', 100, 3), { ...acuerdo('2026-10', 1000, 0), por: null }])
  })

  it('un acuerdo que no cierra se saltea: por semana sin día, por mes con día, o «cada» algo que no se conoce', () => {
    const leida = fichaDesdeDatos('ana', {
      acuerdos: [
        { desde: '2026-11', monto: 100, cada: 'semana' }, // por semana pide un día
        { desde: '2026-11-07', monto: 1000, cada: 'mes' }, // por mes pide un mes
        { desde: '2026-11-07', monto: 1000 }, // sin «cada» es por mes: lo mismo
        { desde: '2026-02-30', monto: 100, cada: 'semana' }, // ese día no existe
        { desde: '2026-11-07', monto: 100, cada: 'quincena' }, // no se conoce: tomarlo por mes sería inventar
        { desde: '2026-11', monto: 100, cada: null },
      ],
    })
    expect(leida.acuerdos).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* Lo del 19/11 a la tarde: apodos, pagos por semana, retiros, «Mi sueldo» */

const dueno = (id: string, nombre: string, apodos: string | null = null): PersonaConSueldo => ({
  id,
  nombre,
  activo: true,
  rol: 'owner',
  apodos,
})
const empleada = (id: string, nombre: string, apodos: string | null = null): PersonaConSueldo => ({
  id,
  nombre,
  activo: true,
  rol: 'empleado',
  apodos,
})

describe('con qué nombres figura alguien en un gasto', () => {
  it('su nombre de pila y sus apodos, sin acentos ni mayúsculas', () => {
    expect(comoFigura({ nombre: 'Gabriela Pérez', apodos: 'Gabi, GABY' })).toEqual(['gabriela', 'gabi', 'gaby'])
    expect(comoFigura({ nombre: 'José', apodos: null })).toEqual(['jose'])
  })

  it('un nombre de dos letras no se usa (aparece adentro de todo); un apodo de dos letras sí', () => {
    expect(comoFigura({ nombre: 'Lu', apodos: null })).toEqual([])
    expect(comoFigura({ nombre: 'Lu', apodos: 'Lu' })).toEqual(['lu'])
    expect(comoFigura({ nombre: 'Ana', apodos: 'A' })).toEqual(['ana'])
  })

  it('no repite: el apodo igual al nombre cuenta una vez', () => {
    expect(comoFigura({ nombre: 'Ana', apodos: 'ana, Anita' })).toEqual(['ana', 'anita'])
  })

  it('los apodos se guardan prolijos, y vacío es «no tiene»', () => {
    expect(apodosLimpios('  Gabi ,gaby,, Gabi  ')).toBe('Gabi, gaby')
    expect(apodosLimpios('   ')).toBeNull()
    expect(apodosLimpios(' , ,')).toBeNull()
  })
})

describe('qué parece un gasto por su concepto', () => {
  const equipo = [empleada('gabi', 'Gabriela Pérez', 'Gabi'), empleada('sandra', 'Sandra'), dueno('elena', 'Elena', 'Mamá')]

  it('LOS PAGOS POR SEMANA: «SEMANA GABI» es el sueldo de Gabriela, por su apodo', () => {
    expect(queParece('SEMANA GABI', equipo)).toEqual({ que: 'sueldo', persona: equipo[0] })
    expect(queParece('gabi semana', equipo)).toEqual({ que: 'sueldo', persona: equipo[0] })
  })

  it('sin el apodo cargado igual parece un sueldo, por «semana», pero no sabe de quién', () => {
    const sinApodo = [empleada('gabi', 'Gabriela Pérez'), empleada('sandra', 'Sandra')]
    expect(queParece('SEMANA GABI', sinApodo)).toEqual({ que: 'sueldo', persona: null })
  })

  it('si nombra a un dueño es un retiro, diga lo que diga el resto', () => {
    expect(queParece('Elena', equipo)).toEqual({ que: 'retiro', persona: equipo[2] })
    expect(queParece('adelanto mamá', equipo)).toEqual({ que: 'retiro', persona: equipo[2] })
  })

  it('si nombra a alguien del equipo es un sueldo, aunque diga «retiro»', () => {
    expect(queParece('Retiro Sandra', equipo)).toEqual({ que: 'sueldo', persona: equipo[1] })
  })

  it('sin nombre deciden las palabras: «adelanto» es sueldo, «retiro» es retiro', () => {
    expect(queParece('adelanto', equipo)).toEqual({ que: 'sueldo', persona: null })
    expect(queParece('RETIRO EFECTIVO', equipo)).toEqual({ que: 'retiro', persona: null })
    // Con las dos, gana la de sueldo: «retiro» se le dice a cualquier salida de plata.
    expect(queParece('retiro adelanto', equipo)).toEqual({ que: 'sueldo', persona: null })
  })

  it('lo que no nombra a nadie ni dice nada de eso, no parece nada', () => {
    expect(queParece('flete y café', equipo)).toBeNull()
    expect(queParece('', equipo)).toBeNull()
    // El nombre adentro de otra palabra no cuenta.
    expect(queParece('sandralias', equipo)).toBeNull()
    expect(queParece('semanario', equipo)).toBeNull()
  })

  it('la pregunta y la categoría que se le ofrecen a quien carga', () => {
    const sueldoDeGabi = queParece('semana gabi', equipo)!
    expect(preguntaDeLaSugerencia(sueldoDeGabi)).toBe('¿Es el sueldo de Gabriela Pérez?')
    expect(categoriaQueSugiere(sueldoDeGabi)).toBe('SUELDOS')
    const retiroDeElena = queParece('elena', equipo)!
    expect(preguntaDeLaSugerencia(retiroDeElena)).toBe('¿Es un retiro de Elena?')
    expect(categoriaQueSugiere(retiroDeElena)).toBe('RETIRO SOCIOS')
    expect(preguntaDeLaSugerencia({ que: 'sueldo', persona: null })).toBe('¿Es un sueldo?')
    expect(preguntaDeLaSugerencia({ que: 'retiro', persona: null })).toBe('¿Es un retiro de un dueño?')
  })

  it('no se ofrece lo que ya está puesto: la categoría, y la persona si el concepto la nombra', () => {
    const sueldoDeGabi = queParece('semana gabi', equipo)!
    expect(sugerenciaAplicada(sueldoDeGabi, 'OTROS', null)).toBe(false)
    expect(sugerenciaAplicada(sueldoDeGabi, 'SUELDOS', null)).toBe(false)
    expect(sugerenciaAplicada(sueldoDeGabi, 'SUELDOS', 'sandra')).toBe(false)
    expect(sugerenciaAplicada(sueldoDeGabi, 'SUELDOS', 'gabi')).toBe(true)
    expect(sugerenciaAplicada(sueldoDeGabi, 'RETIRO SOCIOS', 'gabi')).toBe(false)
    // Sin nombre alcanza con la categoría.
    expect(sugerenciaAplicada({ que: 'sueldo', persona: null }, 'SUELDOS', null)).toBe(true)
    expect(sugerenciaAplicada({ que: 'retiro', persona: null }, 'SUELDOS', null)).toBe(false)
  })
})

describe('los pagos por semana que no se encontraban', () => {
  // Como estaban cargados: con el apodo, la palabra «semana» y en OTROS.
  const sabados = ['2026-10-03', '2026-10-10', '2026-10-17']
  const pagos = sabados.map((f, i) =>
    pago(f, 100 + i, { categoria: 'OTROS', concepto: i % 2 === 0 ? 'SEMANA GABI' : 'GABI SEMANA' }),
  )

  it('con el apodo, los encuentra y sabe de quién son', () => {
    const lista = parecenSueldo(pagos, [empleada('gabi', 'Gabriela Pérez', 'Gabi')], '2026-10')
    expect(lista.map((x) => [x.movimiento.fecha, x.sugerida?.id ?? null])).toEqual(sabados.map((f) => [f, 'gabi']))
  })

  it('sin el apodo, los encuentra igual por «semana», sin decir de quién', () => {
    const lista = parecenSueldo(pagos, [empleada('gabi', 'Gabriela Pérez')], '2026-10')
    expect(lista.map((x) => [x.movimiento.fecha, x.sugerida])).toEqual(sabados.map((f) => [f, null]))
  })

  it('el apodo que se puede ofrecer recordar: la única palabra que queda', () => {
    const equipo = [empleada('gabi', 'Gabriela Pérez'), dueno('elena', 'Elena')]
    expect(apodoPosible('SEMANA GABI', equipo)).toBe('gabi')
    expect(apodoPosible('adelanto 2 gabi', equipo)).toBe('gabi')
    // Nada que ofrecer: no queda ninguna, o quedan dos y no se adivina.
    expect(apodoPosible('SEMANA', equipo)).toBeNull()
    expect(apodoPosible('semana gabi extra', equipo)).toBeNull()
    // Lo que ya es de alguien no se ofrece otra vez.
    expect(apodoPosible('semana gabriela', equipo)).toBeNull()
    expect(apodoPosible('retiro elena', equipo)).toBeNull()
    // Palabras de relleno y de dos letras no son un apodo.
    expect(apodoPosible('pago semana de gabi', equipo)).toBe('gabi')
    expect(apodoPosible('semana lu', equipo)).toBeNull()
    // Un número no es un apodo, tenga las cifras que tenga.
    expect(apodoPosible('adelanto 500', equipo)).toBeNull()
  })
})

describe('gastos que parecen el retiro de un dueño', () => {
  const equipo = [dueno('elena', 'Elena', 'mamá'), dueno('seba', 'Sebastián', 'Seba'), empleada('gabi', 'Gabriela', 'Gabi')]

  it('los que nombran a un dueño o dicen «retiro», y no los que ya están en su categoría', () => {
    const lista = parecenRetiro(
      [
        pago('2026-11-03', 1, { categoria: 'OTROS', concepto: 'ELENA' }),
        pago('2026-11-04', 2, { categoria: 'OTROS', concepto: 'retiro' }),
        pago('2026-11-05', 3, { categoria: 'OTROS', concepto: 'seba nafta' }),
        pago('2026-11-06', 4, { categoria: 'OTROS', concepto: 'semana gabi' }), // es un sueldo, va a la otra lista
        pago('2026-11-07', 5, { categoria: 'RETIRO SOCIOS', concepto: 'retiro mamá' }), // ya es retiro
        pago('2026-11-08', 6, { categoria: 'SUELDOS', concepto: 'elena' }), // ya es sueldo: no se toca desde acá
        pago('2026-10-08', 7, { categoria: 'OTROS', concepto: 'elena' }), // otro mes
        pago('2026-11-09', 8, { categoria: 'OTROS', concepto: 'flete' }),
      ],
      equipo,
      '2026-11',
    )
    expect(lista.map((x) => [x.movimiento.monto, x.sugerida?.id ?? null])).toEqual([
      [1, 'elena'],
      [2, null],
      [3, 'seba'],
    ])
  })

  it('y esos mismos no aparecen como sueldo', () => {
    const lista = parecenSueldo(
      [
        pago('2026-11-03', 1, { categoria: 'OTROS', concepto: 'adelanto elena' }),
        pago('2026-11-06', 4, { categoria: 'OTROS', concepto: 'semana gabi' }),
      ],
      equipo,
      '2026-11',
    )
    expect(lista.map((x) => x.movimiento.monto)).toEqual([4])
  })
})

describe('los retiros de los dueños, por persona', () => {
  const personas = [
    dueno('emma', 'Emmanuel'),
    dueno('elena', 'Elena'),
    { ...dueno('ex', 'Ex socio'), activo: false },
    empleada('gabi', 'Gabriela'),
  ]
  const retiro = (fecha: string, monto: number, persona: string | null, extra: Record<string, unknown> = {}) =>
    pago(fecha, monto, { categoria: 'RETIRO SOCIOS', persona, ...extra })

  it('qué es un retiro: un gasto de categoría RETIRO SOCIOS, salga del cajón o de otra cuenta', () => {
    expect(esRetiroDeSocio({ tipo: 'EGRESO_CAJA', categoria: 'RETIRO SOCIOS' })).toBe(true)
    expect(esRetiroDeSocio({ tipo: 'GASTO_CAJA_GRANDE', categoria: 'RETIRO SOCIOS' })).toBe(true)
    expect(esRetiroDeSocio({ tipo: 'EGRESO_CAJA', categoria: 'SUELDOS' })).toBe(false)
    expect(esRetiroDeSocio({ tipo: 'A_CAJA_GRANDE', categoria: 'RETIRO SOCIOS' })).toBe(false)
  })

  it('cada dueño con lo que retiró en el mes, de a poquito: se suma', () => {
    const r = resumenDeRetiros(
      personas,
      [
        retiro('2026-11-02', 10, 'elena'),
        retiro('2026-11-09', 20, 'elena'),
        retiro('2026-11-16', 30, 'elena'),
        retiro('2026-11-05', 400, 'emma'),
        retiro('2026-10-31', 999, 'elena'), // octubre
        pago('2026-11-06', 77, { persona: 'elena' }), // un sueldo no es un retiro
      ],
      '2026-11',
    )
    expect(r.renglones.map((x) => [x.persona.nombre, x.retirado, x.retiros.length])).toEqual([
      ['Elena', 60, 3],
      ['Emmanuel', 400, 1],
    ])
    expect(r.total).toBe(460)
    expect(r.sinAsignar).toEqual([])
  })

  it('un dueño activo figura aunque no haya retirado; uno que ya no está, solo si retiró', () => {
    const sinNada = resumenDeRetiros(personas, [], '2026-11')
    expect(sinNada.renglones.map((x) => [x.persona.nombre, x.retirado])).toEqual([
      ['Elena', 0],
      ['Emmanuel', 0],
    ])
    const conElEx = resumenDeRetiros(personas, [retiro('2026-11-02', 5, 'ex')], '2026-11')
    expect(conElEx.renglones.map((x) => x.persona.nombre)).toEqual(['Elena', 'Emmanuel', 'Ex socio'])
  })

  it('un retiro sin nombre, o a nombre de alguien que no figura, queda «sin asignar» y suma al total', () => {
    const r = resumenDeRetiros(
      personas,
      [retiro('2026-11-02', 10, null), retiro('2026-11-03', 20, 'nadie'), retiro('2026-11-04', 30, 'elena')],
      '2026-11',
    )
    expect(r.sinAsignar.map((m) => m.monto)).toEqual([10, 20])
    expect(r.total).toBe(60)
  })

  it('si un retiro quedó a nombre de alguien que no es dueño, se ve: no se esconde', () => {
    const r = resumenDeRetiros(personas, [retiro('2026-11-02', 10, 'gabi')], '2026-11')
    expect(r.renglones.map((x) => [x.persona.nombre, x.retirado])).toContainEqual(['Gabriela', 10])
  })

  it('a quién se le puede cargar un retiro: a los dueños activos, por nombre', () => {
    expect(duenosParaRetiro(personas).map((p) => p.nombre)).toEqual(['Elena', 'Emmanuel'])
  })
})

describe('en el mes de sueldos, los dueños no figuran salvo que cobren uno', () => {
  const personas = [dueno('emma', 'Emmanuel'), dueno('elena', 'Elena'), empleada('gabi', 'Gabriela')]

  it('un dueño sin sueldo definido y sin pagos no aparece; la empleada sí', () => {
    const r = resumenDeSueldos(personas, [], [], '2026-11')
    expect(r.renglones.map((x) => x.persona.nombre)).toEqual(['Gabriela'])
  })

  it('si a un dueño se le definió un sueldo, o se le cargó un pago, aparece', () => {
    const conAcuerdoDeElena = resumenDeSueldos(personas, [ficha('elena', 'Elena', acuerdo('2026-11', 500))], [], '2026-11')
    expect(conAcuerdoDeElena.renglones.map((x) => x.persona.nombre)).toEqual(['Elena', 'Gabriela'])
    const conPagoAEmma = resumenDeSueldos(personas, [], [pago('2026-11-05', 9, { persona: 'emma' })], '2026-11')
    expect(conPagoAEmma.renglones.map((x) => x.persona.nombre)).toEqual(['Emmanuel', 'Gabriela'])
  })
})

describe('«Mi sueldo»: lo de una persona en el mes', () => {
  const miFicha = ficha('gabi', 'Gabriela', acuerdo('2026-10', 1000))
  const movimientos = [
    pago('2026-11-07', 250, { persona: 'gabi', concepto: 'semana 1' }),
    pago('2026-11-14', 250, { persona: 'gabi', concepto: 'semana 2' }),
    pago('2026-11-21', 250, { persona: 'gabi', concepto: 'semana 3' }),
    pago('2026-11-10', 999, { persona: 'sandra' }), // de otra persona
    pago('2026-11-11', 888, { persona: null }), // sin asignar
    pago('2026-12-03', 100, { persona: 'gabi', periodoSueldo: '2026-11', concepto: 'saldo' }), // de noviembre, pagado en diciembre
    pago('2026-11-28', 777, { persona: 'gabi', categoria: 'OTROS' }), // no es sueldo
    pago('2026-10-31', 50, { persona: 'gabi' }), // octubre
  ]

  it('SE ACUERDA POR MES Y SE PAGA POR SEMANA: las semanas se suman y lo que falta es la diferencia', () => {
    const mio = miSueldoDelMes(miFicha, movimientos, 'gabi', '2026-11')
    expect(mio.acordado).toBe(1000)
    expect(mio.pagos.map((m) => m.concepto)).toEqual(['semana 1', 'semana 2', 'semana 3', 'saldo'])
    expect(mio.pagado).toBe(850)
    expect(mio.saldo).toBe(150)
    expect(estadoDeMiSaldo(mio)).toEqual({ etiqueta: 'Te falta cobrar', monto: 150 })
  })

  it('solo lo suyo: ni lo de otra persona ni lo que no tiene nombre', () => {
    const mio = miSueldoDelMes(miFicha, movimientos, 'gabi', '2026-11')
    expect(mio.pagos.every((m) => m.persona === 'gabi')).toBe(true)
    expect(mio.pagos.map((m) => m.monto)).not.toContain(999)
    expect(mio.pagos.map((m) => m.monto)).not.toContain(888)
  })

  it('el último pago cierra el mes: al día, o de más si se pasó', () => {
    const alDia = miSueldoDelMes(miFicha, [...movimientos, pago('2026-11-28', 150, { persona: 'gabi' })], 'gabi', '2026-11')
    expect(estadoDeMiSaldo(alDia)).toEqual({ etiqueta: 'Estás al día', monto: 0 })
    const deMas = miSueldoDelMes(miFicha, [...movimientos, pago('2026-11-28', 200, { persona: 'gabi' })], 'gabi', '2026-11')
    expect(estadoDeMiSaldo(deMas)).toEqual({ etiqueta: 'Cobraste de más', monto: 50 })
  })

  it('sin ficha, o sin un acuerdo que alcance al mes, dice que no hay sueldo cargado y muestra igual lo cobrado', () => {
    const sinFicha = miSueldoDelMes(null, movimientos, 'gabi', '2026-11')
    expect(sinFicha.acordado).toBeNull()
    expect(sinFicha.saldo).toBeNull()
    expect(sinFicha.pagado).toBe(850)
    expect(estadoDeMiSaldo(sinFicha)).toEqual({ etiqueta: 'Todavía no hay un sueldo cargado', monto: null })
    expect(miSueldoDelMes(miFicha, movimientos, 'gabi', '2026-09').acordado).toBeNull()
  })
})

describe('quién ve lo acordado, dicho al guardar', () => {
  it('la confirmación avisa que lo ven los dueños, quien está de encargado y la propia persona', () => {
    for (const nuevo of [acuerdo('2026-11', 1000), porSemana('2026-11-07', 250)]) {
      const texto = textoDeConfirmacionSueldo('Gabriela', nuevo, [])
      expect(texto).toContain('Lo ven los dueños, quien está de encargado y Gabriela en «Mi sueldo»')
      expect(texto).not.toContain('solo el dueño')
    }
  })
})


describe('los sábados de un mes', () => {
  it('son cuatro o cinco, según cómo caiga el mes', () => {
    expect(sabadosDelMes('2026-11')).toEqual(['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'])
    expect(sabadosDelMes('2026-10')).toEqual(['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31'])
    expect(sabadosDelMes('2027-01')).toEqual(['2027-01-02', '2027-01-09', '2027-01-16', '2027-01-23', '2027-01-30'])
    expect(sabadosDelMes('2026-12')).toEqual(['2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26'])
  })

  it('febrero, con 28 días y con 29', () => {
    expect(sabadosDelMes('2026-02')).toEqual(['2026-02-07', '2026-02-14', '2026-02-21', '2026-02-28'])
    // 2020 fue bisiesto y el 29 cayó sábado: son cinco.
    expect(sabadosDelMes('2020-02')).toEqual(['2020-02-01', '2020-02-08', '2020-02-15', '2020-02-22', '2020-02-29'])
    expect(sabadosDelMes('2021-02')).toEqual(['2021-02-06', '2021-02-13', '2021-02-20', '2021-02-27'])
  })

  it('lo que no es un mes no tiene sábados', () => {
    expect(sabadosDelMes('2026-13')).toEqual([])
    expect(sabadosDelMes('2026-11-07')).toEqual([])
    expect(sabadosDelMes('')).toEqual([])
  })

  it('un día que no existe no es un día', () => {
    expect(esDia('2026-11-07')).toBe(true)
    expect(esDia('2020-02-29')).toBe(true)
    expect(esDia('2021-02-29')).toBe(false)
    expect(esDia('2026-02-30')).toBe(false)
    expect(esDia('2026-11-31')).toBe(false)
    expect(esDia('2026-11')).toBe(false)
    expect(esDia('07/11/2026')).toBe(false)
  })
})

describe('SUELDO POR SEMANA: un monto fijo cada sábado (19/11)', () => {
  const sabadosDeNoviembre = ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']

  it('a cada mes le corresponde el monto por los sábados que tiene: cuatro en noviembre, cinco en octubre', () => {
    const acuerdos = [porSemana('2026-10-01', 100)]
    expect(acordadoEnElMes(acuerdos, '2026-11')).toEqual({
      monto: 400,
      cada: 'semana',
      tramos: [{ monto: 100, sabados: sabadosDeNoviembre }],
    })
    expect(sueldoDelMes(acuerdos, '2026-10')).toBe(500)
    expect(sueldoDelMes(acuerdos, '2026-12')).toBe(400)
    expect(sueldoDelMes(acuerdos, '2027-01')).toBe(500)
  })

  it('cuentan los sábados desde el día en que empieza, ese día incluido', () => {
    // Empezó el sábado 14: le tocan el 14, el 21 y el 28.
    expect(sueldoDelMes([porSemana('2026-11-14', 100)], '2026-11')).toBe(300)
    // Empezó un miércoles: su primer sábado es el de esa semana.
    expect(sueldoDelMes([porSemana('2026-11-04', 100)], '2026-11')).toBe(400)
    // Empezó un domingo: el sábado de la víspera no cuenta.
    expect(sueldoDelMes([porSemana('2026-11-08', 100)], '2026-11')).toBe(300)
    // Los meses que siguen, enteros.
    expect(sueldoDelMes([porSemana('2026-11-14', 100)], '2026-12')).toBe(400)
  })

  it('para algo que no es un mes no hay nada acordado, haya los acuerdos que haya', () => {
    expect(acordadoEnElMes([acuerdo('2026-11', 1000), porSemana('2026-11-07', 100)], 'cualquier cosa')).toBeNull()
    expect(sueldoDelMes([acuerdo('2026-11', 1000)], '2026-13')).toBeNull()
  })

  it('antes de empezar no hay nada acordado, y un mes sin ningún sábado suyo tampoco', () => {
    expect(sueldoDelMes([porSemana('2026-11-14', 100)], '2026-10')).toBeNull()
    // Empieza el lunes 30: en noviembre ya no queda ningún sábado.
    expect(acordadoEnElMes([porSemana('2026-11-30', 100)], '2026-11')).toBeNull()
    expect(sueldoDelMes([porSemana('2026-11-30', 100)], '2026-12')).toBe(400)
  })

  it('un aumento a mitad de mes: cada sábado vale lo que regía ese día', () => {
    const acuerdos = [porSemana('2026-11-01', 100, 1), porSemana('2026-11-21', 150, 2)]
    expect(acordadoEnElMes(acuerdos, '2026-11')).toEqual({
      monto: 500,
      cada: 'semana',
      tramos: [
        { monto: 100, sabados: ['2026-11-07', '2026-11-14'] },
        { monto: 150, sabados: ['2026-11-21', '2026-11-28'] },
      ],
    })
    expect(sueldoDelMes(acuerdos, '2026-12')).toBe(600)
    // El orden en que están guardados no cambia nada.
    expect(sueldoDelMes([...acuerdos].reverse(), '2026-11')).toBe(500)
  })

  it('si dos empiezan el mismo día vale el último que se cargó: así se corrige un monto mal puesto', () => {
    const acuerdos = [porSemana('2026-11-07', 100, 10), porSemana('2026-11-07', 120, 20)]
    expect(sueldoDelMes(acuerdos, '2026-11')).toBe(480)
    expect(sueldoDelMes([...acuerdos].reverse(), '2026-11')).toBe(480)
  })

  it('con 0 deja de cobrar desde ese día', () => {
    const acuerdos = [porSemana('2026-11-01', 100, 1), porSemana('2026-11-21', 0, 2)]
    expect(sueldoDelMes(acuerdos, '2026-11')).toBe(200)
    expect(sueldoDelMes(acuerdos, '2026-12')).toBe(0)
  })

  it('de «por mes» a «por semana»: el mes del cambio cuenta los sábados desde el cambio', () => {
    const acuerdos = [acuerdo('2026-10', 1000, 1), porSemana('2026-11-14', 100, 2)]
    expect(acordadoEnElMes(acuerdos, '2026-10')).toEqual({ monto: 1000, cada: 'mes', tramos: [] })
    expect(sueldoDelMes(acuerdos, '2026-11')).toBe(300)
    expect(sueldoDelMes(acuerdos, '2026-12')).toBe(400)
    // Si el cambio cae después del último sábado, ese mes sigue siendo por mes.
    expect(acordadoEnElMes([acuerdo('2026-10', 1000, 1), porSemana('2026-11-30', 100, 2)], '2026-11')).toEqual({
      monto: 1000,
      cada: 'mes',
      tramos: [],
    })
  })

  it('de «por semana» a «por mes»: desde ese mes vale el monto del mes', () => {
    const acuerdos = [porSemana('2026-10-01', 100, 1), acuerdo('2026-12', 1000, 2)]
    expect(sueldoDelMes(acuerdos, '2026-11')).toBe(400)
    expect(acordadoEnElMes(acuerdos, '2026-12')).toEqual({ monto: 1000, cada: 'mes', tramos: [] })
    expect(sueldoDelMes(acuerdos, '2027-01')).toBe(1000)
  })

  it('volver a «por mes» en el mes en que empezó el de por semana no cambiaría nada: se avisa antes de guardar', () => {
    const anteriores = [porSemana('2026-11-07', 100, 1)]
    const nuevo = acuerdo('2026-11', 1000, 2)
    // Vale el que empezó último: el de por semana, que empezó el 7.
    expect(sueldoDelMes([...anteriores, nuevo], '2026-11')).toBe(400)
    expect(porQueNoCambia(anteriores, nuevo)).toMatch(/noviembre 2026 ya rige un acuerdo por semana.*elegí desde el mes siguiente/)
    // Desde el mes siguiente sí cambia: nada que avisar.
    expect(porQueNoCambia(anteriores, acuerdo('2026-12', 1000, 2))).toBeNull()
    // Si el de por semana empezó el día 1.º, el de por mes cargado después lo reemplaza.
    expect(porQueNoCambia([porSemana('2026-11-01', 100, 1)], nuevo)).toBeNull()
    // Un acuerdo por semana no cae en esto, y sin nada antes tampoco.
    expect(porQueNoCambia(anteriores, porSemana('2026-11-14', 100, 2))).toBeNull()
    expect(porQueNoCambia([], nuevo)).toBeNull()
  })
})

describe('el sueldo por semana, dicho en pantalla', () => {
  const noviembre = acordadoEnElMes([porSemana('2026-11-01', 100)], '2026-11')

  it('dice la cuenta: el monto por los sábados del mes', () => {
    expect(comoSeCalcula(noviembre, '2026-12-15')).toBe(`${plata(100)} por semana × 4 sábados`)
    expect(comoSeCalcula(acordadoEnElMes([porSemana('2026-11-28', 100)], '2026-11'), '2027-01-01')).toBe(
      `${plata(100)} por semana × 1 sábado`,
    )
  })

  it('en el mes en curso dice cuántos sábados van; en un mes que ya pasó o que todavía no llegó, no', () => {
    expect(comoSeCalcula(noviembre, '2026-11-19')).toBe(`${plata(100)} por semana × 4 sábados · van 2`)
    // El sábado mismo ya cuenta.
    expect(comoSeCalcula(noviembre, '2026-11-14')).toBe(`${plata(100)} por semana × 4 sábados · van 2`)
    expect(comoSeCalcula(noviembre, '2026-11-13')).toBe(`${plata(100)} por semana × 4 sábados · van 1`)
    expect(comoSeCalcula(noviembre, '2026-11-05')).toBe(`${plata(100)} por semana × 4 sábados · van 0`)
    // Pasaron todos: no hace falta decirlo.
    expect(comoSeCalcula(noviembre, '2026-11-28')).toBe(`${plata(100)} por semana × 4 sábados`)
    expect(comoSeCalcula(noviembre, '2026-10-31')).toBe(`${plata(100)} por semana × 4 sábados`)
  })

  it('con un aumento a mitad de mes dice cuántos sábados a cada monto', () => {
    const conAumento = acordadoEnElMes([porSemana('2026-11-01', 100, 1), porSemana('2026-11-21', 150, 2)], '2026-11')
    expect(comoSeCalcula(conAumento, '2026-12-01')).toBe(`2 sábados a ${plata(100)} y 2 sábados a ${plata(150)}`)
  })

  it('por mes, o sin nada acordado, no hay cuenta que explicar', () => {
    expect(comoSeCalcula(acordadoEnElMes([acuerdo('2026-11', 1000)], '2026-11'), '2026-11-19')).toBeNull()
    expect(comoSeCalcula(null, '2026-11-19')).toBeNull()
  })

  it('un acuerdo en una línea, con el día de la semana para que se vea si es sábado', () => {
    expect(diaLindo('2026-11-07')).toBe('sábado 07/11/2026')
    expect(diaLindo('2026-11-04')).toBe('miércoles 04/11/2026')
    expect(diaLindo('2026-11-08')).toBe('domingo 08/11/2026')
    expect(diaLindo('cualquier cosa')).toBe('cualquier cosa')
    expect(acuerdoEnPalabras(porSemana('2026-11-07', 100))).toBe(`Desde el sábado 07/11/2026: ${plata(100)} por semana`)
    expect(acuerdoEnPalabras(acuerdo('2026-11', 1000))).toBe(`Desde noviembre 2026: ${plata(1000)} por mes`)
    expect(acuerdoEnPalabras(porSemana('2026-11-21', 0))).toBe('Desde el sábado 21/11/2026: sin sueldo')
    expect(acuerdoEnPalabras(acuerdo('2026-12', 0))).toBe('Desde diciembre 2026: sin sueldo')
  })
})

describe('el mes de quien cobra por semana', () => {
  const personas = [persona('gabi', 'Gabriela'), persona('sandra', 'Sandra')]
  const fichas = [
    ficha('gabi', 'Gabriela', porSemana('2026-10-03', 100)),
    ficha('sandra', 'Sandra', acuerdo('2026-10', 1000)),
  ]
  const sabadosDeOctubre = ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']
  const renglonDe = (id: string, pagos: ReturnType<typeof pago>[], mes: string) =>
    resumenDeSueldos(personas, fichas, pagos, mes).renglones.find((r) => r.persona.id === id)!

  it('OCTUBRE TUVO CINCO SÁBADOS: con sus cinco pagos queda al día, no «cobró de más»', () => {
    const pagos = sabadosDeOctubre.map((dia) => pago(dia, 100, { persona: 'gabi', concepto: 'SEMANA GABI' }))
    const gabi = renglonDe('gabi', pagos, '2026-10')
    expect(gabi.acordado).toBe(500)
    expect(gabi.detalle).toEqual({ monto: 500, cada: 'semana', tramos: [{ monto: 100, sabados: sabadosDeOctubre }] })
    expect(gabi.pagado).toBe(500)
    expect(estadoDelSaldo(gabi)).toEqual({ etiqueta: 'Al día', monto: 0 })
    // El total del mes suma lo de quien cobra por semana y lo de quien cobra por mes.
    expect(resumenDeSueldos(personas, fichas, pagos, '2026-10').acordado).toBe(500 + 1000)
  })

  it('a mitad de mes, lo que falta es lo de los sábados que todavía no llegaron', () => {
    const pagos = ['2026-11-07', '2026-11-14'].map((dia) => pago(dia, 100, { persona: 'gabi' }))
    const gabi = renglonDe('gabi', pagos, '2026-11')
    expect(gabi.acordado).toBe(400)
    expect(gabi.saldo).toBe(200)
    expect(estadoDelSaldo(gabi)).toEqual({ etiqueta: 'Falta pagar', monto: 200 })
    expect(comoSeCalcula(gabi.detalle, '2026-11-19')).toBe(`${plata(100)} por semana × 4 sábados · van 2`)
  })

  it('quien cobra por mes sigue igual: su renglón dice «por mes» y no lleva cuenta de sábados', () => {
    const sandra = renglonDe('sandra', [], '2026-11')
    expect(sandra.acordado).toBe(1000)
    expect(sandra.detalle).toEqual({ monto: 1000, cada: 'mes', tramos: [] })
    expect(comoSeCalcula(sandra.detalle, '2026-11-19')).toBeNull()
  })

  it('«Mi sueldo» de quien cobra por semana: lo que le corresponde en el mes, lo cobrado y lo que falta', () => {
    const pagos = ['2026-11-07', '2026-11-14'].map((dia) => pago(dia, 100, { persona: 'gabi' }))
    const mio = miSueldoDelMes(fichas[0], pagos, 'gabi', '2026-11')
    expect(mio.acordado).toBe(400)
    expect(mio.detalle?.cada).toBe('semana')
    expect(mio.pagado).toBe(200)
    expect(estadoDeMiSaldo(mio)).toEqual({ etiqueta: 'Te falta cobrar', monto: 200 })
    // Antes de su primer sábado no hay nada cargado para ella.
    const antes = miSueldoDelMes(fichas[0], pagos, 'gabi', '2026-09')
    expect(antes.acordado).toBeNull()
    expect(antes.detalle).toBeNull()
  })
})
