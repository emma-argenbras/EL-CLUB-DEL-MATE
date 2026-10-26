import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../db/db'
import { egresoIgual, preguntaEgresoRepetido, preguntaPagoRepetido } from './egresoRepetido'
import { plata } from './formato'

const mov = (extra: Partial<Movimiento>): Movimiento => ({
  id: 'm1', fecha: '2026-10-23', tipo: 'EGRESO_CAJA', concepto: 'Pago a DOSANTO', monto: 37500,
  categoria: 'PROVEEDORES', jornadaId: 'j1', esVariable: true, cuenta: 'cajon', ...extra,
})

describe('egresoIgual', () => {
  it('el caso del 23/10: mismo monto, mismo dia, del cajon', () => {
    expect(egresoIgual(37500, '2026-10-23', [mov({})])?.id).toBe('m1')
  })

  it('otro dia, otro monto, o que no salio del cajon: no es el mismo', () => {
    expect(egresoIgual(37500, '2026-10-24', [mov({})])).toBeNull()
    expect(egresoIgual(37000, '2026-10-23', [mov({})])).toBeNull()
    expect(egresoIgual(37500, '2026-10-23', [mov({ tipo: 'GASTO_CAJA_GRANDE' })])).toBeNull()
    expect(egresoIgual(37500, '2026-10-23', [mov({ tipo: 'A_CAJA_GRANDE' })])).toBeNull()
  })
})

describe('las preguntas', () => {
  it('si el que ya esta es un pago a proveedor, lo dice y explica que el cierre ya lo descuenta', () => {
    const texto = preguntaEgresoRepetido(mov({}))
    expect(texto).toContain('«Pago a DOSANTO»')
    expect(texto).toContain('desde Proveedores')
    expect(texto).toContain(plata(37500))
  })

  it('si es un egreso cualquiera, dice cual', () => {
    const texto = preguntaEgresoRepetido(mov({ concepto: 'Bolsas', categoria: 'OTROS' }))
    expect(texto).toContain('«Bolsas»')
    expect(texto).not.toContain('Proveedores')
  })

  it('al registrar el pago, avisa que el cierre lo descontaria dos veces', () => {
    expect(preguntaPagoRepetido(mov({ concepto: 'Dosanto', categoria: 'OTROS' }))).toContain('dos veces')
  })
})
