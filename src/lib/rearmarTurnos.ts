import type { Arqueo, EntradaHistorial, Jornada, Movimiento, Turno, Venta } from '../db/db'
import { resumirJornada, totalArqueo } from './calculos'
import { fechaLinda } from './formato'
import { HORA_CAMBIO_DE_TURNO } from './turnoSegunHora'

/**
 * Rearmar en el servidor un turno que no llegó (20/11).
 *
 * El 03/11 y el 04/11 tres turnos de Gabriela quedaron en su aparato y
 * nunca subieron: sus ventas y sus egresos sí están, el turno no. Caja no
 * los muestra y falta con cuánto abrieron, el conteo del cierre y la
 * diferencia (ver «Lo que pasó el 07/11» en el README).
 *
 * Todo lo que hace falta para completarlos ya está en el servidor:
 * - La fecha, el horario y la hora de apertura: el renglón «creó» del
 *   historial («Turno del 2026-11-03 a la mañana»).
 * - El conteo del cierre, con sus billetes, y la hora: los renglones del
 *   historial de cuando se cerró.
 * - Con cuánto abrió: lo que se contó al cerrar el turno anterior. La
 *   cadena de caja cierra (lo revisó el soporte de Emmanuel): lo que queda
 *   en el cajón al cerrar es con lo que abre el turno que sigue.
 * - Las ventas y los egresos: tienen el id del turno.
 *
 * Se rearma con el MISMO id: si un día aparece el aparato que lo tiene y
 * lo sube, es el mismo turno y no queda repetido.
 *
 * Lo que no se sabe no se inventa: el motivo de la diferencia y el primer
 * conteo quedan vacíos, y si la caja no dio justa el cierre espera el
 * visto bueno como cualquier otro.
 */

export const MOTIVO_REARMADO = 'Turno rearmado: no había llegado al servidor'

export interface DatosParaRearmar {
  jornadas: Jornada[]
  ventas: Venta[]
  movimientos: Movimiento[]
  historial: EntradaHistorial[]
}

export interface TurnoParaRearmar {
  id: string
  fecha: string
  turno: Turno
  /** El horario salió de la hora de las ventas, no del historial. */
  turnoPorLaHora: boolean
  vendedor: string | null
  ventas: number
  totalVendido: number
  efectivo: number
  /** Egresos de la caja chica y pases a caja grande del turno. */
  egresos: number
  cajaInicial: number | null
  arqueoApertura: Arqueo | null
  /** De dónde sale la caja inicial, en palabras. */
  deDondeAbre: string
  arqueoCierre: Arqueo | null
  /** De dónde sale el conteo del cierre, en palabras. */
  deDondeCierra: string
  horaApertura: string | null
  horaCierre: string | null
  notaCierre: string | null
  creadoEn: number | null
  /** Lo que tendría que haber dado el cierre, y la diferencia con lo contado. */
  esperado: number | null
  diferencia: number | null
  /**
   * Si el turno que sigue, ya en el servidor, abrió con lo que este contó
   * al cerrar. null si el que sigue también se rearma o no hay ninguno.
   */
  engancha: { con: string; abrio: number; cerro: number; igual: boolean } | null
  /** Por qué no se puede rearmar; null si se puede. */
  problema: string | null
}

const COMO_DICE_EL_HISTORIAL = /^Turno del (\d{4}-\d{2}-\d{2}) a la (mañana|tarde)$/

export const nombreDelTurno = (turno: Turno) => (turno === 'M' ? 'mañana' : 'tarde')
const elTurno = (fecha: string, turno: Turno) => `${fechaLinda(fecha).slice(0, 5)} ${nombreDelTurno(turno)}`

/**
 * «09:05», como guarda la hora la pantalla de Caja en el navegador. A mano
 * y no con toLocaleTimeString: según dónde corra, es-AR sale «09:05 a. m.».
 */
