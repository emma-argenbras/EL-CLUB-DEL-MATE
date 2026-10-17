import { conMotivo, db, type Proveedor } from './db'
import { armarPlanProveedores, type PlanProveedores } from '../lib/planProveedores'

/** El motivo con el que quedan todos los renglones en el historial. */
export const MOTIVO = 'Limpieza de proveedores'

export interface ResultadoLimpieza {
  fichasCreadas: number
  fichasActualizadas: number
  fichasBorradas: number
  productosTocados: number
  fichasFinales: number
}

/**
 * Aplica el plan de proveedores: unifica, reengancha, crea y reactiva.
 *
 * Tres cosas sobre como lo hace.
 *
 * **Vuelve a calcular el plan adentro de la transaccion.** La pantalla
 * muestra un plan calculado hace unos segundos; lo que se aplica es el
 * plan de los datos de este instante. Si entre una cosa y la otra entro
 * un cambio desde otro dispositivo, se aplica sobre lo que hay, no
 * sobre la foto vieja. Por eso devuelve lo que realmente hizo, y la
 * pantalla informa ESO y no lo que habia prometido.
 *
 * **El orden no es casual:** primero se deja lista la ficha final,
 * despues se mueven los productos, y recien al final se borran las
 * absorbidas. Al reves habria un momento con productos apuntando a una
 * ficha que ya no existe.
 *
 * **Cambiar el id es crear y borrar.** El id es la clave primaria, asi
 * que "renombrar" una ficha es agregar la nueva y sacar la vieja. Lo
 * que se conserva --nombre, contacto, notas, alias, cuando se creo-- va
 * explicito en el registro nuevo.
 */
export async function aplicarPlanProveedores(): Promise<ResultadoLimpieza> {
  return conMotivo(MOTIVO, async () =>
    db.transaction('rw', db.proveedores, db.productos, async () => {
      const [proveedores, productos] = await Promise.all([
        db.proveedores.toArray(),
        db.productos.toArray(),
      ])
      const plan = armarPlanProveedores(proveedores, productos)
      const porId = new Map(proveedores.map((p) => [p.id, p]))

      const resultado: ResultadoLimpieza = {
        fichasCreadas: 0,
        fichasActualizadas: 0,
        fichasBorradas: 0,
        productosTocados: 0,
        fichasFinales: plan.fichasFinales,
      }

      // 1. La ficha final, lista y con los datos que se rescatan.
      for (const d of plan.todos) {
        const yaEsta = porId.get(d.id)
        const registro: Proveedor = {
          id: d.id,
          nombre: d.nombre,
          contacto: d.contacto,
          notas: d.notas,
          activo: d.activo || d.vigentesFinales > 0,
          // Siempre un array, aunque este vacio: si al crear se omitiera
          // el campo y al actualizar se escribiera [], la ficha quedaria
          // distinta segun por que camino paso, y aplicar dos veces
          // dejaria dos resultados distintos.
          alias: d.alias,
          creadoEn: d.sobrevive?.proveedor.creadoEn ?? Date.now(),
          actualizadoEn: Date.now(),
        }

        if (yaEsta) {
          // Si ya esta igual, no se escribe. Importa de verdad: sin
          // esto, correr la limpieza de nuevo --o tocar el boton dos
          // veces-- le cambiaria la fecha de modificacion a todas las
          // fichas y las subiria a la nube una por una, para nada.
          const igual =
            yaEsta.nombre === registro.nombre &&
            (yaEsta.contacto ?? null) === registro.contacto &&
            (yaEsta.notas ?? null) === registro.notas &&
            (yaEsta.activo !== false) === registro.activo &&
            JSON.stringify(yaEsta.alias ?? []) === JSON.stringify(registro.alias)
          if (!igual) {
            await db.proveedores.update(d.id, {
              nombre: registro.nombre,
              contacto: registro.contacto,
              notas: registro.notas,
              activo: registro.activo,
              alias: registro.alias,
              actualizadoEn: registro.actualizadoEn,
            })
            resultado.fichasActualizadas++
          }
        } else {
          await db.proveedores.add(registro)
          resultado.fichasCreadas++
        }
      }

      // 2. Los productos, a su ficha final. Se corrige tambien el
      //    nombre escrito en el producto: si quedara el viejo, la
      //    importacion del Excel leeria un nombre que ya no es el de
      //    ninguna ficha.
      const nombrePorId = new Map(plan.todos.map((d) => [d.id, d.nombre]))
      for (const p of productos) {
        if (!p.proveedorId) continue
        const destino = plan.destinoDe.get(p.proveedorId)
        if (!destino) continue
        const nombre = nombrePorId.get(destino) ?? p.proveedor
        if (p.proveedorId === destino && p.proveedor === nombre) continue
        await db.productos.update(p.codigo, { proveedorId: destino, proveedor: nombre })
        resultado.productosTocados++
      }

      // 3. Las fichas absorbidas, una vez que nadie las apunta.
      for (const d of plan.todos) {
        for (const ficha of d.fichas) {
          if (ficha.proveedor.id === d.id) continue
          await db.proveedores.delete(ficha.proveedor.id)
          resultado.fichasBorradas++
        }
      }

      return resultado
    }),
  )
}

/** "1 ficha" / "3 fichas". */
function cuantas(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * El texto que se le muestra a la persona antes de aplicar.
 *
 * Separa a proposito dos cosas que son muy distintas y que al
 * principio aparecian juntas: una ficha que CAMBIA DE NUMERO INTERNO
 * sigue estando --es la misma, con el mismo nombre y los mismos
 * productos-- y una ficha REPETIDA que se absorbe desaparece de la
 * lista. Leer "se borran 10 fichas" al lado de "quedan 9" asusta, y
 * ademas es falso: no se borra ningun proveedor del negocio.
 */
export function textoDeConfirmacion(plan: PlanProveedores): string {
  const hoy = plan.activos + plan.inactivos
  const repetidasAbsorbidas = plan.todos.reduce(
    (s, d) => s + Math.max(0, d.fichas.length - 1),
    0,
  )
  const cambianDeNumero = plan.todos.filter(
    (d) => d.sobrevive != null && d.sobrevive.proveedor.id !== d.id,
  ).length

  const lineas = [`Vas a reordenar los proveedores. Quedan ${plan.fichasFinales} fichas, de las ${hoy} de ahora.`, '']
  if (repetidasAbsorbidas > 0) {
    lineas.push(
      `· Se juntan ${cuantas(repetidasAbsorbidas, 'ficha repetida', 'fichas repetidas')} con la que queda.`,
    )
  }
  if (plan.crear.length > 0) {
    lineas.push(`· Se crean ${cuantas(plan.crear.length, 'ficha que falta', 'fichas que faltan')}.`)
  }
  if (plan.reactivar.length > 0) {
    lineas.push(`· Se reactivan ${cuantas(plan.reactivar.length, 'ficha', 'fichas')}.`)
  }
  if (cambianDeNumero > 0) {
    lineas.push(
      `· ${cuantas(cambianDeNumero, 'ficha cambia', 'fichas cambian')} de número interno, para que no se vuelvan a duplicar. El nombre, el contacto y las notas quedan igual.`,
    )
  }
  lineas.push(
    `· ${plan.productosAfectados} productos pasan a su proveedor.`,
    '',
    `Queda todo en el historial como «${MOTIVO}», con el valor de antes y el de después.`,
    '',
    `No se borra ningún producto ni ninguna venta.`,
  )
  return lineas.join('\n')
}
