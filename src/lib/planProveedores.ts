import type { Producto, Proveedor } from '../db/db'
import { idDeProveedor } from './idProveedor'

/**
 * Que hacer con el lio de proveedores, calculado y sin tocar nada.
 *
 * De donde viene el lio
 * ---------------------
 * El id de cada proveedor se invento en cada dispositivo por separado:
 * la migracion de la base (version 3) agrupaba los productos por el
 * NOMBRE del proveedor y le daba a cada nombre un id nuevo con
 * nuevoId(), que es aleatorio. En un dispositivo funciona. Con cinco
 * no: el celular de cada persona le puso a "MOHICANO" un id distinto y
 * despues los cinco sincronizaron.
 *
 * La otra mitad la puso el bug de las claves con barra (ver
 * sync/claves.ts): la subida inicial se cortaba en el primer producto
 * con barra y los proveedores de ese dispositivo nunca llegaban al
 * servidor, aunque sus productos --subidos antes-- si. De ahi los
 * proveedorId que no corresponden a ninguna ficha.
 *
 * Hacia donde va todo
 * -------------------
 * Cada proveedor termina con el id que le corresponde por su nombre
 * (ver idProveedor.ts). Eso hace tres cosas de una: junta las copias,
 * recupera los productos que apuntaban a fichas perdidas, y hace que la
 * importacion del Excel --que trae el proveedor por nombre-- caiga
 * sobre las fichas que ya existen en vez de crear una segunda copia de
 * cada una.
 *
 * Por que el paso de reactivar se calcula al final
 * -----------------------------------------------
 * Porque antes de mover los productos, la foto miente. Un proveedor
 * inactivo que hoy figura sin productos vigentes puede recibir 18 en el
 * paso 2, y entonces si hay que reactivarlo. El plan primero SIMULA los
 * pasos 1 a 3 y recien sobre ese resultado decide a quien reactivar.
 *
 * Este modulo no escribe nada. Calcula y devuelve un plan para mirar.
 */

/** Un producto cuenta si no esta archivado. */
function cuenta(p: Producto): boolean {
  return p.archivado !== true
}

/** Sigue vivo: ni archivado ni descontinuado. */
function vigente(p: Producto): boolean {
  return cuenta(p) && p.descontinuado !== true
}

export interface ProveedorConUso {
  proveedor: Proveedor
  /** Productos que lo tienen como proveedorId hoy (sin archivados). */
  productos: number
  vigentes: number
}

/** Como queda un proveedor despues de aplicar todo el plan. */
export interface Destino {
  id: string
  nombre: string
  /** Las fichas de hoy que terminan siendo esta. Vacio: hay que crearla. */
  fichas: ProveedorConUso[]
  /** La ficha cuyo nombre y datos se conservan. */
  sobrevive: ProveedorConUso | null
  /**
   * El contacto que queda. Si la ficha que sobrevive no tiene y alguna
   * de las absorbidas si, se rescata: la ficha que mas productos tiene
   * no es necesariamente la que tiene cargado el telefono.
   */
  contacto: string | null
  notas: string | null
  /** Si el contacto o las notas vienen de una ficha absorbida. */
  rescataDatos: boolean
  /** Los alias que quedan cargados en la ficha final. */
  alias: string[]
  /** Queda activo al final del plan. */
  activo: boolean
  productosFinales: number
  vigentesFinales: number
  /** Productos que cambian de proveedorId al aplicar el plan. */
  productosAMover: number
  /** Productos que llegan desde un id que no tiene ficha. */
  productosRecuperados: number
}

/** Un proveedorId que los productos usan y del que no quedo ficha. */
export interface IdPerdido {
  id: string
  nombre: string | null
  productos: number
}

export interface PlanProveedores {
  conUso: ProveedorConUso[]
  activos: number
  inactivos: number
  idsPerdidos: IdPerdido[]
  sinProveedor: number

  /** Paso 1: juntar copias y darle a cada ficha el id de su nombre. */
  unificar: Destino[]
  /** Paso 2: productos de fichas perdidas que vuelven a una que existe. */
  reenganchar: Destino[]
  /** Paso 3: fichas que no existen en ningun lado y hay que crear. */
  crear: Destino[]
  /** Paso 4: calculado sobre el resultado de los pasos 1 a 3. */
  reactivar: Destino[]

