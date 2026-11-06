import { describe, expect, it } from 'vitest'
import type { ArqueoCuenta, Movimiento } from '../db/db'
import { cajaVirtual, efectoEnCuenta, saldoDeCuenta } from './cajaGrande'

const mov = (id: string, tipo: Movimiento['tipo'], monto: number, extra: Partial<Movimiento> = {}): Movimiento => ({
  id, fecha: '2026-11-06', tipo, concepto: id, monto, categoria: null, jornadaId: null, esVariable: false,
  creadoEn: 2000, ...extra,
})
const conteo = (contado: number, cuando = 1000, extra: Partial<ArqueoCuenta> = {}): ArqueoCuenta => ({
  id: `c${cuando}`, cuenta: 'cajaGrande', fecha: '2026-11-06', hora: '09:00', cuando, contado,
  esperado: null, quien: null, quienNombre: null, nota: null, ...extra,
})

describe('qué mueve cada movimiento en la caja grande', () => {
  it('el pase desde el cajón entra; un gasto pagado con ella sale', () => {
    expect(efectoEnCuenta('cajaGrande', mov('p', 'A_CAJA_GRANDE', 50000))).toBe(50000)
    expect(efectoEnCuenta('cajaGrande', mov('g', 'GASTO_CAJA_GRANDE', 30000, { cuenta: 'cajaGrande' }))).toBe(-30000)
  })

  it('un gasto pagado por el banco o Mercado Pago no la toca', () => {
    expect(efectoEnCuenta('cajaGrande', mov('g', 'GASTO_CAJA_GRANDE', 30000, { cuenta: 'banco' }))).toBe(0)
    expect(efectoEnCuenta('cajaGrande', mov('g', 'GASTO_CAJA_GRANDE', 30000, { cuenta: 'mercadoPago' }))).toBe(0)
  })

  it('un depósito al banco sale de la caja grande y entra al banco', () => {
    const deposito = mov('d', 'PASE_ENTRE_CUENTAS', 100000, { cuenta: 'cajaGrande', cuentaDestino: 'banco' })
    expect(efectoEnCuenta('cajaGrande', deposito)).toBe(-100000)
    expect(efectoEnCuenta('banco', deposito)).toBe(100000)
  })

  it('un egreso del cajón no toca la caja grande', () => {
    expect(efectoEnCuenta('cajaGrande', mov('e', 'EGRESO_CAJA', 500))).toBe(0)
  })
})

describe('el saldo de la caja grande', () => {
  it('sin ningún conteo no hay saldo: hay que contarla para arrancar', () => {
    expect(saldoDeCuenta('cajaGrande', [], [mov('p', 'A_CAJA_GRANDE', 50000)]).saldo).toBeNull()
  })

  it('es lo último que se contó, más lo que entró y menos lo que salió después', () => {
    const r = saldoDeCuenta(
      'cajaGrande',
      [conteo(200000, 1000), conteo(150000, 500)],
      [
        mov('antes', 'A_CAJA_GRANDE', 99999, { creadoEn: 900 }),
        mov('pase', 'A_CAJA_GRANDE', 50000),
        mov('alquiler', 'GASTO_CAJA_GRANDE', 120000, { cuenta: 'cajaGrande' }),
        mov('deposito', 'PASE_ENTRE_CUENTAS', 60000, { cuenta: 'cajaGrande', cuentaDestino: 'banco' }),
        mov('por-banco', 'GASTO_CAJA_GRANDE', 40000, { cuenta: 'banco' }),
      ],
    )
    expect(r.saldo).toBe(200000 + 50000 - 120000 - 60000)
    expect(r.movimientos.map((x) => x.movimiento.id).sort()).toEqual(['alquiler', 'deposito', 'pase'])
  })

  it('un movimiento viejo sin hora de carga cuenta si es de un día posterior al conteo', () => {
    const r = saldoDeCuenta(
      'cajaGrande',
      [conteo(1000, 1000, { fecha: '2026-11-05' })],
      [mov('viejo', 'A_CAJA_GRANDE', 500, { creadoEn: undefined, fecha: '2026-11-06' }), mov('mismo-dia', 'A_CAJA_GRANDE', 700, { creadoEn: undefined, fecha: '2026-11-05' })],
    )
    expect(r.saldo).toBe(1500)
  })
})

describe('la caja virtual', () => {
  it('suma lo cobrado sin efectivo, por medio de pago', () => {
    expect(
      cajaVirtual([
        { medioPago: 'EFECTIVO', total: 1000 },
        { medioPago: 'DEBITO', total: 3000 },
        { medioPago: 'TRANSFERENCIA', total: 5000 },
        { medioPago: 'DEBITO', total: 2000 },
      ]),
    ).toEqual([
      { medio: 'DEBITO', total: 5000 },
      { medio: 'TRANSFERENCIA', total: 5000 },
    ])
  })

  it('un renglón pagado una parte en efectivo y otra con tarjeta suma solo la parte de la tarjeta (06/11)', () => {
    expect(
      cajaVirtual([
        {
          medioPago: 'EFECTIVO',
          total: 20000,
          pagos: [
            { medio: 'EFECTIVO', monto: 12000 },
            { medio: 'CREDITO', monto: 8000, tarjeta: 'Consumax', plan: '3 pagos', cuotas: 3, recargoPct: 15 },
          ],
        },
      ]),
    ).toEqual([{ medio: 'CREDITO', total: 8000 }])
  })
})