export function horaDelMomento(cuando: number): string {
  const d = new Date(cuando)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function esArqueo(valor: unknown): valor is Arqueo {
  if (!valor || typeof valor !== 'object') return false
  const billetes = (valor as { billetes?: unknown }).billetes
  return Boolean(billetes) && typeof billetes === 'object'
}

const copiar = (a: Arqueo): Arqueo => ({ billetes: { ...a.billetes }, monedas: a.monedas || 0 })

const orden = (j: Pick<Jornada, 'fecha' | 'turno'>) => `${j.fecha}|${j.turno}`

/** Lo último que el historial dice de un campo del turno. */
function ultimo(renglones: EntradaHistorial[], campo: string): EntradaHistorial | undefined {
  return renglones.filter((h) => h.accion === 'edito' && h.campo === campo).at(-1)
}

/**
 * Los turnos que tienen ventas en el servidor pero no están, con lo que se
 * puede reconstruir de cada uno, en el orden en que pasaron.
 */
export function turnosParaRearmar(datos: DatosParaRearmar): TurnoParaRearmar[] {
  const existentes = new Map(datos.jornadas.map((j) => [j.id, j]))
  const faltan = new Map<string, { ventas: Venta[]; movimientos: Movimiento[] }>()
  for (const v of datos.ventas) {
    if (!v.jornadaId || existentes.has(v.jornadaId)) continue
    const t = faltan.get(v.jornadaId) ?? { ventas: [], movimientos: [] }
    t.ventas.push(v)
    faltan.set(v.jornadaId, t)
  }
  if (faltan.size === 0) return []
  for (const m of datos.movimientos) {
    if (m.jornadaId && faltan.has(m.jornadaId)) faltan.get(m.jornadaId)!.movimientos.push(m)
  }

  // Primero lo que dice el historial de cada uno.
  const armados: TurnoParaRearmar[] = []
  for (const [id, { ventas, movimientos }] of faltan) {
    const renglones = datos.historial
      .filter((h) => h.tabla === 'jornadas' && h.clave === id)
      .sort((a, b) => a.cuando - b.cuando)
    const creo = renglones.find((h) => h.accion === 'creo')
    const dice = creo ? COMO_DICE_EL_HISTORIAL.exec(creo.queEs) : null
    const primera = [...ventas].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0]
    const fecha = dice?.[1] ?? primera.fecha
    const corregido = ultimo(renglones, 'turno')?.valorNuevo
    const turnoDelHistorial: Turno | null =
      corregido === 'M' || corregido === 'T' ? corregido : dice ? (dice[2] === 'mañana' ? 'M' : 'T') : null
    const turno = turnoDelHistorial ?? (Number((primera.hora || '0').split(':')[0]) < HORA_CAMBIO_DE_TURNO ? 'M' : 'T')

    const cierre = ultimo(renglones, 'arqueoCierre')
    const cerro = renglones.filter((h) => h.accion === 'edito' && h.campo === 'estado' && h.valorNuevo === 'cerrado').at(-1)
    const vendedorCorregido = ultimo(renglones, 'vendedor')?.valorNuevo
    const nota = ultimo(renglones, 'notaCierre')?.valorNuevo
    const cajaCorregida = ultimo(renglones, 'cajaInicial')?.valorNuevo
    const aperturaCorregida = ultimo(renglones, 'arqueoApertura')?.valorNuevo
    const resumen = resumirJornada(0, ventas, movimientos)

    armados.push({
      id,
      fecha,
      turno,
      turnoPorLaHora: turnoDelHistorial === null,
      vendedor:
        typeof vendedorCorregido === 'string'
          ? vendedorCorregido
          : (ventas.find((v) => v.vendedor)?.vendedor ?? creo?.quienNombre ?? null),
      ventas: ventas.length,
      totalVendido: resumen.totalVentas,
      efectivo: resumen.efectivo,
      egresos: resumen.egresosCaja + resumen.aCajaGrande,
      cajaInicial: typeof cajaCorregida === 'number' ? cajaCorregida : esArqueo(aperturaCorregida) ? totalArqueo(aperturaCorregida) : null,
      arqueoApertura: esArqueo(aperturaCorregida) ? copiar(aperturaCorregida) : null,
      deDondeAbre:
        typeof cajaCorregida === 'number' || esArqueo(aperturaCorregida) ? 'lo que se corrigió en el turno, según el historial' : '',
      arqueoCierre: cierre && esArqueo(cierre.valorNuevo) ? copiar(cierre.valorNuevo) : null,
      deDondeCierra:
        cierre && esArqueo(cierre.valorNuevo)
          ? `el conteo del cierre, del historial (${cierre.quienNombre}, ${fechaLinda(fecha).slice(0, 5)} a las ${horaDelMomento(cierre.cuando)})`
          : '',
      horaApertura: creo ? horaDelMomento(creo.cuando) : null,
      horaCierre: cerro ? horaDelMomento(cerro.cuando) : cierre ? horaDelMomento(cierre.cuando) : null,
      notaCierre: typeof nota === 'string' && nota.trim() ? nota : null,
      creadoEn: creo?.cuando ?? null,
      esperado: null,
      diferencia: null,
      engancha: null,
      problema: null,
    })
  }

  // Después, la cadena: con lo que cerró el anterior abre este, y con lo
  // que cerró este abrió el siguiente. En orden, porque dos seguidos que
  // faltan se apoyan uno en el otro.
  armados.sort((a, b) => orden(a).localeCompare(orden(b)))
  const ocupados = new Map(datos.jornadas.map((j) => [orden(j), j]))
  type Eslabon = { fecha: string; turno: Turno; rearmado?: TurnoParaRearmar; jornada?: Jornada }
  const cadena: Eslabon[] = [
    ...datos.jornadas.map((j): Eslabon => ({ fecha: j.fecha, turno: j.turno, jornada: j })),
    ...armados.map((t): Eslabon => ({ fecha: t.fecha, turno: t.turno, rearmado: t })),
  ].sort((a, b) => orden(a).localeCompare(orden(b)) || (a.rearmado ? 1 : 0) - (b.rearmado ? 1 : 0))

  for (const t of armados) {
    const repetido = ocupados.get(orden(t))
    if (repetido) {
      t.problema = `Ya hay un turno del ${elTurno(t.fecha, t.turno)} en el servidor: sus ventas habría que pasarlas a ese, no armar otro.`
      continue
    }
    const pos = cadena.findIndex((e) => e.rearmado === t)
    const anterior = cadena[pos - 1]
    const siguiente = cadena[pos + 1]

    if (t.cajaInicial === null && anterior) {
      const cierreAnterior = anterior.jornada?.estado === 'cerrado' ? anterior.jornada.arqueoCierre : anterior.rearmado?.arqueoCierre
      if (cierreAnterior) {
        t.cajaInicial = totalArqueo(cierreAnterior)
        t.arqueoApertura = copiar(cierreAnterior)
        t.deDondeAbre = `lo que se contó al cerrar el turno anterior (${elTurno(anterior.fecha, anterior.turno)}${anterior.rearmado ? ', que también se rearma' : ''})`
      }
    }
    if (t.arqueoCierre === null && siguiente?.jornada?.arqueoApertura) {
      t.arqueoCierre = copiar(siguiente.jornada.arqueoApertura)
      t.deDondeCierra = `lo que se contó al abrir el turno siguiente (${elTurno(siguiente.fecha, siguiente.turno)}): el historial no tiene el conteo del cierre`
    }

    if (t.cajaInicial === null) {
      t.problema = 'No se sabe con cuánto abrió: el turno anterior no tiene el conteo del cierre.'
      continue
    }
    if (t.arqueoCierre === null) {
      t.problema = 'No se sabe cuánto se contó al cerrar: no está en el historial ni en la apertura del turno siguiente.'
      continue
    }
    const cerro = totalArqueo(t.arqueoCierre)
    t.esperado = t.cajaInicial + t.efectivo - t.egresos
    t.diferencia = cerro - t.esperado
    if (siguiente?.jornada) {
      t.engancha = {
        con: elTurno(siguiente.fecha, siguiente.turno),
        abrio: siguiente.jornada.cajaInicial,
        cerro,
        igual: Math.abs(siguiente.jornada.cajaInicial - cerro) < 1,
      }
    }
  }
  return armados
}

