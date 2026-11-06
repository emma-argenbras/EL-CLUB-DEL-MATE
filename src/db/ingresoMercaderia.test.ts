import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type MovimientoProveedor, type Producto } from './db'
import {
  cambiosDeCosto,
  comprasDeProducto,
  paraRemarcar,
  problemaDelIngreso,
  registrarIngreso,
  remarcar,
  repartirFlete,
  type RenglonIngreso,
} from './ingresoMercaderia'

function prod(codigo: string, precioCompra: number | null, precioVenta: number | null, stock: number | null, rentabilidad: number | null = 1): Producto {
  return {
    codigo, descripcion: `PRODUCTO ${codigo}`, proveedor: null, proveedorId: null, fechaCompra: null,
    precioCompra, rentabilidad, precioVenta, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock, activo: true,
  }
}
const renglon = (p: Producto, cantidad: number, costoUnitario: number): RenglonIngreso => ({ producto: p, cantidad, costoUnitario })

beforeEach(async () => {
  await Promise.all([db.productos.clear(), db.movimientosProveedor.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('repartir el flete', () => {
  it('por costo: un mate de $ 40.000 carga diez veces más que una bombilla de $ 4.000', () => {
    const { porRenglon, porUnidad } = repartirFlete(
      [
        { cantidad: 1, costoUnitario: 40000 },
        { cantidad: 1, costoUnitario: 4000 },
      ],
      11000,
      'costo',
    )
    expect(porRenglon).toEqual([10000, 1000])
    expect(porUnidad).toEqual([10000, 1000])
  })

  it('por unidades: cada unidad carga lo mismo', () => {
    const { porRenglon, porUnidad } = repartirFlete(
      [
        { cantidad: 6, costoUnitario: 40000 },
        { cantidad: 4, costoUnitario: 4000 },
      ],
      5000,
      'unidades',
    )
    expect(porUnidad).toEqual([500, 500])
    expect(porRenglon).toEqual([3000, 2000])
  })

  it('suma exacto el flete, al centavo, aunque no divida justo', () => {
    const r = repartirFlete(
      [
        { cantidad: 3, costoUnitario: 1000 },
        { cantidad: 3, costoUnitario: 1000 },
        { cantidad: 3, costoUnitario: 1000 },
      ],
      1000,
      'costo',
    )
    expect(Math.round(r.porRenglon.reduce((s, x) => s + x, 0) * 100)).toBe(100000)
    expect(r.porRenglon).toEqual([333.34, 333.33, 333.33])
  })

  it('si todo vino bonificado (costo 0), por costo reparte por unidades', () => {
    expect(repartirFlete([{ cantidad: 2, costoUnitario: 0 }, { cantidad: 2, costoUnitario: 0 }], 400, 'costo').porUnidad).toEqual([100, 100])
  })

  it('sin flete, nada', () => {
    expect(repartirFlete([{ cantidad: 2, costoUnitario: 10 }], 0, 'costo').porUnidad).toEqual([0])
  })
})

describe('lo que le falta al ingreso', () => {
  it('sin proveedor, sin productos, sin cantidad, sin costo o con flete negativo, no se registra', () => {
    expect(problemaDelIngreso(null, [{ cantidad: 1, costoUnitario: 1 }], 0)).toMatch(/proveedor/)
    expect(problemaDelIngreso('p', [], 0)).toMatch(/al menos un producto/)
    expect(problemaDelIngreso('p', [{ cantidad: 0, costoUnitario: 1 }], 0)).toMatch(/cantidad/)
    expect(problemaDelIngreso('p', [{ cantidad: 1, costoUnitario: Number.NaN }], 0)).toMatch(/costo/)
    expect(problemaDelIngreso('p', [{ cantidad: 1, costoUnitario: 1 }], -5)).toMatch(/flete/)
    expect(problemaDelIngreso('p', [{ cantidad: 1, costoUnitario: 0 }], 0)).toBeNull()
  })
})

describe('qué subió de costo y a cuánto habría que venderlo', () => {
  it('con el flete adentro, la variación y el precio que pide su rentabilidad', () => {
    const mate = prod('M', 18000, 36000, 0, 1)
    const bombilla = prod('B', 4000, 9000, 0, 1)
    const yerbera = prod('Y', 10000, 25000, 0, 1)
    const { subieron, todos } = cambiosDeCosto(
      [renglon(mate, 1, 20000), renglon(bombilla, 1, 4000), renglon(yerbera, 1, 11000)],
      [1000, 0, 0],
    )
    expect(todos.map((c) => c.ahora)).toEqual([21000, 4000, 11000])
    expect(subieron.map((c) => c.codigo)).toEqual(['M', 'Y'])
    expect(subieron[0].variacion).toBe(16.67)
    expect(subieron[0].sugerido).toBe(42000)
    // La yerbera subió, pero a $ 25.000 todavía cubre su rentabilidad ($ 22.000): no se remarca.
    expect(paraRemarcar(subieron).map((c) => c.codigo)).toEqual(['M'])
  })

  it('con la misma vara que el aviso del Panel: 5 % de tolerancia, y un descontinuado no se remarca', () => {
    const casi = prod('C', 20000, 43000, 0, 1) // pide $ 44.000: le falta menos del 5 %
    const liquidando = { ...prod('L', 20000, 30000, 0, 1), descontinuado: true }
    const { subieron } = cambiosDeCosto([renglon(casi, 1, 22000), renglon(liquidando, 1, 22000)], [0, 0])
    expect(subieron).toHaveLength(2)
    expect(paraRemarcar(subieron)).toEqual([])
  })

  it('sin rentabilidad cargada no hay precio sugerido, y no se remarca', () => {
    const { subieron } = cambiosDeCosto([renglon(prod('X', 100, 200, 0, null), 1, 150)], [0])
    expect(subieron[0].sugerido).toBeNull()
    expect(paraRemarcar(subieron)).toEqual([])
  })
})

describe('registrar el ingreso', () => {
  it('suma el stock, deja el costo con flete, y al proveedor le debe la mercadería sin flete', async () => {
    await db.productos.bulkPut([prod('M', 18000, 36000, 2), prod('B', 4000, 9000, null)])
    const { id } = await registrarIngreso({
      proveedor: { id: 'arandu', nombre: 'ARANDU' },
      fecha: '2026-11-06',
      comprobante: ' R-0001 ',
      notas: '',
      renglones: [renglon(prod('M', 18000, 36000, 2), 3, 20000), renglon(prod('B', 4000, 9000, null), 10, 4000)],
      flete: { monto: 10000, criterio: 'costo', transportista: 'Vía Cargo' },
      quien: 'ventas@elclubdelmate.com',
    })
    const mov = (await db.movimientosProveedor.get(id))!
    expect(mov.monto).toBe(100000)
    expect(mov.comprobante).toBe('R-0001')
    expect(mov.flete).toEqual({ monto: 10000, criterio: 'costo', transportista: 'Vía Cargo' })
    expect(mov.items?.map((it) => [it.codigo, it.costoUnitario, it.costoConFlete])).toEqual([
      ['M', 20000, 22000],
      ['B', 4000, 4400],
    ])
    const m = (await db.productos.get('M'))!
    expect([m.stock, m.precioCompra, m.fechaCompra]).toEqual([5, 22000, '2026-11-06'])
    const b = (await db.productos.get('B'))!
    expect([b.stock, b.precioCompra]).toEqual([10, 4400])
  })

  it('el costo que cambió queda en el historial con el motivo del ingreso', async () => {
    await db.productos.put(prod('M', 18000, 36000, 0))
    await registrarIngreso({
      proveedor: { id: 'arandu', nombre: 'ARANDU' }, fecha: '2026-11-06', comprobante: 'F 12', notas: null,
      renglones: [renglon(prod('M', 18000, 36000, 0), 1, 20000)], flete: null, quien: null,
    })
    await historialAlDia()
    const costo = (await db.historial.toArray()).find((h) => h.campo === 'precioCompra')
    expect(costo?.motivo).toBe('Ingreso de mercadería de ARANDU (F 12)')
    expect(costo?.valorNuevo).toBe(20000)
  })

  it('un ingreso con problema no toca nada', async () => {
    await db.productos.put(prod('M', 18000, 36000, 2))
    await expect(
      registrarIngreso({
        proveedor: { id: '', nombre: '' }, fecha: '2026-11-06', comprobante: null, notas: null,
        renglones: [renglon(prod('M', 18000, 36000, 2), 3, 20000)], flete: null, quien: null,
      }),
    ).rejects.toThrow(/proveedor/)
    expect(await db.movimientosProveedor.count()).toBe(0)
    expect((await db.productos.get('M'))?.stock).toBe(2)
  })

  it('ningún valor queda undefined adentro del flete: Firestore no lo acepta', async () => {
    await db.productos.put(prod('M', 1, 2, 0))
    const { id } = await registrarIngreso({
      proveedor: { id: 'p', nombre: 'P' }, fecha: '2026-11-06', comprobante: null, notas: null,
      renglones: [renglon(prod('M', 1, 2, 0), 1, 100)],
      flete: { monto: 50, criterio: 'unidades', transportista: undefined as unknown as null },
      quien: null,
    })
    const mov = (await db.movimientosProveedor.get(id))!
    expect(Object.values(mov.flete!).some((v) => v === undefined)).toBe(false)
    expect(mov.items!.some((it) => Object.values(it).some((v) => v === undefined))).toBe(false)
  })
})

describe('remarcar', () => {
  it('pone el precio nuevo con la fecha de hoy, con motivo, y saltea lo que ya estaba', async () => {
    await db.productos.bulkPut([prod('M', 21000, 36000, 0), prod('B', 4000, 9000, 0)])
    expect(
      await remarcar(
        [
          { codigo: 'M', precioNuevo: 42000 },
          { codigo: 'B', precioNuevo: 9000 },
        ],
        'Remarcado al ingresar mercadería de ARANDU',
      ),
    ).toBe(1)
    const m = (await db.productos.get('M'))!
    expect(m.precioVenta).toBe(42000)
    expect(m.fechaPrecioVenta).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await historialAlDia()
    expect((await db.historial.toArray()).find((h) => h.campo === 'precioVenta')?.motivo).toBe(
      'Remarcado al ingresar mercadería de ARANDU',
    )
  })
})

describe('las compras de un producto', () => {
  it('de la más nueva a la más vieja, con su costo con flete', () => {
    const mov = (id: string, fecha: string, items: MovimientoProveedor['items']): MovimientoProveedor => ({
      id, proveedorId: `prov-${id}`, tipo: 'compra', fecha, monto: 0, medioPago: null, items, notas: null,
    })
    const lista = comprasDeProducto('M', [
      mov('a', '2026-09-01', [{ codigo: 'M', descripcion: 'M', cantidad: 2, costoUnitario: 15000 }]),
      mov('b', '2026-11-06', [{ codigo: 'M', descripcion: 'M', cantidad: 3, costoUnitario: 20000, costoConFlete: 22000 }]),
      mov('c', '2026-10-01', [{ codigo: 'X', descripcion: 'X', cantidad: 1, costoUnitario: 1 }]),
      { ...mov('d', '2026-10-02', null), tipo: 'pago' },
    ])
    expect(lista.map((c) => [c.fecha, c.proveedorId, c.costoConFlete])).toEqual([
      ['2026-11-06', 'prov-b', 22000],
      ['2026-09-01', 'prov-a', null],
    ])
  })
})
