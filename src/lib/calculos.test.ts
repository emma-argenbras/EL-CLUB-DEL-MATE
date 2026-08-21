import { describe, expect, it } from 'vitest'
import type { Movimiento, Producto, Venta } from '../db/db'
import {
  arqueoVacio,
  costoDesactualizado,
  desglosarGastos,
  margenPorcentual,
  margenUnitario,
  precioBajoCosto,
  precioSugerido,
  redondearPrecio,
  resumirJornada,
  resumirMes,
  sinStock,
  totalArqueo,
} from './calculos'

function venta(parcial: Partial<Venta>): Venta {
  return {
    id: 'v1',
    jornadaId: 'j1',
    fecha: '2026-07-01',
    hora: '10:00',
    codigo: 'COD1',
    descripcion: 'Producto',
    cantidad: 1,
    precioUnitario: 1000,
    costoUnitario: 500,
    medioPago: 'EFECTIVO',
    total: 1000,
    vendedor: null,
    ...parcial,
  }
}

function movimiento(parcial: Partial<Movimiento>): Movimiento {
  return {
    id: 'm1',
    fecha: '2026-07-01',
    tipo: 'EGRESO_CAJA',
    concepto: 'Gasto',
    monto: 100,
    categoria: null,
    jornadaId: 'j1',
    esVariable: true,
    ...parcial,
  }
}

function producto(parcial: Partial<Producto>): Producto {
  return {
    codigo: 'COD1',
    descripcion: 'Producto',
    proveedor: null,
    proveedorId: null,
    fechaCompra: null,
    precioCompra: null,
    rentabilidad: null,
    precioVenta: null,
    fechaPrecioVenta: null,
    busqueda: 'producto',
    stock: null,
    activo: true,
    ...parcial,
  }
}

describe('totalArqueo', () => {
  it('suma billetes por denominacion mas monedas', () => {
    const total = totalArqueo({ billetes: { '2000': 3, '500': 2 }, monedas: 150 })
    expect(total).toBe(2000 * 3 + 500 * 2 + 150)
  })

  it('un arqueo vacio da cero', () => {
    expect(totalArqueo(arqueoVacio())).toBe(0)
  })

  it('null o undefined dan cero, no explotan', () => {
    expect(totalArqueo(null)).toBe(0)
    expect(totalArqueo(undefined)).toBe(0)
  })
})

describe('redondearPrecio', () => {
  it('redondea siempre para arriba, al multiplo de 100 mas cercano', () => {
    expect(redondearPrecio(8819.2)).toBe(8900)
    expect(redondearPrecio(8801)).toBe(8900)
    expect(redondearPrecio(8800)).toBe(8800)
  })
})

describe('precioSugerido', () => {
  it('aplica el markup sobre el costo', () => {
    expect(precioSugerido(producto({ precioCompra: 1000, rentabilidad: 0.3 }))).toBe(1300)
  })

  it('redondea para arriba a un numero facil de cobrar, sin decimales', () => {
    // 3328 * 2.65 = 8819.2 -> nunca se cobra de menos, y sin sueltos.
    expect(precioSugerido(producto({ precioCompra: 3328, rentabilidad: 1.65 }))).toBe(8900)
  })

  it('sin costo o sin rentabilidad cargados, no sugiere nada', () => {
    expect(precioSugerido(producto({ precioCompra: null, rentabilidad: 0.3 }))).toBeNull()
    expect(precioSugerido(producto({ precioCompra: 1000, rentabilidad: null }))).toBeNull()
  })
})

describe('margenUnitario y margenPorcentual', () => {
  it('calculan la diferencia y el porcentaje sobre la venta', () => {
    expect(margenUnitario(1000, 600)).toBe(400)
    expect(margenPorcentual(1000, 600)).toBeCloseTo(40)
  })

  it('sin costo cargado, no hay margen calculable', () => {
    expect(margenUnitario(1000, null)).toBeNull()
    expect(margenPorcentual(1000, null)).toBeNull()
  })
})

