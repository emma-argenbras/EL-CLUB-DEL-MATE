import type { Producto, Proveedor } from '../db/db'

/**
 * En que estado esta el proveedor de un producto.
 *
 * Hay tres, no dos, y el tercero es el que nos hizo perder productos de
 * vista: un producto puede apuntar a una ficha que NO EXISTE. Pasa
 * cuando el proveedor se creo en otro dispositivo y esa ficha nunca
 * llego al servidor (ver sync/claves.ts, el bug de las barras).
 *
 * Esos productos quedaban en un limbo: no contaban como "sin
 * proveedor" --porque proveedorId no es null-- y tampoco aparecian
 * dentro de ningun proveedor --porque esa ficha no esta en la lista--.
 * Invisibles para los dos lados, con el agravante de que nadie los
 * buscaba porque ningun aviso los nombraba.
 *
 * El caso real: MR001 a MR006, de "MATES RAFAEL MISIONES SARAPICO
 * SHOPPING".
 *
 * Lo unico que queda de esos proveedores es el NOMBRE, que el producto
 * trae escrito de la planilla vieja en el campo `proveedor`. Con eso
 * alcanza para mostrarlos y para que una persona los reasigne.
 */
export type EstadoProveedor =
  | { tipo: 'sin' }
  | { tipo: 'ok'; id: string; nombre: string }
  | { tipo: 'fantasma'; id: string; nombre: string | null }

/** Marcador del filtro: los que apuntan a una ficha que no existe. */
export const FILTRO_FANTASMA = 'fantasma'
/** Marcador del filtro: los que no tienen proveedor asignado. */
export const FILTRO_SIN_PROVEEDOR = 'sin-proveedor'

export function estadoDelProveedor(
  producto: Producto,
  fichasPorId: Map<string, Proveedor>,
): EstadoProveedor {
  if (!producto.proveedorId) return { tipo: 'sin' }
  const ficha = fichasPorId.get(producto.proveedorId)
  if (ficha) return { tipo: 'ok', id: ficha.id, nombre: ficha.nombre }
  return {
    tipo: 'fantasma',
    id: producto.proveedorId,
    nombre: producto.proveedor?.trim() || null,
  }
}

/** Como se lee en una lista. */
export function textoDelProveedor(estado: EstadoProveedor): string | null {
  if (estado.tipo === 'ok') return estado.nombre
  if (estado.tipo === 'fantasma') {
    return estado.nombre ? `proveedor inexistente: ${estado.nombre}` : 'proveedor inexistente'
  }
  return null
}

/**
 * Los proveedores fantasma que usan los productos, agrupados por el
 * nombre que traen escrito. Sirve para listarlos en el filtro y para
 * que el aviso diga cuantos son y de quienes.
 */
export function fantasmasDeLosProductos(
  productos: Producto[],
  fichasPorId: Map<string, Proveedor>,
): { nombre: string | null; productos: number }[] {
  const porNombre = new Map<string, { nombre: string | null; productos: number }>()
  for (const p of productos) {
    const estado = estadoDelProveedor(p, fichasPorId)
    if (estado.tipo !== 'fantasma') continue
    // Se agrupa por nombre y no por id: dos dispositivos pudieron
    // inventar dos ids para el mismo proveedor, y para quien mira la
    // pantalla eso es uno solo.
    const clave = (estado.nombre ?? '').toLowerCase()
    const actual = porNombre.get(clave)
    if (actual) actual.productos++
    else porNombre.set(clave, { nombre: estado.nombre, productos: 1 })
  }
  return [...porNombre.values()].sort((a, b) => b.productos - a.productos)
}
