import type { Producto } from '../db/db'
import { distancia, palabrasClave } from './fichasParecidas'

/**
 * Productos que parecen ser el mismo, por la descripción.
 *
 * El 21/10 se cargó LST016 con la descripción de MATERA RECTANGULAR,
 * que ya existía como LST010: el mismo producto con dos códigos, y el
 * stock y las ventas repartidos entre los dos.
 *
 * Esto NO bloquea nada. Hay productos legítimamente parecidos --tres
 * proveedores distintos venden "LIMPIA BOMBILLA" y son tres productos
 * con su propio costo-- así que lo único honesto es avisar y que
 * decida quien está cargando.
 */

/** La descripción reducida a lo que la distingue. */
export function claveDescripcion(descripcion: string): string {
  return palabrasClave(descripcion).join(' ')
}

export type ParecidoProducto = 'misma' | 'casi-igual'

export interface ProductoParecido {
  producto: Producto
  por: ParecidoProducto
}

/** Un producto que cuenta para esto: ni archivado ni descontinuado. */
function vigente(p: Producto): boolean {
  return !p.archivado && !p.descontinuado
}

/**
 * Los que ya existen con esa descripción, o con una a una letra.
 *
 * `exceptoCodigo` saca de la lista al producto que se está editando:
 * si no, editarle el precio a uno se avisaría a sí mismo.
 */
export function productosParecidos(
  descripcion: string,
  productos: Producto[],
  exceptoCodigo?: string,
): ProductoParecido[] {
  const clave = claveDescripcion(descripcion)
  if (!clave) return []
  const palabras = clave.split(' ')

  const salida: ProductoParecido[] = []
  for (const producto of productos) {
    if (!vigente(producto)) continue
    if (exceptoCodigo && producto.codigo === exceptoCodigo) continue
    const suya = claveDescripcion(producto.descripcion ?? '')
    if (!suya) continue
    if (suya === clave) {
      salida.push({ producto, por: 'misma' })
      continue
    }
    // Una sola letra en una sola palabra, y solo en palabras largas:
    // la misma vara que para las fichas de proveedor.
    const suyas = suya.split(' ')
    if (suyas.length !== palabras.length) continue
    let distintas = 0
    let cambios = 0
    let sirve = true
    for (let i = 0; i < palabras.length; i++) {
      if (palabras[i] === suyas[i]) continue
      distintas++
      const d = distancia(palabras[i], suyas[i])
      cambios += d
      if (d > 1 || Math.min(palabras[i].length, suyas[i].length) < 5) {
        sirve = false
        break
      }
    }
    if (sirve && distintas === 1 && cambios === 1) {
      salida.push({ producto, por: 'casi-igual' })
    }
  }
  return salida.sort((a, b) => (a.por === b.por ? 0 : a.por === 'misma' ? -1 : 1))
}

export interface GrupoRepetido {
  /** La descripción tal cual la tiene el primero del grupo. */
  descripcion: string
  productos: Producto[]
}

/**
 * Los grupos de productos vigentes que comparten descripción.
 *
 * Para la lista de trabajo: no todos son un error --tres proveedores
 * distintos pueden vender lo mismo-- pero son los que hay que mirar.
 */
export function gruposRepetidos(productos: Producto[]): GrupoRepetido[] {
  const por = new Map<string, Producto[]>()
  for (const p of productos) {
    if (!vigente(p)) continue
    const clave = claveDescripcion(p.descripcion ?? '')
    if (!clave) continue
    const grupo = por.get(clave)
    if (grupo) grupo.push(p)
    else por.set(clave, [p])
  }
  return [...por.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      descripcion: g[0].descripcion ?? '',
      productos: [...g].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }))
    .sort((a, b) => b.productos.length - a.productos.length || a.descripcion.localeCompare(b.descripcion))
}