describe('resumirJornada', () => {
  it('separa efectivo de banco y calcula el cierre esperado', () => {
    const resumen = resumirJornada(
      10000,
      [
        venta({ id: 'v1', medioPago: 'EFECTIVO', total: 1000, cantidad: 1, costoUnitario: 600 }),
        venta({ id: 'v2', medioPago: 'TRANSFERENCIA', total: 2000, cantidad: 1, costoUnitario: 1200 }),
      ],
      [
        movimiento({ id: 'm1', tipo: 'EGRESO_CAJA', monto: 300 }),
        movimiento({ id: 'm2', tipo: 'A_CAJA_GRANDE', monto: 5000 }),
      ],
    )

    expect(resumen.efectivo).toBe(1000)
    expect(resumen.banco).toBe(2000)
    expect(resumen.totalVentas).toBe(3000)
    expect(resumen.costoMercaderia).toBe(1800)
    expect(resumen.margenBruto).toBe(1200)
    expect(resumen.egresosCaja).toBe(300)
    expect(resumen.aCajaGrande).toBe(5000)
    // Caja inicial + efectivo vendido - egresos - lo pasado a caja grande.
    expect(resumen.cierreEsperado).toBe(10000 + 1000 - 300 - 5000)
  })

  it('cuenta las ventas sin costo cargado, para poder avisar', () => {
    const resumen = resumirJornada(0, [venta({ costoUnitario: null })], [])
    expect(resumen.ventasSinCosto).toBe(1)
    expect(resumen.costoMercaderia).toBe(0)
  })
})

describe('resumirMes', () => {
  it('separa gastos fijos de variables para el margen de contribucion', () => {
    const resumen = resumirMes(
      [venta({ fecha: '2026-07-01', total: 1000, cantidad: 1, costoUnitario: 400, medioPago: 'EFECTIVO' })],
      [
        movimiento({ tipo: 'GASTO_CAJA_GRANDE', monto: 200, esVariable: true }),
        movimiento({ tipo: 'GASTO_CAJA_GRANDE', monto: 300, esVariable: false }),
      ],
    )

    // Ventas (1000) - costo mercaderia (400) - gastos variables (200).
    expect(resumen.margenContribucion).toBe(400)
    expect(resumen.gastosVariables).toBe(200)
    expect(resumen.gastosFijos).toBe(300)
    // Margen de contribucion (400) - gastos fijos (300).
    expect(resumen.resultado).toBe(100)
  })

  it('cuenta dias distintos con ventas, no ventas', () => {
    const resumen = resumirMes(
      [
        venta({ id: 'v1', fecha: '2026-07-01' }),
        venta({ id: 'v2', fecha: '2026-07-01' }),
        venta({ id: 'v3', fecha: '2026-07-02' }),
      ],
      [],
    )
    expect(resumen.diasConVentas).toBe(2)
    expect(resumen.operaciones).toBe(3)
  })

  it('sin ventas, el porcentaje de margen no divide por cero', () => {
    const resumen = resumirMes([], [])
    expect(resumen.margenContribucionPorcentual).toBe(0)
  })
})

describe('costoDesactualizado', () => {
  it('sin precio de compra o sin fecha, se considera desactualizado', () => {
    expect(costoDesactualizado(producto({ precioCompra: null, fechaCompra: '2026-07-01' }))).toBe(true)
    expect(costoDesactualizado(producto({ precioCompra: 100, fechaCompra: null }))).toBe(true)
  })

  it('una compra reciente no esta desactualizada', () => {
    const hoy = new Date().toISOString().slice(0, 10)
    expect(costoDesactualizado(producto({ precioCompra: 100, fechaCompra: hoy }))).toBe(false)
  })

  it('una compra de hace mas de 6 meses si esta desactualizada', () => {
    const vieja = new Date()
    vieja.setMonth(vieja.getMonth() - 7)
    expect(
      costoDesactualizado(producto({ precioCompra: 100, fechaCompra: vieja.toISOString().slice(0, 10) })),
    ).toBe(true)
  })

  it('un producto descontinuado nunca se marca como desactualizado, aunque le falte todo', () => {
    expect(
      costoDesactualizado(
        producto({ precioCompra: null, fechaCompra: null, descontinuado: true }),
      ),
    ).toBe(false)
    const vieja = new Date()
    vieja.setMonth(vieja.getMonth() - 24)
    expect(
      costoDesactualizado(
        producto({
          precioCompra: 100,
          fechaCompra: vieja.toISOString().slice(0, 10),
          descontinuado: true,
        }),
      ),
    ).toBe(false)
  })
})

describe('sinStock', () => {
  it('un producto sin control de stock nunca esta agotado', () => {
    expect(sinStock(producto({ stock: null }))).toBe(false)
  })

  it('con stock disponible no esta agotado', () => {
    expect(sinStock(producto({ stock: 3 }))).toBe(false)
  })

  it('en cero esta agotado', () => {
    expect(sinStock(producto({ stock: 0 }))).toBe(true)
  })

  it('en negativo tambien avisa: se vendio mas de lo que habia cargado', () => {
    expect(sinStock(producto({ stock: -2 }))).toBe(true)
  })

  it('un producto archivado no molesta con avisos de stock', () => {
    expect(sinStock(producto({ stock: 0, archivado: true }))).toBe(false)
  })
})

