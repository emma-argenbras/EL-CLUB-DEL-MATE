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

/**
 * Redondea siempre para arriba, a un multiplo de 100: nunca a favor
 * nuestro por error de redondeo, y un numero facil de cobrar en el
 * momento (sin decimales sueltos).
 */
export function redondearPrecio(monto: number): number {
  return Math.ceil(monto / 100) * 100
}

/** Precio de venta sugerido segun el markup objetivo del producto. */
export function precioSugerido(producto: Producto): number | null {
  if (!producto.precioCompra || !producto.rentabilidad) return null
  return redondearPrecio(producto.precioCompra * (1 + producto.rentabilidad))
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
 * Se quedo sin stock. Solo aplica a los productos que llevan control
 * (stock null = no se controla, no es que este agotado). Un numero
 * negativo tambien cuenta: significa que se vendio mas de lo que la app
 * creia que habia, y hay que revisarlo igual.
 */
export function sinStock(producto: Producto): boolean {
  if (producto.stock === null || producto.stock === undefined) return false
  if (producto.archivado) return false
  // Un producto descontinuado no se repone: avisar que "hay que
  // reponerlo" es pedirle a alguien algo que no puede hacer.
  if (producto.descontinuado) return false
  return producto.stock <= 0
}

/**
 * Se esta vendiendo al costo o por debajo: cada unidad que sale es plata
 * perdida. Suele pasar cuando el proveedor aumenta y el precio de venta
 * queda sin actualizar. A diferencia del costo vencido, aca el problema
 * no es el dato sino el precio: hay que corregirlo si o si.
 */
/**
 * Hace mucho que nadie toca el precio de VENTA de este producto.
 *
 * Es un problema distinto del costo vencido, y conviene no mezclarlos:
 *
 *   - costo vencido      -> el margen del reporte miente, porque el
 *                           costo cargado es mas viejo que el real.
 *   - precio vencido     -> se esta cobrando de menos, porque el precio
 *                           quedo planchado mientras todo aumentaba.
 *
 * En la planilla de precios son dos fechas separadas justamente por
 * esto: la fecha del costo cambia cuando se le compra al proveedor, y
 * la del precio de venta cambia cuando se remarca, se haya comprado o no.
 */
export function precioDesactualizado(producto: Producto, mesesLimite = 12): boolean {
  if (producto.archivado) return false
  // Igual que con el costo: a nadie le sirve que le reclamen remarcar
  // algo que esta dejando de vender.
  if (producto.descontinuado) return false
  // Un producto sin precio de venta no es "precio viejo", es otra cosa
  // (no se puede vender), y ya se avisa por otro lado.
  if (!producto.precioVenta) return false
  if (!producto.fechaPrecioVenta) return true
  const puesto = new Date(producto.fechaPrecioVenta)
  if (Number.isNaN(puesto.getTime())) return true
  const limite = new Date()
  limite.setMonth(limite.getMonth() - mesesLimite)
  return puesto < limite
}

/**
 * Cuanto le falta al precio de venta para llegar al que sale de su
 * propia rentabilidad. Devuelve null cuando no se puede calcular o
 * cuando el precio ya esta donde tiene que estar.
 *
 * Esta es la senal mas afilada de las tres, porque no depende de
 * ninguna fecha: compara el precio que hay con el que la propia
 * planilla dice que deberia haber. Si el costo esta al dia y el precio
 * quedo atras, aparece aca aunque las dos fechas sean recientes.
 */
export function precioAtrasado(
  producto: Producto,
  tolerancia = 0.05,
): { actual: number; sugerido: number; falta: number } | null {
  if (producto.archivado) return null
  // Un descontinuado se esta liquidando: que quede por debajo de su
  // markup puede ser a proposito.
  if (producto.descontinuado) return null
  const { precioCompra: compra, rentabilidad: rent, precioVenta: venta } = producto
  if (!compra || !rent || !venta) return null
  const sugerido = redondearPrecio(compra * (1 + rent))
  // Una diferencia chica es redondeo o una decision de precio, no un
  // olvido: recien se avisa cuando se despego de verdad.
  if (venta >= sugerido * (1 - tolerancia)) return null
  return { actual: venta, sugerido, falta: sugerido - venta }
}

export function precioBajoCosto(producto: Producto): boolean {
  if (producto.archivado) return false
  if (!producto.precioCompra || !producto.precioVenta) return false
  return producto.precioVenta <= producto.precioCompra
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

export interface GastoDetallado {
  concepto: string
  monto: number
  fecha: string
  /** Un egreso de caja sale del turno; un gasto grande, de la caja grande. */
  deLaCaja: boolean
}

export interface CategoriaGastada {
  categoria: string
  monto: number
  /** Cuanto pesa dentro de su grupo (fijos o variables). */
  porcentaje: number
  movimientos: GastoDetallado[]
}

export interface GrupoGastos {
  total: number
  categorias: CategoriaGastada[]
}

export interface DesgloseGastos {
  variables: GrupoGastos
  fijos: GrupoGastos
  total: number
}

/**
 * Abre los dos totales de gastos del mes para ver de que estan hechos.
 *
 * Se agrupa primero por fijo/variable —que es lo que cambia el calculo
 * del margen— y adentro por categoria, de mayor a menor: asi se ve de un
 * vistazo cual es el gasto que mas pesa en cada grupo.
 *
 * Toma los mismos movimientos que resumirMes: los gastos pagados con la
 * caja grande y los egresos chicos de la caja del turno. Los pases a
 * caja grande no son un gasto (es plata que cambia de lugar), y los
 * ingresos tampoco.
 */
export function desglosarGastos(movimientos: Movimiento[]): DesgloseGastos {
  const gastos = movimientos.filter(
    (m) => m.tipo === 'GASTO_CAJA_GRANDE' || m.tipo === 'EGRESO_CAJA',
  )

  function armarGrupo(deEsteGrupo: Movimiento[]): GrupoGastos {
    const total = deEsteGrupo.reduce((suma, m) => suma + m.monto, 0)
    const porCategoria = new Map<string, GastoDetallado[]>()

    for (const m of deEsteGrupo) {
      const categoria = m.categoria ?? 'OTROS'
      const detalle: GastoDetallado = {
        concepto: m.concepto,
        monto: m.monto,
        fecha: m.fecha,
        deLaCaja: m.tipo === 'EGRESO_CAJA',
      }
      const actual = porCategoria.get(categoria)
      if (actual) actual.push(detalle)
      else porCategoria.set(categoria, [detalle])
    }

    const categorias: CategoriaGastada[] = [...porCategoria.entries()]
      .map(([categoria, movs]) => {
        const monto = movs.reduce((suma, m) => suma + m.monto, 0)
        return {
          categoria,
          monto,
          porcentaje: total > 0 ? (monto / total) * 100 : 0,
          movimientos: movs.sort((a, b) => a.fecha.localeCompare(b.fecha)),
        }
      })
      .sort((a, b) => b.monto - a.monto)

    return { total, categorias }
  }

  const variables = armarGrupo(gastos.filter((m) => m.esVariable))
  const fijos = armarGrupo(gastos.filter((m) => !m.esVariable))

  return { variables, fijos, total: variables.total + fijos.total }
}

export interface ResumenDeUnMes extends ResumenMes {
  /** Mes en formato yyyy-mm. */
  mes: string
  /** El mes que todavia esta corriendo: no cerro, todavia le faltan dias. */
  enCurso: boolean
}

export interface ResumenAnual {
  anio: string
  /** Un renglon por cada mes que tuvo movimiento, del mas viejo al mas nuevo. */
  meses: ResumenDeUnMes[]
  /** El año entero, calculado igual que un mes. */
  total: ResumenMes
  mejorMes: ResumenDeUnMes | null
  peorMes: ResumenDeUnMes | null
  /** Promedio de ventas de los meses con actividad, ya cerrados. */
  promedioMensual: number
}

/**
 * El año completo, mes por mes y en total.
 *
 * Solo entran los meses que tuvieron algo cargado: un año recien
 * empezado no muestra diez meses en cero, que solo ensucian la
 * comparacion y el promedio.
 */
export function resumirAnio(
  anio: string,
  ventas: Venta[],
  movimientos: Movimiento[],
  hoy: string = new Date().toISOString().slice(0, 10),
): ResumenAnual {
  const ventasPorMes = new Map<string, Venta[]>()
  const movimientosPorMes = new Map<string, Movimiento[]>()

  for (const v of ventas) {
    const mes = v.fecha.slice(0, 7)
    const actual = ventasPorMes.get(mes)
    if (actual) actual.push(v)
    else ventasPorMes.set(mes, [v])
  }
  for (const m of movimientos) {
    const mes = m.fecha.slice(0, 7)
    const actual = movimientosPorMes.get(mes)
    if (actual) actual.push(m)
    else movimientosPorMes.set(mes, [m])
  }

  const conActividad = [...new Set([...ventasPorMes.keys(), ...movimientosPorMes.keys()])].sort()

  const mesActual = hoy.slice(0, 7)
  const meses: ResumenDeUnMes[] = conActividad.map((mes) => ({
    mes,
    enCurso: mes === mesActual,
    ...resumirMes(ventasPorMes.get(mes) ?? [], movimientosPorMes.get(mes) ?? []),
  }))

  // El mes que todavia esta corriendo no se compara con los cerrados:
  // le faltan dias, siempre saldria "el peor" y bajaria el promedio sin
  // que eso signifique nada. Igual suma al total del año.
  const conVentas = meses.filter((m) => m.ventasTotales > 0 && !m.enCurso)
  const ordenadosPorVenta = [...conVentas].sort((a, b) => b.ventasTotales - a.ventasTotales)

  return {
    anio,
    meses,
    total: resumirMes(ventas, movimientos),
    mejorMes: ordenadosPorVenta[0] ?? null,
    peorMes: ordenadosPorVenta.length > 1 ? ordenadosPorVenta[ordenadosPorVenta.length - 1] : null,
    promedioMensual: conVentas.length
      ? conVentas.reduce((suma, m) => suma + m.ventasTotales, 0) / conVentas.length
      : 0,
  }
}
