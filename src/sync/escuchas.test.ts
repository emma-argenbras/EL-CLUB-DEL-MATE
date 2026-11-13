import { describe, expect, it } from 'vitest'
import {
  anotarCaida,
  consejoDeTablasSinRecibir,
  anotarQueVolvio,
  esperaParaReabrir,
  estadoTrasRecibir,
  textoDeTablasSinRecibir,
} from './escuchas'

const MIN = 60_000

describe('las escuchas del servidor que se caen', () => {
  it('se vuelven a abrir cada vez con más espera, y después cada cinco minutos para siempre', () => {
    expect([1, 2, 3, 4, 5, 6, 40].map(esperaParaReabrir)).toEqual([
      15_000,
      30_000,
      MIN,
      2 * MIN,
      5 * MIN,
      5 * MIN,
      5 * MIN,
    ])
  })

  it('cada caída seguida suma, pero el «desde» queda el de la primera', () => {
    let lista = anotarCaida([], 'productos', 'Quota exceeded.', 1_000)
    lista = anotarCaida(lista, 'productos', 'Quota exceeded otra vez.', 9_000)
    expect(lista).toEqual([
      { tabla: 'productos', desde: 1_000, caidas: 2, error: 'Quota exceeded otra vez.', codigo: null },
    ])
  })

  it('las tablas se anotan por separado y vuelve solo la que volvió', () => {
    let lista = anotarCaida([], 'productos', 'x', 1_000)
    lista = anotarCaida(lista, 'ventas', 'x', 2_000)
    expect(anotarQueVolvio(lista, 'productos').map((t) => t.tabla)).toEqual(['ventas'])
    expect(anotarQueVolvio(lista, 'jornadas')).toEqual(lista)
  })

  it('el cartel dice qué no recibe, en palabras, y hace cuánto se cortó', () => {
    const ahora = 100 * MIN
    expect(textoDeTablasSinRecibir([{ tabla: 'productos', desde: ahora - 12 * MIN, caidas: 3, error: 'x' }], ahora)).toBe(
      'Este aparato no está recibiendo los cambios de productos. Se cortó hace 12 minutos.',
    )
    const varias = [
      { tabla: 'productos' as const, desde: ahora - 5 * MIN, caidas: 1, error: 'x' },
      { tabla: 'jornadas' as const, desde: ahora - 30 * MIN, caidas: 4, error: 'x' },
      { tabla: 'movimientosProveedor' as const, desde: ahora, caidas: 1, error: 'x' },
    ]
    expect(textoDeTablasSinRecibir(varias, ahora)).toBe(
      'Este aparato no está recibiendo los cambios de productos, turnos y compras y pagos a proveedores. Se cortó hace 30 minutos.',
    )
    expect(textoDeTablasSinRecibir([], ahora)).toBe('')
  })

  it('con una tabla caída, recibir de otra NO deja el estado en «Sincronizado»', () => {
    const ahora = 50 * MIN
    expect(estadoTrasRecibir([], ahora)).toEqual({ estado: 'sincronizado', error: null, ultimaRecepcion: ahora })
    const caida = [{ tabla: 'productos' as const, desde: ahora - MIN, caidas: 1, error: 'x' }]
    expect(estadoTrasRecibir(caida, ahora)).toEqual({
      estado: 'error',
      error: 'Este aparato no está recibiendo los cambios de productos. Se cortó hace 1 minuto.',
      ultimaRecepcion: ahora,
    })
  })

  it('si se agotó la cuota de lecturas no manda a recargar, que no sirve: vuelve a la madrugada', () => {
    const otra = [{ tabla: 'ventas' as const, desde: 0, caidas: 2, error: 'x', codigo: 'unavailable' }]
    expect(consejoDeTablasSinRecibir(otra)).toContain('recargá la app')
    expect(consejoDeTablasSinRecibir(otra)).not.toContain('madrugada')
    const cuota = [...otra, { tabla: 'productos' as const, desde: 0, caidas: 1, error: 'Quota exceeded.', codigo: 'resource-exhausted' }]
    expect(consejoDeTablasSinRecibir(cuota)).toContain('vuelve solo a la madrugada: recargar no lo arregla')
    expect(consejoDeTablasSinRecibir(cuota)).not.toContain('recargá la app')
    // En los dos casos dice que lo de acá no se pierde.
    for (const l of [otra, cuota]) expect(consejoDeTablasSinRecibir(l)).toContain('no se pierde nada')
  })
})
