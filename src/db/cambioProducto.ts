import { CODIGO_RECARGO, cobrosDe, conMotivo, db, nuevoId, type Jornada, type MedioPago, type Producto, type Venta } from './db'
import { borrarVenta } from './borrarVenta'

/**
 * Un cambio de producto: el cliente devuelve uno, se lleva otro, y paga
 * o recibe la diferencia.
 *
 * Hasta el 26/10 no había forma de cargarlo, y Sandra lo resolvía con
 * productos comodín («DIF – Diferencia por cambio», «SALDOS – DE TODO»):
 * $100.700 vendidos sin saber qué salió, sin margen y sin mover stock.
 *
 * Se guarda como dos renglones de venta del turno, unidos por `cambioId`:
 *
 *   - el que VUELVE, en negativo: cantidad y total con signo menos;
 *   - el que SE LLEVA, en positivo, como cualquier venta.
 *
 * Así todo lo que ya suma ventas da bien sin tocarlo: el efectivo del
 * turno sube o baja solo por la diferencia, las unidades netas quedan en
 * cero si es uno por uno, el costo de mercadería resta el que vuelve y
 * suma el que sale, y el ranking de productos le descuenta al devuelto.
 *
 * Los dos renglones llevan el medio de pago de la DIFERENCIA, que es la
 * única plata que se mueve. Si no hay diferencia, efectivo: no cambia
 * nada. Si se le devuelve plata en efectivo, sale del cajón: el efectivo
 * esperado al cierre baja en esa cantidad, sin cargar un egreso aparte
 * (eso la contaría dos veces).
 */

export const MOTIVO_CAMBIO = 'Cambio de producto'
export const MOTIVO_DESHACER_CAMBIO = 'Cambio deshecho al momento de cargarlo'
export const MOTIVO_BORRAR_CAMBIO = 'Cambio borrado desde Caja'

