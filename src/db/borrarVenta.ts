import { conMotivo, db, type Borrado } from './db'

/**
 * Borrar una venta suelta: la del renglón de Caja, o la que se deshace
 * apenas se cargó.
 *
 * Hasta el 22/10 el renglón de Caja la borraba sin dejar constancia en
 * `borrados`. Un celular que la tenía y estaba sin internet la volvía a
 * subir al reconectarse (empujarTodoLocal sube lo que el servidor no
 * tiene), y la venta reaparecía en la caja. Es el mismo problema que ya
 * resolvía borrarJornada para un turno entero.
 *
 * El stock se devuelve como lo hacía Caja: si el producto lleva stock,
 * vuelve la cantidad vendida.
 */

export const MOTIVO_BORRAR_VENTA = 'Venta borrada desde Caja'
export const MOTIVO_DESHACER_VENTA = 'Venta deshecha al momento de cargarla'

/** Cuánto dura el "Deshacer" después de registrar una venta. */
export const SEGUNDOS_PARA_DESHACER = 30

export function quedaParaDeshacer(registradaEn: number, ahora = Date.now()): number {
  return Math.max(0, Math.ceil(SEGUNDOS_PARA_DESHACER - (ahora - registradaEn) / 1000))
}

/** Devuelve false si la venta ya no estaba. */
export async function borrarVenta(id: string, motivo: string, quien: string | null): Promise<boolean> {
  return conMotivo(motivo, async () =>
    db.transaction('rw', [db.ventas, db.productos, db.borrados], async () => {
      const venta = await db.ventas.get(id)
      if (!venta) return false

      // La constancia primero, como en borrarJornada: de más no revive
      // nada, de menos sí.
      const constancia: Borrado = {
        id: `ventas/${id}`,
        tabla: 'ventas',
        clave: id,
        cuando: Date.now(),
        quien,
        motivo,
      }
      await db.borrados.put(constancia)
      await db.ventas.delete(id)

      const producto = await db.productos.get(venta.codigo)
      if (producto && producto.stock !== null && producto.stock !== undefined) {
        await db.productos.update(venta.codigo, { stock: producto.stock + venta.cantidad })
      }
      return true
    }),
  )
}
