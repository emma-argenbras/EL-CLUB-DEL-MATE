import { describe, expect, it } from 'vitest'
import type { Movimiento, Vencimiento } from '../db/db'
import {
  agenda,
  CATEGORIAS_FIJAS,
  cuandoVence,
  cuotaDelPeriodo,
  diasEntre,
  estadoDeLaDeuda,
  fechaDeVencimiento,
  gastosParaEnganchar,
  mesesEntre,
  nombreDelMes,
  periodoAnterior,
  periodoSiguiente,
  situacionDe,
  sumarMeses,
  tocaEn,
} from './vencimientos'
import { esVariablePorDefecto, FIJOS_POR_DEFECTO } from './borrarGasto'

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

describe('EQUIPAMIENTO (20/11)', () => {
  it('es una categoría fija, la misma lista en toda la app', () => {
    expect(esVariablePorDefecto('EQUIPAMIENTO')).toBe(false)
    expect(CATEGORIAS_FIJAS).toBe(FIJOS_POR_DEFECTO)
    expect(CATEGORIAS_FIJAS).toContain('EQUIPAMIENTO')
  })
})

describe('UNA DEUDA EN CUOTAS (20/11): el local le devuelve a un dueño de la cuota 2 a la 6', () => {
  // La 2 vence el 10 de noviembre; la 6, el 10 de marzo.
  const deuda = venc({
    id: 'compu', concepto: 'Compu del local', categoria: 'EQUIPAMIENTO', dia: 10, montoAproximado: 100,
    desde: '2026-11-10', cuotas: { total: 6, primera: 2, periodo: '2026-11' }, aQuien: 'sin-cuenta-1',
  })
  const cuota = (periodo: string, fecha = `${periodo}-10`) =>
    pago('compu', periodo, fecha, { id: `c-${periodo}`, categoria: 'EQUIPAMIENTO', monto: 100 })
  const pagadas = (...periodos: string[]) => periodos.map((p) => cuota(p))

  it('los meses, cruzando el año', () => {
    expect(mesesEntre('2026-11', '2027-03')).toBe(4)
    expect(mesesEntre('2027-03', '2026-11')).toBe(-4)
    expect(sumarMeses('2026-11', 4)).toBe('2027-03')
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
    expect(sumarMeses('2026-12', 1)).toBe('2027-01')
  })

  it('cada mes tiene su cuota; antes de la primera y después de la última no toca pagar', () => {
    expect(cuotaDelPeriodo(deuda, '2026-11')).toBe(2)
    expect(cuotaDelPeriodo(deuda, '2027-01')).toBe(4)
    expect(cuotaDelPeriodo(deuda, '2027-03')).toBe(6)
    expect(tocaEn(deuda, '2026-10')).toBe(false)
    expect(tocaEn(deuda, '2026-11')).toBe(true)
    expect(tocaEn(deuda, '2027-03')).toBe(true)
    expect(tocaEn(deuda, '2027-04')).toBe(false)
    // Un vencimiento de siempre toca todos los meses.
    expect(cuotaDelPeriodo(venc(), '2026-11')).toBeNull()
    expect(tocaEn(venc(), '2030-01')).toBe(true)
  })

  it('cargada antes de la primera cuota: muestra la primera, sin reclamar nada', () => {
    const s = situacionDe(deuda, '2026-10-20', [])
    expect([s.periodo, s.estado]).toEqual(['2026-11', 'pendiente'])
    // Aunque la agenda la conozca desde antes: octubre sería la cuota 1, que el local no paga.
    const antes = situacionDe({ ...deuda, desde: '2026-09-01' }, '2026-10-05', [])
    expect([antes.periodo, antes.fecha]).toEqual(['2026-11', '2026-11-10'])
  })

  it('pagada la última, no hay próximo; y el mes siguiente queda terminada', () => {
    const hastaFebrero = pagadas('2026-11', '2026-12', '2027-01', '2027-02')
    const marzo = situacionDe(deuda, '2027-03-05', hastaFebrero)
    expect([marzo.periodo, marzo.estado]).toEqual(['2027-03', 'pendiente'])
    const pagaMarzo = situacionDe(deuda, '2027-03-12', [...hastaFebrero, cuota('2027-03')])
    expect([pagaMarzo.estado, pagaMarzo.proximo]).toEqual(['pagado', null])
    const abril = situacionDe(deuda, '2027-04-20', [...hastaFebrero, cuota('2027-03')])
    expect(abril.estado).toBe('terminado')
    expect(cuandoVence(abril)).toBe('Terminada')
    // Si la última quedó sin pagar, en abril se reclama marzo.
    const debeMarzo = situacionDe(deuda, '2027-04-20', hastaFebrero)
    expect([debeMarzo.periodo, debeMarzo.estado]).toEqual(['2027-03', 'vencido'])
    // Y una cuota del medio pagada: el próximo es el mes siguiente.
    expect(situacionDe(deuda, '2026-12-12', pagadas('2026-11', '2026-12')).proximo).toBe('2027-01-10')
  })

  it('el mes de antes de la primera cuota no se reclama aunque esté sin pagar', () => {
    const s = situacionDe({ ...deuda, desde: '2026-09-01' }, '2026-11-05', [])
    expect([s.periodo, s.estado]).toEqual(['2026-11', 'pendiente'])
  })

  it('en la agenda lo terminado va al final', () => {
    const otro = venc({ id: 'luz', concepto: 'Luz', dia: 15, desde: '2026-09-01' })
    const lista = agenda([deuda, otro], '2027-04-20', pagadas('2026-11', '2026-12', '2027-01', '2027-02', '2027-03'))
    expect(lista.map((s) => s.vencimiento.id)).toEqual(['luz', 'compu'])
  })

  it('cuánto va pagado y cuánto queda', () => {
    expect(estadoDeLaDeuda(deuda, pagadas('2026-11'))).toEqual({
      aPagar: 5, pagadas: 1, quedan: 4, montoQueda: 400, siguiente: 3, ultimoPeriodo: '2027-03',
    })
    // Una cuota salteada: la siguiente es la que falta, no la del mes.
    expect(estadoDeLaDeuda(deuda, pagadas('2026-12'))?.siguiente).toBe(2)
    // Un pago enganchado a un mes fuera de las cuotas no cuenta.
    expect(estadoDeLaDeuda(deuda, pagadas('2026-10', '2026-11'))?.pagadas).toBe(1)
    const todas = estadoDeLaDeuda(deuda, pagadas('2026-11', '2026-12', '2027-01', '2027-02', '2027-03'))
    expect([todas?.quedan, todas?.siguiente, todas?.montoQueda]).toEqual([0, null, 0])
    expect(estadoDeLaDeuda({ ...deuda, montoAproximado: null }, [])?.montoQueda).toBeNull()
    expect(estadoDeLaDeuda(venc(), [])).toBeNull()
  })

  it('para enganchar, en una deuda en cuotas también ofrece lo cargado como OTROS', () => {
    const otros = { ...cuota('2026-11'), id: 'o1', categoria: 'OTROS' as const, vencimiento: null }
    const alquiler = { ...cuota('2026-11'), id: 'a1', categoria: 'ALQUILER' as const, vencimiento: null }
    expect(gastosParaEnganchar(deuda, ['2026-11'], [otros, alquiler]).map((m) => m.id)).toEqual(['o1'])
    // Un vencimiento de siempre, no: solo su categoría.
    expect(gastosParaEnganchar(venc(), ['2026-11'], [otros, alquiler]).map((m) => m.id)).toEqual(['a1'])
  })

  it('para enganchar, primero lo de monto más parecido; a igual monto, lo más nuevo', () => {
    const otro = (id: string, fecha: string, monto: number) =>
      ({ ...cuota('2026-11'), id, fecha, monto, categoria: 'OTROS' as const, vencimiento: null })
    const gastos = [otro('lejos-nuevo', '2026-11-15', 300), otro('cerca-viejo', '2026-11-02', 101), otro('justo', '2026-11-05', 100), otro('justo-nuevo', '2026-11-07', 100)]
    expect(gastosParaEnganchar(deuda, ['2026-11'], gastos).map((m) => m.id)).toEqual(['justo-nuevo', 'justo', 'cerca-viejo', 'lejos-nuevo'])
    // Sin monto en la agenda, por fecha.
    expect(gastosParaEnganchar({ ...deuda, montoAproximado: null }, ['2026-11'], gastos).map((m) => m.id)).toEqual(['lejos-nuevo', 'justo-nuevo', 'justo', 'cerca-viejo'])
  })
})
