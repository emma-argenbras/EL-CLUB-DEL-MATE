import type { CategoriaGasto, Movimiento, Vencimiento } from '../db/db'
import { FIJOS_POR_DEFECTO } from './borrarGasto'

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
 *
 * Una deuda en cuotas (20/11) es un vencimiento con `cuotas`: antes de la
 * primera cuota que paga el local no se reclama nada, y despues de la
 * ultima queda terminada. Asi se lleva, por ejemplo, lo que el local le
 * devuelve a un dueño que pago algo del local con su tarjeta.
 */

/** Las categorias que se pagan igual se venda mucho o poco: una sola lista para toda la app. */
export const CATEGORIAS_FIJAS: CategoriaGasto[] = FIJOS_POR_DEFECTO

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

/** Cuantos meses van de un periodo a otro (negativo si `hasta` es antes). */
export function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = partes(desde)
  const [a2, m2] = partes(hasta)
  return (a2 - a1) * 12 + (m2 - m1)
}

/** El periodo `n` meses despues (o antes, si `n` es negativo). */
export function sumarMeses(periodo: string, n: number): string {
  const [a, m] = partes(periodo)
  const total = a * 12 + (m - 1) + n
  return armarPeriodo(Math.floor(total / 12), (total % 12) + 1)
}

/**
 * El numero de cuota que vence en ese mes, si es una deuda en cuotas; null
 * si no lo es. Puede caer fuera de las cuotas (antes de la primera o
 * despues de la ultima): eso lo dice `tocaEn`.
 */
export function cuotaDelPeriodo(v: Pick<Vencimiento, 'cuotas'>, periodo: string): number | null {
  if (!v.cuotas) return null
  return v.cuotas.primera + mesesEntre(v.cuotas.periodo, periodo)
}

