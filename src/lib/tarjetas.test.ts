import { describe, expect, it } from 'vitest'
import { nombreDelPlan, planAlElegirMedio, planesDe, planPorId, PLANES_TARJETA, recargoDe } from './tarjetas'

describe('las tarjetas y sus planes', () => {
  it('Consumax y Club del Este: 5 % en un pago y 15 % en tres (lo que dijo Emmanuel el 06/11)', () => {
    for (const tarjeta of ['Consumax', 'Club del Este']) {
      const planes = PLANES_TARJETA.filter((p) => p.tarjeta === tarjeta)
      expect(planes.map((p) => [p.cuotas, p.recargoPct])).toEqual([
        [1, 5],
        [3, 15],
      ])
    }
  })

  it('el recargo se redondea al peso y sin plan no hay recargo', () => {
    expect(recargoDe(10000, planPorId('consumax-3'))).toBe(1500)
    expect(recargoDe(12345, planPorId('club-del-este-1'))).toBe(617)
    expect(recargoDe(10000, planPorId('credito-1'))).toBe(0)
    expect(recargoDe(10000, null)).toBe(0)
  })

  it('al elegir débito queda puesto el débito; con crédito hay que elegir la tarjeta cada vez', () => {
    expect(planAlElegirMedio('DEBITO')).toBe('debito')
    expect(planAlElegirMedio('CREDITO')).toBeNull()
    expect(planAlElegirMedio('EFECTIVO')).toBeNull()
    expect(planesDe('CREDITO')).toHaveLength(5)
    expect(planesDe('TRANSFERENCIA')).toHaveLength(0)
  })

  it('el nombre que se ve al elegir', () => {
    expect(nombreDelPlan(planPorId('consumax-3')!)).toBe('Consumax 3 pagos')
    expect(nombreDelPlan(planPorId('debito')!)).toBe('Débito')
  })
})
