import {
  conMotivo,
  db,
  nuevoId,
  type CriterioFlete,
  type FleteCompra,
  type ItemCompra,
  type MovimientoProveedor,
  type Producto,
} from './db'
import { precioAtrasado, precioSugerido } from '../lib/calculos'
import { hoyISO } from '../lib/formato'

/**
 * El ingreso de mercaderia (puntos 10 y 11 del pedido del 06/11).
 *
 * Lo que llego de un proveedor, contado, con su costo y --si vino por
 * transporte-- el flete repartido entre los productos. Hasta el 06/11 la
 * compra se cargaba adentro del proveedor eligiendo cada producto de una
 * lista con los 1.300 del catalogo, y el flete no tenia donde ir: o no
 * se contaba, o se cargaba como gasto y el costo de los productos quedaba
 * por debajo del real.
 *
 * Se guarda como siempre, sin tabla nueva: un movimiento de proveedor de
 * tipo «compra» con sus renglones. Lo nuevo es opcional: el flete, el
 * numero de remito o factura, y en cada renglon el costo con flete.
 *
 * Que es cada monto:
 * - Lo que se le debe al proveedor (`monto`) es la mercaderia sin flete:
 *   el flete no lo cobra el, lo cobra el transporte.
 * - El costo que queda en cada producto es el de la factura MAS su parte
 *   del flete: es lo que de verdad costo tenerlo en el local, y es el que
 *   usan el margen y el precio sugerido.
 *
 * Como se reparte el flete: los sistemas de gestion grandes lo llaman
 * «costos de importacion» o «gastos de compra» y ofrecen varios criterios
 * (Odoo: igual, por cantidad, por costo, por peso, por volumen). Para el
 * local alcanzan dos: por costo (cada producto carga en proporcion a lo
 * que vale, el que va por defecto) y por unidades (cada unidad carga lo
 * mismo, para cuando los productos son parecidos).
 */

export interface RenglonIngreso {
  producto: Producto
  cantidad: number
  /** El costo por unidad de la factura, sin flete. */
  costoUnitario: number
}

export const ETIQUETA_CRITERIO: Record<CriterioFlete, string> = {
  costo: 'Por costo',
  unidades: 'Por unidades',
}

const centavos = (n: number) => Math.round(n * 100)
const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Cuanto flete le toca a cada renglon, en pesos, y cuanto a cada unidad.
 * La parte de cada renglon suma exacto el flete, al centavo (metodo del
 * mayor resto); lo de cada unidad se redondea al centavo.
 */
export function repartirFlete(
  renglones: Pick<RenglonIngreso, 'cantidad' | 'costoUnitario'>[],
  flete: number,
  criterio: CriterioFlete,
): { porRenglon: number[]; porUnidad: number[] } {
  const ceros = { porRenglon: renglones.map(() => 0), porUnidad: renglones.map(() => 0) }
  const total = centavos(flete)
  if (total <= 0 || renglones.length === 0) return ceros
  const porUnidades = renglones.map((r) => Math.max(0, r.cantidad))
  const porCosto = renglones.map((r) => Math.max(0, r.cantidad) * Math.max(0, r.costoUnitario))
  // Por costo, si nada tiene costo (todo bonificado), se reparte por unidades.
  const pesos = criterio === 'costo' && porCosto.some((p) => p > 0) ? porCosto : porUnidades
  const suma = pesos.reduce((s, p) => s + p, 0)
  if (suma <= 0) return ceros

  const exactos = pesos.map((p) => (total * p) / suma)
  const partes = exactos.map((x) => Math.floor(x))
  let resto = total - partes.reduce((s, p) => s + p, 0)
  const porResto = exactos
    .map((x, i) => ({ i, fraccion: x - Math.floor(x) }))
    .sort((a, b) => b.fraccion - a.fraccion || a.i - b.i)
  for (const { i } of porResto) {
    if (resto <= 0) break
    partes[i] += 1
    resto -= 1
  }
  return {
    porRenglon: partes.map((c) => c / 100),
    porUnidad: partes.map((c, i) => (renglones[i].cantidad > 0 ? redondear(c / 100 / renglones[i].cantidad) : 0)),
  }
}