/** Si ese mes hay algo que pagar: siempre, o, en una deuda en cuotas, entre la primera y la ultima. */
export function tocaEn(v: Pick<Vencimiento, 'cuotas'>, periodo: string): boolean {
  const n = cuotaDelPeriodo(v, periodo)
  if (n === null || !v.cuotas) return true
  return n >= v.cuotas.primera && n <= v.cuotas.total
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

/** 'terminado': una deuda en cuotas que ya no tiene cuotas por delante. */
export type EstadoVencimiento = 'vencido' | 'por-vencer' | 'pendiente' | 'pagado' | 'terminado'

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

  // 1. El mes pasado quedo sin pagar, la agenda ya lo conocia y tocaba pagar.
  const fechaAnterior = fechaDeVencimiento(v.dia, anterior)
  if (v.desde <= fechaAnterior && tocaEn(v, anterior) && !pagoDelPeriodo(v, anterior, movimientos)) {
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
  // En cuotas: antes de la primera se mira la primera; despues de la ultima, termino.
  const cuota = cuotaDelPeriodo(v, periodo)
  if (cuota !== null && v.cuotas) {
    if (cuota < v.cuotas.primera) {
      periodo = v.cuotas.periodo
      fecha = fechaDeVencimiento(v.dia, periodo)
    } else if (cuota > v.cuotas.total) {
      return { vencimiento: v, periodo, fecha, dias: diasEntre(hoy, fecha), estado: 'terminado', pago: null, proximo: null }
    }
  }
  const dias = diasEntre(hoy, fecha)
  const pago = pagoDelPeriodo(v, periodo, movimientos)
  if (pago) {
    const siguiente = periodoSiguiente(periodo)
    return {
      vencimiento: v,
      periodo,
      fecha,
      dias,
      estado: 'pagado',
      pago,
      // Si era la ultima cuota, no hay proximo.
      proximo: tocaEn(v, siguiente) ? fechaDeVencimiento(v.dia, siguiente) : null,
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

const ORDEN: Record<EstadoVencimiento, number> = { vencido: 0, 'por-vencer': 1, pendiente: 2, pagado: 3, terminado: 4 }

/** Todos los activos, primero lo vencido, despues lo que vence antes. */
export function agenda(vencimientos: Vencimiento[], hoy: string, movimientos: Movimiento[]): Situacion[] {
  return vencimientos
    .filter((v) => v.activo !== false)
    .map((v) => situacionDe(v, hoy, movimientos))
    .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.fecha.localeCompare(b.fecha) || a.vencimiento.concepto.localeCompare(b.vencimiento.concepto, 'es'))
}

/** Lo que dice el renglon: «Vence en 3 días», «Venció hace 2 días», «Vence hoy». */
export function cuandoVence(s: Pick<Situacion, 'dias' | 'estado'>): string {
  if (s.estado === 'terminado') return 'Terminada'
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
 *
 * En una deuda en cuotas tambien los de OTROS: las cuotas que ya se
 * pagaron casi siempre se cargaron asi (20/11). Al engancharlo pasa a la
 * categoria de la deuda.
 *
 * Primero los de monto mas parecido al de la agenda: OTROS junta de todo y
 * la pantalla muestra los cuatro primeros, asi que el mas reciente no
 * siempre es el que se busca. A igual distancia, el mas nuevo.
 */
export function gastosParaEnganchar(
  v: Pick<Vencimiento, 'categoria' | 'cuotas' | 'montoAproximado'>,
  meses: string[],
  movimientos: Movimiento[],
): Movimiento[] {
  const categorias: (CategoriaGasto | null | undefined)[] = v.cuotas ? [v.categoria, 'OTROS'] : [v.categoria]
  return movimientos
    .filter(
      (m) =>
        (m.tipo === 'GASTO_CAJA_GRANDE' || m.tipo === 'EGRESO_CAJA') &&
        categorias.includes(m.categoria) &&
        !m.vencimiento &&
        meses.includes(periodoDe(m.fecha)),
    )
    .sort((a, b) => {
      const monto = v.montoAproximado
      if (monto) {
        const dif = Math.abs(a.monto - monto) - Math.abs(b.monto - monto)
        if (dif !== 0) return dif
      }
      return b.fecha.localeCompare(a.fecha)
    })
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** «noviembre», o «noviembre de 2025» si no es de este año. */
export function nombreDelMes(periodo: string, hoy: string): string {
  const [a, m] = partes(periodo)
  const nombre = MESES[m - 1] ?? periodo
  return periodo.slice(0, 4) === hoy.slice(0, 4) ? nombre : `${nombre} de ${a}`
}

/** Como va una deuda en cuotas. */
export interface EstadoDeLaDeuda {
  /** Cuantas paga el local: de la primera a la ultima. */
  aPagar: number
  /** Cuantas tienen su pago cargado. */
  pagadas: number
  quedan: number
  /** Lo que queda, con el monto aproximado de la cuota; null si no tiene monto. */
  montoQueda: number | null
  /** El numero de la proxima cuota sin pagar, o null si no queda ninguna. */
  siguiente: number | null
  /** El mes de la ultima cuota. */
  ultimoPeriodo: string
}

/**
 * Cuanto va pagado de una deuda en cuotas y cuanto queda (20/11). Cuenta
 * los meses que tienen un gasto enganchado; null si no es en cuotas.
 */
export function estadoDeLaDeuda(v: Vencimiento, movimientos: Movimiento[]): EstadoDeLaDeuda | null {
  if (!v.cuotas) return null
  const aPagar = Math.max(0, v.cuotas.total - v.cuotas.primera + 1)
  const pagados = new Set(
    movimientos
      .filter((m) => m.vencimiento?.id === v.id && tocaEn(v, m.vencimiento.periodo))
      .map((m) => m.vencimiento!.periodo),
  )
  let siguiente: number | null = null
  for (let i = 0; i < aPagar; i++) {
    if (!pagados.has(sumarMeses(v.cuotas.periodo, i))) {
      siguiente = v.cuotas.primera + i
      break
    }
  }
  const quedan = aPagar - pagados.size
  return {
    aPagar,
    pagadas: pagados.size,
    quedan,
    montoQueda: v.montoAproximado == null ? null : quedan * v.montoAproximado,
    siguiente,
    ultimoPeriodo: sumarMeses(v.cuotas.periodo, aPagar - 1),
  }
}
