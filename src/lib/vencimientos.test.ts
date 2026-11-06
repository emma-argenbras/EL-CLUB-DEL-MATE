import { describe, expect, it } from 'vitest'
import type { Movimiento, Vencimiento } from '../db/db'
import {
  agenda,
  cuandoVence,
  diasEntre,
  fechaDeVencimiento,
  gastosParaEnganchar,
  nombreDelMes,
  periodoAnterior,
  periodoSiguiente,
  situacionDe,
} from './vencimientos'

const venc = (extra: Partial<Vencimiento> = {}): Vencimiento => ({
  id: 'alq', concepto: 'Alquiler', dia: 10, montoAproximado: 350000, categoria: 'ALQUILER', cuenta: 'cajaGrande',
  esVariable: false, avisarDiasAntes: 3, desde: '2026-09-01', activo: true, notas: null, ...extra,
})
const pago = (vencimientoId: string, periodo: string, fecha: string, extra: Partial<Movimiento> = {}): Movimiento => ({
  id: `p-${periodo}`, fecha, tipo: 'GASTO_CAJA_GRANDE', concepto: 'x', monto: 350000, categoria: 'ALQUILER',
  jornadaId: null, esVariable: false, vencimiento: { id: vencimientoId, periodo }, ...extra,
})

describe('las fechas', () => {
  it('el 31 en un mes de 30 vence el 30, y en febrero el último día', () => {
    expect(fechaDeVencimiento(31, '2026-11')).toBe('2026-11-30')
    expect(fechaDeVencimiento(31, '2026-02')).toBe('2026-02-28')
    expect(fechaDeVencimiento(29, '2028-02')).toBe('2028-02-29')
    expect(fechaDeVencimiento(5, '2026-12')).toBe('2026-12-05')
  })

  it('los meses de al lado, cruzando el año', () => {
    expect(periodoAnterior('2026-01')).toBe('2025-12')
    expect(periodoSiguiente('2026-12')).toBe('2027-01')
    expect(diasEntre('2026-11-06', '2026-11-10')).toBe(4)
    expect(diasEntre('2026-11-06', '2026-10-31')).toBe(-6)
    expect(nombreDelMes('2026-11', '2026-11-06')).toBe('noviembre')
    expect(nombreDelMes('2025-12', '2026-01-03')).toBe('diciembre de 2025')
  })
})

describe('cómo está cada vencimiento', () => {
  it('pagado el mes pasado y este mes faltan 4 días: pendiente (avisa 3 días antes)', () => {
    const s = situacionDe(venc(), '2026-11-06', [pago('alq', '2026-10', '2026-10-09')])
    expect([s.estado, s.periodo, s.fecha, s.dias]).toEqual(['pendiente', '2026-11', '2026-11-10', 4])
  })

  it('faltan 3 días o menos: por vencer', () => {
    const s = situacionDe(venc(), '2026-11-07', [pago('alq', '2026-10', '2026-10-09')])
    expect([s.estado, s.dias]).toEqual(['por-vencer', 3])
    expect(cuandoVence(s)).toBe('Vence en 3 días')
  })

  it('ya pasó el día y no se pagó: vencido', () => {
    const s = situacionDe(venc(), '2026-11-12', [pago('alq', '2026-10', '2026-10-09')])
    expect([s.estado, s.dias]).toEqual(['vencido', -2])
    expect(cuandoVence(s)).toBe('Venció hace 2 días')
  })

  it('el mes pasado quedó sin pagar: eso va primero, aunque este mes falte', () => {
    const s = situacionDe(venc(), '2026-11-06', [])
    expect([s.estado, s.periodo, s.fecha]).toEqual(['vencido', '2026-10', '2026-10-10'])
  })

  it('pagado este mes: dice cuándo vence el que viene', () => {
    const s = situacionDe(venc(), '2026-11-06', [pago('alq', '2026-10', '2026-10-09'), pago('alq', '2026-11', '2026-11-05')])
    expect([s.estado, s.proximo, s.pago?.fecha]).toEqual(['pagado', '2026-12-10', '2026-11-05'])
  })

  it('el pago de octubre hecho en noviembre cuenta para octubre, no para noviembre', () => {
    const s = situacionDe(venc(), '2026-11-06', [pago('alq', '2026-10', '2026-11-02')])
    expect([s.estado, s.periodo]).toEqual(['pendiente', '2026-11'])
  })

  it('cargado hoy: no reclama el mes pasado, y si este mes ya venció, arranca el que viene', () => {
    const s = situacionDe(venc({ desde: '2026-11-12', dia: 10 }), '2026-11-12', [])
    expect([s.estado, s.periodo, s.fecha]).toEqual(['pendiente', '2026-12', '2026-12-10'])
    const t = situacionDe(venc({ desde: '2026-11-06', dia: 20 }), '2026-11-06', [])
    expect([t.estado, t.periodo]).toEqual(['pendiente', '2026-11'])
  })

  it('el pago de otro vencimiento no cuenta', () => {
    const s = situacionDe(venc(), '2026-11-06', [pago('luz', '2026-10', '2026-10-09')])
    expect(s.estado).toBe('vencido')
  })
})

describe('la agenda', () => {
  it('primero lo vencido, después lo que vence antes; los archivados no están', () => {
    const lista = agenda(
      [
        venc({ id: 'alq', concepto: 'Alquiler', dia: 10 }),
        venc({ id: 'luz', concepto: 'Luz', dia: 8 }),
        venc({ id: 'cont', concepto: 'Contador', dia: 2 }),
        venc({ id: 'viejo', concepto: 'Viejo', activo: false }),
      ],
      '2026-11-06',
      [pago('alq', '2026-10', '2026-10-09'), pago('luz', '2026-10', '2026-10-08'), pago('cont', '2026-10', '2026-10-02')],
    )
    expect(lista.map((s) => `${s.vencimiento.id}:${s.estado}`)).toEqual(['cont:vencido', 'luz:por-vencer', 'alq:pendiente'])
  })
})

describe('no cargar dos veces lo que ya está en Gastos', () => {
  it('ofrece los gastos de esa categoría, del mes, sin vencimiento', () => {
    const gastos: Movimiento[] = [
      pago('alq', '2026-10', '2026-10-09'),
      // Del mismo mes y categoría, pero ya es el pago de otro vencimiento.
      { ...pago('otro', '2026-11', '2026-11-02'), id: 'ya-enganchado' },
      { ...pago('x', '2026-11', '2026-11-03'), id: 'a-mano', vencimiento: null },
      { ...pago('x', '2026-11', '2026-11-03'), id: 'otra-cat', vencimiento: null, categoria: 'SERVICIOS' },
      { ...pago('x', '2026-09', '2026-09-03'), id: 'otro-mes', vencimiento: null },
      { ...pago('x', '2026-11', '2026-11-03'), id: 'pase', vencimiento: null, tipo: 'A_CAJA_GRANDE' },
    ]
    expect(gastosParaEnganchar(venc(), ['2026-11'], gastos).map((m) => m.id)).toEqual(['a-mano'])
  })
})
