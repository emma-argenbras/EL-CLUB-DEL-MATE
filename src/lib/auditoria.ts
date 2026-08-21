import type {
  Jornada,
  Movimiento,
  MovimientoProveedor,
  Producto,
  Proveedor,
  SeccionId,
  Venta,
} from '../db/db'
import {
  costoDesactualizado,
  precioAtrasado,
  precioBajoCosto,
  precioDesactualizado,
  resumirJornada,
  sinStock,
  totalArqueo,
} from './calculos'
import { plata } from './formato'

/**
 * Auditoria automatica del negocio.
 *
 * Un solo lugar que revisa todos los modulos y devuelve una lista de
 * hallazgos. Lo usan el Panel, la campana y los pendientes de cada
 * persona: asi los tres dicen siempre lo mismo, en vez de que cada
 * pantalla tenga su propia idea de que hay para revisar.
 *
 * Es una funcion pura: recibe los datos ya cargados y devuelve los
 * hallazgos. No toca la base ni la pantalla, para poder probarla sola.
 */

export type NivelHallazgo = 'critico' | 'importante' | 'aviso'

export type ModuloAuditoria = 'caja' | 'productos' | 'proveedores' | 'gastos' | 'sistema'

export interface Hallazgo {
  /** Estable en el tiempo: es la clave con la que se pospone un aviso. */
  id: string
  modulo: ModuloAuditoria
  nivel: NivelHallazgo
  titulo: string
  /** Por que importa, en criollo. */
  detalle: string
  /** Que hay que hacer para que deje de aparecer. */
  comoSeResuelve: string
  /** A donde lleva el boton, ya filtrado cuando se puede. */
  ruta: string
  cantidad?: number
  /** Plata involucrada, cuando el hallazgo tiene un monto claro. */
  monto?: number
  /** Habla de ganancias del negocio: un empleado no lo ve. */
  soloOwner?: boolean
  /** Sin esa seccion habilitada no lo puede resolver, asi que no se le muestra. */
  requiereSeccion?: SeccionId
}

export interface DatosAuditoria {
  productos: Producto[]
  proveedores: Proveedor[]
  /** Todas las jornadas, para encontrar las que quedaron abiertas. */
  jornadas: Jornada[]
  /** Ventas y movimientos del mes que se esta auditando. */
  ventas: Venta[]
  movimientos: Movimiento[]
  /** Movimientos del mes anterior, para comparar los gastos fijos. */
  movimientosMesAnterior: Movimiento[]
  /** Ventas y movimientos de las jornadas abiertas, para el cierre esperado. */
  ventasPorJornada: Map<string, Venta[]>
  movimientosPorJornada: Map<string, Movimiento[]>
  cuentaCorriente: MovimientoProveedor[]
  estadoNube: 'sin-configurar' | 'desconectado' | 'conectando' | 'sincronizado' | 'error'
  errorNube: string | null
  /** Fecha (yyyy-mm-dd) de hoy y mes (yyyy-mm) que se audita. */
  hoy: string
  mes: string
}

const ORDEN_NIVEL: Record<NivelHallazgo, number> = { critico: 0, importante: 1, aviso: 2 }

export const ETIQUETA_MODULO: Record<ModuloAuditoria, string> = {
  caja: 'Caja',
  productos: 'Productos',
  proveedores: 'Proveedores',
  gastos: 'Gastos',
  sistema: 'Sistema',
}

/** Gastos que se pagan todos los meses: si falta uno, probablemente no se cargó. */
const GASTOS_HABITUALES = ['ALQUILER', 'SERVICIOS', 'SUELDOS', 'CONTADOR']

function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_
}

/** Dias enteros entre dos fechas yyyy-mm-dd (b - a). */
function diasEntre(a: string, b: string): number {
  const uno = Date.parse(`${a}T00:00:00`)
  const otro = Date.parse(`${b}T00:00:00`)
  if (Number.isNaN(uno) || Number.isNaN(otro)) return 0
  return Math.round((otro - uno) / 86400000)
}

