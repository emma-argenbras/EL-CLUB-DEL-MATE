import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { CODIGO_RECARGO, cobrosDe, db, engancharAutor, historialAlDia, type Producto } from './db'
import {
  armarTicket,
  borrarTicket,
  moverTicket,
  problemaDelTicket,
  registrarTicket,
  repartirPagos,
  totalesDelTicket,
  type RenglonTicket,
} from './ticket'

function prod(codigo: string, precioVenta: number, precioCompra: number | null, stock: number | null): Producto {
  return {
    codigo, descripcion: `PRODUCTO ${codigo}`, proveedor: null, proveedorId: null, fechaCompra: null,
    precioCompra, rentabilidad: null, precioVenta, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock, activo: true,
  }
}
const renglon = (p: Producto, cantidad = 1, precio = p.precioVenta ?? 0): RenglonTicket => ({
  producto: p, descripcion: p.descripcion, cantidad, precioUnitario: precio,
})
const JORNADA = { id: 'j1', fecha: '2026-11-06', vendedor: 'Sandra' }
const ids = (n: number, r = 2) => ({
  ticketId: 't1',
  renglones: Array.from({ length: n }, (_, i) => `r${i}`),
  recargos: Array.from({ length: r }, (_, i) => `rec${i}`),
})

beforeEach(async () => {
  await Promise.all([db.ventas.clear(), db.productos.clear(), db.borrados.clear(), db.jornadas.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('repartir los pagos entre los renglones', () => {
  it('un solo pago cubre todo', () => {
    expect(repartirPagos([40000, 10000], [{ medio: 'EFECTIVO', monto: 50000 }])).toEqual([
      [{ medio: 'EFECTIVO', monto: 40000 }],
      [{ medio: 'EFECTIVO', monto: 10000 }],
    ])
  })

  it('$ 30.000 en efectivo y $ 20.000 con débito: se parte un solo renglón y cada medio suma exacto', () => {
    const r = repartirPagos([40000, 10000], [
      { medio: 'EFECTIVO', monto: 30000 },
      { medio: 'DEBITO', monto: 20000 },
    ])
    expect(r).toEqual([
      [{ medio: 'EFECTIVO', monto: 30000 }, { medio: 'DEBITO', monto: 10000 }],
      [{ medio: 'DEBITO', monto: 10000 }],
    ])
  })

  it('con centavos no se pierde ni se inventa nada', () => {
    const r = repartirPagos([33.33, 33.33, 33.34], [{ medio: 'EFECTIVO', monto: 50 }, { medio: 'QR', monto: 50 }])
    const suma = (medio: string) => r.flat().filter((p) => p.medio === medio).reduce((s, p) => s + p.monto, 0)
    expect(Math.round(suma('EFECTIVO') * 100)).toBe(5000)
    expect(Math.round(suma('QR') * 100)).toBe(5000)
  })
})

describe('armar el ticket', () => {
  const mate = prod('TM015', 40000, 18000, 3)
  const bombilla = prod('BO01', 10000, 4000, null)

  it('un ticket en efectivo: un renglón por producto, como cualquier venta, con el mismo ticket', () => {
    const filas = armarTicket(JORNADA, [renglon(mate), renglon(bombilla)], [{ medio: 'EFECTIVO', monto: 50000 }], '10:30', ids(2))
    expect(filas.map((f) => [f.codigo, f.total, f.medioPago, f.ticketId, f.pagos ?? null])).toEqual([
      ['TM015', 40000, 'EFECTIVO', 't1', null],
      ['BO01', 10000, 'EFECTIVO', 't1', null],
    ])
    expect(filas[0].costoUnitario).toBe(18000)
  })

  it('pago mixto: el renglón partido guarda cómo se pagó, y las cuentas de plata lo leen', () => {
    const filas = armarTicket(
      JORNADA,
      [renglon(mate), renglon(bombilla)],
      [{ medio: 'EFECTIVO', monto: 30000 }, { medio: 'DEBITO', monto: 20000, planId: 'debito' }],
      '10:30',
      ids(2),
    )
    const efectivo = filas.flatMap(cobrosDe).filter((p) => p.medio === 'EFECTIVO').reduce((s, p) => s + p.monto, 0)
    const debito = filas.flatMap(cobrosDe).filter((p) => p.medio === 'DEBITO').reduce((s, p) => s + p.monto, 0)
    expect(efectivo).toBe(30000)
    expect(debito).toBe(20000)
    expect(filas[0].medioPago).toBe('EFECTIVO')
    expect(filas).toHaveLength(2)
  })

  it('Consumax en 3 pagos: un renglón de recargo del 15 %, con costo cero, y el total cobrado lo incluye', () => {
    const filas = armarTicket(JORNADA, [renglon(mate)], [{ medio: 'CREDITO', monto: 40000, planId: 'consumax-3' }], '10:30', ids(1))
    const recargo = filas.find((f) => f.codigo === CODIGO_RECARGO)!
    expect(recargo.total).toBe(6000)
    expect(recargo.costoUnitario).toBe(0)
    expect(recargo.descripcion).toBe('Recargo Consumax 3 pagos (15 %)')
    expect(filas.reduce((s, f) => s + f.total, 0)).toBe(46000)
    expect(filas[0].pagos?.[0]).toMatchObject({ medio: 'CREDITO', tarjeta: 'Consumax', plan: '3 pagos', cuotas: 3 })
  })

  it('el débito y la crédito bancaria no llevan recargo', () => {
    const filas = armarTicket(JORNADA, [renglon(mate)], [{ medio: 'CREDITO', monto: 40000, planId: 'credito-1' }], '10:30', ids(1))
    expect(filas.some((f) => f.codigo === CODIGO_RECARGO)).toBe(false)
  })
})

describe('lo que le falta al ticket', () => {
  const mate = prod('TM015', 40000, 18000, 3)
  it('cobrar de menos, de más, o con tarjeta sin plan, no se registra', () => {
    expect(problemaDelTicket([renglon(mate)], [{ medio: 'EFECTIVO', monto: 30000 }])).toMatch(/^Faltan/)
    expect(problemaDelTicket([renglon(mate)], [{ medio: 'EFECTIVO', monto: 50000 }])).toMatch(/de más/)
    expect(problemaDelTicket([renglon(mate)], [{ medio: 'CREDITO', monto: 40000 }])).toBe('Elegí la tarjeta y el plan.')
    expect(problemaDelTicket([], [])).toBe('Sumá al menos un producto.')
    expect(problemaDelTicket([renglon(mate)], [{ medio: 'EFECTIVO', monto: 40000 }])).toBeNull()
  })

  it('los totales: subtotal, recargo y total a cobrar', () => {
    expect(totalesDelTicket([renglon(mate)], [{ medio: 'CREDITO', monto: 40000, planId: 'club-del-este-1' }])).toEqual({
      subtotal: 40000, recargo: 2000, total: 42000, falta: 0,
    })
  })
})

describe('registrar y borrar el ticket', () => {
  it('guarda todos los renglones juntos y descuenta el stock de cada producto, aunque se repita', async () => {
    const mate = prod('TM015', 40000, 18000, 3)
    await db.productos.put(mate)
    const { ticketId, filas } = await registrarTicket(
      JORNADA,
      [renglon(mate), renglon(mate, 1, 38000), renglon(prod('XX', 5000, null, null))],
      [{ medio: 'EFECTIVO', monto: 83000 }],
      '11:00',
    )
    expect(filas).toHaveLength(3)
    expect(await db.ventas.where('jornadaId').equals('j1').count()).toBe(3)
    expect((await db.productos.get('TM015'))?.stock).toBe(1)

    expect(await borrarTicket({ jornadaId: 'j1', ticketId }, 'prueba', null)).toBe(3)
    expect(await db.ventas.count()).toBe(0)
    expect((await db.productos.get('TM015'))?.stock).toBe(3)
  })

  it('un ticket con problema no guarda nada', async () => {
    await expect(
      registrarTicket(JORNADA, [renglon(prod('TM015', 40000, 18000, 3))], [{ medio: 'EFECTIVO', monto: 1 }], '11:00'),
    ).rejects.toThrow(/Faltan/)
    expect(await db.ventas.count()).toBe(0)
  })

  it('el ticket entero pasa al otro turno, o no pasa nada', async () => {
    const base = { fecha: '2026-11-06', cajaInicial: 0, vendedor: 'Sandra' }
    await db.jornadas.bulkPut([
      { ...base, id: 'j1', turno: 'M', estado: 'abierto' },
      { ...base, id: 'j2', turno: 'T', estado: 'abierto' },
    ] as never)
    const mate = prod('TM015', 40000, 18000, null)
    const { ticketId } = await registrarTicket(
      JORNADA,
      [renglon(mate), renglon(prod('XX', 5000, null, null))],
      [{ medio: 'CREDITO', monto: 45000, planId: 'consumax-3' }],
      '11:00',
    )
    expect(await moverTicket({ jornadaId: 'j1', ticketId }, 'j2')).toBe(3)
    expect(await db.ventas.where('jornadaId').equals('j2').count()).toBe(3)

    // Con el turno de destino cerrado no se mueve ni un renglon.
    await db.jornadas.update('j1', { estado: 'cerrado' })
    await expect(moverTicket({ jornadaId: 'j2', ticketId }, 'j1')).rejects.toThrow(/cerrado/)
    expect(await db.ventas.where('jornadaId').equals('j2').count()).toBe(3)
  })
})

describe('lo que se sube al servidor', () => {
  it('ningun valor queda undefined adentro de los pagos: Firestore no lo acepta', () => {
    const filas = armarTicket(
      JORNADA,
      [renglon(prod('A', 30000, 1, null)), renglon(prod('B', 20000, 1, null))],
      [
        { medio: 'EFECTIVO', monto: 40000 },
        { medio: 'CREDITO', monto: 10000, planId: 'club-del-este-1' },
      ],
      '11:00',
      ids(2),
    )
    const tieneUndefined = (x: unknown): boolean =>
      x === undefined ||
      (Array.isArray(x) ? x.some(tieneUndefined) : x !== null && typeof x === 'object' && Object.values(x).some(tieneUndefined))
    for (const f of filas) expect(tieneUndefined(f.pagos)).toBe(false)
    // El segundo renglon se pago una parte en efectivo y otra con la tarjeta.
    expect(filas.map((f) => f.pagos?.length ?? 0)).toEqual([0, 2, 1])
  })
})
