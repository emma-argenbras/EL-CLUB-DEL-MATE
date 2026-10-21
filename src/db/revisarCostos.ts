import { conMotivo, db, type Producto } from './db'
import { costoDesactualizado } from '../lib/calculos'
import { hoyISO } from '../lib/formato'

/**
 * Corregir costos de a muchos, sin entrar producto por producto.
 *
 * Sandra actualiza costos mirando las facturas del proveedor: abre la
 * lista de ese proveedor y va corrigiendo los que estan vacios o
 * vencidos. Entrando y saliendo de cada ficha, de a 100 productos, eso
 * no se termina nunca.
 *
 * Se escriben DOS campos y nada mas --el costo y su fecha-- y solo en
 * los renglones que ella toca. El precio de venta, la rentabilidad, el
 * stock y el proveedor quedan como estan: esta pantalla corrige costos,
 * no es un editor de productos.
 */

export const MOTIVO_REVISION_COSTOS = 'Revisión de costos'

/** Por que este producto esta en la lista de trabajo. */
export type MotivoRevision = 'sin-costo' | 'vencido'

export interface ParaRevisar {
  producto: Producto
  motivo: MotivoRevision
}

/**
 * Los productos que hay que mirar, de un proveedor o de todos.
 *
 * Primero los que no tienen costo --ahi el margen directamente no se
 * puede calcular-- y despues los vencidos, del mas viejo al mas nuevo,
 * que es el orden en que conviene atacarlos.
 */
export function productosParaRevisar(
  productos: Producto[],
  proveedorId: string | null,
): ParaRevisar[] {
  const salida: ParaRevisar[] = []
  for (const producto of productos) {
    if (producto.archivado) continue
    // Un descontinuado no se repone: su costo viejo no le molesta a
    // nadie y llenaria la lista de trabajo con ruido.
    if (producto.descontinuado) continue
    if (proveedorId && producto.proveedorId !== proveedorId) continue
    if (producto.precioCompra == null) salida.push({ producto, motivo: 'sin-costo' })
    else if (costoDesactualizado(producto)) salida.push({ producto, motivo: 'vencido' })
  }

  return salida.sort((a, b) => {
    if (a.motivo !== b.motivo) return a.motivo === 'sin-costo' ? -1 : 1
    const fa = a.producto.fechaCompra ?? ''
    const fb = b.producto.fechaCompra ?? ''
    if (fa !== fb) return fa < fb ? -1 : 1
    return a.producto.codigo.localeCompare(b.producto.codigo)
  })
}

export type ResultadoGuardar =
  | { estado: 'guardado' }
  | { estado: 'no-existe' }
  /** Alguien lo cambio entre que se dibujo la lista y que ella guardo. */
  | { estado: 'cambio-mientras-tanto'; costoAhora: number | null }

/**
 * Guarda el costo de un producto, si nadie lo movio mientras tanto.
 *
 * `costoQueSeVeia` es el costo que la lista tenia dibujado cuando ella
 * escribio el nuevo. Si en el servidor ya es otro, alguien lo corrigio
 * en el medio --desde otro celular, o el propio motor de
 * sincronizacion-- y guardar seria pisarle el trabajo. En ese caso no
 * se escribe nada y se avisa, que es lo unico honesto: la pantalla no
 * puede saber cual de los dos es el bueno.
 */
export async function guardarCosto(
  codigo: string,
  costoNuevo: number,
  costoQueSeVeia: number | null,
): Promise<ResultadoGuardar> {
  return conMotivo(MOTIVO_REVISION_COSTOS, async () => {
    const producto = await db.productos.get(codigo)
    if (!producto) return { estado: 'no-existe' } as const

    const costoAhora = producto.precioCompra ?? null
    if (costoAhora !== costoQueSeVeia) {
      return { estado: 'cambio-mientras-tanto', costoAhora } as const
    }

    await db.productos.update(codigo, { precioCompra: costoNuevo, fechaCompra: hoyISO() })
    return { estado: 'guardado' } as const
  })
}