function auditarCaja(datos: DatosAuditoria, hallazgos: Hallazgo[]): void {
  // --- Turnos que quedaron abiertos de dias anteriores ---
  const abiertosViejos = datos.jornadas
    .filter((j) => j.estado === 'abierto' && diasEntre(j.fecha, datos.hoy) >= 1)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (abiertosViejos.length > 0) {
    const masViejo = abiertosViejos[0]
    hallazgos.push({
      id: 'caja-turnos-abiertos',
      modulo: 'caja',
      nivel: 'critico',
      titulo: `${abiertosViejos.length} ${plural(abiertosViejos.length, 'turno quedó abierto', 'turnos quedaron abiertos')} sin cerrar`,
      detalle: `El más viejo es del ${masViejo.fecha}. Mientras un turno está abierto no se sabe si la caja cerró bien ese día.`,
      comoSeResuelve: 'Entrá a Caja, elegí ese día y turno, contá la caja en la pestaña Cierre y cerralo.',
      ruta: '/caja',
      cantidad: abiertosViejos.length,
      requiereSeccion: 'caja',
    })
  }

  // --- Diferencias de caja en los cierres del mes ---
  const cerradasDelMes = datos.jornadas.filter(
    (j) => j.estado === 'cerrado' && j.fecha.startsWith(datos.mes) && j.arqueoCierre,
  )
  let conDiferencia = 0
  let sumaAbsoluta = 0
  let peor: { jornada: Jornada; diferencia: number } | null = null

  for (const jornada of cerradasDelMes) {
    const resumen = resumirJornada(
      jornada.cajaInicial,
      datos.ventasPorJornada.get(jornada.id) ?? [],
      datos.movimientosPorJornada.get(jornada.id) ?? [],
    )
    const diferencia = totalArqueo(jornada.arqueoCierre) - resumen.cierreEsperado
    if (diferencia === 0) continue
    conDiferencia++
    sumaAbsoluta += Math.abs(diferencia)
    if (!peor || Math.abs(diferencia) > Math.abs(peor.diferencia)) peor = { jornada, diferencia }
  }

  if (peor && conDiferencia > 0) {
    const signo = peor.diferencia > 0 ? '+' : ''
    hallazgos.push({
      id: 'caja-diferencias',
      modulo: 'caja',
      nivel: sumaAbsoluta >= 20000 ? 'importante' : 'aviso',
      titulo: `${conDiferencia} ${plural(conDiferencia, 'cierre con diferencia', 'cierres con diferencia')} de caja este mes`,
      detalle: `Suman ${plata(sumaAbsoluta)} de diferencia. La más grande fue el ${peor.jornada.fecha} (${signo}${plata(peor.diferencia)}): si sobra puede haber una venta sin cargar, si falta un egreso sin registrar.`,
      comoSeResuelve: 'Revisá esos turnos en Caja y buscá la venta o el egreso que quedó sin anotar.',
      ruta: '/caja',
      cantidad: conDiferencia,
      monto: sumaAbsoluta,
      requiereSeccion: 'caja',
    })
  }

  // --- Dias del mes ya pasados sin ningun turno cargado ---
  const conJornada = new Set(
    datos.jornadas.filter((j) => j.fecha.startsWith(datos.mes)).map((j) => j.fecha),
  )
  const diaDeHoy = Number(datos.hoy.slice(8, 10))
  const esMesEnCurso = datos.hoy.startsWith(datos.mes)
  const ultimoDia = esMesEnCurso ? diaDeHoy - 1 : 31
  const faltantes: string[] = []
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const fecha = `${datos.mes}-${String(dia).padStart(2, '0')}`
    // Date.parse rechaza los dias que no existen en ese mes (30 de febrero).
    if (Number.isNaN(Date.parse(`${fecha}T00:00:00`))) continue
    if (!conJornada.has(fecha)) faltantes.push(fecha)
  }

  if (faltantes.length > 0) {
    hallazgos.push({
      id: 'caja-dias-sin-cargar',
      modulo: 'caja',
      nivel: faltantes.length >= 5 ? 'importante' : 'aviso',
      titulo: `${faltantes.length} ${plural(faltantes.length, 'día del mes no tiene', 'días del mes no tienen')} caja cargada`,
      detalle:
        faltantes.length <= 4
          ? `Son el ${faltantes.join(', ')}. Puede ser que el local haya estado cerrado, o que quedaron sin cargar.`
          : `Del ${faltantes[0]} al ${faltantes[faltantes.length - 1]}. Puede ser que el local haya estado cerrado, o que quedaron sin cargar.`,
      comoSeResuelve: 'Si el local abrió esos días, cargá el turno desde Caja eligiendo la fecha.',
      ruta: '/caja',
      cantidad: faltantes.length,
      requiereSeccion: 'caja',
    })
  }
}