describe('precioBajoCosto', () => {
  it('avisa cuando el precio de venta no llega a cubrir el costo', () => {
    expect(precioBajoCosto(producto({ precioCompra: 12500, precioVenta: 8750 }))).toBe(true)
  })

  it('vender justo al costo tambien cuenta: no deja nada', () => {
    expect(precioBajoCosto(producto({ precioCompra: 2700, precioVenta: 2700 }))).toBe(true)
  })

  it('con margen normal no avisa', () => {
    expect(precioBajoCosto(producto({ precioCompra: 1000, precioVenta: 2300 }))).toBe(false)
  })

  it('sin costo o sin precio de venta cargado no se puede saber, y no avisa', () => {
    expect(precioBajoCosto(producto({ precioCompra: null, precioVenta: 2300 }))).toBe(false)
    expect(precioBajoCosto(producto({ precioCompra: 1000, precioVenta: null }))).toBe(false)
  })

  it('un producto archivado no molesta mas', () => {
    expect(
      precioBajoCosto(producto({ precioCompra: 12500, precioVenta: 8750, archivado: true })),
    ).toBe(false)
  })
})

describe('desglosarGastos', () => {
  it('separa fijos de variables y agrupa por categoria', () => {
    const d = desglosarGastos([
      movimiento({ id: 'a', categoria: 'ALQUILER', monto: 1150000, esVariable: false }),
      movimiento({ id: 'b', categoria: 'SERVICIOS', monto: 64000, esVariable: false }),
      movimiento({ id: 'c', categoria: 'PROVEEDORES', monto: 200000, esVariable: true }),
      movimiento({ id: 'd', categoria: 'PROVEEDORES', monto: 100000, esVariable: true }),
    ])

    expect(d.fijos.total).toBe(1214000)
    expect(d.variables.total).toBe(300000)
    expect(d.total).toBe(1514000)
    // Las dos compras al mismo proveedor quedan juntas en una categoria.
    expect(d.variables.categorias).toHaveLength(1)
    expect(d.variables.categorias[0].categoria).toBe('PROVEEDORES')
    expect(d.variables.categorias[0].movimientos).toHaveLength(2)
  })

  it('ordena las categorias de mayor a menor', () => {
    const d = desglosarGastos([
      movimiento({ id: 'a', categoria: 'SERVICIOS', monto: 64000, esVariable: false }),
      movimiento({ id: 'b', categoria: 'ALQUILER', monto: 1150000, esVariable: false }),
    ])
    expect(d.fijos.categorias.map((c) => c.categoria)).toEqual(['ALQUILER', 'SERVICIOS'])
  })

  it('calcula cuanto pesa cada categoria dentro de su grupo', () => {
    const d = desglosarGastos([
      movimiento({ id: 'a', categoria: 'ALQUILER', monto: 750, esVariable: false }),
      movimiento({ id: 'b', categoria: 'SERVICIOS', monto: 250, esVariable: false }),
    ])
    expect(d.fijos.categorias[0].porcentaje).toBe(75)
    expect(d.fijos.categorias[1].porcentaje).toBe(25)
  })

  it('un pase a caja grande no es un gasto: es plata que cambia de lugar', () => {
    const d = desglosarGastos([
      movimiento({ id: 'a', tipo: 'A_CAJA_GRANDE', monto: 400000, categoria: null }),
      movimiento({ id: 'b', tipo: 'INGRESO_CAJA_GRANDE', monto: 50000, categoria: null }),
    ])
    expect(d.total).toBe(0)
  })

  it('distingue el egreso de la caja del turno del gasto de caja grande', () => {
    const d = desglosarGastos([
      movimiento({ id: 'a', tipo: 'EGRESO_CAJA', categoria: 'OTROS', monto: 3000, esVariable: true }),
    ])
    expect(d.variables.categorias[0].movimientos[0].deLaCaja).toBe(true)
  })

  it('un gasto sin categoria cae en OTROS y no se pierde', () => {
    const d = desglosarGastos([movimiento({ id: 'a', categoria: null, monto: 500 })])
    expect(d.variables.categorias[0].categoria).toBe('OTROS')
    expect(d.total).toBe(500)
  })

  it('sin gastos, no divide por cero', () => {
    const d = desglosarGastos([])
    expect(d.total).toBe(0)
    expect(d.fijos.categorias).toEqual([])
  })
})
