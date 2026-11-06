import type { CategoriaGasto, Movimiento, Vencimiento } from '../db/db'

/**
 * La agenda de pagos que se repiten (punto 18 del pedido del 06/11).
 *
 * Un vencimiento esta pagado en un mes si hay un gasto que lo dice
 * (`Movimiento.vencimiento`). No se guarda aparte: asi no hay dos
 * verdades, y si el gasto se borra, el vencimiento vuelve a figurar sin
 * pagar.
 *
 * Que se reclama: el mes anterior, si vencio y no se pago (y la agenda
 * ya lo conocia), y el mes en curso. Mas atras no: para eso esta Gastos.
 */

/** Las categorias que se pagan igual se venda mucho o poco (como en Caja). */
export const CATEGORIAS_FIJAS: CategoriaGasto[] = [
  'ALQUILER',
  'SERVICIOS',
  'SUELDOS',
  'CONTADOR',
  'IMPUESTOS',
  'MANTENIMIENTO',
]

/** Para cargar los de siempre de un toque. Los dias son una guia: se corrigen. */
export const SUGERIDOS: { concepto: string; categoria: CategoriaGasto; dia: number }[] = [
  { concepto: 'Alquiler', categoria: 'ALQUILER', dia: 10 },
  { concepto: 'Luz', categoria: 'SERVICIOS', dia: 15 },
  { concepto: 'Internet', categoria: 'SERVICIOS', dia: 15 },
  { concepto: 'Contador', categoria: 'CONTADOR', dia: 10 },
  // La cuota del monotributo vence el 20 (dato a confirmar con el contador).
  { concepto: 'Monotributo', categoria: 'IMPUESTOS', dia: 20 },
  { concepto: 'Resumen de la tarjeta', categoria: 'OTROS', dia: 5 },
]

export const AVISAR_DIAS_ANTES = 3

/** yyyy-mm de una fecha yyyy-mm-dd. */
export function periodoDe(fecha: string): string {
  return fecha.slice(0, 7)
}

function partes(periodo: string): [number, number] {
  const [a, m] = periodo.split('-').map(Number)
  return [a, m]
}

