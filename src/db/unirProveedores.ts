import { conMotivo, db, type MovimientoProveedor, type Producto, type Proveedor } from './db'

/**
 * Unir dos fichas de proveedor que son el mismo.
 *
 * Despues de asociar los productos quedaron fichas repetidas que el id
 * derivado del nombre no junta solo, porque los nombres no normalizan
 * igual: SALDO y SALDOS, VICTOR ESTEBANEZ y VICTOR ESTEVANEZ.
 *
 * Una union mueve TODO lo que cuelga de la ficha absorbida --sus
 * productos y su cuenta corriente, compras y pagos-- y recien despues
 * la borra. Si se moviera solo una parte, la ficha quedaria con plata
 * colgada de un id que ya no existe, que es peor que tener dos fichas.
 *
 * El nombre absorbido queda como "otro nombre" de la que queda. No es
 * cosmetico: asegurarProveedor() mira los alias, asi que si mañana
 * alguien escribe el nombre viejo cae en la ficha buena en vez de
 * crear la copia de nuevo.
 */

export const MOTIVO_UNION = 'Unión de proveedores'

/** Los campos de la ficha que se pueden rescatar si estan vacios. */
const RESCATABLES = [
  ['contacto', 'el teléfono'],
  ['notas', 'las notas'],
  ['comoSeCompra', 'cómo se le compra'],
  ['web', 'la web'],
  ['aliasCbu', 'el alias o CBU'],
  ['titular', 'el titular de la cuenta'],
  ['ciudad', 'la ciudad'],
] as const

export interface VistaPreviaUnion {
  queda: Proveedor
  seAbsorbe: Proveedor
  productos: number
  compras: number
  pagos: number
  /** Lo que se le debe segun la cuenta corriente de la absorbida. */
  saldoQuePasa: number
  /** Los nombres que pasan a ser "otro nombre" de la que queda. */
  aliasNuevos: string[]
  /** En palabras: que datos vacios se completan con los de la absorbida. */
  datosQueSeRescatan: string[]
}

/** Un texto util, o nada. */
function cargado(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/**
 * Que pasaria si se unieran estas dos fichas. No toca nada.
 */
export function armarUnion(
  queda: Proveedor,
  seAbsorbe: Proveedor,
  productos: Producto[],
  movimientos: MovimientoProveedor[],
): VistaPreviaUnion {
  const mios = movimientos.filter((m) => m.proveedorId === seAbsorbe.id)
  const compras = mios.filter((m) => m.tipo === 'compra')
  const pagos = mios.filter((m) => m.tipo === 'pago')

  // Los nombres que se suman: el de la absorbida y los otros nombres
  // que ella ya tenia. Sin repetir, y sin el nombre de la que queda.
  const yaTiene = new Set([queda.nombre, ...(queda.alias ?? [])].map((n) => n.trim().toLowerCase()))
  const aliasNuevos: string[] = []
  for (const nombre of [seAbsorbe.nombre, ...(seAbsorbe.alias ?? [])]) {
    const limpio = nombre.trim()
    if (!limpio || yaTiene.has(limpio.toLowerCase())) continue
    yaTiene.add(limpio.toLowerCase())
    aliasNuevos.push(limpio)
  }

  const datosQueSeRescatan = RESCATABLES.filter(
    ([campo]) => !cargado(queda[campo]) && cargado(seAbsorbe[campo]),
  ).map(([, comoSeLlama]) => comoSeLlama)

  return {
    queda,
    seAbsorbe,
    productos: productos.filter((p) => p.proveedorId === seAbsorbe.id).length,
    compras: compras.length,
    pagos: pagos.length,
    saldoQuePasa:
      compras.reduce((s, m) => s + m.monto, 0) - pagos.reduce((s, m) => s + m.monto, 0),
    aliasNuevos,
    datosQueSeRescatan,
  }
}

export function textoDeConfirmacionUnion(v: VistaPreviaUnion): string {
  const partes = [`Se une "${v.seAbsorbe.nombre}" dentro de "${v.queda.nombre}".`, '']
  if (v.productos > 0) {
    partes.push(`· ${v.productos} ${v.productos === 1 ? 'producto pasa' : 'productos pasan'} a "${v.queda.nombre}"`)
  }
  if (v.compras + v.pagos > 0) {
    partes.push(`· ${v.compras} compras y ${v.pagos} pagos pasan a su cuenta corriente`)
  }
  if (v.aliasNuevos.length > 0) {
    partes.push(`· queda como otro nombre: ${v.aliasNuevos.join(', ')}`)
  }
  partes.push(`· la ficha "${v.seAbsorbe.nombre}" se borra`)
  partes.push('', `Queda en el historial como «${MOTIVO_UNION}».`, '', '¿Unir?')
  return partes.join('\n')
}

export interface ResultadoUnion {
  productosTocados: number
  movimientosTocados: number
}

export type FalloUnion = 'no-existe' | 'es-la-misma'

/**
 * Une las dos fichas, de verdad.
 *
 * Todo adentro de una transaccion: si algo falla a mitad de camino, no
 * puede quedar la ficha borrada con sus compras colgando.
 */
export async function unirProveedores(
  idQueda: string,
  idSeAbsorbe: string,
): Promise<ResultadoUnion | FalloUnion> {
  if (idQueda === idSeAbsorbe) return 'es-la-misma'

  return conMotivo(MOTIVO_UNION, async () =>
    db.transaction('rw', db.proveedores, db.productos, db.movimientosProveedor, async () => {
      // Se vuelven a leer adentro de la transaccion: la vista previa se
      // dibujo hace unos segundos y pudo cambiar.
      const [queda, seAbsorbe] = await Promise.all([
        db.proveedores.get(idQueda),
        db.proveedores.get(idSeAbsorbe),
      ])
      if (!queda || !seAbsorbe) return 'no-existe' as const

      const [productos, movimientos] = await Promise.all([
        db.productos.where('proveedorId').equals(idSeAbsorbe).toArray(),
        db.movimientosProveedor.where('proveedorId').equals(idSeAbsorbe).toArray(),
      ])
      const plan = armarUnion(queda, seAbsorbe, productos, movimientos)

      // 1. Los productos, con el nombre escrito tambien: si quedara el
      //    viejo, el filtro de "proveedor inexistente" lo volveria a
      //    marcar como suelto.
      for (const p of productos) {
        await db.productos.update(p.codigo, {
          proveedorId: queda.id,
          proveedor: queda.nombre,
        })
      }

      // 2. La cuenta corriente.
      for (const m of movimientos) {
        await db.movimientosProveedor.update(m.id, { proveedorId: queda.id })
      }

      // 3. La ficha que queda: los otros nombres y los datos rescatados.
      const cambios: Partial<Proveedor> = { actualizadoEn: Date.now() }
      if (plan.aliasNuevos.length > 0) {
        cambios.alias = [...(queda.alias ?? []), ...plan.aliasNuevos]
      }
      for (const [campo] of RESCATABLES) {
        if (!cargado(queda[campo]) && cargado(seAbsorbe[campo])) {
          ;(cambios as Record<string, unknown>)[campo] = seAbsorbe[campo]
        }
      }
      // Si la que queda estaba inactiva y ahora tiene productos, se
      // reactiva: si no, desaparece del selector al editar un producto.
      if (queda.activo === false && productos.length > 0) cambios.activo = true
      await db.proveedores.update(queda.id, cambios)

      // 4. Recien ahora, cuando ya no cuelga nada de ella.
      await db.proveedores.delete(seAbsorbe.id)

      return { productosTocados: productos.length, movimientosTocados: movimientos.length }
    }),
  )
}
