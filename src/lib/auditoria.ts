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

  // --- La plata tiene que engancharse entre un turno y el siguiente ---
  // Lo que se conto al cerrar la manana deberia ser lo que aparece al
  // abrir la tarde. Si no engancha, o alguien saco plata entre medio, o
  // uno de los dos conteos esta mal. Es el control que sigue el rastro
  // del efectivo de punta a punta, y no lo hacia nadie.
  const enOrden = datos.jornadas
    .filter((j) => j.estado === 'cerrado' && j.arqueoCierre && j.fecha.startsWith(datos.mes))
    .sort((a, b) => (a.fecha + a.turno).localeCompare(b.fecha + b.turno))

  const saltos: { fecha: string; turno: string; salto: number }[] = []
  for (let i = 0; i < enOrden.length - 1; i++) {
    const cierra = enOrden[i]
    const abre = enOrden[i + 1]
    // Solo tiene sentido comparar turnos consecutivos de verdad: si en
    // el medio hubo un dia cerrado, la plata pudo ir a caja grande.
    const seguidos =
      (cierra.fecha === abre.fecha && cierra.turno === 'M' && abre.turno === 'T') ||
      (diasEntre(cierra.fecha, abre.fecha) === 1 && cierra.turno === 'T' && abre.turno === 'M')
    if (!seguidos) continue
    const salto = abre.cajaInicial - totalArqueo(cierra.arqueoCierre)
    if (Math.abs(salto) < 1) continue
    saltos.push({ fecha: abre.fecha, turno: abre.turno, salto })
  }

  if (saltos.length > 0) {
    const total = saltos.reduce((suma, x) => suma + Math.abs(x.salto), 0)
    const peorSalto = saltos.reduce((a, b) => (Math.abs(b.salto) > Math.abs(a.salto) ? b : a))
    hallazgos.push({
      id: 'caja-no-engancha',
      modulo: 'caja',
      nivel: total >= 20000 ? 'importante' : 'aviso',
      titulo: `${saltos.length} ${plural(saltos.length, 'turno abrió', 'turnos abrieron')} con una plata distinta a la que había quedado`,
      detalle: `Lo que se contó al cerrar un turno tiene que ser lo mismo que aparece al abrir el siguiente. Suman ${plata(total)} de diferencia; la mayor fue al abrir el ${peorSalto.fecha} ${peorSalto.turno === 'M' ? 'a la mañana' : 'a la tarde'} (${peorSalto.salto > 0 ? 'apareció' : 'faltó'} ${plata(Math.abs(peorSalto.salto))}).`,
      comoSeResuelve:
        'Revisá esos dos turnos: puede que se haya sacado plata entre medio sin registrarla como egreso, o que uno de los dos conteos esté mal.',
      ruta: '/caja',
      cantidad: saltos.length,
      monto: total,
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

  // --- Sin precio de venta: no se pueden vender ---
  // Es distinto de "precio viejo": aca directamente no hay precio, asi
  // que el producto no se puede cargar en una venta ni sale en el
  // catalogo publico. Esta primero porque es lo unico de esta lista que
  // impide vender.
  const sinPrecio = visibles.filter((p) => !p.descontinuado && !p.precioVenta)
  if (sinPrecio.length > 0) {
    const conCosto = sinPrecio.filter((p) => p.precioCompra).length
    hallazgos.push({
      id: 'productos-sin-precio',
      modulo: 'productos',
      nivel: 'importante',
      titulo: `${sinPrecio.length} ${plural(sinPrecio.length, 'producto no tiene', 'productos no tienen')} precio de venta`,
      detalle:
        `Sin precio no se pueden cargar en una venta ni aparecen en el catálogo que ven los clientes.` +
        (conCosto > 0
          ? ` ${conCosto} de ${plural(conCosto, 'ellos ya tiene', 'ellos ya tienen')} el costo cargado, así que la app te puede sugerir el precio sola.`
          : ''),
      comoSeResuelve:
        'Abrí cada uno y poné el precio de venta. Si tiene costo y rentabilidad cargados, la app te sugiere el número redondeado.',
      ruta: '/productos?sinPrecio=1',
      cantidad: sinPrecio.length,
      requiereSeccion: 'productos',
    })
  }

  // --- Stock en negativo: se vendio mas de lo que figuraba ---
  const enNegativo = visibles.filter((p) => typeof p.stock === 'number' && p.stock < 0)
  if (enNegativo.length > 0) {
    hallazgos.push({
      id: 'productos-stock-negativo',
      modulo: 'productos',
      nivel: 'importante',
      titulo: `${enNegativo.length} ${plural(enNegativo.length, 'producto tiene', 'productos tienen')} el stock en negativo`,
      detalle:
        'Se vendieron más unidades de las que figuraban cargadas. O falta registrar una compra al proveedor, o el conteo de stock quedó mal.',
      comoSeResuelve:
        'Contá lo que hay en el local y corregí el stock, o registrá la compra que faltaba desde Proveedores.',
      ruta: '/productos?stockNegativo=1',
      cantidad: enNegativo.length,
      requiereSeccion: 'productos',
    })
  }

  // --- Sin nombre: figuran por el codigo pelado ---
  const sinNombre = visibles.filter((p) => {
    const d = (p.descripcion ?? '').trim()
    return !d || d.toUpperCase() === (p.codigo ?? '').trim().toUpperCase()
  })
  if (sinNombre.length > 0) {
    hallazgos.push({
      id: 'productos-sin-nombre',
      modulo: 'productos',
      nivel: 'aviso',
      titulo: `${sinNombre.length} ${plural(sinNombre.length, 'producto figura', 'productos figuran')} solo con su código`,
      detalle:
        'Nadie sabe qué son sin buscarlos en el estante. Aparecen así en las ventas, en los reportes y en el catálogo que ven los clientes.',
      comoSeResuelve: 'Abrí cada uno y escribile el nombre.',
      ruta: '/productos?sinNombre=1',
      cantidad: sinNombre.length,
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

/* ------------------------------------------------------------------ */
/* Revision completa: que se controla, no solo que salio mal           */
/* ------------------------------------------------------------------ */

/**
 * Cada control que corre la auditoria, con la explicacion de que mira.
 *
 * El Panel muestra solo lo que esta mal, que es lo util para trabajar.
 * Pero para saber si el negocio esta sano hace falta lo otro: ver la
 * lista entera y que los que estan bien digan que estan bien. Si no,
 * "no hay avisos" y "no se reviso nada" se ven igual.
 *
 * La clave es el id del hallazgo, asi hay una sola fuente de verdad:
 * si un id no aparece entre los hallazgos, ese control paso.
 */
export const CONTROLES: {
  id: string
  modulo: ModuloAuditoria
  /** Que se revisa. */
  que: string
  /** Que quiere decir que este bien. */
  bien: string
  soloOwner?: boolean
  requiereSeccion?: SeccionId
  /**
   * Cuando devuelve true, el control no se pudo correr. Un control que
   * no corrio NO es un control que dio bien: mostrarlo con un tilde
   * verde seria mentir. Pasa, por ejemplo, con la sincronizacion
   * cuando el negocio todavia no activo la nube.
   */
  noSePudoCorrer?: (datos: DatosAuditoria) => boolean
  /** Por que no se pudo correr, para explicarlo en la revision. */
  porque?: string
}[] = [
  {
    id: 'caja-turnos-abiertos',
    modulo: 'caja',
    que: 'Que no queden turnos abiertos de días anteriores',
    bien: 'Todos los turnos de días pasados están cerrados',
    requiereSeccion: 'caja',
  },
  {
    id: 'caja-diferencias',
    modulo: 'caja',
    que: 'Que la caja contada al cerrar coincida con lo que debería haber',
    bien: 'Todos los cierres del mes dieron exactos',
    requiereSeccion: 'caja',
  },
  {
    id: 'caja-no-engancha',
    modulo: 'caja',
    que: 'Que la plata de un turno sea la misma con la que abre el siguiente',
    bien: 'El efectivo se engancha turno a turno sin saltos',
    requiereSeccion: 'caja',
  },
  {
    id: 'caja-dias-sin-cargar',
    modulo: 'caja',
    que: 'Que no falte cargar ningún día del mes',
    bien: 'Todos los días del mes tienen caja cargada',
    requiereSeccion: 'caja',
  },
  {
    id: 'productos-bajo-costo',
    modulo: 'productos',
    que: 'Que ningún producto se venda por debajo de lo que costó',
    bien: 'Todos los productos se venden por encima de su costo',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-sin-precio',
    modulo: 'productos',
    que: 'Que todos los productos tengan precio de venta',
    bien: 'Todos los productos se pueden vender',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-precio-atrasado',
    modulo: 'productos',
    que: 'Que el precio coincida con el que sale de su rentabilidad',
    bien: 'Ningún precio quedó por debajo de su propio markup',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-stock-negativo',
    modulo: 'productos',
    que: 'Que no haya stock en negativo',
    bien: 'Ningún producto vendió más de lo que tenía cargado',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-sin-stock',
    modulo: 'productos',
    que: 'Que no haya productos agotados sin reponer',
    bien: 'No hay productos agotados',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-precio-vencido',
    modulo: 'productos',
    que: 'Que los precios se revisen al menos una vez al año',
    bien: 'Todos los precios se remarcaron en el último año',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-costo-vencido',
    modulo: 'productos',
    que: 'Que los costos estén al día, para que el margen sea confiable',
    bien: 'Todos los costos tienen menos de 6 meses',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-sin-nombre',
    modulo: 'productos',
    que: 'Que todos los productos tengan nombre y no solo código',
    bien: 'Todos los productos tienen nombre',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-sin-proveedor',
    modulo: 'productos',
    que: 'Que cada producto sepa de qué proveedor viene',
    bien: 'Todos los productos tienen proveedor asignado',
    requiereSeccion: 'productos',
  },
  {
    id: 'productos-solicitudes',
    modulo: 'productos',
    que: 'Que no queden pedidos de archivado sin responder',
    bien: 'No hay pedidos esperando autorización',
    requiereSeccion: 'productos',
  },
  {
    id: 'ventas-sin-costo',
    modulo: 'productos',
    que: 'Que las ventas del mes tengan el costo cargado',
    bien: 'Todas las ventas del mes tienen costo, así que el margen es real',
    soloOwner: true,
    requiereSeccion: 'productos',
  },
  {
    id: 'proveedores-saldo',
    modulo: 'proveedores',
    que: 'Cuánto se le debe a los proveedores',
    bien: 'No se le debe nada a ningún proveedor',
    requiereSeccion: 'proveedores',
  },
  {
    id: 'gastos-habituales-faltantes',
    modulo: 'gastos',
    que: 'Que no falte cargar un gasto que se paga todos los meses',
    bien: 'Los gastos habituales del mes están cargados',
    soloOwner: true,
    requiereSeccion: 'gastos',
  },
  {
    id: 'sistema-sync-error',
    modulo: 'sistema',
    que: 'Que la sincronización con el servidor funcione',
    bien: 'La sincronización anda bien',
    noSePudoCorrer: (d) => d.estadoNube === 'sin-configurar',
    porque: 'El respaldo automático todavía no está activado',
  },
  {
    id: 'sistema-sync-desconectado',
    modulo: 'sistema',
    que: 'Que este dispositivo esté vinculado al respaldo automático',
    bien: 'Este dispositivo está vinculado y respalda solo',
    noSePudoCorrer: (d) => d.estadoNube === 'sin-configurar',
    porque: 'El respaldo automático todavía no está activado: los datos viven solo acá',
  },
]

export interface ResultadoControl {
  id: string
  modulo: ModuloAuditoria
  que: string
  /**
   * 'bien' cuando el control paso, 'no-corrio' cuando no se pudo
   * revisar, y si no el nivel del hallazgo que encontro.
   */
  estado: 'bien' | 'no-corrio' | NivelHallazgo
  /** Lo que se comprobo, o el titulo del problema encontrado. */
  resultado: string
  hallazgo?: Hallazgo
}

/**
 * La foto completa: todos los controles con su resultado, los que
 * pasaron y los que no. Se arma cruzando el catalogo de arriba con los
 * hallazgos, para que no haya dos listas que se puedan desincronizar.
 */
export function revisionCompleta(
  hallazgos: Hallazgo[],
  esOwner = true,
  secciones?: SeccionId[],
  datos?: DatosAuditoria,
): ResultadoControl[] {
  const porId = new Map(hallazgos.map((h) => [h.id, h]))
  return CONTROLES.filter((c) => {
    if (c.soloOwner && !esOwner) return false
    if (c.requiereSeccion && secciones && !secciones.includes(c.requiereSeccion)) return false
    return true
  }).map((c) => {
    const hallazgo = porId.get(c.id)
    if (hallazgo) {
      return {
        id: c.id,
        modulo: c.modulo,
        que: c.que,
        estado: hallazgo.nivel,
        resultado: hallazgo.titulo,
        hallazgo,
      }
    }
    if (datos && c.noSePudoCorrer?.(datos)) {
      return {
        id: c.id,
        modulo: c.modulo,
        que: c.que,
        estado: 'no-corrio' as const,
        resultado: c.porque ?? 'No se pudo revisar',
      }
    }
    return {
      id: c.id,
      modulo: c.modulo,
      que: c.que,
      estado: 'bien' as const,
      resultado: c.bien,
    }
  })
}