function auditarProductos(datos: DatosAuditoria, hallazgos: Hallazgo[]): void {
  const visibles = datos.productos.filter((p) => !p.archivado)

  const bajoCosto = visibles.filter(precioBajoCosto)
  if (bajoCosto.length > 0) {
    const perdida = bajoCosto.reduce(
      (suma, p) => suma + ((p.precioCompra ?? 0) - (p.precioVenta ?? 0)),
      0,
    )
    hallazgos.push({
      id: 'productos-bajo-costo',
      modulo: 'productos',
      nivel: 'critico',
      titulo: `${bajoCosto.length} ${plural(bajoCosto.length, 'producto se vende', 'productos se venden')} al costo o por debajo`,
      detalle: `Cada unidad que sale pierde plata: entre todos son ${plata(perdida)} de pérdida por unidad vendida. Pasa cuando el proveedor aumenta y el precio de venta queda sin actualizar.`,
      comoSeResuelve: 'Abrí cada uno y poné el precio de venta que sugiere la app según su rentabilidad.',
      ruta: '/productos?bajoCosto=1',
      cantidad: bajoCosto.length,
      monto: perdida,
      requiereSeccion: 'productos',
    })
  }

  const agotados = visibles.filter(sinStock)
  if (agotados.length > 0) {
    hallazgos.push({
      id: 'productos-sin-stock',
      modulo: 'productos',
      nivel: 'importante',
      titulo: `${agotados.length} ${plural(agotados.length, 'producto se quedó', 'productos se quedaron')} sin stock`,
      detalle: 'No se pueden vender hasta reponerlos, y si se venden igual el stock queda en negativo.',
      comoSeResuelve: 'Registrá la compra al proveedor: el stock se actualiza solo y el costo también.',
      ruta: '/productos?sinStock=1',
      cantidad: agotados.length,
      requiereSeccion: 'productos',
    })
  }

  // La planilla de precios lleva DOS fechas por producto, y son dos
  // problemas distintos que antes se avisaban juntos:
  //
  //   fecha del costo         -> si esta vieja, el margen del reporte
  //                              miente (el costo real subio).
  //   fecha del precio venta  -> si esta vieja, se esta cobrando de
  //                              menos (el precio quedo planchado).
  //
  // Mezclarlos daba un solo aviso rojo sobre el 90 % del catalogo, que
  // no le decia a nadie que hacer primero.

  // 1. Lo mas accionable: el precio quedo por debajo de su propia
  //    rentabilidad. No depende de ninguna fecha.
  const atrasados = visibles
    .map((p) => ({ producto: p, atraso: precioAtrasado(p) }))
    .filter((x) => x.atraso !== null)
  if (atrasados.length > 0) {
    const falta = atrasados.reduce((suma, x) => suma + (x.atraso?.falta ?? 0), 0)
    hallazgos.push({
      id: 'productos-precio-atrasado',
      modulo: 'productos',
      nivel: 'importante',
      titulo: `${atrasados.length} ${plural(atrasados.length, 'producto está', 'productos están')} más baratos de lo que dice su rentabilidad`,
      detalle: `Sumando todos, se están dejando de cobrar ${plata(falta)} por unidad vendida. No es que falte actualizar una fecha: con el costo y la rentabilidad que ya tienen cargados, el precio debería ser más alto.`,
      comoSeResuelve:
        'Abrí cada uno: la app te muestra el precio que sale de su rentabilidad y lo podés poner de una.',
      ruta: '/productos?precioAtrasado=1',
      cantidad: atrasados.length,
      monto: falta,
      requiereSeccion: 'productos',
    })
  }

  // 2. Hace mucho que no se remarca. Puede estar bien igual, pero con
  //    inflación conviene revisarlo.
  const precioViejo = visibles.filter((p) => precioDesactualizado(p))
  if (precioViejo.length > 0) {
    hallazgos.push({
      id: 'productos-precio-vencido',
      modulo: 'productos',
      nivel: 'aviso',
      titulo: `${precioViejo.length} de ${visibles.length} productos no se remarcan hace más de un año`,
      detalle:
        'El precio de venta quedó donde estaba mientras todo lo demás aumentaba. No siempre está mal, pero conviene repasarlos.',
      comoSeResuelve:
        'Empezá por los que más se venden. Al abrir cada uno vas a ver desde cuándo tiene ese precio.',
      ruta: '/productos?precioViejo=1',
      cantidad: precioViejo.length,
      requiereSeccion: 'productos',
    })
  }

  // 3. El costo vencido no cambia lo que se cobra: ensucia el reporte.
  const vencidos = visibles.filter((p) => costoDesactualizado(p))
  if (vencidos.length > 0) {
    hallazgos.push({
      id: 'productos-costo-vencido',
      modulo: 'productos',
      nivel: 'aviso',
      titulo: `${vencidos.length} de ${visibles.length} productos tienen el costo vencido o sin cargar`,
      detalle:
        'Esto no afecta lo que le cobrás al cliente: afecta al reporte. Como el costo cargado es más viejo que el real, el margen de contribución sale más alto de lo que en verdad es.',
      comoSeResuelve:
        'Actualizá primero los que más se venden. Desde Proveedores se puede subir todos los costos de un proveedor de una vez.',
      ruta: '/productos?alertas=1',
      cantidad: vencidos.length,
      requiereSeccion: 'productos',
    })
  }

  const sinProveedor = visibles.filter((p) => !p.proveedorId)
  if (sinProveedor.length > 0) {
    hallazgos.push({
      id: 'productos-sin-proveedor',
      modulo: 'productos',
      nivel: 'aviso',
      titulo: `${sinProveedor.length} ${plural(sinProveedor.length, 'producto no tiene', 'productos no tienen')} proveedor asignado`,
      detalle: 'No entran en los aumentos en bloque ni en la cuenta corriente de ningún proveedor.',
      comoSeResuelve: 'Al editar cada producto, elegile el proveedor en la lista.',
      ruta: '/productos',
      cantidad: sinProveedor.length,
      requiereSeccion: 'productos',
    })
  }

  const pedidosDeArchivado = visibles.filter((p) => p.solicitudBorrado)
  if (pedidosDeArchivado.length > 0) {
    hallazgos.push({
      id: 'productos-solicitudes',
      modulo: 'productos',
      nivel: 'aviso',
      titulo: `${pedidosDeArchivado.length} ${plural(pedidosDeArchivado.length, 'pedido', 'pedidos')} de archivado esperando autorización`,
      detalle: 'Alguien del equipo pidió sacar un producto del catálogo y necesita que un dueño lo apruebe.',
      comoSeResuelve: 'En Productos, arriba de todo, autorizalo o rechazalo.',
      ruta: '/productos',
      cantidad: pedidosDeArchivado.length,
      soloOwner: true,
      requiereSeccion: 'productos',
    })
  }
}

