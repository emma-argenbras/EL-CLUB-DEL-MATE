import { CODIGO_RECARGO, db, nuevoId, type Jornada, type MedioPago, type PagoDeVenta, type Producto, type Venta } from './db'
import { borrarVenta } from './borrarVenta'
import { moverVenta } from './moverVenta'
import { plata } from '../lib/formato'
import { planesDe, planPorId, recargoDe } from '../lib/tarjetas'

/**
 * Un ticket: varios productos y uno o varios pagos (puntos 7 y 8 del
 * pedido del 06/11).
 *
 * Hasta el 06/11 cada producto era una venta suelta con su propio medio de
 * pago: un cliente que se llevaba un mate y una bombilla eran dos ventas, y
 * si pagaba una parte en efectivo y otra con tarjeta no habia como
 * cargarlo.
 *
 * Se guarda sin tabla nueva: cada producto sigue siendo un renglon de
 * venta, y los renglones del ticket comparten `ticketId`. Si el ticket se
 * pago con mas de un medio, o con una tarjeta y un plan, cada renglon
 * guarda en `pagos` como se pago lo suyo; las cuentas de plata leen eso
 * (ver cobrosDe en db.ts). El recargo de una tarjeta va como un renglon mas
 * del ticket, con el codigo CODIGO_RECARGO y costo cero: asi lo vendido
 * suma lo cobrado, y el margen lo cuenta.
 */

export interface RenglonTicket {
  producto: Producto
  /** La del producto, o lo que se escribio si es generico. */
  descripcion: string
  cantidad: number
  precioUnitario: number
}

export interface PagoTicket {
  medio: MedioPago
  /** Lo que se paga con este medio, sin el recargo. */
  monto: number
  /** Con tarjeta: el plan (ver tarjetas.ts). */
  planId?: string | null
}

export const MOTIVO_BORRAR_TICKET = 'Ticket borrado desde Caja'
export const MOTIVO_DESHACER_TICKET = 'Ticket deshecho al momento de cargarlo'

const centavos = (n: number) => Math.round(n * 100)
const redondear = (n: number) => Math.round(n * 100) / 100

export function totalDelRenglon(r: Pick<RenglonTicket, 'cantidad' | 'precioUnitario'>): number {
  return redondear(r.cantidad * r.precioUnitario)
}

export function totalesDelTicket(renglones: RenglonTicket[], pagos: PagoTicket[]) {
  const subtotal = redondear(renglones.reduce((s, r) => s + totalDelRenglon(r), 0))
  const pagado = redondear(pagos.reduce((s, p) => s + p.monto, 0))
  const recargo = pagos.reduce((s, p) => s + recargoDe(p.monto, planPorId(p.planId)), 0)
  return { subtotal, recargo, total: redondear(subtotal + recargo), falta: redondear(subtotal - pagado) }
}

/** Que le falta al ticket para poder registrarse, o null si esta listo. */
export function problemaDelTicket(renglones: RenglonTicket[], pagos: PagoTicket[]): string | null {
  if (renglones.length === 0) return 'Sumá al menos un producto.'
  if (renglones.some((r) => !(r.cantidad > 0) || !(r.precioUnitario > 0))) {
    return 'Cada producto tiene que tener cantidad y precio.'
  }
  if (pagos.length === 0) return 'Elegí cómo paga.'
  if (pagos.some((p) => !(p.monto > 0))) return 'Cada medio de pago tiene que tener un monto.'
  if (pagos.some((p) => planesDe(p.medio).length > 0 && !planPorId(p.planId))) {
    return 'Elegí la tarjeta y el plan.'
  }
  const { falta } = totalesDelTicket(renglones, pagos)
  if (falta > 0) return `Faltan ${plata(falta)} por cobrar.`
  if (falta < 0) return `Los pagos suman ${plata(-falta)} de más.`
  return null
}

/**
 * Reparte los pagos entre los renglones, en orden: cada renglon toma de los
 * pagos hasta cubrirse. Asi un pago mixto parte a lo sumo un renglon por
 * cada medio de mas, y la suma de cada medio da exacta, al centavo.
 */