/** Que le falta al ingreso para poder registrarse, o null si esta listo. */
export function problemaDelIngreso(
  proveedorId: string | null,
  renglones: Pick<RenglonIngreso, 'cantidad' | 'costoUnitario'>[],
  flete: number,
): string | null {
  if (!proveedorId) return 'Elegí el proveedor.'
  if (renglones.length === 0) return 'Sumá al menos un producto.'
  if (renglones.some((r) => !(r.cantidad > 0))) return 'Cada producto tiene que tener la cantidad que llegó.'
  if (renglones.some((r) => !Number.isFinite(r.costoUnitario) || r.costoUnitario < 0)) {
    return 'Cada producto tiene que tener su costo (0 si vino bonificado).'
  }
  if (!Number.isFinite(flete) || flete < 0) return 'El flete no puede ser negativo.'
  return null
}

/** Lo que cambia en el costo de cada producto, y el precio que pediria su rentabilidad. */
export interface CambioDeCosto {
  codigo: string
  descripcion: string
  antes: number | null
  ahora: number
  /** En porcentaje; null si antes no tenia costo. */
  variacion: number | null
  precioVenta: number | null
  /** Con la rentabilidad del producto y el costo nuevo; null si no tiene rentabilidad. */
  sugerido: number | null
  /**
   * Con el costo nuevo, el precio quedo por debajo de su rentabilidad. Es
   * la misma cuenta que el aviso del Panel «mas baratos de lo que dice su
   * rentabilidad» (precioAtrasado): 5 % de tolerancia, y un descontinuado
   * no cuenta porque se esta liquidando.
   */
  atrasado: boolean
}

export function cambiosDeCosto(
  renglones: RenglonIngreso[],
  porUnidad: number[],
): { subieron: CambioDeCosto[]; todos: CambioDeCosto[] } {
  const todos = renglones.map((r, i): CambioDeCosto => {
    const ahora = redondear(r.costoUnitario + (porUnidad.at(i) ?? 0))
    const antes = r.producto.precioCompra ?? null
    const conCostoNuevo = { ...r.producto, precioCompra: ahora }
    return {
      codigo: r.producto.codigo,
      descripcion: r.producto.descripcion,
      antes,
      ahora,
      variacion: antes ? redondear(((ahora - antes) / antes) * 100) : null,
      precioVenta: r.producto.precioVenta ?? null,
      sugerido: precioSugerido(conCostoNuevo),
      atrasado: precioAtrasado(conCostoNuevo) !== null,
    }
  })
  return { subieron: todos.filter((c) => c.antes != null && c.ahora > c.antes), todos }
}

/** Los productos cuyo precio de venta quedo abajo de lo que pide su rentabilidad. */
export function paraRemarcar(cambios: CambioDeCosto[]): CambioDeCosto[] {
  return cambios.filter((c) => c.atrasado && c.sugerido != null)
}

export function motivoIngreso(proveedor: string, comprobante: string | null): string {
  return `Ingreso de mercadería de ${proveedor}${comprobante ? ` (${comprobante})` : ''}`
}

/**
 * Guarda el ingreso: el movimiento del proveedor, el stock y el costo de
 * cada producto, todo junto. Queda en el historial con el motivo, asi los
 * costos que cambiaron se leen como un ingreso y no como ediciones sueltas.
 */
