import { describe, expect, it } from 'vitest'

// La hora del local, pase lo que pase donde corra la prueba.
process.env.TZ = 'America/Argentina/Cordoba'

import type { Arqueo, EntradaHistorial, Jornada, Movimiento, Venta } from '../db/db'
import { totalArqueo } from './calculos'
import {
  jornadaRearmada,
  MOTIVO_REARMADO,
  textoDeConfirmacion,
  turnosParaRearmar,
  type DatosParaRearmar,
} from './rearmarTurnos'

// Montos inventados. El caso, como el real: faltan el 03/11 mañana, el
// 03/11 tarde y el 04/11 tarde; están el 02/11 tarde, el 04/11 mañana y
// el 05/11 mañana.
const arqueo = (billetes: Record<string, number>, monedas = 0): Arqueo => ({ billetes, monedas })
const CIERRA_02T = arqueo({ '10000': 3 }) // 30.000
const CIERRA_03M = arqueo({ '10000': 3, '1000': 4 }) // 34.000
const CIERRA_03T = arqueo({ '10000': 4 }, 50) // 40.050
const CIERRA_04M = arqueo({ '10000': 2, '1000': 5 }) // 25.000
const CIERRA_04T = arqueo({ '10000': 2, '2000': 1 }) // 22.000

const jornada = (id: string, fecha: string, turno: 'M' | 'T', abre: Arqueo | null, cierra: Arqueo | null): Jornada => ({
  id, fecha, turno, estado: 'cerrado', vendedor: 'Sandra', cajaInicial: totalArqueo(abre), horaApertura: '09:00',
  horaCierre: '13:00', arqueoApertura: abre, arqueoCierre: cierra, notas: null,
})
const venta = (id: string, jornadaId: string, fecha: string, total: number, medioPago: Venta['medioPago'] = 'EFECTIVO', hora = '10:00'): Venta => ({
  id, jornadaId, fecha, hora, codigo: 'TM015', descripcion: 'MATE', cantidad: 1, precioUnitario: total,
  costoUnitario: null, medioPago, total, vendedor: 'Gabriela',
})
const egreso = (id: string, jornadaId: string, monto: number): Movimiento => ({
  id, fecha: '2026-11-03', tipo: 'EGRESO_CAJA', concepto: 'Bolsas', monto, categoria: 'OTROS', jornadaId, esVariable: true,
})
/** Un momento de ese día, en la hora del local. */
const a = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00`).getTime()
let n = 0
const renglon = (clave: string, accion: EntradaHistorial['accion'], cuando: number, extra: Partial<EntradaHistorial> = {}): EntradaHistorial => ({
  id: `h${n++}`, tabla: 'jornadas', clave, accion, queEs: '', campo: null, valorAnterior: null, valorNuevo: null,
  quien: 'gabi@prueba.test', quienNombre: 'Gabriela', quienRol: 'empleado', cuando, motivo: null, ...extra,
})
/** Lo que el historial guarda de un turno que se abrió y se cerró con conteo. */
const historialDe = (clave: string, fecha: string, turno: 'mañana' | 'tarde', abre: string, cierra: string, conteo: Arqueo) => [
  renglon(clave, 'creo', a(fecha, abre), { queEs: `Turno del ${fecha} a la ${turno}` }),
  renglon(clave, 'edito', a(fecha, cierra), { campo: 'arqueoCierre', valorNuevo: conteo }),
  renglon(clave, 'edito', a(fecha, cierra) + 1000, { campo: 'estado', valorAnterior: 'abierto', valorNuevo: 'cerrado' }),
]

function elCaso(): DatosParaRearmar {
  return {
    jornadas: [
      jornada('02T', '2026-11-02', 'T', arqueo({ '10000': 2 }), CIERRA_02T),
      jornada('04M', '2026-11-04', 'M', CIERRA_03T, CIERRA_04M),
      jornada('05M', '2026-11-05', 'M', CIERRA_04T, null),
    ],
    ventas: [
      venta('v1', 'id-03m', '2026-11-03', 5000),
      venta('v2', 'id-03m', '2026-11-03', 2000, 'TRANSFERENCIA'),
      venta('v3', 'id-03t', '2026-11-03', 6000, 'EFECTIVO', '17:00'),
      venta('v4', 'id-04t', '2026-11-04', 3000, 'EFECTIVO', '18:00'),
      venta('v5', '04M', '2026-11-04', 9000), // de un turno que está: no cuenta
    ],
    movimientos: [egreso('e1', 'id-03m', 1000), egreso('e2', '04M', 500)],
    historial: [
      ...historialDe('id-03m', '2026-11-03', 'mañana', '09:02', '13:05', CIERRA_03M),
      ...historialDe('id-03t', '2026-11-03', 'tarde', '16:01', '20:10', CIERRA_03T),
      ...historialDe('id-04t', '2026-11-04', 'tarde', '16:03', '20:15', CIERRA_04T),
      renglon('id-03t', 'edito', a('2026-11-03', '20:09'), { campo: 'notaCierre', valorNuevo: 'Sobraron monedas' }),
      renglon('04M', 'creo', a('2026-11-04', '09:00'), { queEs: 'Turno del 2026-11-04 a la mañana' }),
    ],
  }
}

describe('rearmar los turnos que no llegaron al servidor (20/11)', () => {
  it('encuentra los tres, en el orden en que pasaron, con la fecha, el horario y las horas del historial', () => {
    const turnos = turnosParaRearmar(elCaso())
    expect(turnos.map((t) => `${t.id} ${t.fecha} ${t.turno} ${t.horaApertura}-${t.horaCierre}`)).toEqual([
      'id-03m 2026-11-03 M 09:02-13:05',
      'id-03t 2026-11-03 T 16:01-20:10',
      'id-04t 2026-11-04 T 16:03-20:15',
    ])
    expect(turnos.every((t) => t.problema === null && !t.turnoPorLaHora)).toBe(true)
    expect(turnos[1].notaCierre).toBe('Sobraron monedas')
    expect(turnos[0].vendedor).toBe('Gabriela')
  })

  it('abre con lo que contó el anterior al cerrar, aunque el anterior también se rearme', () => {
    const [m03, t03, t04] = turnosParaRearmar(elCaso())
    expect([m03.cajaInicial, t03.cajaInicial, t04.cajaInicial]).toEqual([30000, 34000, 25000])
    expect(m03.arqueoApertura).toEqual(CIERRA_02T)
    expect(m03.deDondeAbre).toMatch(/cerrar el turno anterior \(02\/11 tarde\)$/)
    expect(t03.deDondeAbre).toMatch(/\(03\/11 mañana, que también se rearma\)$/)
    expect(t04.deDondeAbre).toMatch(/\(04\/11 mañana\)$/)
    // Y cierra con el conteo del historial, billete por billete.
    expect(t03.arqueoCierre).toEqual(CIERRA_03T)
    expect(t03.deDondeCierra).toMatch(/^el conteo del cierre, del historial \(Gabriela, 03\/11 a las 20:10\)$/)
  })

  it('la caja esperada y la diferencia salen de las ventas en efectivo y los egresos del turno', () => {
    const [m03, t03] = turnosParaRearmar(elCaso())
    expect([m03.ventas, m03.totalVendido, m03.efectivo, m03.egresos]).toEqual([2, 7000, 5000, 1000])
    expect(m03.esperado).toBe(34000) // 30.000 + 5.000 - 1.000
    expect(m03.diferencia).toBe(0)
    expect(t03.esperado).toBe(40000) // 34.000 + 6.000
    expect(t03.diferencia).toBe(50)
  })

  it('dice si el turno que sigue, que sí está, abrió con lo que este contó al cerrar', () => {
    const [m03, t03, t04] = turnosParaRearmar(elCaso())
    expect(m03.engancha).toBeNull() // el que sigue también se rearma
    expect(t03.engancha).toEqual({ con: '04/11 mañana', abrio: 40050, cerro: 40050, igual: true })
    expect(t04.engancha).toEqual({ con: '05/11 mañana', abrio: 22000, cerro: 22000, igual: true })
    const caso = elCaso()
    caso.jornadas[2] = { ...caso.jornadas[2], cajaInicial: 21000 }
    expect(turnosParaRearmar(caso)[2].engancha?.igual).toBe(false)
  })

  it('la fecha es la del historial aunque las ventas se hayan pasado otro día, y la hora de cierre es la del último cierre', () => {
    const caso = elCaso()
    caso.ventas = caso.ventas.map((v) => (v.jornadaId === 'id-03m' ? { ...v, fecha: '2026-11-04' } : v))
    // Se reabrió y se volvió a cerrar más tarde.
    caso.historial.push(
      renglon('id-03m', 'edito', a('2026-11-03', '13:20'), { campo: 'estado', valorAnterior: 'cerrado', valorNuevo: 'abierto' }),
      renglon('id-03m', 'edito', a('2026-11-03', '13:40'), { campo: 'estado', valorAnterior: 'abierto', valorNuevo: 'cerrado' }),
    )
    const m03 = turnosParaRearmar(caso).find((t) => t.id === 'id-03m')!
    expect(m03.fecha).toBe('2026-11-03')
    expect(m03.horaCierre).toBe('13:40')
  })

  it('un conteo del historial que no tiene billetes no se toma como conteo', () => {
    const caso = elCaso()
    caso.historial = caso.historial.map((h) =>
      h.clave === 'id-04t' && h.campo === 'arqueoCierre' ? { ...h, valorNuevo: { total: 22000 } } : h,
    )
    const t04 = turnosParaRearmar(caso).find((t) => t.id === 'id-04t')!
    expect(t04.deDondeCierra).toMatch(/^lo que se contó al abrir el turno siguiente/)
  })

  it('si el horario se corrigió, vale el corregido', () => {
    const caso = elCaso()
    caso.historial.push(renglon('id-04t', 'edito', a('2026-11-04', '16:30'), { campo: 'turno', valorAnterior: 'T', valorNuevo: 'M' }))
    caso.jornadas = caso.jornadas.filter((j) => j.id !== '04M')
    const t04 = turnosParaRearmar(caso).find((t) => t.id === 'id-04t')!
    expect(t04.turno).toBe('M')
  })

  it('sin historial: el horario por la hora de las ventas y el cierre por la apertura del turno siguiente', () => {
    const caso = elCaso()
    caso.historial = caso.historial.filter((h) => h.clave !== 'id-04t')
    const t04 = turnosParaRearmar(caso).find((t) => t.id === 'id-04t')!
    expect(t04.turno).toBe('T') // la venta es de las 18
    expect(t04.turnoPorLaHora).toBe(true)
    expect(t04.horaApertura).toBeNull()
    expect(t04.arqueoCierre).toEqual(CIERRA_04T)
    expect(t04.deDondeCierra).toMatch(/^lo que se contó al abrir el turno siguiente \(05\/11 mañana\)/)
    expect(t04.problema).toBeNull()
    // A la mañana, mañana.
    caso.ventas = caso.ventas.map((v) => (v.id === 'v4' ? { ...v, hora: '9:40' } : v))
    caso.jornadas = caso.jornadas.filter((j) => j.id !== '04M')
    expect(turnosParaRearmar(caso).find((t) => t.id === 'id-04t')!.turno).toBe('M')
  })

  it('lo que no se sabe no se inventa: sin anterior o sin conteo, no se rearma y dice por qué', () => {
    const sinAnterior = elCaso()
    sinAnterior.jornadas = sinAnterior.jornadas.filter((j) => j.id !== '02T')
    const [m03, t03] = turnosParaRearmar(sinAnterior)
    expect(m03.problema).toBe('No se sabe con cuánto abrió: el turno anterior no tiene el conteo del cierre.')
    expect(t03.problema).toBeNull() // el de la tarde abre con lo que contó la mañana

    const sinConteo = elCaso()
    sinConteo.historial = sinConteo.historial.filter((h) => !(h.clave === 'id-04t' && h.campo === 'arqueoCierre'))
    sinConteo.jornadas = sinConteo.jornadas.filter((j) => j.id !== '05M')
    expect(turnosParaRearmar(sinConteo)[2].problema).toMatch(/^No se sabe cuánto se contó al cerrar/)
  })

  it('si ya hay otro turno con esa fecha y ese horario, no arma otro', () => {
    const caso = elCaso()
    caso.jornadas.push(jornada('otro', '2026-11-04', 'T', CIERRA_04M, CIERRA_04T))
    const t04 = turnosParaRearmar(caso).find((t) => t.id === 'id-04t')!
    expect(t04.problema).toMatch(/^Ya hay un turno del 04\/11 tarde en el servidor/)
  })

  it('si no falta ninguno, no hay nada que rearmar', () => {
    const caso = elCaso()
    caso.ventas = caso.ventas.filter((v) => v.jornadaId === '04M')
    expect(turnosParaRearmar(caso)).toEqual([])
  })

  it('el turno se guarda con su mismo id, cerrado, sin visto bueno y con una nota que dice de dónde salió', () => {
    const [m03] = turnosParaRearmar(elCaso())
    const j = jornadaRearmada(m03, '2026-11-20')
    expect(j).toMatchObject({
      id: 'id-03m', fecha: '2026-11-03', turno: 'M', estado: 'cerrado', vendedor: 'Gabriela',
      cajaInicial: 30000, arqueoApertura: CIERRA_02T, arqueoCierre: CIERRA_03M, horaApertura: '09:02', horaCierre: '13:05',
      cierreAutorizado: null, solicitudCierre: null, motivoDiferencia: null, primerConteo: null,
      creadoEn: a('2026-11-03', '09:02'),
    })
    expect(j.notas).toMatch(/^Rearmado el 20\/11\/2026: no había llegado al servidor\. Con cuánto abrió sale de lo que se contó al cerrar el turno anterior/)
    const sinAnterior = elCaso()
    sinAnterior.jornadas = sinAnterior.jornadas.filter((x) => x.id !== '02T')
    expect(() => jornadaRearmada(turnosParaRearmar(sinAnterior)[0], '2026-11-20')).toThrow(/con cuánto abrió/)
  })

  it('la pregunta dice cuántos, cuáles y con qué motivo queda en el historial', () => {
    const texto = textoDeConfirmacion(turnosParaRearmar(elCaso()))
    expect(texto).toMatch(/^Se van a crear 3 turnos en el servidor/)
    expect(texto).toContain('• 03/11 mañana (Gabriela)\n• 03/11 tarde (Gabriela)\n• 04/11 tarde (Gabriela)')
    expect(texto).toContain(`«${MOTIVO_REARMADO}»`)
    const sinAnterior = elCaso()
    sinAnterior.jornadas = sinAnterior.jornadas.filter((x) => x.id !== '02T')
    expect(textoDeConfirmacion(turnosParaRearmar(sinAnterior))).toMatch(/^Se van a crear 2 turnos/)
  })
})
