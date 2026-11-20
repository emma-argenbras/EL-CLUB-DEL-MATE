import { conMotivo, db } from './db'
import { jornadaRearmada, MOTIVO_REARMADO, turnosParaRearmar, type TurnoParaRearmar } from '../lib/rearmarTurnos'

/**
 * Los turnos con ventas que no están, leídos de este aparato (que tiene lo
 * mismo que el servidor). Ver lib/rearmarTurnos.ts.
 */
export async function leerTurnosParaRearmar(): Promise<TurnoParaRearmar[]> {
  const [jornadas, ventas] = await Promise.all([db.jornadas.toArray(), db.ventas.toArray()])
  const ids = new Set(jornadas.map((j) => j.id))
  const faltan = [...new Set(ventas.filter((v) => v.jornadaId && !ids.has(v.jornadaId)).map((v) => v.jornadaId))]
  if (faltan.length === 0) return []
  const [movimientos, historial] = await Promise.all([
    db.movimientos.where('jornadaId').anyOf(faltan).toArray(),
    db.historial.where('tabla').equals('jornadas').toArray(),
  ])
  return turnosParaRearmar({ jornadas, ventas, movimientos, historial })
}

export interface ResultadoRearmado {
  creados: string[]
  /** Los que ya estaban cuando se tocó el botón (llegaron de otro aparato). */
  yaEstaban: string[]
}

/**
 * Crea los turnos que se pueden rearmar, con su mismo id, de una vez y con
 * su motivo en el historial. Lo que tiene un problema no se toca.
 */
export async function rearmarTurnos(turnos: TurnoParaRearmar[], hoy: string): Promise<ResultadoRearmado> {
  const listos = turnos.filter((t) => !t.problema)
  return conMotivo(MOTIVO_REARMADO, () =>
    db.transaction('rw', db.jornadas, async () => {
      const resultado: ResultadoRearmado = { creados: [], yaEstaban: [] }
      for (const t of listos) {
        // Se vuelve a mirar adentro: entre que se dibujó la lista y que se
        // tocó el botón, el aparato que lo tenía pudo haberlo subido.
        const yaEsta =
          (await db.jornadas.get(t.id)) ?? (await db.jornadas.where('[fecha+turno]').equals([t.fecha, t.turno]).first())
        if (yaEsta) {
          resultado.yaEstaban.push(t.id)
          continue
        }
        await db.jornadas.add(jornadaRearmada(t, hoy))
        resultado.creados.push(t.id)
      }
      return resultado
    }),
  )
}
