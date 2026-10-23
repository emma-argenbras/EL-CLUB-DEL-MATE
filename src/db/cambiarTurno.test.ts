import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Jornada, type Movimiento, type Venta } from './db'
import { cambiarTurno, motivoCambioTurno } from './cambiarTurno'

function jornada(id: string, turno: 'M' | 'T', estado: 'abierto' | 'cerrado' = 'abierto'): Jornada {
  return {
    id, fecha: '2026-10-23', turno, estado,
    vendedor: 'Sandra', cajaInicial: 10000, horaApertura: '09:13',
    horaCierre: estado === 'cerrado' ? '13:00' : null,
    arqueoApertura: null, arqueoCierre: null, notas: null,
  }
}

function venta(id: string, jornadaId: string): Venta {
  return {
    id, jornadaId, fecha: '2026-10-23', hora: '10:00', codigo: 'TM015',
    descripcion: 'MATE', cantidad: 1, precioUnitario: 5000, costoUnitario: null,
    medioPago: 'EFECTIVO', total: 5000, vendedor: null,
  }
}

beforeEach(async () => {
  await Promise.all([db.jornadas.clear(), db.ventas.clear(), db.movimientos.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('cambiarTurno', () => {
  it('el caso del 23/10: el TARDE abierto a la mañana pasa a MAÑANA, con su caja inicial', async () => {
    await db.jornadas.add(jornada('j1', 'T'))
    expect(await cambiarTurno('j1')).toEqual({ estado: 'cambiado', turno: 'M' })
    const j = await db.jornadas.get('j1')
    expect(j?.turno).toBe('M')
    expect(j?.cajaInicial).toBe(10000)
    expect(await db.jornadas.where('[fecha+turno]').equals(['2026-10-23', 'M']).count()).toBe(1)
  })

  it('y al reves', async () => {
    await db.jornadas.add(jornada('j1', 'M'))
    expect(await cambiarTurno('j1')).toEqual({ estado: 'cambiado', turno: 'T' })
  })

  it('CON VENTAS NO: eso ya es mover plata de caja', async () => {
    await db.jornadas.add(jornada('j1', 'T'))
    await db.ventas.add(venta('v1', 'j1'))
    expect(await cambiarTurno('j1')).toEqual({ estado: 'tiene-ventas', ventas: 1 })
    expect((await db.jornadas.get('j1'))?.turno).toBe('T')
  })

  it('si el otro horario ya tiene turno, no los junta', async () => {
    await db.jornadas.bulkAdd([jornada('j1', 'T'), jornada('j2', 'M')])
    expect(await cambiarTurno('j1')).toEqual({ estado: 'ocupado' })
    expect((await db.jornadas.get('j1'))?.turno).toBe('T')
  })

  it('un turno cerrado no se toca', async () => {
    await db.jornadas.add(jornada('j1', 'T', 'cerrado'))
    expect(await cambiarTurno('j1')).toEqual({ estado: 'cerrado' })
  })

  it('si el turno ya no esta, no inventa uno', async () => {
    expect(await cambiarTurno('fantasma')).toEqual({ estado: 'no-existe' })
  })

  it('los egresos van con el turno: cuelgan de el, no del horario', async () => {
    await db.jornadas.add(jornada('j1', 'T'))
    await db.movimientos.add({ id: 'm1', jornadaId: 'j1', tipo: 'EGRESO_CAJA', concepto: 'Bolsas', monto: 500 } as Movimiento)
    await cambiarTurno('j1')
    expect((await db.movimientos.get('m1'))?.jornadaId).toBe('j1')
  })

  it('queda en el historial, de que turno a cual y con quien', async () => {
    await db.jornadas.add(jornada('j1', 'T'))
    await cambiarTurno('j1')
    await historialAlDia()
    const renglon = (await db.historial.toArray()).find((r) => r.tabla === 'jornadas' && r.campo === 'turno')
    expect(renglon?.valorAnterior).toBe('T')
    expect(renglon?.valorNuevo).toBe('M')
    expect(renglon?.motivo).toBe(motivoCambioTurno('T', 'M'))
    expect(renglon?.quienNombre).toBe('Sandra')
  })
})
