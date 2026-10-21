import { conMotivo, db, type EntradaHistorial, type Producto } from './db'
import { idDeProveedor } from '../lib/idProveedor'
import { costoDesactualizado } from '../lib/calculos'

/**
 * Devolverle a los productos los costos y proveedores que se perdieron.
 *
 * El 20/10/2026 un celular rearmado desde el catalogo publico subio
 * productos vacios encima de los del servidor. Quedaron ~280 sin
 * proveedor y 120 sin costo.
 *
 * La regla de oro, y no se negocia: **solo se rellena lo que esta
 * vacio**. Nunca se pisa un valor cargado. Si no, recuperar lo viejo
 * borraria lo que Sandra cargo esta semana, que es exactamente el error
 * que estamos arreglando, al reves.
 *
 * Las fuentes se consultan en orden y gana la primera que tenga el
 * dato:
 *
 *   1. El historial de la app. Es la mas nueva y la mas precisa:
 *      guarda, producto por producto, el valor que tenia cada campo la
 *      ultima vez que cambio. Incluye los 1.506 renglones del 14/10,
 *      que son justamente los costos reales del servidor de ese dia.
 *   2. Lo que se cargue desde un archivo (el Excel, la foto de agosto).
 *
 * El costo viaja con su fecha. Un costo de agosto que entrara con la
 * fecha de hoy pasaria por actual y nadie lo volveria a mirar; con su
 * fecha de verdad, la app lo marca como "costo vencido" y queda en la
 * lista de lo que hay que actualizar, que es lo que corresponde.
 */

/** Lo que se puede recuperar de un producto. */
export interface ValoresProducto {
  precioCompra?: number | null
  fechaCompra?: string | null
  rentabilidad?: number | null
  proveedor?: string | null
}

export interface Fuente {
  nombre: string
  /** La fecha a la que corresponde, si el dato no trae la suya. */
  fecha?: string | null
  valores: Map<string, ValoresProducto>
}

export interface CambioRecuperado {
  codigo: string
  descripcion: string
  /** De que fuente salio el costo, si se recupera. */
  fuenteCosto?: string
  /** De que fuente salio el proveedor, si se recupera. */
  fuenteProveedor?: string
  precioCompra?: number
  fechaCompra?: string | null
  rentabilidad?: number | null
  proveedor?: string
  proveedorId?: string
}

export interface PlanRecuperacion {
  cambios: CambioRecuperado[]
  /** Cuantos costos y proveedores recupera cada fuente. */
  porFuente: { nombre: string; costos: number; proveedores: number }[]
  /** Productos a los que les falta algo y ninguna fuente lo tiene. */
  sinFuente: number
  costosVacios: number
  proveedoresVacios: number
  /**
   * De los costos que se recuperan, cuantos quedan marcados como
   * vencidos por la fecha con la que entran.
   *
   * Es el numero que importa mirar: un costo viejo que entrara con la
   * fecha de hoy pasaria por actual y nadie lo volveria a tocar. Con su
   * fecha de verdad, la app lo deja en la lista de lo que hay que
   * actualizar, que es donde corresponde que este.
   */
  costosVencidos: number
}

/** Los campos de producto que el historial sabe reconstruir. */
const CAMPOS = ['precioCompra', 'fechaCompra', 'rentabilidad', 'proveedor'] as const

/**
 * El ultimo valor conocido de cada campo, segun el historial.
 *
 * Se queda con el renglon mas nuevo que tenga un valor de verdad: si
 * el ultimo cambio fue justamente el que lo vacio, sirve el anterior.
 */
export function valoresDelHistorial(renglones: EntradaHistorial[]): Map<string, ValoresProducto> {
  const porProducto = new Map<string, ValoresProducto>()
  const cuandoDe = new Map<string, number>()

  for (const r of renglones) {
    if (r.tabla !== 'productos' || !r.campo) continue
    if (!(CAMPOS as readonly string[]).includes(r.campo)) continue
    if (r.valorNuevo === null || r.valorNuevo === undefined || r.valorNuevo === '') continue

    const clave = `${r.clave}|${r.campo}`
    if ((cuandoDe.get(clave) ?? -1) >= r.cuando) continue
    cuandoDe.set(clave, r.cuando)

    const actual = porProducto.get(r.clave) ?? {}
    ;(actual as Record<string, unknown>)[r.campo] = r.valorNuevo
    porProducto.set(r.clave, actual)
  }
  return porProducto
}

/** Un numero de verdad, o nada. */
function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

