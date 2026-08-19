import {
  type Arqueo,
  type Movimiento,
  type Producto,
  type Venta,
  MEDIOS_BANCO,
} from '../db/db'

/**
 * Denominaciones de billetes en circulacion.
 * El arqueo se carga por CANTIDAD de billetes y la app hace la cuenta:
 * es mas rapido y evita el error de sumar mal a mano.
 */
export const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10]

export function arqueoVacio(): Arqueo {
  const billetes: Record<string, number> = {}
  for (const d of DENOMINACIONES) billetes[String(d)] = 0
  return { billetes, monedas: 0 }
}

export function totalArqueo(arqueo: Arqueo | null | undefined): number {
  if (!arqueo) return 0
  let total = arqueo.monedas || 0
  for (const [denominacion, cantidad] of Object.entries(arqueo.billetes || {})) {
    total += Number(denominacion) * (cantidad || 0)
  }
  return total
}

/** Precio de venta sugerido segun el markup objetivo del producto. */
export function precioSugerido(producto: Producto): number | null {
  if (!producto.precioCompra || !producto.rentabilidad) return null
  return Math.round(producto.precioCompra * (1 + producto.rentabilidad))
}

/** Margen unitario en pesos: lo que deja el producto por unidad. */
export function margenUnitario(precioVenta: number, costo: number | null): number | null {
  if (costo === null || costo === undefined) return null
  return precioVenta - costo
}

/** Margen sobre la venta, en porcentaje. */
export function margenPorcentual(precioVenta: number, costo: number | null): number | null {
  if (costo === null || costo === undefined || precioVenta <= 0) return null
  return ((precioVenta - costo) / precioVenta) * 100
}

export interface ResumenJornada {
  efectivo: number
  banco: number
  totalVentas: number
  unidades: number
  costoMercaderia: number
  /** Ventas menos costo de la mercaderia vendida. */
  margenBruto: number
  egresosCaja: number
  aCajaGrande: number
  /** Efectivo que deberia haber en la caja al cerrar. */
  cierreEsperado: number
  /** Cuantas ventas no tienen costo cargado (ensucian el margen). */
  ventasSinCosto: number
}

export function resumirJornada(
  cajaInicial: number,
  ventas: Venta[],
  movimientos: Movimiento[],
): ResumenJornada {
  let efectivo = 0
  let banco = 0
  let unidades = 0
  let costoMercaderia = 0
  let ventasSinCosto = 0

  for (const v of ventas) {
    if (v.medioPago === 'EFECTIVO') efectivo += v.total
    else if (MEDIOS_BANCO.includes(v.medioPago)) banco += v.total
    unidades += v.cantidad
    if (v.costoUnitario === null || v.costoUnitario === undefined) ventasSinCosto += 1
    else costoMercaderia += v.costoUnitario * v.cantidad
  }

  const egresosCaja = movimientos
    .filter((m) => m.tipo === 'EGRESO_CAJA')
    .reduce((suma, m) => suma + m.monto, 0)
  const aCajaGrande = movimientos
    .filter((m) => m.tipo === 'A_CAJA_GRANDE')
    .reduce((suma, m) => suma + m.monto, 0)

  const totalVentas = efectivo + banco

  return {
    efectivo,
    banco,
    totalVentas,
    unidades,
    costoMercaderia,
    margenBruto: totalVentas - costoMercaderia,
    egresosCaja,
    aCajaGrande,
    cierreEsperado: cajaInicial + efectivo - egresosCaja - aCajaGrande,
    ventasSinCosto,
  }
}

export interface ResumenMes {
  ventasEfectivo: number
  ventasBanco: number
  ventasTotales: number
  unidades: number
  operaciones: number
  costoMercaderia: number
  /** Ventas - costo de mercaderia - gastos variables. */
  margenContribucion: number
  margenContribucionPorcentual: number
  gastosVariables: number
  gastosFijos: number
  /** Margen de contribucion menos gastos fijos: el resultado del mes. */
  resultado: number
  ventasSinCosto: number
  montoSinCosto: number
  diasConVentas: number
}

export function resumirMes(ventas: Venta[], movimientos: Movimiento[]): ResumenMes {
  let ventasEfectivo = 0
  let ventasBanco = 0
  let unidades = 0
  let costoMercaderia = 0
  let ventasSinCosto = 0
  let montoSinCosto = 0
  const dias = new Set<string>()

  for (const v of ventas) {
    if (v.medioPago === 'EFECTIVO') ventasEfectivo += v.total
    else ventasBanco += v.total
    unidades += v.cantidad
    dias.add(v.fecha)
    if (v.costoUnitario === null || v.costoUnitario === undefined) {
      ventasSinCosto += 1
      montoSinCosto += v.total
    } else {
      costoMercaderia += v.costoUnitario * v.cantidad
    }
  }

  const gastos = movimientos.filter(
    (m) => m.tipo === 'GASTO_CAJA_GRANDE' || m.tipo === 'EGRESO_CAJA',
  )
  const gastosVariables = gastos
    .filter((m) => m.esVariable)
    .reduce((suma, m) => suma + m.monto, 0)
  const gastosFijos = gastos
    .filter((m) => !m.esVariable)
    .reduce((suma, m) => suma + m.monto, 0)

  const ventasTotales = ventasEfectivo + ventasBanco
  const margenContribucion = ventasTotales - costoMercaderia - gastosVariables

  return {
    ventasEfectivo,
    ventasBanco,
    ventasTotales,
    unidades,
    operaciones: ventas.length,
    costoMercaderia,
    margenContribucion,
    margenContribucionPorcentual:
      ventasTotales > 0 ? (margenContribucion / ventasTotales) * 100 : 0,
    gastosVariables,
    gastosFijos,
    resultado: margenContribucion - gastosFijos,
    ventasSinCosto,
    montoSinCosto,
    diasConVentas: dias.size,
  }
}

/**
 * Un costo de compra viejo infla el margen: si el precio de venta se
 * actualizo por inflacion y el de compra no, la ganancia parece mayor
 * de lo que es. Marcamos los productos con costo desactualizado.
 */
export function costoDesactualizado(producto: Producto, mesesLimite = 6): boolean {
  // Descontinuado a proposito: nadie va a actualizar el costo de algo
  // que no se vuelve a comprar, asi que no tiene sentido seguir avisando.
  if (producto.descontinuado) return false
  if (!producto.precioCompra) return true
  if (!producto.fechaCompra) return true
  const compra = new Date(producto.fechaCompra)
  if (Number.isNaN(compra.getTime())) return true
  const limite = new Date()
  limite.setMonth(limite.getMonth() - mesesLimite)
  return compra < limite
}
