import type { Producto, Proveedor } from '../db/db'
import { normalizar } from './formato'

/**
 * Que hacer con el lio de proveedores, calculado y sin tocar nada.
 *
 * De donde viene el lio
 * ---------------------
 * El id de cada proveedor se invento en cada dispositivo por separado.
 * Tanto la migracion de la base (version 3) como
 * derivarProveedoresDesdeProductos() hacen lo mismo: agrupan los
 * productos por el NOMBRE del proveedor que venia de la planilla y le
 * dan a cada nombre un id nuevo con nuevoId(), que es aleatorio.
 *
 * Eso funciona en un dispositivo. Con cinco, no: el celular de cada
 * persona le puso a "MOHICANO" un id distinto, y despues los cinco
 * sincronizaron. Resultado:
 *
 *   - el mismo proveedor aparece varias veces, con nombres iguales y
 *     ids distintos (A MATEAR ALEJO, ABEL, ALBERTO BALDUGA...);
 *   - los productos quedaron apuntando al id que les puso SU
 *     dispositivo, que puede no ser ninguno de los que sobrevivieron:
 *     de ahi que haya ~80 proveedorId distintos para 34 proveedores.
 *
 * La otra mitad del problema la puso el bug de las claves con barra
 * (ver sync/claves.ts): la subida inicial se cortaba en el primer
 * producto con barra y los proveedores de ese dispositivo nunca
 * llegaban al servidor, aunque sus productos --subidos antes-- si.
 *
 * Que hace este modulo
 * --------------------
 * Nada. Calcula y devuelve un plan para mirar. Aplicarlo es otra cosa,
 * aparte y con confirmacion: son cambios sobre cientos de productos y
 * la regla de la casa es que eso se mira antes de que pase.
 */

export interface ProveedorConUso {
  proveedor: Proveedor
  /** Productos que lo tienen como proveedorId (sin contar archivados). */
  productos: number
  /** De esos, cuantos siguen vivos (ni archivados ni descontinuados). */
  vigentes: number
}

/** Varios proveedores que son el mismo, con distinto id. */
export interface GrupoDuplicado {
  nombre: string
  /** El que conviene conservar: el que mas productos tiene. */
  sobrevive: ProveedorConUso
  /** Los que se absorben: sus productos pasan al que sobrevive. */
  absorbidos: ProveedorConUso[]
  /** Cuantos productos cambiarian de proveedorId. */
  productosAMover: number
}

/** Un proveedorId que los productos usan y que no existe como documento. */
export interface IdHuerfano {
  id: string
  /** El nombre que los propios productos traen en el campo `proveedor`. */
  nombre: string | null
  productos: number
  /**
   * Si hay un proveedor con ese mismo nombre, los productos se le
   * reenganchan. Si no, hay que crearlo.
   */
  seEnganchaA: Proveedor | null
}

export interface PlanProveedores {
  conUso: ProveedorConUso[]
  activos: number
  inactivos: number
  /** Inactivos que todavia tienen productos vigentes: candidatos a revivir. */
  aReactivar: ProveedorConUso[]
  duplicados: GrupoDuplicado[]
  huerfanos: IdHuerfano[]
  /** Huerfanos que no coinciden con ningun proveedor: hay que crearlos. */
  aCrear: IdHuerfano[]
  sinProveedor: number
  /** Cuantos productos tocaria el plan entero. */
  productosAfectados: number
}

/** Un producto cuenta si no esta archivado. */
function cuenta(p: Producto): boolean {
  return p.archivado !== true
}

/** Sigue vivo: ni archivado ni descontinuado. */
function vigente(p: Producto): boolean {
  return cuenta(p) && p.descontinuado !== true
}

export function armarPlanProveedores(
  proveedores: Proveedor[],
  productos: Producto[],
): PlanProveedores {
  const porId = new Map(proveedores.map((p) => [p.id, p]))

  const usoPorId = new Map<string, { total: number; vivos: number; nombres: Set<string> }>()
  let sinProveedor = 0
  for (const p of productos) {
    if (!cuenta(p)) continue
    if (!p.proveedorId) {
      sinProveedor++
      continue
    }
    let uso = usoPorId.get(p.proveedorId)
    if (!uso) {
      uso = { total: 0, vivos: 0, nombres: new Set() }
      usoPorId.set(p.proveedorId, uso)
    }
    uso.total++
    if (vigente(p)) uso.vivos++
    if (p.proveedor) uso.nombres.add(p.proveedor.trim())
  }

  const conUso: ProveedorConUso[] = proveedores
    .map((proveedor) => ({
      proveedor,
      productos: usoPorId.get(proveedor.id)?.total ?? 0,
      vigentes: usoPorId.get(proveedor.id)?.vivos ?? 0,
    }))
    .sort((a, b) => a.proveedor.nombre.localeCompare(b.proveedor.nombre, 'es'))

  // Duplicados: mismo nombre normalizado, ids distintos.
  const porNombre = new Map<string, ProveedorConUso[]>()
  for (const c of conUso) {
    const clave = normalizar(c.proveedor.nombre)
    if (!clave) continue
    const lista = porNombre.get(clave) ?? []
    lista.push(c)
    porNombre.set(clave, lista)
  }

  const duplicados: GrupoDuplicado[] = []
  for (const [, grupo] of porNombre) {
    if (grupo.length < 2) continue
    // Sobrevive el que mas productos tiene; a igualdad, el mas viejo,
    // que es el que probablemente este en mas dispositivos.
    const ordenado = [...grupo].sort(
      (a, b) =>
        b.productos - a.productos ||
        (a.proveedor.creadoEn ?? 0) - (b.proveedor.creadoEn ?? 0),
    )
    const [sobrevive, ...absorbidos] = ordenado
    duplicados.push({
      nombre: sobrevive.proveedor.nombre,
      sobrevive,
      absorbidos,
      productosAMover: absorbidos.reduce((s, a) => s + a.productos, 0),
    })
  }
  duplicados.sort((a, b) => b.productosAMover - a.productosAMover)

  // Ids que los productos usan y que no existen como documento.
  const porNombreUnico = new Map<string, Proveedor>()
  for (const c of conUso) {
    const clave = normalizar(c.proveedor.nombre)
    if (clave && !porNombreUnico.has(clave)) porNombreUnico.set(clave, c.proveedor)
  }

  const huerfanos: IdHuerfano[] = []
  for (const [id, uso] of usoPorId) {
    if (porId.has(id)) continue
    // Los productos traen el nombre del proveedor en texto, de la
    // planilla vieja. Es lo que permite saber a quien pertenecian estos
    // ids sin tener el documento.
    const nombre = [...uso.nombres][0] ?? null
    huerfanos.push({
      id,
      nombre,
      productos: uso.total,
      seEnganchaA: nombre ? (porNombreUnico.get(normalizar(nombre)) ?? null) : null,
    })
  }
  huerfanos.sort((a, b) => b.productos - a.productos)

  const aReactivar = conUso.filter((c) => c.proveedor.activo === false && c.vigentes > 0)
  const aCrear = huerfanos.filter((h) => !h.seEnganchaA)

  return {
    conUso,
    activos: conUso.filter((c) => c.proveedor.activo !== false).length,
    inactivos: conUso.filter((c) => c.proveedor.activo === false).length,
    aReactivar,
    duplicados,
    huerfanos,
    aCrear,
    sinProveedor,
    productosAfectados:
      duplicados.reduce((s, d) => s + d.productosAMover, 0) +
      huerfanos.reduce((s, h) => s + h.productos, 0),
  }
}
