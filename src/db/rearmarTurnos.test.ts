import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Arqueo, type EntradaHistorial, type Jornada, type Venta } from './db'
import { leerTurnosParaRearmar, rearmarTurnos } from './rearmarTurnos'
import { MOTIVO_REARMADO } from '../lib/rearmarTurnos'

// Montos inventados. Falta el turno de la mañana del 03/11; está el de
// la tarde del 02/11, que cerró con 30.000.
const arqueo = (billetes: Record<string, number>): Arqueo => ({ billetes, monedas: 0 })
const jornada = (id: string, fecha: string, turno: 'M' | 'T', cierra: Arqueo | null): Jornada => ({
  id, fecha, turno, estado: 'cerrado', vendedor: 'Sandra', cajaInicial: 0, horaApertura: '16:00', horaCierre: '20:00',
  arqueoApertura: null, arqueoCierre: cierra, notas: null,
})
const venta = (id: string, jornadaId: string, fecha: string): Venta => ({
  id, jornadaId, fecha, hora: '10:00', codigo: 'TM015', descripcion: 'MATE', cantidad: 1, precioUnitario: 5000,
  costoUnitario: null, medioPago: 'EFECTIVO', total: 5000, vendedor: 'Gabriela',
})
const lineaDelHistorial = (clave: string, extra: Pick<EntradaHistorial, 'accion' | 'cuando'> & Partial<EntradaHistorial>): EntradaHistorial => ({
  id: `h-${clave}-${Math.random()}`, tabla: 'jornadas' as const, clave, queEs: '', campo: null, valorAnterior: null,
  valorNuevo: null, quien: 'gabi@prueba.test', quienNombre: 'Gabriela', quienRol: 'empleado' as const, motivo: null, ...extra,
})

beforeEach(async () => {
  await Promise.all([db.jornadas.clear(), db.ventas.clear(), db.movimientos.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'dueno@prueba.test', nombre: 'Emmanuel', rol: 'owner' }))
  await db.jornadas.add(jornada('02T', '2026-11-02', 'T', arqueo({ '10000': 3 })))
  await db.ventas.bulkAdd([venta('v1', 'falta', '2026-11-03'), venta('v2', 'falta', '2026-11-03')])
  await db.historial.bulkAdd([
    lineaDelHistorial('falta', { accion: 'creo', queEs: 'Turno del 2026-11-03 a la mañana', cuando: new Date('2026-11-03T09:02:00').getTime() }),
    lineaDelHistorial('falta', { accion: 'edito', campo: 'arqueoCierre', valorNuevo: arqueo({ '10000': 4 }), cuando: new Date('2026-11-03T13:05:00').getTime() }),
  ])
  await historialAlDia()
})

describe('rearmar los turnos que no llegaron (20/11)', () => {
  it('crea el turno con su mismo id, deja el motivo en el historial y no toca las ventas', async () => {
    const turnos = await leerTurnosParaRearmar()
    expect(turnos.map((t) => [t.id, t.cajaInicial, t.problema])).toEqual([['falta', 30000, null]])

    expect(await rearmarTurnos(turnos, '2026-11-20')).toEqual({ creados: ['falta'], yaEstaban: [] })
    const j = await db.jornadas.get('falta')
    expect(j).toMatchObject({ fecha: '2026-11-03', turno: 'M', estado: 'cerrado', cajaInicial: 30000, vendedor: 'Gabriela' })
    expect((await db.ventas.where('jornadaId').equals('falta').toArray()).map((v) => v.id).sort()).toEqual(['v1', 'v2'])

    await historialAlDia()
    const alta = (await db.historial.where('[tabla+clave]').equals(['jornadas', 'falta']).toArray()).filter((h) => h.quien === 'dueno@prueba.test')
    expect(alta.map((h) => [h.accion, h.motivo])).toEqual([['creo', MOTIVO_REARMADO]])

    // Ya no falta nada.
    expect(await leerTurnosParaRearmar()).toEqual([])
  })

  it('si mientras tanto llegó del aparato que lo tenía, no lo pisa ni lo repite', async () => {
    const turnos = await leerTurnosParaRearmar()
    // Llega con su mismo id, aunque allá le hayan corregido el horario.
    await db.jornadas.add({ ...jornada('falta', '2026-11-03', 'T', arqueo({ '10000': 4 })), vendedor: 'Desde el aparato' })
    expect(await rearmarTurnos(turnos, '2026-11-20')).toEqual({ creados: [], yaEstaban: ['falta'] })
    expect((await db.jornadas.get('falta'))?.vendedor).toBe('Desde el aparato')
    // Tampoco si llegó otro turno para la misma mañana.
    await db.jornadas.delete('falta')
    await db.jornadas.add(jornada('otro', '2026-11-03', 'M', null))
    expect(await rearmarTurnos(turnos, '2026-11-20')).toEqual({ creados: [], yaEstaban: ['falta'] })
    expect(await db.jornadas.get('falta')).toBeUndefined()
  })

  it('lo que tiene un problema no se crea', async () => {
    await db.jornadas.delete('02T')
    const turnos = await leerTurnosParaRearmar()
    expect(turnos[0].problema).toMatch(/con cuánto abrió/)
    expect(await rearmarTurnos(turnos, '2026-11-20')).toEqual({ creados: [], yaEstaban: [] })
    expect(await db.jornadas.count()).toBe(0)
  })
})
