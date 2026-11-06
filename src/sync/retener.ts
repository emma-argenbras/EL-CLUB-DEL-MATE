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

const nombreDeTurno = (t: Pick<TurnoRetenido, 'fecha' | 'turno'>) =>
  `${t.fecha.slice(8, 10)}/${t.fecha.slice(5, 7)} ${t.turno === 'M' ? 'mañana' : 'tarde'}`

const numero = (n: number) => n.toLocaleString('es-AR')

export function textoDeRetenidos(turnos: TurnoRetenido[]): string {
  const ventas = turnos.reduce((s, t) => s + t.ventas, 0)
  // Hasta tres se nombran; mas, se dice el tramo. El 06/11 la Mac de
  // Emmanuel retuvo 406 turnos y el cartel los listaba uno por uno: una
  // pared roja que tapaba la pantalla y no se podia leer.
  const cuales =
    turnos.length <= 3
      ? turnos.map(nombreDeTurno).join(', ')
      : `del ${nombreDeTurno(turnos[0])} al ${nombreDeTurno(turnos[turnos.length - 1])}`
  return (
    `Este aparato tiene ${numero(turnos.length)} ${turnos.length === 1 ? 'turno' : 'turnos'} con ${numero(ventas)} ` +
    `${ventas === 1 ? 'venta' : 'ventas'} que no se subieron, porque el servidor ya tiene ` +
    `${turnos.length === 1 ? 'ese turno cargado' : 'esos turnos cargados'} desde otro aparato (${cuales}). ` +
    'No se duplicó nada.'
  )
}

/* ------------------------------------------------------------------ */
/* ¿Es una copia de lo que ya esta en el servidor?                     */
/* ------------------------------------------------------------------ */

/**
 * Un turno retenido puede ser una copia exacta del que tiene el servidor
 * o algo distinto. El caso de la Mac de Emmanuel (06/11): hasta el 15/10
 * cada aparato importaba por su cuenta los meses viejos de la planilla,
 * con sus propios numeros de turno, asi que la Mac tenia su copia de
 * febrero a agosto y el servidor la de otro aparato. Son 406 turnos:
 * resolverlos de a uno no es una opcion, pero tirarlos a ciegas tampoco,
 * porque una version vieja del importador pudo dejar datos distintos.
 *
 * Por eso se compara el contenido, no solo la fecha: las mismas ventas
 * (producto, cantidad, total y medio de pago) y los mismos movimientos
 * (tipo, concepto y monto), sin importar el orden ni los numeros
 * internos. Solo lo que coincide entero se ofrece sacar de un saque.
 */
export type Coincidencia = 'igual' | 'distinto' | 'sin-servidor'

type VentaComparable = Pick<Venta, 'codigo' | 'cantidad' | 'total' | 'medioPago'>
type MovimientoComparable = Pick<Movimiento, 'tipo' | 'concepto' | 'monto'>

const centavos = (n: number) => Math.round(Number(n) * 100)

export function firmaDeVentas(ventas: VentaComparable[]): string {
  return ventas
    .map((v) => `${v.codigo}|${v.cantidad}|${centavos(v.total)}|${v.medioPago}`)
    .sort()
    .join('\n')
}

export function firmaDeMovimientos(movimientos: MovimientoComparable[]): string {
  return movimientos
    .map((m) => `${m.tipo}|${(m.concepto ?? '').trim().toLowerCase()}|${centavos(m.monto)}`)
    .sort()
    .join('\n')
}

export function compararConServidor(
  aca: { ventas: VentaComparable[]; movimientos: MovimientoComparable[] },
  servidor: { ventas: VentaComparable[]; movimientos: MovimientoComparable[] } | null,
): Coincidencia {
  if (!servidor) return 'sin-servidor'
  return firmaDeVentas(aca.ventas) === firmaDeVentas(servidor.ventas) &&
    firmaDeMovimientos(aca.movimientos) === firmaDeMovimientos(servidor.movimientos)
    ? 'igual'
    : 'distinto'
}
