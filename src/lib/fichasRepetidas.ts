import type { MovimientoProveedor, Producto, Proveedor } from '../db/db'

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
  /** La que queda: la única de ese nombre con datos. */
  gemela: FichaConUso
}

export interface PlanRepetidas {
  /** Se pueden unir de una a su gemela. */
  vacias: RepetidaVacia[]
  /** Mismo nombre, con datos en más de una ficha: se unen a mano. */
  aMano: { nombre: string; fichas: FichaConUso[] }[]
  /** Mismo nombre, todas sin datos: no hay cuál elegir como la buena. Se dejan. */
  todasVacias: { nombre: string; fichas: Proveedor[] }[]
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

  const plan: PlanRepetidas = { vacias: [], aMano: [], todasVacias: [] }
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
        if (f !== gemela) plan.vacias.push({ vacia: f.proveedor, gemela })
      }
    } else if (conDatos.length > 1) {
      plan.aMano.push({
        nombre,
        fichas: conUso.sort((a, b) => b.productos - a.productos || b.movimientos - a.movimientos),
      })
    } else {
      plan.todasVacias.push({ nombre, fichas })
    }
  }
  plan.vacias.sort((a, b) => porNombre(a.vacia, b.vacia) || a.vacia.id.localeCompare(b.vacia.id))
  plan.aMano.sort(porNombre)
  plan.todasVacias.sort(porNombre)
  return plan
}
