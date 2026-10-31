import { describe, expect, it } from 'vitest'
import type { Jornada, Movimiento, Venta } from '../db/db'
import { cuelgaDeRetenido, decidirRetenidos, textoDeRetenidos } from './retener'

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
