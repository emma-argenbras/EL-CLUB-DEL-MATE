import { describe, expect, it } from 'vitest'
import type { Jornada, Movimiento, Venta } from '../db/db'
import {
  compararConServidor,
  cuelgaDeRetenido,
  decidirRetenidos,
  textoDeRetenidos,
  type TurnoRetenido,
} from './retener'

function jornada(id: string, fecha: string, turno: 'M' | 'T'): Jornada {
  return {
    id, fecha, turno, estado: 'cerrado', vendedor: 'Gabriela', cajaInicial: 0, horaApertura: '09:00',
    horaCierre: '13:00', arqueoApertura: null, arqueoCierre: null, notas: null,
  }
}
function venta(id: string, jornadaId: string, total = 1000): Venta {
  return {
    id, jornadaId, fecha: '2026-10-29', hora: '10:00', codigo: 'TM015', descripcion: 'MATE', cantidad: 1,
    precioUnitario: total, costoUnitario: null, medioPago: 'EFECTIVO', total, vendedor: null,
  }
}
function egreso(id: string, jornadaId: string): Movimiento {
  return { id, fecha: '2026-10-29', tipo: 'EGRESO_CAJA', concepto: 'Bolsas', monto: 500, categoria: 'OTROS', jornadaId, esVariable: true }
}

describe('decidirRetenidos: el caso de Gabriela y Sandra', () => {
  it('el turno del celular se retiene si el servidor ya tiene ese dia y horario con otro id', () => {
    const r = decidirRetenidos(
      [jornada('gabi-29m', '2026-10-29', 'M')],
      [{ id: 'sandra-29m', fecha: '2026-10-29', turno: 'M' }],
      [venta('v1', 'gabi-29m', 45000), venta('v2', 'gabi-29m', 5000), venta('v3', 'otro')],
      [egreso('e1', 'gabi-29m')],
    )
    expect(r).toEqual([
      { id: 'gabi-29m', fecha: '2026-10-29', turno: 'M', idEnServidor: 'sandra-29m', ventas: 2, totalVentas: 50000, movimientos: 1 },
    ])
  })

  it('un turno que el servidor no tiene se sube normal: no se retiene', () => {
    expect(decidirRetenidos([jornada('gabi-30t', '2026-10-30', 'T')], [{ id: 'x', fecha: '2026-10-30', turno: 'M' }], [], [])).toEqual([])
  })

  it('el mismo id en el servidor no es un conflicto (ese ni siquiera llega aca)', () => {
    expect(decidirRetenidos([jornada('j1', '2026-10-29', 'M')], [{ id: 'j1', fecha: '2026-10-29', turno: 'M' }], [], [])).toEqual([])
  })

  it('ordena por fecha y horario', () => {
    const r = decidirRetenidos(
      [jornada('b', '2026-10-30', 'T'), jornada('a', '2026-10-29', 'M')],
      [{ id: 's1', fecha: '2026-10-30', turno: 'T' }, { id: 's2', fecha: '2026-10-29', turno: 'M' }],
      [], [],
    )
    expect(r.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('cuelgaDeRetenido', () => {
  const retenidos = new Set(['gabi-29m'])
  it('el turno, sus ventas y sus egresos no se suben; el resto si', () => {
    expect(cuelgaDeRetenido('jornadas', { id: 'gabi-29m' }, retenidos)).toBe(true)
    expect(cuelgaDeRetenido('ventas', { id: 'v1', jornadaId: 'gabi-29m' }, retenidos)).toBe(true)
    expect(cuelgaDeRetenido('movimientos', { id: 'e1', jornadaId: 'gabi-29m' }, retenidos)).toBe(true)
    expect(cuelgaDeRetenido('ventas', { id: 'v3', jornadaId: 'otro' }, retenidos)).toBe(false)
    expect(cuelgaDeRetenido('productos', { codigo: 'TM015' }, retenidos)).toBe(false)
    expect(cuelgaDeRetenido('ventas', { id: 'v1', jornadaId: 'gabi-29m' }, new Set())).toBe(false)
  })
})

describe('textoDeRetenidos', () => {
  it('dice cuantos, cuales, y que no se duplico nada', () => {
    const texto = textoDeRetenidos([
      { id: 'a', fecha: '2026-10-29', turno: 'M', idEnServidor: 's', ventas: 2, totalVentas: 50000, movimientos: 1 },
      { id: 'b', fecha: '2026-10-30', turno: 'T', idEnServidor: 's2', ventas: 1, totalVentas: 1000, movimientos: 0 },
    ])
    expect(texto).toContain('2 turnos con 3 ventas')
    expect(texto).toContain('29/10 mañana, 30/10 tarde')
    expect(texto).toContain('No se duplicó nada')
  })
})

describe('textoDeRetenidos con muchos turnos', () => {
  it('406 turnos no se listan uno por uno: se dice el tramo, con los miles separados', () => {
    const turnos: TurnoRetenido[] = Array.from({ length: 406 }, (_, i) => ({
      id: `t${i}`,
      fecha: i === 0 ? '2026-02-01' : i === 405 ? '2026-08-31' : '2026-05-10',
      turno: i === 405 ? 'T' : 'M',
      idEnServidor: `s${i}`,
      ventas: i < 79 ? 5 : 4,
      totalVentas: 1000,
      movimientos: 0,
    }))
    const texto = textoDeRetenidos(turnos)
    expect(texto).toContain('406 turnos con 1.703 ventas')
    expect(texto).toContain('del 01/02 mañana al 31/08 tarde')
    expect(texto).not.toContain('10/05')
    expect(texto.length).toBeLessThan(250)
  })
})

describe('compararConServidor: copia exacta o algo distinto', () => {
  const v = (codigo: string, total: number, medioPago: 'EFECTIVO' | 'DEBITO' = 'EFECTIVO') => ({
    codigo, cantidad: 1, total, medioPago,
  })
  const egreso = (monto: number, concepto = 'Bolsas') => ({ tipo: 'EGRESO_CAJA' as const, concepto, monto })

  it('las mismas ventas y egresos en otro orden: es una copia', () => {
    expect(
      compararConServidor(
        { ventas: [v('TM015', 45000), v('YB01', 5000)], movimientos: [egreso(500)] },
        { ventas: [v('YB01', 5000), v('TM015', 45000)], movimientos: [egreso(500, ' bolsas ')] },
      ),
    ).toBe('igual')
  })

  it('un monto distinto, una venta de mas o otro medio de pago: no es copia', () => {
    const aca = { ventas: [v('TM015', 45000)], movimientos: [] }
    expect(compararConServidor(aca, { ventas: [v('TM015', 45500)], movimientos: [] })).toBe('distinto')
    expect(compararConServidor(aca, { ventas: [v('TM015', 45000), v('TM015', 45000)], movimientos: [] })).toBe('distinto')
    expect(compararConServidor(aca, { ventas: [v('TM015', 45000, 'DEBITO')], movimientos: [] })).toBe('distinto')
    expect(compararConServidor(aca, { ventas: [v('TM015', 45000)], movimientos: [egreso(500)] })).toBe('distinto')
  })

  it('si el turno del servidor todavia no llego a este aparato, no se puede decir', () => {
    expect(compararConServidor({ ventas: [], movimientos: [] }, null)).toBe('sin-servidor')
  })
})