/** El turno tal como se guarda, con el mismo id que tenía en el aparato. */
export function jornadaRearmada(t: TurnoParaRearmar, hoy: string): Jornada {
  if (t.problema || t.cajaInicial === null || !t.arqueoCierre) throw new Error(t.problema ?? 'Al turno le falta algo para rearmarlo.')
  return {
    id: t.id,
    fecha: t.fecha,
    turno: t.turno,
    estado: 'cerrado',
    vendedor: t.vendedor,
    cajaInicial: t.cajaInicial,
    horaApertura: t.horaApertura,
    horaCierre: t.horaCierre,
    arqueoApertura: t.arqueoApertura,
    arqueoCierre: t.arqueoCierre,
    notaCierre: t.notaCierre,
    motivoDiferencia: null,
    primerConteo: null,
    // El servidor no deja crear un turno con el visto bueno puesto. Si la
    // caja no dio justa, espera el del dueño como cualquier cierre.
    cierreAutorizado: null,
    solicitudCierre: null,
    notas: `Rearmado el ${fechaLinda(hoy)}: no había llegado al servidor. Con cuánto abrió sale de ${t.deDondeAbre}; el cierre, de ${t.deDondeCierra}.`,
    ...(t.creadoEn ? { creadoEn: t.creadoEn } : {}),
  }
}

/** La pregunta antes de escribir: cuántos turnos y cuáles. */
export function textoDeConfirmacion(turnos: TurnoParaRearmar[]): string {
  const listos = turnos.filter((t) => !t.problema)
  const cuales = listos.map((t) => `• ${elTurno(t.fecha, t.turno)}${t.vendedor ? ` (${t.vendedor})` : ''}`).join('\n')
  return (
    `Se van a crear ${listos.length} ${listos.length === 1 ? 'turno' : 'turnos'} en el servidor, cerrados, con su caja inicial y su conteo del cierre:\n${cuales}\n\n` +
    `Las ventas y los egresos no se tocan. Queda en el historial con el motivo «${MOTIVO_REARMADO}». ¿Seguir?`
  )
}
