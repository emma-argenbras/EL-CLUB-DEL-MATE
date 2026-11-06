import { describe, expect, it } from 'vitest'
import type { Jornada, Movimiento, Venta } from '../db/db'
import { lunesDe, resumenDeHoy, saludo, ventasDeLaSemana } from './tablero'

const venta = (id: string, extra: Partial<Venta> = {}): Venta => ({
  id, jornadaId: 'j-tarde', fecha: '2026-11-06', hora: '17:00', codigo: 'A', descripcion: 'A', cantidad: 1,
  precioUnitario: 1000, costoUnitario: null, medioPago: 'EFECTIVO', total: 1000, vendedor: null, ...extra,
})
const jornada = (id: string, estado: Jornada['estado'], cajaInicial = 10000): Jornada => ({
  id, fecha: '2026-11-06', turno: id === 'j-man' ? 'M' : 'T', estado, vendedor: null, cajaInicial,
  horaApertura: null, horaCierre: null, arqueoApertura: null, arqueoCierre: null, notas: null,
})

describe('el saludo', () => {
  it('días hasta las 12, tardes hasta las 20, noches después', () => {
    expect([saludo(9), saludo(12), saludo(19), saludo(20)]).toEqual(['Buenos días', 'Buenas tardes', 'Buenas tardes', 'Buenas noches'])
  })
})

describe('la semana', () => {
  it('el lunes de la semana, y el domingo es el fin de la que termina', () => {
    expect(lunesDe('2026-11-06')).toBe('2026-11-02') // viernes
    expect(lunesDe('2026-11-02')).toBe('2026-11-02') // lunes
    expect(lunesDe('2026-11-08')).toBe('2026-11-02') // domingo
    expect(lunesDe('2026-01-01')).toBe('2025-12-29') // cruza el año
  })

  it('lo vendido de lunes a sábado, cada día lo suyo', () => {
    const s = ventasDeLaSemana('2026-11-02', [
      { fecha: '2026-11-02', total: 1000 },
      { fecha: '2026-11-02', total: 500 },
      { fecha: '2026-11-06', total: 2000 },
      { fecha: '2026-11-08', total: 9999 }, // domingo: no va
      { fecha: '2026-10-31', total: 9999 }, // la semana anterior
    ])
    expect(s.map((d) => `${d.dia}:${d.total}`)).toEqual(['Lun:1500', 'Mar:0', 'Mié:0', 'Jue:0', 'Vie:2000', 'Sáb:0'])
  })
})

describe('lo de hoy', () => {
  it('lo vendido, las operaciones, el cajón de los turnos abiertos y lo que va al banco', () => {
    const ventas = [
      venta('a', { jornadaId: 'j-man', total: 5000 }),
      venta('b', { total: 3000 }),
      venta('c', { total: 2000, medioPago: 'DEBITO' }),
      venta('t1', { total: 4000, ticketId: 't', pagos: [{ medio: 'EFECTIVO', monto: 1000 }, { medio: 'CREDITO', monto: 3000 }] }),
      venta('t2', { total: 1000, ticketId: 't' }),
    ]
    const movimientos: Movimiento[] = [
      { id: 'm', fecha: '2026-11-06', tipo: 'EGRESO_CAJA', concepto: 'flete', monto: 500, categoria: null, jornadaId: 'j-tarde', esVariable: true },
    ]
    const h = resumenDeHoy([jornada('j-man', 'cerrado'), jornada('j-tarde', 'abierto')], ventas, movimientos)
    expect(h.vendido).toBe(15000)
    expect(h.operaciones).toBe(4)
    expect(h.banco).toBe(5000)
    // Tarde: 10.000 de inicio + 3.000 + 1.000 + 1.000 en efectivo − 500 de egreso.
    expect(h.enElCajon).toBe(14500)
  })

  it('sin turno abierto, el cajón no se sabe', () => {
    expect(resumenDeHoy([jornada('j-man', 'cerrado')], [], []).enElCajon).toBeNull()
  })
})