export function repartirPagos(totales: number[], pagos: PagoDeVenta[]): PagoDeVenta[][] {
  const restantes = pagos.map((p) => centavos(p.monto))
  let j = 0
  return totales.map((total) => {
    let falta = centavos(total)
    const partes: PagoDeVenta[] = []
    while (falta > 0 && j < pagos.length) {
      const toma = Math.min(falta, restantes[j])
      if (toma > 0) {
        partes.push({ ...pagos[j], monto: toma / 100 })
        restantes[j] -= toma
        falta -= toma
      }
      if (restantes[j] === 0) j++
    }
    return partes
  })
}

function medioPrincipal(partes: PagoDeVenta[], porDefecto: MedioPago): MedioPago {
  return partes.reduce<PagoDeVenta | null>((a, b) => (!a || b.monto > a.monto ? b : a), null)?.medio ?? porDefecto
}

/** Los renglones de venta del ticket, sin guardarlos. */
export function armarTicket(
  jornada: Pick<Jornada, 'id' | 'fecha' | 'vendedor'>,
  renglones: RenglonTicket[],
  pagos: PagoTicket[],
  hora: string,
  ids: { ticketId: string; renglones: string[]; recargos: string[] },
): Venta[] {
  const pagosDeVenta: PagoDeVenta[] = pagos.map((p) => {
    const plan = planPorId(p.planId)
    return {
      medio: p.medio,
      monto: p.monto,
      tarjeta: plan?.tarjeta ?? null,
      plan: plan?.nombre ?? null,
      cuotas: plan?.cuotas ?? null,
      recargoPct: plan?.recargoPct ?? null,
    }
  })
  const totales = renglones.map(totalDelRenglon)
  const partes = repartirPagos(totales, pagosDeVenta)
  const filas: Venta[] = renglones.map((r, i) => {
    const suyas = partes.at(i) ?? []
    // Un renglon pagado entero con un solo medio y sin tarjeta queda como
    // cualquier venta de antes: sin `pagos`.
    const hacenFalta = suyas.length > 1 || suyas.some((p) => p.tarjeta)
    return {
      id: ids.renglones.at(i) ?? nuevoId(),
      jornadaId: jornada.id,
      fecha: jornada.fecha,
      hora,
      codigo: r.producto.codigo,
      descripcion: r.descripcion,
      cantidad: r.cantidad,
      precioUnitario: r.precioUnitario,
      costoUnitario: r.producto.precioCompra ?? null,
      medioPago: medioPrincipal(suyas, pagos.at(0)?.medio ?? 'EFECTIVO'),
      total: totales.at(i) ?? 0,
      vendedor: jornada.vendedor,
      ticketId: ids.ticketId,
      pagos: hacenFalta ? suyas : null,
    }
  })
  let k = 0
  pagosDeVenta.forEach((p, i) => {
    const plan = planPorId(pagos.at(i)?.planId)
    const recargo = recargoDe(p.monto, plan)
    if (!plan || recargo <= 0) return
    filas.push({
      id: ids.recargos.at(k++) ?? nuevoId(),
      jornadaId: jornada.id,
      fecha: jornada.fecha,
      hora,
      codigo: CODIGO_RECARGO,
      descripcion: `Recargo ${plan.tarjeta} ${plan.nombre} (${plan.recargoPct} %)`,
      cantidad: 1,
      precioUnitario: recargo,
      costoUnitario: 0,
      medioPago: p.medio,
      total: recargo,
      vendedor: jornada.vendedor,
      ticketId: ids.ticketId,
      pagos: [{ ...p, monto: recargo }],
    })
  })
  return filas
}

/** Guarda el ticket y descuenta el stock, todo junto. */
export async function registrarTicket(
  jornada: Pick<Jornada, 'id' | 'fecha' | 'vendedor'>,
  renglones: RenglonTicket[],
  pagos: PagoTicket[],
  hora: string,
): Promise<{ ticketId: string; filas: Venta[] }> {
  const problema = problemaDelTicket(renglones, pagos)
  if (problema) throw new Error(problema)
  const ticketId = nuevoId()
  const filas = armarTicket(jornada, renglones, pagos, hora, {
    ticketId,
    renglones: renglones.map(() => nuevoId()),
    recargos: pagos.map(() => nuevoId()),
  })
  await guardarFilas(filas, renglones)
  return { ticketId, filas }
}