  /**
   * Ids perdidos cuyos productos no dicen de quien son. No se pueden
   * resolver solos: hay que asignarlos a mano.
   */
  sinNombre: IdPerdido[]

  productosAfectados: number
  /** Cuantas fichas quedan al final, contra las que hay hoy. */
  fichasFinales: number

  /** Todas las fichas finales, incluidas las que no cambian. */
  todos: Destino[]
  /**
   * A donde va cada proveedorId de hoy. Lo usa aplicarPlanProveedores
   * para no recalcular --y sobre todo para no recalcular DISTINTO-- lo
   * que la pantalla ya mostro.
   */
  destinoDe: Map<string, string>
}

export function armarPlanProveedores(
  proveedores: Proveedor[],
  productos: Producto[],
): PlanProveedores {
  const porId = new Map(proveedores.map((p) => [p.id, p]))

  // ---- Como estan hoy ----
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
    if (p.proveedor?.trim()) uso.nombres.add(p.proveedor.trim())
  }

  const conUso: ProveedorConUso[] = proveedores
    .map((proveedor) => ({
      proveedor,
      productos: usoPorId.get(proveedor.id)?.total ?? 0,
      vigentes: usoPorId.get(proveedor.id)?.vivos ?? 0,
    }))
    .sort((a, b) => a.proveedor.nombre.localeCompare(b.proveedor.nombre, 'es'))

  // Los ids que los productos usan y de los que no quedo ficha.
  const idsPerdidos: IdPerdido[] = []
  for (const [id, uso] of usoPorId) {
    if (porId.has(id)) continue
    // Los productos traen el nombre del proveedor escrito, de la
    // planilla vieja: es lo que permite saber de quien era este id.
    idsPerdidos.push({ id, nombre: [...uso.nombres][0] ?? null, productos: uso.total })
  }
  idsPerdidos.sort((a, b) => b.productos - a.productos)

  // ---- A donde va cada id ----
  // Un solo mapa: id de hoy -> id final. Agrupar por NOMBRE y nombrar
  // por nombre son la misma operacion, asi que no pueden discrepar.
  // Los alias cargados a mano: "este otro nombre tambien soy yo".
  // Mapea el id que ese nombre tendria por si solo al id de la ficha
  // que lo reclama. Se resuelve de a un salto a proposito: una cadena
  // de alias (A dice ser B, B dice ser C) seria un lio para entender
  // desde la pantalla, y el caso no existe.
  const aliasHacia = new Map<string, string>()
  for (const p of proveedores) {
    const suyo = idDeProveedor(p.nombre)
    for (const alias of p.alias ?? []) {
      if (!alias.trim()) continue
      const deAlias = idDeProveedor(alias)
      if (deAlias !== suyo) aliasHacia.set(deAlias, suyo)
    }
  }

  const aDondeVa = (nombre: string): string => {
    const propio = idDeProveedor(nombre)
    return aliasHacia.get(propio) ?? propio
  }

  const destinoDe = new Map<string, string>()
  for (const p of proveedores) destinoDe.set(p.id, aDondeVa(p.nombre))
  for (const perdido of idsPerdidos) {
    if (perdido.nombre) destinoDe.set(perdido.id, aDondeVa(perdido.nombre))
  }

  // ---- Simulacion de los pasos 1 a 3 ----
  const finales = new Map<string, Destino>()

  function destino(id: string, nombre: string): Destino {
    let d = finales.get(id)
    if (!d) {
      d = {
        id,
        nombre,
        fichas: [],
        sobrevive: null,
        contacto: null,
        notas: null,
        rescataDatos: false,
        alias: [],
        activo: true,
        productosFinales: 0,
        vigentesFinales: 0,
        productosAMover: 0,
        productosRecuperados: 0,
      }
      finales.set(id, d)
    }
    return d
  }

  for (const c of conUso) {
    destino(destinoDe.get(c.proveedor.id)!, c.proveedor.nombre).fichas.push(c)
  }
  for (const perdido of idsPerdidos) {
    if (perdido.nombre) destino(aDondeVa(perdido.nombre), perdido.nombre)
  }

  // De cada grupo sobrevive el que mas productos tiene; a igualdad, el
  // mas viejo. Es el que aporta contacto y notas, y el que decide si la
  // ficha final arranca activa o inactiva.
  for (const d of finales.values()) {
    if (d.fichas.length === 0) continue
    const ordenado = [...d.fichas].sort(
      (a, b) =>
        b.productos - a.productos || (a.proveedor.creadoEn ?? 0) - (b.proveedor.creadoEn ?? 0),
    )
    d.sobrevive = ordenado[0]
    d.nombre = ordenado[0].proveedor.nombre
    d.activo = ordenado[0].proveedor.activo !== false

    // El contacto y las notas de la que sobrevive, y si no tiene, los
    // de la primera absorbida que si tenga. La ficha con mas productos
    // no es necesariamente la que tiene cargado el telefono, y borrar
    // un telefono por una limpieza de ids seria una perdida tonta.
    d.contacto = ordenado.map((f) => f.proveedor.contacto).find((c) => c?.trim()) ?? null
    d.notas = ordenado.map((f) => f.proveedor.notas).find((n) => n?.trim()) ?? null
    d.rescataDatos =
      (d.contacto !== null && d.contacto !== (ordenado[0].proveedor.contacto ?? null)) ||
      (d.notas !== null && d.notas !== (ordenado[0].proveedor.notas ?? null))

    // Los alias de todas las fichas del grupo se juntan, y el nombre de
    // cada absorbida pasa a ser alias de la que queda: asi la
    // importacion del Excel tampoco la vuelve a crear.
    const alias = new Set<string>()
    for (const f of ordenado) for (const a of f.proveedor.alias ?? []) if (a.trim()) alias.add(a.trim())
    for (const f of ordenado.slice(1)) {
      if (idDeProveedor(f.proveedor.nombre) !== d.id) alias.add(f.proveedor.nombre.trim())
    }
    d.alias = [...alias].sort((a, b) => a.localeCompare(b, 'es'))
  }

  for (const p of productos) {
    if (!cuenta(p) || !p.proveedorId) continue
    const idFinal = destinoDe.get(p.proveedorId)
    // Sin nombre no hay a donde mandarlo: se queda donde esta.
    if (!idFinal) continue
    const d = finales.get(idFinal)
    if (!d) continue
    d.productosFinales++
    if (vigente(p)) d.vigentesFinales++
    if (p.proveedorId !== idFinal) d.productosAMover++
    if (!porId.has(p.proveedorId)) d.productosRecuperados++
  }

  // ---- Los cuatro pasos, ya sobre el resultado ----
  const todos = [...finales.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const unificar = todos
    .filter((d) => d.fichas.length > 1 || (d.sobrevive != null && d.sobrevive.proveedor.id !== d.id))
    .sort((a, b) => b.fichas.length - a.fichas.length || b.productosAMover - a.productosAMover)

  const reenganchar = todos
    .filter((d) => d.fichas.length > 0 && d.productosRecuperados > 0)
    .sort((a, b) => b.productosRecuperados - a.productosRecuperados)

  const crear = todos
    .filter((d) => d.fichas.length === 0)
    .sort((a, b) => b.productosFinales - a.productosFinales)

  // El paso que cambia al simularlo: se mira el estado FINAL, no el de
  // hoy. Un inactivo que hoy no tiene productos vigentes puede terminar
  // con 18 despues del paso 2.
  const reactivar = todos
    .filter((d) => d.sobrevive != null && !d.activo && d.vigentesFinales > 0)
    .sort((a, b) => b.vigentesFinales - a.vigentesFinales)

  return {
    conUso,
    activos: conUso.filter((c) => c.proveedor.activo !== false).length,
    inactivos: conUso.filter((c) => c.proveedor.activo === false).length,
    idsPerdidos,
    sinProveedor,
    unificar,
    reenganchar,
    crear,
    reactivar,
    sinNombre: idsPerdidos.filter((h) => !h.nombre),
    productosAfectados: todos.reduce((s, d) => s + d.productosAMover, 0),
    fichasFinales: finales.size,
    todos,
    destinoDe,
  }
}
