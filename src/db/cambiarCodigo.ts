import {
  conMotivo,
  db,
  type Borrado,
  type MovimientoProveedor,
  type Producto,
  type Venta,
} from './db'
import { normalizar } from '../lib/formato'

/**
 * Cambiarle el código a un producto que ya existe.
 *
 * Por qué hace falta: el código es la clave del producto, así que hasta
 * ahora no se podía tocar. Cuando Sandra necesitaba renumerar algo se
 * iba al Excel viejo, lo ordenaba ahí y lo pasaba a mano — y el Excel y
 * la app terminaron diciendo cosas distintas sobre los mismos códigos.
 *
 * Cambiar el código NO es editar un campo: es mudar el producto y todo
 * lo que cuelga de él. Si se moviera solo el producto, las ventas
 * quedarían apuntando a un código que ya no existe.
 *
 * Esto también resuelve el otro pedido de Sandra --"poder borrar
 * productos para liberar códigos"-- sin borrar nada: le cambia el
 * código al producto y el viejo queda libre.
 */

export const MOTIVO_CAMBIO_CODIGO = 'Cambio de código de producto'

export interface VistaPreviaCambioCodigo {
  producto: Producto
  codigoNuevo: string
  ventas: number
  /** Compras que tienen a este producto en alguna de sus líneas. */
  compras: number
  /**
   * Renglones de historial del código viejo.
   *
   * No se mueven: el historial no se puede editar ni acá ni en el
   * servidor, y es a propósito. Se muestran para que quien cambia el
   * código sepa que ese rastro queda bajo el código anterior.
   */
  historialQueQueda: number
}

/** Las líneas de compra que mencionan este código. */
function mencionan(movimiento: MovimientoProveedor, codigo: string): boolean {
  return (movimiento.items ?? []).some((i) => i.codigo === codigo)
}

export function armarCambioCodigo(
  producto: Producto,
  codigoNuevo: string,
  ventas: Venta[],
  movimientos: MovimientoProveedor[],
  renglonesDeHistorial: number,
): VistaPreviaCambioCodigo {
  return {
    producto,
    codigoNuevo,
    ventas: ventas.filter((v) => v.codigo === producto.codigo).length,
    compras: movimientos.filter((m) => mencionan(m, producto.codigo)).length,
    historialQueQueda: renglonesDeHistorial,
  }
}

export function textoDeConfirmacionCambioCodigo(v: VistaPreviaCambioCodigo): string {
  const partes = [
    `El producto "${v.producto.descripcion}" pasa de ${v.producto.codigo} a ${v.codigoNuevo}.`,
    '',
  ]
  if (v.ventas > 0) partes.push(`· ${v.ventas} ventas pasan al código nuevo`)
  if (v.compras > 0) partes.push(`· ${v.compras} compras lo mencionan y se corrigen`)
  if (v.historialQueQueda > 0) {
    partes.push(
      `· ${v.historialQueQueda} renglones de historial quedan bajo ${v.producto.codigo}: el historial no se puede editar`,
    )
  }
  partes.push(`· el código ${v.producto.codigo} queda libre`)
  partes.push('', `Queda en el historial como «${MOTIVO_CAMBIO_CODIGO}».`, '', '¿Cambiar?')
  return partes.join('\n')
}

export interface ResultadoCambioCodigo {
  ventasTocadas: number
  comprasTocadas: number
}

export type FalloCambioCodigo = 'no-existe' | 'es-el-mismo' | 'ocupado'

/** La clave de la constancia de un producto borrado (ver Borrado en db.ts). */
export function claveDeBorrado(codigo: string): string {
  return `productos/${codigo}`
}

/**
 * Un código que vuelve a usarse deja de estar "borrado".
 *
 * La constancia existe para que un dispositivo atrasado no resucite el
 * producto viejo. Si el código se le da a otro producto, esa constancia
 * ya no habla de lo que hay: dejarla haría que, si el producto nuevo no
 * llegara a subir en el momento, el control de inicio no lo subiera
 * nunca, porque lo tomaría por el viejo.
 */
