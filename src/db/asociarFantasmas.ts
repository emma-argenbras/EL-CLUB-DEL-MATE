import { asegurarProveedor, conMotivo, db, type Producto, type Proveedor } from './db'
import { idDeProveedor } from '../lib/idProveedor'
import { estadoDelProveedor } from '../lib/proveedorDeProducto'

/**
 * Enganchar a su ficha los productos que apuntan a un proveedor que no
 * existe.
 *
 * En la base real son 850 productos repartidos en 97 nombres --MOHICANO
 * 135, SALDOS 65, PAISA 61-- contra 49 productos bien enganchados. O
 * sea que el estado roto es la regla y no la excepcion: arreglarlo de a
 * un producto no es trabajo de una tarde, es imposible.
 *
 * Se hace de a un proveedor, a pedido, y mostrando antes que productos
 * se van a tocar. No es una limpieza automatica: es una herramienta
 * para que una persona vaya resolviendo de a uno, viendo lo que hace.
 *
 * Toca dos campos y nada mas: `proveedorId` y el `proveedor` escrito.
 * Ni precios, ni costos, ni stock.
 */

/** Las palabras que forman un nombre, normalizadas. */
function palabras(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Una ficha que ya existe y que PARECE ser este mismo proveedor,
 * aunque el nombre no sea igual.
 *
 * El criterio es conservador a proposito: las palabras de uno tienen
 * que ser el comienzo exacto del otro. Asi "THOR MATES" se ofrece para
 * "THOR MATES BRIAN AGUIAR", pero "MATES RAFAEL" no se ofrece para
 * "MATES DEL LITORAL".
 *
 * Es una SUGERENCIA, no una decision: la toma quien esta mirando, que
 * sabe si son el mismo proveedor o dos distintos que empiezan igual.
 * Por eso no se aplica sola.
 */
export function fichaParecida(nombre: string, proveedores: Proveedor[]): Proveedor | null {
  const mias = palabras(nombre)
  if (mias.length === 0) return null

  const candidatas = proveedores.filter((p) => {
    // La que coincide exacto la encuentra asegurarProveedor; aca
    // interesan las que NO coinciden exacto.
    if (idDeProveedor(p.nombre) === idDeProveedor(nombre)) return false
    const suyas = palabras(p.nombre)
    if (suyas.length === 0) return false
    const [corto, largo] = suyas.length <= mias.length ? [suyas, mias] : [mias, suyas]
    return corto.every((palabra, i) => largo[i] === palabra)
  })

  // Si hay varias, la de nombre mas largo: es la mas especifica, y la
  // que menos chance tiene de ser una coincidencia de la primera
  // palabra.
  return (
    candidatas.sort((a, b) => palabras(b.nombre).length - palabras(a.nombre).length)[0] ?? null
  )
}

/** Los productos que apuntan a una ficha inexistente con ese nombre. */
export async function productosDelFantasma(nombre: string): Promise<Producto[]> {
  const [productos, proveedores] = await Promise.all([
    db.productos.toArray(),
    db.proveedores.toArray(),
  ])
  const fichas = new Map(proveedores.map((p) => [p.id, p]))
  const buscado = idDeProveedor(nombre)
  return productos
    .filter((p) => p.archivado !== true)
    .filter((p) => {
      const estado = estadoDelProveedor(p, fichas)
      return estado.tipo === 'fantasma' && estado.nombre != null && idDeProveedor(estado.nombre) === buscado
    })
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
}

export interface ResultadoAsociacion {
  /** La ficha a la que quedaron enganchados. */
  fichaId: string
  fichaNombre: string
  /** Si hubo que crearla o ya existia. */
  creada: boolean
  productos: number
}

/**
 * Engancha los productos de ese proveedor fantasma a una ficha.
 *
 * Sin `usarFicha`, la ficha sale de asegurarProveedor(): reusa la que
 * exista con ese nombre --o con ese alias-- y si no, la crea.
 *
 * Con `usarFicha`, se usa esa, y el nombre del fantasma queda cargado
 * como **otro nombre** de esa ficha. Eso es lo que hace que la proxima
 * vez que aparezca escrito asi caiga solo en el lugar correcto, sin
 * que nadie tenga que acordarse.
 */
export async function asociarFantasma(
  nombre: string,
  usarFicha?: Proveedor,
): Promise<ResultadoAsociacion> {
  const productos = await productosDelFantasma(nombre)
  if (productos.length === 0) throw new Error('No quedan productos con ese proveedor.')

  const existiaAntes = usarFicha ?? (await db.proveedores.get(idDeProveedor(nombre)))

  return conMotivo(`Asociación de productos a ${usarFicha?.nombre ?? nombre.trim()}`, async () => {
    let fichaId: string
    let fichaNombre: string

    if (usarFicha) {
      fichaId = usarFicha.id
      fichaNombre = usarFicha.nombre
      const alias = new Set(usarFicha.alias ?? [])
      alias.add(nombre.trim())
      await db.proveedores.update(usarFicha.id, { alias: [...alias], actualizadoEn: Date.now() })
    } else {
      const id = await asegurarProveedor(nombre)
      if (!id) throw new Error('Ese proveedor no tiene nombre: hay que asignarlo a mano.')
      fichaId = id
      fichaNombre = (await db.proveedores.get(id))?.nombre ?? nombre.trim()
    }

    // Solo el proveedor. Los precios, los costos y el stock quedan
    // exactamente como estaban.
    for (const p of productos) {
      await db.productos.update(p.codigo, { proveedorId: fichaId, proveedor: fichaNombre })
    }

    return { fichaId, fichaNombre, creada: !existiaAntes, productos: productos.length }
  })
}
