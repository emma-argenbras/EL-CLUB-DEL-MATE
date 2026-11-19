import { describe, expect, it } from 'vitest'
import type { EntradaHistorial } from '../db/db'
import { plata } from './formato'
import { cambiosDelProducto, comoSeLee, etiquetaCampo, productosEditadosEnElMes } from './historialLegible'

const entrada = (clave: string, cuando: string, extra: Partial<EntradaHistorial> = {}): EntradaHistorial => ({
  id: `${clave}-${cuando}`, tabla: 'productos', clave, accion: 'edito', queEs: clave, campo: 'precioVenta',
  valorAnterior: 1, valorNuevo: 2, quien: 'gabi@x.com', quienNombre: 'Gabriela', quienRol: 'empleado',
  cuando: new Date(cuando).getTime(), motivo: null, ...extra,
})

describe('el historial en palabras', () => {
  it('los campos y los valores como se leen', () => {
    expect(etiquetaCampo('precioCompra')).toBe('costo')
    expect(etiquetaCampo('otroCampo')).toBe('otroCampo')
    expect(comoSeLee(19000, 'precioVenta')).toBe(plata(19000))
    expect(comoSeLee(4, 'stock')).toBe('4')
    // De quien es un pago de sueldo (19/11): el nombre, no el id.
    const nombres = new Map([['uid-gabi', 'Gabriela']])
    expect(comoSeLee('uid-gabi', 'persona', nombres)).toBe('Gabriela')
    expect(comoSeLee('uid-otro', 'persona', nombres)).toBe('uid-otro')
    expect(comoSeLee('uid-gabi', 'persona')).toBe('uid-gabi')
    expect(comoSeLee(null, 'persona', nombres)).toBe('—')
    expect(comoSeLee('2026-11', 'periodoSueldo')).toBe('noviembre 2026')
    expect(etiquetaCampo('persona')).toBe('de quién es')
    expect(etiquetaCampo('periodoSueldo')).toBe('mes al que corresponde')
    expect(comoSeLee(null, 'stock')).toBe('—')
  })

  it('los productos distintos que una persona editó en el mes', () => {
    const entradas = [
      entrada('A', '2026-11-02T10:00:00'),
      entrada('A', '2026-11-03T10:00:00'), // el mismo: cuenta una vez
      entrada('B', '2026-11-30T23:00:00'),
      entrada('C', '2026-10-31T23:00:00'), // el mes anterior
      entrada('D', '2026-11-04T10:00:00', { quien: 'sandra@x.com' }), // otra persona
      entrada('E', '2026-11-04T10:00:00', { tabla: 'jornadas' }), // no es un producto
      entrada('F', '2026-11-04T10:00:00', { accion: 'creo' }), // no es una edición
    ]
    expect(productosEditadosEnElMes(entradas, 'gabi@x.com', '2026-11')).toBe(2)
  })

  it('lo que se le cambió a un producto: sin las fechas, sin altas, lo más nuevo primero', () => {
    const lista = cambiosDelProducto([
      entrada('A', '2026-11-02T10:00:00', { id: 'viejo' }),
      entrada('A', '2026-11-05T10:00:00', { id: 'nuevo', campo: 'precioCompra' }),
      entrada('A', '2026-11-05T10:00:00', { id: 'fecha', campo: 'fechaPrecioVenta' }),
      entrada('A', '2026-11-01T10:00:00', { id: 'alta', accion: 'creo', campo: null }),
    ])
    expect(lista.map((h) => h.id)).toEqual(['nuevo', 'viejo'])
  })
})
