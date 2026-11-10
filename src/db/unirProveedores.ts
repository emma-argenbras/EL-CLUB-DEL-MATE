import { conMotivo, db, type Borrado, type MovimientoProveedor, type Producto, type Proveedor } from './db'

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
export const MOTIVO_FICHAS_VACIAS = 'Unión de fichas repetidas vacías'

/**
 * La constancia de que la ficha se borro a proposito (10/11). Sin ella, un
 * aparato que estuvo apagado mientras se unian las fichas vuelve a subir la
 * borrada al abrir la app: la subida inicial sube lo que el servidor no
 * tiene, salvo lo que figura en `borrados`.
 */
function constanciaDeBorrado(id: string, quien: string | null, motivo: string): Borrado {
  return { id: `proveedores/${id}`, tabla: 'proveedores', clave: id, cuando: Date.now(), quien, motivo }
}

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
  quien: string | null = null,
): Promise<ResultadoUnion | FalloUnion> {
  if (idQueda === idSeAbsorbe) return 'es-la-misma'

  return conMotivo(MOTIVO_UNION, async () =>
    db.transaction('rw', [db.proveedores, db.productos, db.movimientosProveedor, db.borrados], async () => {
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

      // 4. Recien ahora, cuando ya no cuelga nada de ella. La constancia
      //    primero, como en borrarJornada.
      await db.borrados.put(constanciaDeBorrado(seAbsorbe.id, quien, MOTIVO_UNION))
      await db.proveedores.delete(seAbsorbe.id)

      return { productosTocados: productos.length, movimientosTocados: movimientos.length }
    }),
  )
}

export interface ResultadoFichasVacias {
  unidas: number
  /** Las que se dejaron porque cambiaron desde que se armo la lista. */
  salteadas: { id: string; nombre: string; porque: string }[]
}

/**
 * Une de una las fichas repetidas vacias a su gemela (ver
 * fichasRepetidas.ts): el 10/11 eran 94, todas de la importacion del 18/08.
 *
 * Cada una se vuelve a mirar adentro de la transaccion, porque la lista se
 * mostro antes: si ya no esta, si cambio de nombre o si le cargaron algun
 * producto, compra o pago, se saltea y se dice. De las que se unen, la
 * gemela se queda con los datos que tenia vacios (telefono, ciudad, alias
 * para transferir...) y con sus otros nombres; la vacia se borra con su
 * constancia. Todo junto: si algo falla, no queda nada a medias.
 */
export async function unirFichasVacias(
  pares: { idVacia: string; idGemela: string }[],
  quien: string | null,
): Promise<ResultadoFichasVacias> {
  return conMotivo(MOTIVO_FICHAS_VACIAS, async () =>
    db.transaction('rw', [db.proveedores, db.productos, db.movimientosProveedor, db.borrados], async () => {
      const resultado: ResultadoFichasVacias = { unidas: 0, salteadas: [] }
      for (const { idVacia, idGemela } of pares) {
        const [vacia, gemela] = await Promise.all([db.proveedores.get(idVacia), db.proveedores.get(idGemela)])
        const saltear = (porque: string) =>
          resultado.salteadas.push({ id: idVacia, nombre: vacia?.nombre ?? idVacia, porque })
        if (!vacia || !gemela || idVacia === idGemela) {
          saltear('ya no está')
          continue
        }
        if (vacia.nombre.trim() !== gemela.nombre.trim()) {
          saltear('ya no se llama igual que su gemela')
          continue
        }
        const [productos, movimientos] = await Promise.all([
          db.productos.where('proveedorId').equals(idVacia).count(),
          db.movimientosProveedor.where('proveedorId').equals(idVacia).count(),
        ])
        if (productos + movimientos > 0) {
          saltear('ahora tiene productos, compras o pagos')
          continue
        }

        const plan = armarUnion(gemela, vacia, [], [])
        const cambios: Partial<Proveedor> = {}
        if (plan.aliasNuevos.length > 0) cambios.alias = [...(gemela.alias ?? []), ...plan.aliasNuevos]
        for (const [campo] of RESCATABLES) {
          if (!cargado(gemela[campo]) && cargado(vacia[campo])) {
            ;(cambios as Record<string, unknown>)[campo] = vacia[campo]
          }
        }
        if (Object.keys(cambios).length > 0) {
          await db.proveedores.update(gemela.id, { ...cambios, actualizadoEn: Date.now() })
        }
        await db.borrados.put(constanciaDeBorrado(vacia.id, quien, MOTIVO_FICHAS_VACIAS))
        await db.proveedores.delete(vacia.id)
        resultado.unidas++
      }
      return resultado
    }),
  )
}

/** La pregunta antes de unir de una: cuántas, un ejemplo, y qué pasa. */
export function textoDeConfirmacionVacias(
  pares: { vacia: Proveedor; gemela: { proveedor: Proveedor; productos: number; movimientos?: number } }[],
): string {
  const n = pares.length
  // El ejemplo, de una gemela con productos: se entiende mejor.
  const ej = [...pares].sort((a, b) => b.gemela.productos - a.gemela.productos)[0]
  const deLaGemela = (g: { productos: number; movimientos?: number }) =>
    [
      `${g.productos} ${g.productos === 1 ? 'producto' : 'productos'}`,
      ...(g.movimientos ? [`${g.movimientos} ${g.movimientos === 1 ? 'compra o pago' : 'compras y pagos'}`] : []),
    ].join(', ')
  return [
    `Vas a unir ${n} ${n === 1 ? 'ficha repetida vacía' : 'fichas repetidas vacías'} a su gemela.`,
    '',
    ej
      ? `Por ejemplo: "${ej.vacia.nombre}" (sin productos, ni compras, ni pagos) dentro de "${ej.gemela.proveedor.nombre}" (${deLaGemela(ej.gemela)}).`
      : '',
    '',
    '· Cada ficha vacía se borra, con su constancia: no vuelve aunque un aparato haya estado apagado.',
    '· Si tenía teléfono, ciudad o alias para transferir y la gemela no, pasan a la gemela.',
    '· Ningún producto, compra ni pago cambia de lugar.',
    '',
    `Queda en el historial como «${MOTIVO_FICHAS_VACIAS}».`,
    '',
    '¿Unir?',
  ].join('\n')
}