function auditarVentas(datos: DatosAuditoria, hallazgos: Hallazgo[]): void {
  const sinCosto = datos.ventas.filter((v) => v.costoUnitario === null || v.costoUnitario === undefined)
  if (sinCosto.length === 0) return

  const monto = sinCosto.reduce((suma, v) => suma + v.total, 0)
  hallazgos.push({
    id: 'ventas-sin-costo',
    modulo: 'productos',
    nivel: 'importante',
    titulo: `${sinCosto.length} ${plural(sinCosto.length, 'venta del mes no tiene', 'ventas del mes no tienen')} costo cargado`,
    detalle: `Son ${plata(monto)} que entran completos como ganancia en el reporte, así que el margen del mes sale más alto de lo real.`,
    comoSeResuelve: 'Cargá el precio de compra de esos productos en Productos; el reporte se corrige solo.',
    ruta: '/reportes',
    cantidad: sinCosto.length,
    monto,
    soloOwner: true,
  })
}

function auditarProveedores(datos: DatosAuditoria, hallazgos: Hallazgo[]): void {
  const saldos = new Map<string, number>()
  for (const movimiento of datos.cuentaCorriente) {
    const actual = saldos.get(movimiento.proveedorId) ?? 0
    saldos.set(
      movimiento.proveedorId,
      actual + (movimiento.tipo === 'compra' ? movimiento.monto : -movimiento.monto),
    )
  }

  const deudores = [...saldos.entries()].filter(([, saldo]) => saldo > 0)
  if (deudores.length === 0) return

  const total = deudores.reduce((suma, [, saldo]) => suma + saldo, 0)
  const nombres = new Map(datos.proveedores.map((p) => [p.id, p.nombre]))
  const mayor = deudores.sort((a, b) => b[1] - a[1])[0]

  hallazgos.push({
    id: 'proveedores-saldo',
    modulo: 'proveedores',
    nivel: 'aviso',
    titulo: `Se le debe plata a ${deudores.length} ${plural(deudores.length, 'proveedor', 'proveedores')}`,
    detalle: `${plata(total)} en total. El saldo más grande es con ${nombres.get(mayor[0]) ?? 'un proveedor'}: ${plata(mayor[1])}.`,
    comoSeResuelve: 'Cuando le pagues, registrá el pago en su cuenta corriente: descuenta la deuda y queda cargado como gasto.',
    ruta: '/proveedores',
    cantidad: deudores.length,
    monto: total,
    soloOwner: true,
    requiereSeccion: 'proveedores',
  })
}

