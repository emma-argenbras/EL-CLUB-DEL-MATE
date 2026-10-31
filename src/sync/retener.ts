import type { Jornada, Movimiento, Venta } from '../db/db'

/**
 * Qué NO subir al iniciar sesión, para no duplicar un turno.
 *
 * La subida inicial (`empujarTodoLocal`) manda al servidor lo que este
 * dispositivo tiene y el servidor no. Compara por clave: si el id no está
 * allá, se sube. Eso duplica un turno entero en un caso real: el celular
 * de Gabriela tuvo ventas que no llegaron, Sandra las volvió a cargar
 * desde su Mac (otro id de turno, otros ids de ventas), y al reconectarse
 * el celular subiría las suyas al lado de las de Sandra.
 *
 * Un turno se identifica por su fecha y su horario (mañana o tarde): si
 * el servidor ya tiene ese turno con otro id, el de este dispositivo se
 * retiene, con sus ventas y sus egresos. No se sube ni se borra: se
 * muestra, y alguien al mando decide si ya estaba cargado (descartar) o
 * si de verdad falta (subirlo igual).
 */

export interface TurnoRetenido {
  /** El turno de este dispositivo que no se subió. */
  id: string
  fecha: string
  turno: Jornada['turno']
  /** El turno que ya tiene el servidor para esa fecha y horario. */
  idEnServidor: string
  ventas: number
  totalVentas: number
  movimientos: number
}

export interface SubidaRetenida {
  cuando: number
  turnos: TurnoRetenido[]
}

/** Clave de un turno por lo que lo identifica para una persona. */
export function claveDeTurno(j: Pick<Jornada, 'fecha' | 'turno'>): string {
  return `${j.fecha}|${j.turno}`
}

export function decidirRetenidos(
  /** Turnos locales que el servidor no tiene (por id). */
  jornadasSinSubir: Jornada[],
  /** Todos los turnos del servidor. */
  jornadasServidor: Pick<Jornada, 'id' | 'fecha' | 'turno'>[],
  ventasLocales: Venta[],
  movimientosLocales: Movimiento[],
): TurnoRetenido[] {
  const enServidor = new Map<string, string>()
  for (const j of jornadasServidor) enServidor.set(claveDeTurno(j), j.id)

  const retenidos: TurnoRetenido[] = []
  for (const j of jornadasSinSubir) {
    const idEnServidor = enServidor.get(claveDeTurno(j))
    if (!idEnServidor || idEnServidor === j.id) continue
    const ventas = ventasLocales.filter((v) => v.jornadaId === j.id)
    const movimientos = movimientosLocales.filter((m) => m.jornadaId === j.id)
    retenidos.push({
      id: j.id,
      fecha: j.fecha,
      turno: j.turno,
      idEnServidor,
      ventas: ventas.length,
      totalVentas: Math.round(ventas.reduce((s, v) => s + v.total, 0) * 100) / 100,
      movimientos: movimientos.length,
    })
  }
  return retenidos.sort((a, b) => (a.fecha + a.turno).localeCompare(b.fecha + b.turno))
}

/** Si una fila de esa tabla cuelga de un turno retenido, tampoco se sube. */
export function cuelgaDeRetenido(
  tabla: string,
  fila: Record<string, unknown>,
  retenidos: Set<string>,
): boolean {
  if (retenidos.size === 0) return false
  if (tabla === 'jornadas') return retenidos.has(String(fila.id))
  if (tabla === 'ventas' || tabla === 'movimientos') {
    return typeof fila.jornadaId === 'string' && retenidos.has(fila.jornadaId)
  }
  return false
}

export function textoDeRetenidos(turnos: TurnoRetenido[]): string {
  const ventas = turnos.reduce((s, t) => s + t.ventas, 0)
  const cuales = turnos
    .map((t) => `${t.fecha.slice(8, 10)}/${t.fecha.slice(5, 7)} ${t.turno === 'M' ? 'mañana' : 'tarde'}`)
    .join(', ')
  return (
    `Este aparato tiene ${turnos.length} ${turnos.length === 1 ? 'turno' : 'turnos'} con ${ventas} ` +
    `${ventas === 1 ? 'venta' : 'ventas'} que no se subieron, porque el servidor ya tiene ` +
    `${turnos.length === 1 ? 'ese turno cargado' : 'esos turnos cargados'} desde otro aparato (${cuales}). ` +
    'No se duplicó nada.'
  )
}