export function armarPlanRecuperacion(productos: Producto[], fuentes: Fuente[]): PlanRecuperacion {
  const cambios: CambioRecuperado[] = []
  const conteo = new Map<string, { costos: number; proveedores: number }>()
  for (const f of fuentes) conteo.set(f.nombre, { costos: 0, proveedores: 0 })

  let costosVacios = 0
  let proveedoresVacios = 0
  let sinFuente = 0
  let costosVencidos = 0

  for (const p of productos) {
    if (p.archivado === true) continue
    const faltaCosto = p.precioCompra == null
    const faltaProveedor = !p.proveedor?.trim()
    if (!faltaCosto && !faltaProveedor) continue
    if (faltaCosto) costosVacios++
    if (faltaProveedor) proveedoresVacios++

    const cambio: CambioRecuperado = { codigo: p.codigo, descripcion: p.descripcion }

    // El costo viaja con su fecha y su rentabilidad: salen todos de la
    // misma fuente o no salen. Mezclar el costo de una con la fecha de
    // otra deja un dato que no existio nunca.
    if (faltaCosto) {
      for (const f of fuentes) {
        const valor = numero(f.valores.get(p.codigo)?.precioCompra)
        if (valor == null) continue
        cambio.precioCompra = valor
        cambio.fechaCompra = texto(f.valores.get(p.codigo)?.fechaCompra) ?? f.fecha ?? null
        cambio.rentabilidad = numero(f.valores.get(p.codigo)?.rentabilidad)
        cambio.fuenteCosto = f.nombre
        conteo.get(f.nombre)!.costos++
        break
      }
    }

    if (faltaProveedor) {
      for (const f of fuentes) {
        const nombre = texto(f.valores.get(p.codigo)?.proveedor)
        if (!nombre) continue
        cambio.proveedor = nombre
        // Tambien el id derivado del nombre: si la ficha existe queda
        // enganchado, y si no, queda como "proveedor inexistente", que
        // es lo que el boton de "Ver y asociar" sabe resolver.
        cambio.proveedorId = idDeProveedor(nombre)
        cambio.fuenteProveedor = f.nombre
        conteo.get(f.nombre)!.proveedores++
        break
      }
    }

    if (cambio.fuenteCosto || cambio.fuenteProveedor) {
      // La misma regla que usa el resto de la app, no una copia: si
      // manana se cambia de seis meses a tres, este numero la sigue.
      if (
        cambio.precioCompra != null &&
        costoDesactualizado({
          ...p,
          precioCompra: cambio.precioCompra,
          fechaCompra: cambio.fechaCompra ?? null,
        })
      ) {
        costosVencidos++
      }
      cambios.push(cambio)
    } else sinFuente++
  }

  return {
    cambios,
    porFuente: fuentes.map((f) => ({ nombre: f.nombre, ...conteo.get(f.nombre)! })),
    sinFuente,
    costosVacios,
    proveedoresVacios,
    costosVencidos,
  }
}

/**
 * Lo que dice la confirmacion antes de aplicar.
 *
 * Dice cuantos registros toca y cuantos campos de cada tipo, porque una
 * operacion que escribe en cientos de productos de una se confirma
 * sabiendo el tamano de lo que se esta por hacer.
 */
export function textoDeConfirmacionRecuperacion(plan: PlanRecuperacion): string {
  const costos = plan.cambios.filter((c) => c.precioCompra != null).length
  const proveedores = plan.cambios.filter((c) => c.proveedor).length
  const partes = []
  if (costos > 0) partes.push(`${costos} costos`)
  if (proveedores > 0) partes.push(`${proveedores} proveedores`)
  return [
    `Se van a rellenar ${partes.join(' y ')} en ${plan.cambios.length} productos.`,
    'Solo se escribe donde esta vacio: ningun dato cargado se pisa.',
    `Queda todo en el historial como «${MOTIVO_RECUPERACION}».`,
    '',
    '¿Aplicar?',
  ].join('\n')
}

export const MOTIVO_RECUPERACION = 'Recuperación de costos y proveedores'

/**
 * Aplica el plan. Vuelve a mirar cada producto antes de escribirlo: lo
 * que se decidio hace unos segundos puede haber cambiado, y rellenar
 * algo que mientras tanto alguien cargo seria pisarlo.
 */
export async function aplicarPlanRecuperacion(plan: PlanRecuperacion): Promise<number> {
  let tocados = 0
  await conMotivo(MOTIVO_RECUPERACION, async () => {
    for (const cambio of plan.cambios) {
      const producto = await db.productos.get(cambio.codigo)
      if (!producto) continue

      const aplicar: Partial<Producto> = {}
      if (cambio.precioCompra != null && producto.precioCompra == null) {
        aplicar.precioCompra = cambio.precioCompra
        aplicar.fechaCompra = cambio.fechaCompra ?? null
        if (cambio.rentabilidad != null && producto.rentabilidad == null) {
          aplicar.rentabilidad = cambio.rentabilidad
        }
      }
      if (cambio.proveedor && !producto.proveedor?.trim()) {
        aplicar.proveedor = cambio.proveedor
        if (!producto.proveedorId) aplicar.proveedorId = cambio.proveedorId
      }

      if (Object.keys(aplicar).length === 0) continue
      await db.productos.update(cambio.codigo, aplicar)
      tocados++
    }
  })
  return tocados
}
