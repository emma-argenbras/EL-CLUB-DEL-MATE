import { conMotivo, db } from './db'

/**
 * Resolver una venta sin código: decir qué producto era.
 *
 * Se le pone el código y la descripción del producto, y el costo de hoy
 * (el del momento de la venta no se conoce: es la misma aproximación que
 * usa un cambio). Si el producto lleva stock, se descuenta ahora lo que
 * salió entonces.
 *
 * Es de a una venta y la elige una persona: no hay asignaciones en
 * bloque. El historial guarda lo que decía antes.
 */

export type ResultadoAsignacion =
  | { estado: 'asignada' }
  | { estado: 'no-existe' }
  /** Ya tiene código: alguien la resolvió mientras tanto. */
  | { estado: 'ya-tiene-codigo'; codigo: string }
  | { estado: 'producto-no-existe' }

export function motivoAsignacion(descripcionOriginal: string, codigo: string): string {
  return `Venta sin código («${descripcionOriginal}») asignada a ${codigo}`
}

export async function asignarVentaSinCodigo(
  ventaId: string,
  codigo: string,
): Promise<ResultadoAsignacion> {
  const venta = await db.ventas.get(ventaId)
  if (!venta) return { estado: 'no-existe' }

  return conMotivo(motivoAsignacion(venta.descripcion, codigo), async () =>
    db.transaction('rw', db.ventas, db.productos, async () => {
      const actual = await db.ventas.get(ventaId)
      if (!actual) return { estado: 'no-existe' } as const
      if (actual.codigo) return { estado: 'ya-tiene-codigo', codigo: actual.codigo } as const
      const producto = await db.productos.get(codigo)
      if (!producto) return { estado: 'producto-no-existe' } as const

      await db.ventas.update(ventaId, {
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        costoUnitario: producto.precioCompra ?? null,
      })
      if (producto.stock !== null && producto.stock !== undefined) {
        await db.productos.update(producto.codigo, { stock: producto.stock - actual.cantidad })
      }
      return { estado: 'asignada' } as const
    }),
  )
}
