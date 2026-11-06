import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia } from './db'
import { engancharGasto, guardarVencimiento, marcarPagado, problemaDelVencimiento, type DatosVencimiento } from './vencimientos'
import { situacionDe } from '../lib/vencimientos'

const datos = (extra: Partial<DatosVencimiento> = {}): DatosVencimiento => ({
  concepto: ' Alquiler ', dia: 10, montoAproximado: 350000, categoria: 'ALQUILER', cuenta: 'cajaGrande',
  esVariable: false, avisarDiasAntes: 3, notas: '', ...extra,
})

beforeEach(async () => {
  await Promise.all([db.vencimientos.clear(), db.movimientos.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'emmanuelclubdelmate@gmail.com', nombre: 'Emmanuel', rol: 'owner' }))
})

describe('cargar un vencimiento', () => {
  it('sin concepto, con un día fuera del mes o un monto negativo, no se carga', () => {
    expect(problemaDelVencimiento(datos({ concepto: '  ' }))).toMatch(/qué se paga/)
    expect(problemaDelVencimiento(datos({ dia: 0 }))).toMatch(/1 al 31/)
    expect(problemaDelVencimiento(datos({ dia: 32 }))).toMatch(/1 al 31/)
    expect(problemaDelVencimiento(datos({ montoAproximado: -1 }))).toMatch(/negativo/)
    expect(problemaDelVencimiento(datos({ montoAproximado: null }))).toBeNull()
  })

  it('queda activo y se controla desde hoy', async () => {
    const id = await guardarVencimiento(datos(), '2026-11-06')
    const v = (await db.vencimientos.get(id))!
    expect([v.concepto, v.desde, v.activo, v.notas]).toEqual(['Alquiler', '2026-11-06', true, null])
  })
})

describe('marcar pagado', () => {
  it('carga el gasto con su categoría y su cuenta, enganchado al mes, y el vencimiento queda pagado', async () => {
    const id = await guardarVencimiento(datos(), '2026-10-01')
    const v = (await db.vencimientos.get(id))!
    const mid = await marcarPagado(v, '2026-11', { fecha: '2026-11-06', monto: 352000, cuenta: 'banco', jornadaId: 'j1', hoy: '2026-11-06' })
    const m = (await db.movimientos.get(mid))!
    expect([m.tipo, m.cuenta, m.categoria, m.monto, m.jornadaId, m.esVariable, m.concepto]).toEqual([
      'GASTO_CAJA_GRANDE', 'banco', 'ALQUILER', 352000, null, false, 'Alquiler (noviembre)',
    ])
    expect(m.vencimiento).toEqual({ id, periodo: '2026-11' })
    expect(situacionDe({ ...v, desde: '2026-10-11' }, '2026-11-06', await db.movimientos.toArray()).estado).toBe('pagado')
    await historialAlDia()
    expect((await db.historial.toArray()).find((h) => h.tabla === 'movimientos')?.motivo).toBe(
      'Pago de Alquiler (noviembre), desde Vencimientos',
    )
  })

  it('desde el cajón va contra el turno abierto; sin turno no se puede', async () => {
    const id = await guardarVencimiento(datos({ cuenta: 'cajon' }), '2026-11-01')
    const v = (await db.vencimientos.get(id))!
    await expect(marcarPagado(v, '2026-11', { fecha: '2026-11-06', monto: 1000, cuenta: 'cajon', jornadaId: null, hoy: '2026-11-06' })).rejects.toThrow(/turno abierto/)
    const mid = await marcarPagado(v, '2026-11', { fecha: '2026-11-06', monto: 1000, cuenta: 'cajon', jornadaId: 'j1', hoy: '2026-11-06' })
    const m = (await db.movimientos.get(mid))!
    expect([m.tipo, m.jornadaId]).toEqual(['EGRESO_CAJA', 'j1'])
  })

  it('sin monto no se marca', async () => {
    const id = await guardarVencimiento(datos(), '2026-11-01')
    const v = (await db.vencimientos.get(id))!
    await expect(marcarPagado(v, '2026-11', { fecha: '2026-11-06', monto: 0, cuenta: 'banco', jornadaId: null, hoy: '2026-11-06' })).rejects.toThrow(/cuánto/)
    expect(await db.movimientos.count()).toBe(0)
  })
})

describe('enganchar lo que ya estaba en Gastos', () => {
  it('el gasto cargado a mano pasa a ser el pago, sin cargar otro; uno ya enganchado no', async () => {
    const id = await guardarVencimiento(datos(), '2026-11-01')
    const v = (await db.vencimientos.get(id))!
    await db.movimientos.add({ id: 'a-mano', fecha: '2026-11-04', tipo: 'GASTO_CAJA_GRANDE', concepto: 'alquiler nov', monto: 350000, categoria: 'ALQUILER', jornadaId: null, esVariable: false })
    await engancharGasto('a-mano', v, '2026-11', '2026-11-06')
    expect((await db.movimientos.get('a-mano'))?.vencimiento).toEqual({ id, periodo: '2026-11' })
    expect(await db.movimientos.count()).toBe(1)
    await expect(engancharGasto('a-mano', v, '2026-12', '2026-11-06')).rejects.toThrow(/otro vencimiento/)
  })
})