function armarPeriodo(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`
}

export function periodoAnterior(periodo: string): string {
  const [a, m] = partes(periodo)
  return m === 1 ? armarPeriodo(a - 1, 12) : armarPeriodo(a, m - 1)
}

export function periodoSiguiente(periodo: string): string {
  const [a, m] = partes(periodo)
  return m === 12 ? armarPeriodo(a + 1, 1) : armarPeriodo(a, m + 1)
}

/** Cuando vence en ese mes: el dia elegido, o el ultimo si el mes es mas corto. */
export function fechaDeVencimiento(dia: number, periodo: string): string {
  const [a, m] = partes(periodo)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const d = Math.min(Math.max(1, Math.round(dia)), ultimo)
  return `${periodo}-${String(d).padStart(2, '0')}`
}

/** Dias de `desde` a `hasta` (negativo si `hasta` ya paso). */
export function diasEntre(desde: string, hasta: string): number {
  const utc = (f: string) => {
    const [a, m, d] = f.split('-').map(Number)
    return Date.UTC(a, m - 1, d)
  }
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000)
}

export type EstadoVencimiento = 'vencido' | 'por-vencer' | 'pendiente' | 'pagado'

export interface Situacion {
  vencimiento: Vencimiento
  /** El mes al que se refiere (yyyy-mm). */
  periodo: string
  /** Cuando vence (o vencio) ese mes. */
  fecha: string
  /** Dias hasta esa fecha; negativo si ya paso. */
  dias: number
  estado: EstadoVencimiento
  /** El gasto que lo pago, si esta pagado. */
  pago: Movimiento | null
  /** Si esta pagado: cuando vence el mes que viene. */
  proximo: string | null
}

export function pagoDelPeriodo(v: Pick<Vencimiento, 'id'>, periodo: string, movimientos: Movimiento[]): Movimiento | null {
  return movimientos.find((m) => m.vencimiento?.id === v.id && m.vencimiento.periodo === periodo) ?? null
}

/** Como esta un vencimiento hoy: lo que hay que mirar primero. */
export function situacionDe(v: Vencimiento, hoy: string, movimientos: Movimiento[]): Situacion {
  const actual = periodoDe(hoy)
  const anterior = periodoAnterior(actual)
  const avisar = v.avisarDiasAntes ?? AVISAR_DIAS_ANTES

  // 1. El mes pasado quedo sin pagar, y la agenda ya lo conocia.
  const fechaAnterior = fechaDeVencimiento(v.dia, anterior)
  if (v.desde <= fechaAnterior && !pagoDelPeriodo(v, anterior, movimientos)) {
    return {
      vencimiento: v,
      periodo: anterior,
      fecha: fechaAnterior,
      dias: diasEntre(hoy, fechaAnterior),
      estado: 'vencido',
      pago: null,
      proximo: null,
    }
  }

  // 2. Este mes. Si se cargo despues de que vencio, arranca el que viene.
  let periodo = actual
  let fecha = fechaDeVencimiento(v.dia, actual)
  if (v.desde > fecha) {
    periodo = periodoSiguiente(actual)
    fecha = fechaDeVencimiento(v.dia, periodo)
  }
  const dias = diasEntre(hoy, fecha)
  const pago = pagoDelPeriodo(v, periodo, movimientos)
  if (pago) {
    return {
      vencimiento: v,
      periodo,
      fecha,
      dias,
      estado: 'pagado',
      pago,
      proximo: fechaDeVencimiento(v.dia, periodoSiguiente(periodo)),
    }
  }
  return {
    vencimiento: v,
    periodo,
    fecha,
    dias,
    estado: dias < 0 ? 'vencido' : dias <= avisar ? 'por-vencer' : 'pendiente',
    pago: null,
    proximo: null,
  }
}

const ORDEN: Record<EstadoVencimiento, number> = { vencido: 0, 'por-vencer': 1, pendiente: 2, pagado: 3 }

/** Todos los activos, primero lo vencido, despues lo que vence antes. */
export function agenda(vencimientos: Vencimiento[], hoy: string, movimientos: Movimiento[]): Situacion[] {
  return vencimientos
    .filter((v) => v.activo !== false)
    .map((v) => situacionDe(v, hoy, movimientos))
    .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.fecha.localeCompare(b.fecha) || a.vencimiento.concepto.localeCompare(b.vencimiento.concepto, 'es'))
}

/** Lo que dice el renglon: «Vence en 3 días», «Venció hace 2 días», «Vence hoy». */
export function cuandoVence(s: Pick<Situacion, 'dias' | 'estado'>): string {
  if (s.estado === 'pagado') return 'Pagado'
  if (s.dias === 0) return 'Vence hoy'
  if (s.dias === 1) return 'Vence mañana'
  if (s.dias > 1) return `Vence en ${s.dias} días`
  if (s.dias === -1) return 'Venció ayer'
  return `Venció hace ${-s.dias} días`
}

/**
 * Los gastos del mes que podrian ser el pago de este vencimiento y no
 * estan enganchados a ninguno: misma categoria, sin vencimiento. Para no
 * cargar dos veces lo que ya se cargo a mano en Gastos.
 */
export function gastosParaEnganchar(
  v: Pick<Vencimiento, 'categoria'>,
  meses: string[],
  movimientos: Movimiento[],
): Movimiento[] {
  return movimientos
    .filter(
      (m) =>
        (m.tipo === 'GASTO_CAJA_GRANDE' || m.tipo === 'EGRESO_CAJA') &&
        m.categoria === v.categoria &&
        !m.vencimiento &&
        meses.includes(periodoDe(m.fecha)),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** «noviembre», o «noviembre de 2025» si no es de este año. */
export function nombreDelMes(periodo: string, hoy: string): string {
  const [a, m] = partes(periodo)
  const nombre = MESES[m - 1] ?? periodo
  return periodo.slice(0, 4) === hoy.slice(0, 4) ? nombre : `${nombre} de ${a}`
}
