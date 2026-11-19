import { describe, expect, it } from 'vitest'
import {
  conAcuerdo,
  esPagoDeSueldo,
  estadoDelSaldo,
  fichaDesdeDatos,
  mesDelPago,
  parecenSueldo,
  personasParaSueldo,
  problemaDelAcuerdo,
  resumenDeSueldos,
  sueldoDelMes,
  textoDeConfirmacionSueldo,
  type AcuerdoSueldo,
  type FichaSueldo,
  type PersonaConSueldo,
} from './sueldos'
import { plata } from './formato'

const acuerdo = (desde: string, monto: number, anotadoEl = 1): AcuerdoSueldo => ({
  desde,
  monto,
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
    expect(problemaDelAcuerdo(null, '2026-11')).toMatch(/monto/)
    expect(problemaDelAcuerdo(Number.NaN, '2026-11')).toMatch(/monto/)
    expect(problemaDelAcuerdo(-1, '2026-11')).toMatch(/negativo/)
    expect(problemaDelAcuerdo(900_000, '')).toMatch(/mes/)
    expect(problemaDelAcuerdo(900_000, '2026-13')).toMatch(/mes/)
    expect(problemaDelAcuerdo(900_000, '2026-11')).toBeNull()
    expect(problemaDelAcuerdo(0, '2026-11')).toBeNull()
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
    const nuevo = textoDeConfirmacionSueldo('Ana', 900_000, '2026-11', null)
    expect(nuevo).toContain(`¿Dejar el sueldo de Ana en ${plata(900_000)} por mes desde noviembre 2026?`)
    expect(nuevo).toContain('no tenía un sueldo definido')
    const cambio = textoDeConfirmacionSueldo('Ana', 1_000_000, '2027-02', 900_000)
    expect(cambio).toContain(`Para ese mes tenía ${plata(900_000)}.`)
    expect(textoDeConfirmacionSueldo('Ana', 0, '2027-03', 900_000)).toContain('¿Dejar a Ana sin sueldo desde marzo 2027?')
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
      acuerdos: [{ desde: '2026-12', monto: 800_000, anotadoEl: 0, por: null }],
      actualizadoEn: 0,
    })
    expect(fichaDesdeDatos('x', null).acuerdos).toEqual([])
    expect(fichaDesdeDatos('x', { acuerdos: 'nada' }).acuerdos).toEqual([])
  })
})
