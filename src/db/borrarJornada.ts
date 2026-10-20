import { conMotivo, db, type Borrado, type Jornada, type Movimiento, type Venta } from './db'

export interface ResumenJornada {
  jornada: Jornada
  ventas: Venta[]
  movimientos: Movimiento[]
  totalVendido: number
}

/** Que tiene adentro un turno, para poder decidir antes de borrarlo. */
export async function resumenJornada(id: string): Promise<ResumenJornada | null> {
  const jornada = await db.jornadas.get(id)
  if (!jornada) return null
  const [ventas, movimientos] = await Promise.all([
    db.ventas.where('jornadaId').equals(id).toArray(),
    db.movimientos.where('jornadaId').equals(id).toArray(),
  ])
  return {
    jornada,
    ventas,
    movimientos,
    totalVendido: ventas.reduce((s, v) => s + v.total, 0),
  }
}

/**
 * Borra un turno entero: el turno, sus ventas y sus movimientos de caja.
 *
 * Por que existe
 * --------------
 * Hasta ahora un turno se creaba y no se sacaba nunca. Eso esta bien
 * para la operacion de todos los dias --un turno trabajado no se borra,
 * se corrige-- pero deja sin salida el caso en que un turno NO tendria
 * que existir: el mismo dia cargado dos veces desde dos dispositivos.
 * Paso el 19/10/2026 y no habia forma de arreglarlo desde la app.
 *
 * Que NO hace: devolver el stock
 * ------------------------------
 * A proposito. El stock se descuenta en el dispositivo donde se carga
 * la venta; cuando la venta llega a los demas por sincronizacion, el
 * stock de ellos no se toca. Si al borrar se devolviera, se estaria
 * sumando en un dispositivo lo que nunca se resto ahi, y el stock
 * quedaria inflado. Si hace falta corregirlo, se corrige a mano, que es
 * lo unico que no se equivoca.
 *
 * La constancia
 * -------------
 * Ademas del historial --que guarda quien, cuando y con que motivo--,
 * cada cosa borrada deja un renglon en `borrados`. Eso es lo que impide
 * que un dispositivo que estaba apagado la vuelva a subir despues (ver
 * la interfaz Borrado en db.ts).
 */
export async function borrarJornada(
  id: string,
  motivo: string,
  quien: string | null,
): Promise<{ ventas: number; movimientos: number }> {
  const resumen = await resumenJornada(id)
  if (!resumen) throw new Error('Ese turno ya no está.')
  if (!motivo.trim()) throw new Error('Hace falta el motivo.')

  const cuando = Date.now()
  const constancia = (tabla: Borrado['tabla'], clave: string): Borrado => ({
    id: `${tabla}/${clave}`,
    tabla,
    clave,
    cuando,
    quien,
    motivo: motivo.trim(),
  })

  await conMotivo(motivo.trim(), async () =>
    db.transaction('rw', db.jornadas, db.ventas, db.movimientos, db.borrados, async () => {
      // Las constancias primero: si algo fallara a mitad de camino,
      // es preferible tener de mas --un borrado anotado que no paso,
      // que no revive nada-- que de menos.
      await db.borrados.bulkPut([
        ...resumen.ventas.map((v) => constancia('ventas', v.id)),
        ...resumen.movimientos.map((m) => constancia('movimientos', m.id)),
        constancia('jornadas', id),
      ])

      for (const v of resumen.ventas) await db.ventas.delete(v.id)
      for (const m of resumen.movimientos) await db.movimientos.delete(m.id)
      await db.jornadas.delete(id)
    }),
  )

  return { ventas: resumen.ventas.length, movimientos: resumen.movimientos.length }
}