export async function registrarIngreso(datos: {
  proveedor: { id: string; nombre: string }
  fecha: string
  comprobante: string | null
  notas: string | null
  renglones: RenglonIngreso[]
  flete: { monto: number; criterio: CriterioFlete; transportista: string | null } | null
  quien: string | null
}): Promise<{ id: string; items: ItemCompra[] }> {
  const montoFlete = datos.flete?.monto ?? 0
  const problema = problemaDelIngreso(datos.proveedor.id, datos.renglones, montoFlete)
  if (problema) throw new Error(problema)
  const { porUnidad } = repartirFlete(datos.renglones, montoFlete, datos.flete?.criterio ?? 'costo')
  const id = nuevoId()
  const comprobante = datos.comprobante?.trim() || null

  let items: ItemCompra[] = []
  await conMotivo(motivoIngreso(datos.proveedor.nombre, comprobante), () =>
    db.transaction('rw', db.movimientosProveedor, db.productos, async () => {
      items = []
      for (const [i, r] of datos.renglones.entries()) {
        // Se lee de la base: el stock que se suma es el de este momento.
        const producto = await db.productos.get(r.producto.codigo)
        if (!producto) throw new Error(`No encuentro el producto ${r.producto.codigo}. Volvé a elegirlo.`)
        items.push({
          codigo: producto.codigo,
          descripcion: producto.descripcion,
          cantidad: r.cantidad,
          costoUnitario: r.costoUnitario,
          costoConFlete: montoFlete > 0 ? redondear(r.costoUnitario + (porUnidad.at(i) ?? 0)) : null,
        })
      }
      const flete: FleteCompra | null =
        montoFlete > 0
          ? {
              monto: redondear(montoFlete),
              criterio: datos.flete!.criterio,
              transportista: datos.flete!.transportista?.trim() || null,
            }
          : null
      const registro: MovimientoProveedor = {
        id,
        proveedorId: datos.proveedor.id,
        tipo: 'compra',
        fecha: datos.fecha,
        monto: redondear(items.reduce((s, it) => s + it.cantidad * it.costoUnitario, 0)),
        medioPago: null,
        items,
        flete,
        comprobante,
        notas: datos.notas?.trim() || null,
        creadoPor: datos.quien,
      }
      await db.movimientosProveedor.add(registro)
      for (const it of items) {
        const producto = await db.productos.get(it.codigo)
        if (!producto) continue
        await db.productos.update(it.codigo, {
          stock: producto.stock != null ? producto.stock + it.cantidad : it.cantidad,
          precioCompra: it.costoConFlete ?? it.costoUnitario,
          fechaCompra: datos.fecha,
        })
      }
    }),
  )
  return { id, items }
}

/**
 * Pone el precio sugerido a los productos elegidos. Escribe en varios
 * productos de una: la pantalla pregunta antes diciendo cuantos, y queda
 * en el historial con el motivo.
 */
export async function remarcar(
  cambios: { codigo: string; precioNuevo: number }[],
  motivo: string,
): Promise<number> {
  let hechos = 0
  await conMotivo(motivo, () =>
    db.transaction('rw', db.productos, async () => {
      for (const c of cambios) {
        if (!(c.precioNuevo > 0)) continue
        const producto = await db.productos.get(c.codigo)
        if (!producto || producto.precioVenta === c.precioNuevo) continue
        await db.productos.update(c.codigo, { precioVenta: c.precioNuevo, fechaPrecioVenta: hoyISO() })
        hechos++
      }
    }),
  )
  return hechos
}

/** Las compras de un producto, de la mas nueva a la mas vieja (punto 17: historial por codigo). */
export interface CompraDeProducto {
  fecha: string
  proveedorId: string
  cantidad: number
  costoUnitario: number
  costoConFlete: number | null
  comprobante: string | null
}

export function comprasDeProducto(codigo: string, movimientos: MovimientoProveedor[]): CompraDeProducto[] {
  const lista: CompraDeProducto[] = []
  for (const m of movimientos) {
    if (m.tipo !== 'compra' || !m.items) continue
    for (const it of m.items) {
      if (it.codigo !== codigo) continue
      lista.push({
        fecha: m.fecha,
        proveedorId: m.proveedorId,
        cantidad: it.cantidad,
        costoUnitario: it.costoUnitario,
        costoConFlete: it.costoConFlete ?? null,
        comprobante: m.comprobante ?? null,
      })
    }
  }
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
}