function auditarGastos(datos: DatosAuditoria, hallazgos: Hallazgo[]): void {
  const categoriasDelMes = new Set(
    datos.movimientos
      .filter((m) => m.tipo === 'GASTO_CAJA_GRANDE' && m.categoria)
      .map((m) => m.categoria as string),
  )
  const categoriasMesAnterior = new Set(
    datos.movimientosMesAnterior
      .filter((m) => m.tipo === 'GASTO_CAJA_GRANDE' && m.categoria)
      .map((m) => m.categoria as string),
  )

  // Solo se avisa por lo que efectivamente se pago el mes pasado: asi no
  // reclama un gasto que este negocio no tiene.
  const faltantes = GASTOS_HABITUALES.filter(
    (categoria) => categoriasMesAnterior.has(categoria) && !categoriasDelMes.has(categoria),
  )
  if (faltantes.length === 0) return

  hallazgos.push({
    id: 'gastos-habituales-faltantes',
    modulo: 'gastos',
    nivel: 'importante',
    titulo: `Falta cargar ${faltantes.length === 1 ? 'un gasto habitual' : `${faltantes.length} gastos habituales`} de este mes`,
    detalle: `El mes pasado se pagó ${faltantes.join(', ')} y este mes todavía no figura. Si no se carga, el resultado del mes va a dar mejor de lo que es.`,
    comoSeResuelve: 'Cargalo en Gastos cuando lo pagues, con la fecha real del pago.',
    ruta: '/gastos',
    cantidad: faltantes.length,
    soloOwner: true,
    requiereSeccion: 'gastos',
  })
}

function auditarSistema(datos: DatosAuditoria, hallazgos: Hallazgo[]): void {
  if (datos.estadoNube === 'error') {
    hallazgos.push({
      id: 'sistema-sync-error',
      modulo: 'sistema',
      nivel: 'critico',
      titulo: 'Hay un problema sincronizando con la nube',
      detalle: datos.errorNube ?? 'Los cambios de este dispositivo pueden no estar llegando a los demás.',
      comoSeResuelve: 'Revisá la conexión. Si sigue, cerrá sesión y volvé a entrar desde Ajustes.',
      ruta: '/ajustes',
      soloOwner: true,
    })
  }

  if (datos.estadoNube === 'desconectado') {
    hallazgos.push({
      id: 'sistema-sync-desconectado',
      modulo: 'sistema',
      nivel: 'importante',
      titulo: 'Este dispositivo no está sincronizando',
      detalle: 'Lo que se carga acá no se está compartiendo con los demás dispositivos ni respaldando en la nube.',
      comoSeResuelve: 'Iniciá sesión de nuevo desde Ajustes.',
      ruta: '/ajustes',
      soloOwner: true,
    })
  }
}

/** Revisa todo el negocio y devuelve los hallazgos, del mas grave al menos. */
export function auditar(datos: DatosAuditoria): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  auditarCaja(datos, hallazgos)
  auditarProductos(datos, hallazgos)
  auditarVentas(datos, hallazgos)
  auditarProveedores(datos, hallazgos)
  auditarGastos(datos, hallazgos)
  auditarSistema(datos, hallazgos)

  return hallazgos.sort((a, b) => {
    const porNivel = ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]
    if (porNivel !== 0) return porNivel
    return (b.monto ?? 0) - (a.monto ?? 0)
  })
}

/**
 * Deja solo los hallazgos que esta persona puede ver y resolver: sin los
 * numeros de ganancia si es empleado, y sin las secciones que tenga
 * apagadas. Mostrarle algo que no puede arreglar solo genera ruido.
 */
export function hallazgosVisibles(
  hallazgos: Hallazgo[],
  esOwner: boolean,
  secciones: SeccionId[],
): Hallazgo[] {
  return hallazgos.filter((h) => {
    if (h.soloOwner && !esOwner) return false
    if (h.requiereSeccion && !esOwner && !secciones.includes(h.requiereSeccion)) return false
    return true
  })
}

/** Una nota de salud del 0 al 100, para el semaforo del Panel. */
export function puntajeSalud(hallazgos: Hallazgo[]): number {
  const penalidad = { critico: 25, importante: 10, aviso: 3 }
  const total = hallazgos.reduce((suma, h) => suma + penalidad[h.nivel], 0)
  return Math.max(0, 100 - total)
}