export interface LadoCambio {
  producto: Producto
  cantidad: number
  precioUnitario: number
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

/** Como se pago un ticket, sumado por medio y tarjeta. */
export interface PagoResumido {
  medio: MedioPago
  monto: number
  /** «Consumax 3 pagos», o null si no fue con un plan de tarjeta. */
  detalle: string | null
}

/** Un renglon de la lista del turno: una venta, un cambio entero o un ticket entero. */
export type RenglonDelTurno =
  | { tipo: 'venta'; venta: Venta }
  | {
      tipo: 'ticket'
      ticketId: string
      filas: Venta[]
      total: number
      hora: string
      pagos: PagoResumido[]
    }
  | {
      tipo: 'cambio'
      cambioId: string
      vuelve: Venta[]
      lleva: Venta[]
      /** Positiva: pago el cliente. Negativa: se le devolvio. */
      diferencia: number
      medioPago: MedioPago
      hora: string
    }

/**
 * Las ventas del turno con cada cambio en un solo renglon, en el orden
 * en que se cargaron. Hasta el 06/11 la lista mostraba los dos renglones
 * sueltos --uno en negativo-- y habia que hacer la cuenta a mano para
 * saber cuanto habia pagado el cliente (punto 9 del pedido del 06/11).
 */
export function agruparCambios(ventas: Venta[]): RenglonDelTurno[] {
  const renglones: RenglonDelTurno[] = []
  const cambios = new Map<string, Extract<RenglonDelTurno, { tipo: 'cambio' }>>()
  const tickets = new Map<string, Extract<RenglonDelTurno, { tipo: 'ticket' }>>()
  for (const v of ventas) {
    // Un ticket con varios productos va junto, en un solo renglon (06/11).
    if (v.ticketId && !v.cambioId) {
      let ticket = tickets.get(v.ticketId)
      if (!ticket) {
        ticket = { tipo: 'ticket', ticketId: v.ticketId, filas: [], total: 0, hora: v.hora, pagos: [] }
        tickets.set(v.ticketId, ticket)
        renglones.push(ticket)
      }
      ticket.filas.push(v)
      ticket.total = redondear(ticket.total + v.total)
      for (const c of cobrosDe(v)) {
        const detalle = c.tarjeta && c.plan ? `${c.tarjeta} ${c.plan}` : null
        const igual = ticket.pagos.find((x) => x.medio === c.medio && x.detalle === detalle)
        if (igual) igual.monto = redondear(igual.monto + c.monto)
        else ticket.pagos.push({ medio: c.medio, monto: c.monto, detalle })
      }
      continue
    }
    if (!v.cambioId) {
      renglones.push({ tipo: 'venta', venta: v })
      continue
    }
    let cambio = cambios.get(v.cambioId)
    if (!cambio) {
      cambio = {
        tipo: 'cambio',
        cambioId: v.cambioId,
        vuelve: [],
        lleva: [],
        diferencia: 0,
        medioPago: v.medioPago,
        hora: v.hora,
      }
      cambios.set(v.cambioId, cambio)
      renglones.push(cambio)
    }
    if (v.cambio === 'vuelve') cambio.vuelve.push(v)
    else {
      cambio.lleva.push(v)
      cambio.medioPago = v.medioPago
    }
    cambio.diferencia = redondear(cambio.diferencia + v.total)
  }
  // Cada aparato trae los renglones en otro orden: el ticket se ve igual en
  // todos con los productos por nombre, el recargo al final y el efectivo
  // primero entre los pagos.
  for (const t of tickets.values()) {
    t.filas.sort(
      (a, b) =>
        Number(a.codigo === CODIGO_RECARGO) - Number(b.codigo === CODIGO_RECARGO) ||
        a.descripcion.localeCompare(b.descripcion, 'es'),
    )
    t.pagos.sort(
      (a, b) =>
        Number(b.medio === 'EFECTIVO') - Number(a.medio === 'EFECTIVO') || b.monto - a.monto,
    )
  }
  return renglones
}

/** Cuantas operaciones hubo: un cambio cuenta como una, no como dos. */
export function contarOperaciones(ventas: Venta[]): number {
  return agruparCambios(ventas).length
}

/** Positiva: paga el cliente. Negativa: se le devuelve. */
export function diferenciaCambio(vuelve: LadoCambio, lleva: LadoCambio): number {
  return redondear(lleva.cantidad * lleva.precioUnitario - vuelve.cantidad * vuelve.precioUnitario)
}

/** Qué le falta al cambio para poder registrarse, o null si está completo. */
export function problemaDelCambio(
  vuelve: Partial<LadoCambio> | null,
  lleva: Partial<LadoCambio> | null,
): string | null {
  if (!vuelve?.producto) return 'Elegí el producto que trae el cliente.'
  if (!lleva?.producto) return 'Elegí el producto que se lleva.'
  if (!vuelve.cantidad || vuelve.cantidad <= 0) return 'Poné cuántos trae.'
  if (!lleva.cantidad || lleva.cantidad <= 0) return 'Poné cuántos se lleva.'
  if (vuelve.precioUnitario == null || vuelve.precioUnitario < 0) {
    return 'Poné el precio al que se le había vendido lo que trae.'
  }
  if (lleva.precioUnitario == null || lleva.precioUnitario < 0) {
    return 'Poné el precio de lo que se lleva.'
  }
  return null
}

/** Los dos renglones del cambio, sin guardar nada. */
export function armarCambio(
  jornada: Pick<Jornada, 'id' | 'fecha' | 'vendedor'>,
  vuelve: LadoCambio,
  lleva: LadoCambio,
  medioPago: MedioPago,
  hora: string,
  ids: { cambioId: string; vuelve: string; lleva: string },
): Venta[] {
  const diferencia = diferenciaCambio(vuelve, lleva)
  const medio: MedioPago = diferencia === 0 ? 'EFECTIVO' : medioPago
  const renglon = (lado: LadoCambio, signo: 1 | -1, id: string, cual: 'vuelve' | 'lleva'): Venta => ({
    id,
    jornadaId: jornada.id,
    fecha: jornada.fecha,
    hora,
    codigo: lado.producto.codigo,
    descripcion: lado.producto.descripcion,
    cantidad: signo * lado.cantidad,
    precioUnitario: lado.precioUnitario,
    // Como en cualquier venta, el costo de hoy queda congelado. Para el
    // que vuelve es una aproximacion --no se sabe a que costo se habia
    // vendido--, y es la misma que usa el stock al reponerlo.
    costoUnitario: lado.producto.precioCompra ?? null,
    medioPago: medio,
    total: redondear(signo * lado.cantidad * lado.precioUnitario),
    vendedor: jornada.vendedor ?? null,
    cambioId: ids.cambioId,
    cambio: cual,
  })
  return [renglon(vuelve, -1, ids.vuelve, 'vuelve'), renglon(lleva, 1, ids.lleva, 'lleva')]
}

/**
 * Lo registra: los dos renglones y el stock, en una sola transacción.
 * Lo que vuelve suma stock, lo que se lleva resta (solo si el producto
 * lleva stock, como en una venta).
 */
export async function registrarCambio(
  jornada: Pick<Jornada, 'id' | 'fecha' | 'vendedor'>,
  vuelve: LadoCambio,
  lleva: LadoCambio,
  medioPago: MedioPago,
  hora: string,
): Promise<{ cambioId: string; ids: string[]; diferencia: number }> {
  const problema = problemaDelCambio(vuelve, lleva)
  if (problema) throw new Error(problema)

  const ids = { cambioId: nuevoId(), vuelve: nuevoId(), lleva: nuevoId() }
  const renglones = armarCambio(jornada, vuelve, lleva, medioPago, hora, ids)

  await conMotivo(MOTIVO_CAMBIO, async () =>
    db.transaction('rw', db.ventas, db.productos, async () => {
      for (const r of renglones) {
        await db.ventas.add(r)
        if (!r.codigo) continue
        // Se lee de la base en el momento: los dos lados pueden ser el
        // mismo producto (otro talle con el mismo codigo).
        const producto = await db.productos.get(r.codigo)
        if (producto && producto.stock !== null && producto.stock !== undefined) {
          await db.productos.update(r.codigo, { stock: producto.stock - r.cantidad })
        }
      }
    }),
  )
  return { cambioId: ids.cambioId, ids: [ids.vuelve, ids.lleva], diferencia: diferenciaCambio(vuelve, lleva) }
}

/**
 * Borra un cambio entero. Nunca la mitad: un cambio sin el renglón que
 * vuelve sería una venta, y sin el que se lleva, una devolución.
 * Cada renglón se borra con borrarVenta, que deja constancia y devuelve
 * el stock (en el que vuelve, "devolver" es sacar lo que había entrado).
 */
export async function borrarCambio(
  cambio: { jornadaId: string; cambioId: string },
  motivo: string,
  quien: string | null,
): Promise<number> {
  return db.transaction('rw', [db.ventas, db.productos, db.borrados], async () => {
    const renglones = await db.ventas
      .where('jornadaId')
      .equals(cambio.jornadaId)
      .filter((v) => v.cambioId === cambio.cambioId)
      .toArray()
    for (const r of renglones) await borrarVenta(r.id, motivo, quien)
    return renglones.length
  })
}
