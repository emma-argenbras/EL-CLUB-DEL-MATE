import { describe, expect, it } from 'vitest'
import { plata } from './formato'
import { pideRecuento, pistasDeLaDiferencia } from './diferenciaCaja'

const venta = (id: string, total: number, medioPago: 'EFECTIVO' | 'DEBITO' | 'TRANSFERENCIA' = 'EFECTIVO', extra = {}) => ({
  id, codigo: `C${total}`, descripcion: 'MATE TORPEDO', hora: '10:32', total, medioPago, cambioId: null, ...extra,
})

describe('pistas cuando falta plata', () => {
  it('una venta en efectivo por el mismo monto: ¿fue en efectivo?', () => {
    const p = pistasDeLaDiferencia(-45000, [venta('a', 45000), venta('b', 3000)], [])
    expect(p[0]).toContain(`MATE TORPEDO de las 10:32 (${plata(45000)}) está cargada en efectivo`)
  })

  it('la misma venta cargada dos veces va primero', () => {
    const p = pistasDeLaDiferencia(-12000, [venta('a', 12000), venta('b', 12000)], [])
    expect(p[0]).toContain('está cargada 2 veces')
  })

  it('un billete justo: ¿están bien contados?', () => {
    const p = pistasDeLaDiferencia(-20000, [], [])
    expect(p).toEqual([`Faltan justo ${plata(20000)}: ¿están bien contados los billetes de ${plata(20000)}?`])
  })
})

describe('pistas cuando sobra plata', () => {
  it('una venta con tarjeta o transferencia por el mismo monto: ¿fue en efectivo?', () => {
    const p = pistasDeLaDiferencia(8500, [venta('a', 8500, 'TRANSFERENCIA')], [])
    expect(p[0]).toContain('cargada como TRANSFERENCIA: ¿se cobró en efectivo?')
  })

  it('un egreso o un pase por el mismo monto: ¿salió de verdad?', () => {
    const p = pistasDeLaDiferencia(
      7300,
      [],
      [
        { tipo: 'EGRESO_CAJA', concepto: 'Flete', monto: 7300 },
        { tipo: 'A_CAJA_GRANDE', concepto: 'Pase', monto: 7300 },
      ],
    )
    expect(p).toHaveLength(2)
    expect(p[0]).toContain('El egreso «Flete»')
    expect(p[1]).toContain('El pase a caja grande')
  })

  it('una venta en efectivo no explica un sobrante, ni un cambio cuenta como venta suelta', () => {
    expect(pistasDeLaDiferencia(8500, [venta('a', 8500, 'EFECTIVO')], [])).toEqual([])
    expect(pistasDeLaDiferencia(-8500, [venta('a', 8500, 'EFECTIVO', { cambioId: 'c' })], [])).toEqual([])
  })

  it('el recargo de una tarjeta no es una venta que se pueda haber cargado mal (06/11)', () => {
    const recargo = venta('r', 1500, 'DEBITO', { codigo: 'REC-TARJETA', descripcion: 'Recargo Consumax 3 pagos (15 %)' })
    expect(pistasDeLaDiferencia(1500, [recargo], [])).toEqual([])
  })
})

describe('cuándo pedir recontar', () => {
  it('desde $ 2.000 de diferencia, para un lado o para el otro', () => {
    expect(pideRecuento(-2000)).toBe(true)
    expect(pideRecuento(2500)).toBe(true)
    expect(pideRecuento(-1500)).toBe(false)
  })

  it('caja justa: sin pistas', () => {
    expect(pistasDeLaDiferencia(0, [venta('a', 0)], [])).toEqual([])
  })
})