export async function olvidarBorrado(codigo: string): Promise<void> {
  const clave = claveDeBorrado(codigo)
  if (await db.borrados.get(clave)) await db.borrados.delete(clave)
}

/**
 * Cambia el código, de verdad.
 *
 * Todo en una transacción: si algo falla a mitad de camino no puede
 * quedar el producto con el código nuevo y las ventas apuntando al
 * viejo.
 */
export async function cambiarCodigo(
  codigoViejo: string,
  codigoNuevo: string,
  quien: string | null = null,
): Promise<ResultadoCambioCodigo | FalloCambioCodigo> {
  const nuevo = codigoNuevo.trim().toUpperCase()
  if (!nuevo) return 'no-existe'
  if (nuevo === codigoViejo) return 'es-el-mismo'

  return conMotivo(MOTIVO_CAMBIO_CODIGO, async () =>
    db.transaction('rw', [db.productos, db.ventas, db.movimientosProveedor, db.borrados], async () => {
      const producto = await db.productos.get(codigoViejo)
      if (!producto) return 'no-existe' as const
      if (await db.productos.get(nuevo)) return 'ocupado' as const

      // 1. Las ventas. Sin esto, el reporte de lo vendido pierde el
      //    producto y el stock deja de cerrar.
      const ventas = await db.ventas.where('codigo').equals(codigoViejo).toArray()
      for (const v of ventas) await db.ventas.update(v.id, { codigo: nuevo })

      // 2. Las líneas de las compras.
      const movimientos = await db.movimientosProveedor.toArray()
      const compras = movimientos.filter((m) => mencionan(m, codigoViejo))
      for (const m of compras) {
        await db.movimientosProveedor.update(m.id, {
          items: (m.items ?? []).map((i) =>
            i.codigo === codigoViejo ? { ...i, codigo: nuevo } : i,
          ),
        })
      }

      // 3. El producto: nace con el código nuevo y muere con el viejo.
      //    En ese orden, para que no haya un instante sin producto.
      //    `busqueda` se rehace: lleva el código adentro.
      await db.productos.add({
        ...producto,
        codigo: nuevo,
        busqueda: normalizar(`${nuevo} ${producto.descripcion ?? ''}`),
        actualizadoEn: Date.now(),
      })
      await olvidarBorrado(nuevo)

      // El viejo primero se archiva y recien despues se borra. No es
      // redundante: el servidor acepta el archivado siempre, pero el
      // borrado solo si las reglas lo permiten para productos (hasta el
      // 22/10 decian "allow delete: if false"). Si el borrado llegara a
      // rechazarse, lo que queda alla es un producto archivado, sin
      // stock e inactivo: invisible en las listas, el catalogo y los
      // selectores, y sin duplicar nada. Un borrado rechazado en
      // silencio, en cambio, dejaba el codigo viejo vivo en todos los
      // otros celulares con el producto repartido entre dos codigos.
      await db.productos.update(codigoViejo, {
        archivado: true,
        activo: false,
        stock: null,
        actualizadoEn: Date.now(),
      })

      // La constancia, antes del borrado (igual que en borrarJornada: de
      // mas no revive nada, de menos si). Sin ella, cualquier dispositivo
      // que todavia tenga el codigo viejo --uno que estuvo apagado, uno
      // con datos de antes-- lo vuelve a subir al iniciar sesion
      // (empujarTodoLocal sube lo que el servidor no tiene), y el
      // producto repetido vuelve solo.
      const constancia: Borrado = {
        id: claveDeBorrado(codigoViejo),
        tabla: 'productos',
        clave: codigoViejo,
        cuando: Date.now(),
        quien,
        motivo: `${MOTIVO_CAMBIO_CODIGO}: pasó a ${nuevo}`,
      }
      await db.borrados.put(constancia)
      await db.productos.delete(codigoViejo)

      return { ventasTocadas: ventas.length, comprasTocadas: compras.length }
    }),
  )
}
