import type { MovimientoProveedor, Producto, Proveedor } from '../db/db'
import { idDeProveedor } from './idProveedor'

/**
 * Las fichas de proveedor que tienen el mismo nombre exacto que otra.
 *
 * El 10/11 se encontraron 94 en el servidor, todas de la importación del
 * 18/08: fichas sin un solo producto ni compra ni pago, al lado de su
 * gemela, que es la que tiene los productos. Esas se pueden unir de una
 * (ver unirFichasVacias). Si dos fichas del mismo nombre tienen datos,
 * no hay forma de saber cuál es la buena sin mirar: se unen a mano, de a
 * una, desde la misma pantalla.
 *
 * Si TODAS las del nombre están vacías (20/11), tampoco hay nada que
 * perder: ninguna tiene productos, compras ni pagos. Queda una y las demás
 * se le unen en la misma pasada (ver quedaEntreVacias), así la limpieza
 * se hace de una vez y no deja nombres repetidos sueltos.
 *
 * Mismo nombre EXACTO quiere decir el mismo texto, sin los espacios de
 * las puntas. Los parecidos (SALDO y SALDOS) siguen en las sugerencias
 * de siempre (fichasParecidas): esos los decide una persona.
 */

export interface FichaConUso {
  proveedor: Proveedor
  productos: number
  /** Compras y pagos de su cuenta corriente. */
  movimientos: number
}

export interface RepetidaVacia {
  /** La que se une: sin productos, sin compras y sin pagos. */
  vacia: Proveedor
  /**
   * La que queda: la única de ese nombre con datos o, si todas están
   * vacías, la que eligió quedaEntreVacias.
   */
  gemela: FichaConUso
  /** Todas las de ese nombre están vacías: la gemela tampoco tiene datos. */
  todasVacias: boolean
}

export interface PlanRepetidas {
  /** Se pueden unir de una a su gemela. */
  vacias: RepetidaVacia[]
  /** Mismo nombre, con datos en más de una ficha: se unen a mano. */
  aMano: { nombre: string; fichas: FichaConUso[] }[]
}

/** Los datos de contacto y pago que tiene cargados una ficha. */
const DATOS: (keyof Proveedor)[] = ['contacto', 'notas', 'comoSeCompra', 'web', 'aliasCbu', 'titular', 'ciudad']
function datosCargados(p: Proveedor): number {
  const cargado = (v: unknown) => (typeof v === 'string' ? v.trim() !== '' : v != null)
  return DATOS.filter((campo) => cargado(p[campo])).length + (p.alias?.length ? 1 : 0)
}

/**
 * Cuál queda cuando todas las del nombre están vacías. Primero la que ya
 * tiene el id de su nombre (ver idProveedor.ts): es a la que llegan la
 * importación del Excel y cualquier aparato. Después, la que tiene más
 * datos cargados, la activa, la más vieja.
 */
export function quedaEntreVacias(nombre: string, fichas: Proveedor[]): Proveedor {
  const id = idDeProveedor(nombre)
  return [...fichas].sort(
    (a, b) =>
      Number(b.id === id) - Number(a.id === id) ||
      datosCargados(b) - datosCargados(a) ||
      Number(b.activo !== false) - Number(a.activo !== false) ||
      (a.creadoEn ?? Number.MAX_SAFE_INTEGER) - (b.creadoEn ?? Number.MAX_SAFE_INTEGER) ||
      a.id.localeCompare(b.id),
  )[0]
}

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es')

export function planDeRepetidas(
  proveedores: Proveedor[],
  productos: Pick<Producto, 'proveedorId'>[],
  movimientos: Pick<MovimientoProveedor, 'proveedorId'>[],
): PlanRepetidas {
  const productosDe = new Map<string, number>()
  for (const p of productos) {
    if (p.proveedorId) productosDe.set(p.proveedorId, (productosDe.get(p.proveedorId) ?? 0) + 1)
  }
  const movimientosDe = new Map<string, number>()
  for (const m of movimientos) movimientosDe.set(m.proveedorId, (movimientosDe.get(m.proveedorId) ?? 0) + 1)

  const grupos = new Map<string, Proveedor[]>()
  for (const p of proveedores) {
    const nombre = p.nombre.trim()
    if (!nombre) continue
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), p])
  }

  const plan: PlanRepetidas = { vacias: [], aMano: [] }
  for (const [nombre, fichas] of grupos) {
    if (fichas.length < 2) continue
    const conUso: FichaConUso[] = fichas.map((proveedor) => ({
      proveedor,
      productos: productosDe.get(proveedor.id) ?? 0,
      movimientos: movimientosDe.get(proveedor.id) ?? 0,
    }))
    const conDatos = conUso.filter((f) => f.productos + f.movimientos > 0)
    if (conDatos.length === 1) {
      const [gemela] = conDatos
      for (const f of conUso) {
        if (f !== gemela) plan.vacias.push({ vacia: f.proveedor, gemela, todasVacias: false })
      }
    } else if (conDatos.length > 1) {
      plan.aMano.push({
        nombre,
        fichas: conUso.sort((a, b) => b.productos - a.productos || b.movimientos - a.movimientos),
      })
    } else {
      const queda = quedaEntreVacias(nombre, fichas)
      const gemela = conUso.find((f) => f.proveedor === queda)!
      for (const f of conUso) {
        if (f !== gemela) plan.vacias.push({ vacia: f.proveedor, gemela, todasVacias: true })
      }
    }
  }
  plan.vacias.sort((a, b) => porNombre(a.vacia, b.vacia) || a.vacia.id.localeCompare(b.vacia.id))
  plan.aMano.sort(porNombre)
  return plan
}