/**
 * Un ticket de un solo producto, pagado con un solo medio y sin recargo, es
 * una venta comun: se guarda sin `ticketId` ni `pagos`, igual que las de
 * siempre. La caja de la compu (06/11) cobra todo desde el ticket, y asi una
 * venta suelta no aparece como un «TICKET» de un producto. Con recargo hay
 * dos renglones (el producto y el recargo), y con dos medios el renglon
 * necesita sus `pagos`: esos siguen siendo ticket.
 */
export function comoVentaSola(filas: Venta[]): Venta | null {
  if (filas.length !== 1 || (filas[0].pagos?.length ?? 0) > 1) return null
  const venta: Venta = { ...filas[0] }
  delete venta.ticketId
  delete venta.pagos
  return venta
}

/** Lo que registra el formulario del ticket: una venta comun o un ticket (ver comoVentaSola). */
export async function registrarCobro(
  jornada: Pick<Jornada, 'id' | 'fecha' | 'vendedor'>,
  renglones: RenglonTicket[],
  pagos: PagoTicket[],
  hora: string,
): Promise<{ ventaId: string; ticketId: null } | { ventaId: null; ticketId: string }> {
  const problema = problemaDelTicket(renglones, pagos)
  if (problema) throw new Error(problema)
  const ticketId = nuevoId()
  const filas = armarTicket(jornada, renglones, pagos, hora, {
    ticketId,
    renglones: renglones.map(() => nuevoId()),
    recargos: pagos.map(() => nuevoId()),
  })
  const sola = comoVentaSola(filas)
  await guardarFilas(sola ? [sola] : filas, renglones)
  return sola ? { ventaId: sola.id, ticketId: null } : { ventaId: null, ticketId }
}

async function guardarFilas(filas: Venta[], renglones: RenglonTicket[]): Promise<void> {
  await db.transaction('rw', db.ventas, db.productos, async () => {
    await db.ventas.bulkAdd(filas)
    const porCodigo = new Map<string, number>()
    for (const r of renglones) {
      porCodigo.set(r.producto.codigo, (porCodigo.get(r.producto.codigo) ?? 0) + r.cantidad)
    }
    for (const [codigo, cantidad] of porCodigo) {
      const producto = await db.productos.get(codigo)
      if (producto && producto.stock !== null && producto.stock !== undefined) {
        await db.productos.update(codigo, { stock: producto.stock - cantidad })
      }
    }
  })
}

/** Borra el ticket entero: un pedazo seria una venta que nadie hizo. */
export async function borrarTicket(
  t: { jornadaId: string; ticketId: string },
  motivo: string,
  quien: string | null,
): Promise<number> {
  // Todo en una transaccion, como borrarCambio: si algo falla a la mitad
  // no queda medio ticket.
  return db.transaction('rw', [db.ventas, db.productos, db.borrados], async () => {
    const filas = await db.ventas
      .where('jornadaId')
      .equals(t.jornadaId)
      .filter((v) => v.ticketId === t.ticketId)
      .toArray()
    for (const v of filas) await borrarVenta(v.id, motivo, quien)
    return filas.length
  })
}

/**
 * Pasa el ticket entero al otro turno del mismo dia (ver moverVenta.ts).
 * Renglon por renglon, pero en una sola transaccion: o pasa todo o nada.
 */
export async function moverTicket(
  t: { jornadaId: string; ticketId: string },
  jornadaDestinoId: string,
): Promise<number> {
  return db.transaction('rw', [db.ventas, db.jornadas], async () => {
    const filas = await db.ventas
      .where('jornadaId')
      .equals(t.jornadaId)
      .filter((v) => v.ticketId === t.ticketId)
      .toArray()
    for (const v of filas) await moverVenta(v.id, jornadaDestinoId)
    return filas.length
  })
}
