import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Jornada, type Venta } from './db'
import { moverVenta } from './moverVenta'

function jornada(id: string, turno: 'M' | 'T', estado: 'abierto' | 'cerrado', fecha = '2026-10-21'): Jornada {
  return {
    id, fecha, turno, estado,
    vendedor: null, cajaInicial: 0, horaApertura: '09:00',
    horaCierre: estado === 'cerrado' ? '13:00' : null,
    arqueoApertura: null, arqueoCierre: null, notas: null,
  }
}

function venta(id: string, jornadaId: string): Venta {
  return {
    id, jornadaId, fecha: '2026-10-21', hora: '10:00', codigo: 'TM015',
    descripcion: 'MATE', cantidad: 1, precioUnitario: 5000, costoUnitario: null,
    medioPago: 'EFECTIVO', total: 5000, vendedor: null,
  }
}

beforeEach(async () => {
  await Promise.all([db.jornadas.clear(), db.ventas.clear(), db.historial.clear()])
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('moverVenta', () => {
  it('pasa la venta al otro turno del dia', async () => {
    await db.jornadas.bulkAdd([jornada('m', 'M', 'abierto'), jornada('t', 'T', 'abierto')])
    await db.ventas.add(venta('v1', 'm'))

    await moverVenta('v1', 't')

    expect((await db.ventas.get('v1'))?.jornadaId).toBe('t')
  })

  it('queda en el historial, diciendo de donde a donde', async () => {
    await db.jornadas.bulkAdd([jornada('m', 'M', 'abierto'), jornada('t', 'T', 'abierto')])
    await db.ventas.add(venta('v1', 'm'))
    await historialAlDia()
    await db.historial.clear()

    await moverVenta('v1', 't')
    await historialAlDia()

    const renglones = await db.historial.toArray()
    const elCambio = renglones.find((r) => r.campo === 'jornadaId')
    expect(elCambio).toBeDefined()
    expect(elCambio!.valorAnterior).toBe('m')
    expect(elCambio!.valorNuevo).toBe('t')
    expect(elCambio!.motivo).toBe('Venta pasada de la mañana a la tarde')
    expect(elCambio!.quienNombre).toBe('Sandra')
  })

  it('no la mueve si el turno de origen esta cerrado', async () => {
    await db.jornadas.bulkAdd([jornada('m', 'M', 'cerrado'), jornada('t', 'T', 'abierto')])
    await db.ventas.add(venta('v1', 'm'))

    await expect(moverVenta('v1', 't')).rejects.toThrow('Reabrí el turno primero')
    expect((await db.ventas.get('v1'))?.jornadaId).toBe('m')
  })

  it('no la mueve si el turno de destino esta cerrado', async () => {
    // Un turno cerrado se cerro contando una plata: meterle una venta
    // despues hace que el arqueo firmado ya no corresponda.
    await db.jornadas.bulkAdd([jornada('m', 'M', 'abierto'), jornada('t', 'T', 'cerrado')])
    await db.ventas.add(venta('v1', 'm'))

    await expect(moverVenta('v1', 't')).rejects.toThrow('Reabrí el turno primero')
  })

  it('no la mueve a un turno de otro dia', async () => {
    await db.jornadas.bulkAdd([
      jornada('m', 'M', 'abierto'),
      jornada('otro', 'T', 'abierto', '2026-10-22'),
    ])
    await db.ventas.add(venta('v1', 'm'))

    await expect(moverVenta('v1', 'otro')).rejects.toThrow('mismo día')
  })

  it('moverla al turno en el que ya esta no hace nada', async () => {
    await db.jornadas.add(jornada('m', 'M', 'abierto'))
    await db.ventas.add(venta('v1', 'm'))
    await historialAlDia()
    await db.historial.clear()

    await moverVenta('v1', 'm')
    await historialAlDia()

    expect(await db.historial.count()).toBe(0)
  })

  it('avisa si la venta ya no esta', async () => {
    await expect(moverVenta('fantasma', 't')).rejects.toThrow('ya no está')
  })

  it('avisa si el turno destino no existe', async () => {
    await db.jornadas.add(jornada('m', 'M', 'abierto'))
    await db.ventas.add(venta('v1', 'm'))
    await expect(moverVenta('v1', 'no-existe')).rejects.toThrow('No encuentro el turno')
  })
})
