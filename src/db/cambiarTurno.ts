import { conMotivo, db, type Turno } from './db'
import { nombreTurno } from '../lib/turnoSegunHora'

/**
 * Pasar un turno abierto de la mañana a la tarde, o al revés.
 *
 * Para corregir el que se abrió en el turno equivocado sin borrarlo:
 * borrar un turno pide motivo, deja constancia y se lleva el arqueo de
 * apertura, que hay que volver a contar.
 *
 * Solo mientras está abierto y no tiene ventas. Con ventas ya no es
 * "me equivoqué al abrir": esas ventas son plata de un turno, y moverla
 * de caja es otra decisión (para una venta suelta está "Pasar al otro
 * turno"). Los egresos, si hay, van con el turno: cuelgan de él y no de
 * la mañana o la tarde.
 */

export type ResultadoCambioTurno =
  | { estado: 'cambiado'; turno: Turno }
  | { estado: 'no-existe' }
  | { estado: 'cerrado' }
  | { estado: 'tiene-ventas'; ventas: number }
  /** Ya hay un turno abierto en el otro horario de ese día. */
  | { estado: 'ocupado' }

export function otroTurno(turno: Turno): Turno {
  return turno === 'M' ? 'T' : 'M'
}

export function motivoCambioTurno(de: Turno, a: Turno): string {
  return `Turno corregido: se abrió como ${nombreTurno(de)} y era ${nombreTurno(a)}`
}

export async function cambiarTurno(jornadaId: string): Promise<ResultadoCambioTurno> {
  const jornada = await db.jornadas.get(jornadaId)
  if (!jornada) return { estado: 'no-existe' }
  const nuevo = otroTurno(jornada.turno)

  return conMotivo(motivoCambioTurno(jornada.turno, nuevo), async () =>
    db.transaction('rw', db.jornadas, db.ventas, async () => {
      // Se vuelve a leer adentro: entre que se dibujó el botón y que se
      // tocó, otro dispositivo pudo cargar una venta o abrir el otro turno.
      const actual = await db.jornadas.get(jornadaId)
      if (!actual) return { estado: 'no-existe' } as const
      if (actual.estado !== 'abierto') return { estado: 'cerrado' } as const

      const ventas = await db.ventas.where('jornadaId').equals(jornadaId).count()
      if (ventas > 0) return { estado: 'tiene-ventas', ventas } as const

      const ocupado = await db.jornadas
        .where('[fecha+turno]')
        .equals([actual.fecha, nuevo])
        .first()
      if (ocupado) return { estado: 'ocupado' } as const

      await db.jornadas.update(jornadaId, { turno: nuevo })
      return { estado: 'cambiado', turno: nuevo } as const
    }),
  )
}
