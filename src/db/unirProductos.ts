import { conMotivo, db, type MovimientoProveedor, type Producto, type Venta } from './db'

/**
 * Unir dos productos que son el mismo, con códigos distintos.
 *
 * El 22/10 un cambio de código dejó MATERA RECTANGULAR dos veces, como
 * LST014 y LST016, y no había forma de juntarlos: cambiarle el código a
 * LST016 por LST014 se frena porque LST014 está ocupado, que es lo
 * correcto para un cambio de código y justo lo contrario de lo que hace
 * falta acá.
 *
 * Unir es parecido a cambiar el código, con una diferencia: el que queda
 * ya existe y manda. Conserva su descripción, su costo y su precio; del
 * que se va se llevan las ventas, las compras y el stock.
 *
 * El que se va se ARCHIVA, no se borra. Archivado no aparece en el
 * catálogo, en Caja ni en los selectores, y el servidor lo acepta con
 * las reglas de hoy. Un borrado, en cambio, necesita que las reglas lo
 * permitan y deja de ser visible en el historial de productos.
 */

export const MOTIVO_UNION_PRODUCTOS = 'Unión de productos repetidos'

export interface VistaPreviaUnionProductos {
  queda: Producto
  seVa: Producto
  ventas: number
  compras: number
  /** El stock con que queda el que queda. */
  stockFinal: number | null
  /** Si el stock del que se va se suma (si no tiene, no se toca nada). */
  sumaStock: boolean
}

function mencionan(movimiento: MovimientoProveedor, codigo: string): boolean {
  return (movimiento.items ?? []).some((i) => i.codigo === codigo)
}

/** Que pasaría si se unieran. No toca nada. */
export function armarUnionProductos(
  queda: Producto,
  seVa: Producto,
  ventas: Venta[],
  movimientos: MovimientoProveedor[],
): VistaPreviaUnionProductos {
  const sumaStock = typeof seVa.stock === 'number' && seVa.stock !== 0
  return {
    queda,
    seVa,
    ventas: ventas.filter((v) => v.codigo === seVa.codigo).length,
    compras: movimientos.filter((m) => mencionan(m, seVa.codigo)).length,
    stockFinal: sumaStock ? (queda.stock ?? 0) + (seVa.stock as number) : (queda.stock ?? null),
    sumaStock,
  }
}

export function textoDeConfirmacionUnionProductos(v: VistaPreviaUnionProductos): string {
  const partes = [
    `${v.seVa.codigo} "${v.seVa.descripcion}" se une con ${v.queda.codigo} "${v.queda.descripcion}".`,
    '',
    `· ${v.ventas} ventas de ${v.seVa.codigo} pasan a ${v.queda.codigo}`,
    `· ${v.compras} compras lo mencionan y se corrigen`,
  ]
  if (v.sumaStock) {
    partes.push(`· el stock se suma: ${v.queda.codigo} queda con ${v.stockFinal}`)
  }
  partes.push(
    `· ${v.queda.codigo} conserva su descripción, su costo y su precio`,
    `· ${v.seVa.codigo} queda archivado: no se ve más en el catálogo ni en Caja`,
    '',
    `Queda en el historial como «${MOTIVO_UNION_PRODUCTOS}».`,
    '',
    '¿Unir?',
  )
  return partes.join('\n')
}

export interface ResultadoUnionProductos {
  ventasTocadas: number
  comprasTocadas: number
}

export type FalloUnionProductos = 'no-existe' | 'es-el-mismo'

/**
 * Une, de verdad. Todo en una transacción: no puede quedar la mitad de
 * las ventas en cada código.
 */
export async function unirProductos(
  codigoQueSeVa: string,
  codigoQueQueda: string,
): Promise<ResultadoUnionProductos | FalloUnionProductos> {
  if (codigoQueSeVa === codigoQueQueda) return 'es-el-mismo'

  return conMotivo(MOTIVO_UNION_PRODUCTOS, async () =>
    db.transaction('rw', db.productos, db.ventas, db.movimientosProveedor, async () => {
      const seVa = await db.productos.get(codigoQueSeVa)
      const queda = await db.productos.get(codigoQueQueda)
      if (!seVa || !queda) return 'no-existe' as const

      const ventas = await db.ventas.where('codigo').equals(codigoQueSeVa).toArray()
      const movimientos = await db.movimientosProveedor.toArray()
      const vista = armarUnionProductos(queda, seVa, ventas, movimientos)

      for (const v of ventas) await db.ventas.update(v.id, { codigo: codigoQueQueda })

      const compras = movimientos.filter((m) => mencionan(m, codigoQueSeVa))
      for (const m of compras) {
        await db.movimientosProveedor.update(m.id, {
          items: (m.items ?? []).map((i) =>
            i.codigo === codigoQueSeVa ? { ...i, codigo: codigoQueQueda } : i,
          ),
        })
      }

      if (vista.sumaStock) await db.productos.update(codigoQueQueda, { stock: vista.stockFinal })

      await db.productos.update(codigoQueSeVa, {
        archivado: true,
        activo: false,
        stock: null,
      })

      return { ventasTocadas: ventas.length, comprasTocadas: compras.length }
    }),
  )
}
