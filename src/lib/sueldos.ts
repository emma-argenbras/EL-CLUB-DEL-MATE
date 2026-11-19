import type { Movimiento, Rol } from '../db/db'
import { mesLindo, normalizar, plata } from './formato'

/**
 * Los sueldos (19/11): cuánto se acordó con cada persona y cuánto lleva
 * cobrado en el mes.
 *
 * Son dos datos que viven en lugares distintos, a propósito:
 *
 * - **Lo que se le pagó** ya estaba en la app: es un gasto de categoría
 *   SUELDOS, cargado desde Caja (un retiro del cajón) o desde Gastos. Lo
 *   nuevo es que ese gasto dice DE QUIÉN es (`persona`) y, si hace falta,
 *   a qué mes corresponde (`periodoSueldo`).
 * - **Lo que se acordó** es nuevo y es privado: cuánto cobra cada uno no
 *   baja a los aparatos del resto. No está en la base local ni viaja con
 *   la sincronización de todos: lo lee y lo escribe solo el dueño, desde
 *   la pantalla Sueldos (ver sync/sueldosNube.ts). Los montos nunca van al
 *   código ni al historial compartido.
 *
 * Acá está la cuenta, sin base ni servidor, para poder probarla.
 */

/** Un monto acordado, y desde qué mes rige. */
export interface AcuerdoSueldo {
  /** Primer mes en que rige, 'yyyy-mm'. */
  desde: string
  /** Por mes. Cero quiere decir «desde ese mes no cobra sueldo». */
  monto: number
  /** Cuándo se cargó. Si hay dos para el mismo mes, vale el último. */
  anotadoEl: number
  por: string | null
}

/**
 * La ficha de una persona: sus acuerdos, del primero al último. Un cambio
 * de sueldo no pisa el anterior, se agrega: así los meses viejos siguen
 * mostrando lo que se había acordado entonces.
 */
export interface FichaSueldo {
  /** El id de su usuario. */
  id: string
  nombre: string
  acuerdos: AcuerdoSueldo[]
  actualizadoEn: number
}

export interface PersonaConSueldo {
  id: string
  nombre: string
  activo: boolean
  rol?: Rol
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Una ficha como vino del servidor, sin confiar en su forma: lo que no
 * se entiende se saltea en vez de romper la pantalla.
 */
export function fichaDesdeDatos(id: string, datos: unknown): FichaSueldo {
  const d = (datos ?? {}) as Record<string, unknown>
  const acuerdos: AcuerdoSueldo[] = []
  for (const crudo of Array.isArray(d.acuerdos) ? d.acuerdos : []) {
    const a = (crudo ?? {}) as Record<string, unknown>
    if (typeof a.desde !== 'string' || !MES.test(a.desde)) continue
    if (typeof a.monto !== 'number' || !Number.isFinite(a.monto) || a.monto < 0) continue
    acuerdos.push({
      desde: a.desde,
      monto: a.monto,
      anotadoEl: typeof a.anotadoEl === 'number' ? a.anotadoEl : 0,
      por: typeof a.por === 'string' ? a.por : null,
    })
  }
  return {
    id,
    nombre: typeof d.nombre === 'string' ? d.nombre : '',
    acuerdos,
    actualizadoEn: typeof d.actualizadoEn === 'number' ? d.actualizadoEn : 0,
  }
}

export function esMes(texto: string): boolean {
  return MES.test(texto)
}

/** Lo acordado para ese mes, o null si todavía no se definió nada que lo alcance. */
export function sueldoDelMes(acuerdos: AcuerdoSueldo[], mes: string): number | null {
  let vigente: AcuerdoSueldo | null = null
  for (const a of acuerdos) {
    if (a.desde > mes) continue
    if (
      !vigente ||
      a.desde > vigente.desde ||
      (a.desde === vigente.desde && a.anotadoEl >= vigente.anotadoEl)
    ) {
      vigente = a
    }
  }
  return vigente ? vigente.monto : null
}

/** Por qué no se puede guardar ese acuerdo, o null si está bien. */
export function problemaDelAcuerdo(monto: number | null, desde: string): string | null {
  if (monto === null || !Number.isFinite(monto)) return 'Escribí el monto del sueldo.'
  if (monto < 0) return 'El sueldo no puede ser negativo.'
  if (!esMes(desde)) return 'Elegí desde qué mes rige.'
  return null
}

/** La ficha con un acuerdo más. No toca la que recibe. */
export function conAcuerdo(
  ficha: FichaSueldo | null,
  persona: { id: string; nombre: string },
  acuerdo: AcuerdoSueldo,
): FichaSueldo {
  return {
    id: persona.id,
    nombre: persona.nombre,
    acuerdos: [...(ficha?.acuerdos ?? []), acuerdo],
    actualizadoEn: acuerdo.anotadoEl,
  }
}

/** La pregunta antes de guardar: a quién, cuánto, desde cuándo y qué había. */
export function textoDeConfirmacionSueldo(
  nombre: string,
  monto: number,
  desde: string,
  anterior: number | null,
): string {
  const que =
    monto === 0
      ? `¿Dejar a ${nombre} sin sueldo desde ${mesLindo(desde)}?`
      : `¿Dejar el sueldo de ${nombre} en ${plata(monto)} por mes desde ${mesLindo(desde)}?`
  const antes =
    anterior === null
      ? 'Hasta ahora no tenía un sueldo definido para ese mes.'
      : `Para ese mes tenía ${plata(anterior)}.`
  return `${que}\n\n${antes} Lo ve solo el dueño. Los meses anteriores no cambian.`
}

type Gasto = Pick<
  Movimiento,
  'id' | 'fecha' | 'tipo' | 'concepto' | 'monto' | 'categoria' | 'cuenta' | 'persona' | 'periodoSueldo'
>

function esGasto(m: Pick<Movimiento, 'tipo'>): boolean {
  return m.tipo === 'EGRESO_CAJA' || m.tipo === 'GASTO_CAJA_GRANDE'
}

/** Un gasto de sueldos: un retiro del cajón o un pago desde otra cuenta. */
export function esPagoDeSueldo(m: Pick<Movimiento, 'tipo' | 'categoria'>): boolean {
  return esGasto(m) && m.categoria === 'SUELDOS'
}

/**
 * A qué mes corresponde el pago. Casi siempre, el de su fecha. Pero el
 * saldo de noviembre pagado el 3 de diciembre es sueldo de noviembre: para
 * eso está `periodoSueldo`.
 */
export function mesDelPago(m: Pick<Movimiento, 'fecha' | 'periodoSueldo'>): string {
  return m.periodoSueldo && esMes(m.periodoSueldo) ? m.periodoSueldo : m.fecha.slice(0, 7)
}

export interface RenglonSueldo {
  persona: PersonaConSueldo
  /** null: todavía no se le definió un sueldo para ese mes. */
  acordado: number | null
  pagado: number
  /** Lo que falta pagar (positivo) o lo que cobró de más (negativo). null sin acuerdo. */
  saldo: number | null
  pagos: Gasto[]
}

export interface ResumenSueldos {
  mes: string
  renglones: RenglonSueldo[]
  /** Pagos de sueldo del mes que no dicen de quién son. */
  sinAsignar: Gasto[]
  acordado: number
  pagado: number
  /** La suma de lo que falta pagar. Lo cobrado de más por uno no tapa lo que falta de otro. */
  falta: number
}

const porFecha = (a: Gasto, b: Gasto) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)

/**
 * El mes de sueldos: una fila por persona, con lo acordado, lo pagado y
 * lo que falta.
 *
 * Aparece quien está activo, quien tiene un sueldo definido para ese mes
 * y quien cobró algo en ese mes aunque ya no esté. Un pago a nombre de
 * alguien que no figura en ningún lado va a «sin asignar»: es preferible
 * verlo suelto a que desaparezca de la cuenta.
 */
export function resumenDeSueldos(
  personas: PersonaConSueldo[],
  fichas: FichaSueldo[],
  movimientos: Gasto[],
  mes: string,
): ResumenSueldos {
  const fichaDe = new Map(fichas.map((f) => [f.id, f]))
  const conocidas = new Map(personas.map((p) => [p.id, p]))
  // Quien tiene ficha pero ya no figura entre los usuarios: se muestra
  // con el nombre que quedó en la ficha.
  for (const f of fichas) {
    if (!conocidas.has(f.id)) conocidas.set(f.id, { id: f.id, nombre: f.nombre, activo: false })
  }

  const pagosDe = new Map<string, Gasto[]>()
  const sinAsignar: Gasto[] = []
  for (const m of movimientos) {
    if (!esPagoDeSueldo(m) || mesDelPago(m) !== mes) continue
    if (m.persona && conocidas.has(m.persona)) {
      pagosDe.set(m.persona, [...(pagosDe.get(m.persona) ?? []), m])
    } else {
      sinAsignar.push(m)
    }
  }

  const renglones: RenglonSueldo[] = []
  for (const persona of conocidas.values()) {
    const acordado = sueldoDelMes(fichaDe.get(persona.id)?.acuerdos ?? [], mes)
    const pagos = (pagosDe.get(persona.id) ?? []).sort(porFecha)
    if (!persona.activo && acordado === null && pagos.length === 0) continue
    const pagado = pagos.reduce((s, m) => s + m.monto, 0)
    renglones.push({
      persona,
      acordado,
      pagado,
      saldo: acordado === null ? null : acordado - pagado,
      pagos,
    })
  }
  renglones.sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre, 'es'))

  return {
    mes,
    renglones,
    sinAsignar: sinAsignar.sort(porFecha),
    acordado: renglones.reduce((s, r) => s + (r.acordado ?? 0), 0),
    pagado: renglones.reduce((s, r) => s + r.pagado, 0) + sinAsignar.reduce((s, m) => s + m.monto, 0),
    falta: renglones.reduce((s, r) => s + Math.max(0, r.saldo ?? 0), 0),
  }
}

/**
 * Cómo se lee el saldo de una persona: la etiqueta y el monto, que es
 * siempre positivo (lo que falta, o lo que cobró de más).
 */
export function estadoDelSaldo(r: Pick<RenglonSueldo, 'acordado' | 'saldo'>): {
  etiqueta: string
  monto: number | null
} {
  if (r.acordado === null || r.saldo === null) return { etiqueta: 'Sin sueldo definido', monto: null }
  if (r.saldo > 0) return { etiqueta: 'Falta pagar', monto: r.saldo }
  if (r.saldo < 0) return { etiqueta: 'Cobró de más', monto: -r.saldo }
  return { etiqueta: 'Al día', monto: 0 }
}

const PALABRAS_DE_SUELDO = ['sueldo', 'sueldos', 'adelanto', 'adelantos', 'quincena', 'aguinaldo', 'jornal']

export interface PareceSueldo {
  movimiento: Gasto
  /** De quién parece ser, si el concepto nombra a alguien. */
  sugerida: PersonaConSueldo | null
}

/**
 * Gastos del mes que parecen un pago de sueldo y están cargados con otra
 * categoría: el concepto dice «sueldo», «adelanto» o el nombre de alguien
 * del equipo. Son sugerencias para que el dueño los mire; no se cambia
 * nada solo. Los retiros de socios no entran: eso no es un sueldo.
 */
export function parecenSueldo(
  movimientos: Gasto[],
  personas: PersonaConSueldo[],
  mes: string,
): PareceSueldo[] {
  const nombres = personas
    .map((p) => ({ persona: p, nombre: normalizar(p.nombre).split(/\s+/)[0] ?? '' }))
    .filter((n) => n.nombre.length >= 3)
  const lista: PareceSueldo[] = []
  for (const m of movimientos) {
    if (!esGasto(m) || m.categoria === 'SUELDOS' || m.categoria === 'RETIRO SOCIOS') continue
    if (m.fecha.slice(0, 7) !== mes) continue
    const palabras = normalizar(m.concepto).split(/[^a-z0-9ñ]+/)
    const nombrada = nombres.find((n) => palabras.includes(n.nombre))?.persona ?? null
    if (!nombrada && !palabras.some((p) => PALABRAS_DE_SUELDO.includes(p))) continue
    lista.push({ movimiento: m, sugerida: nombrada })
  }
  return lista.sort((a, b) => porFecha(a.movimiento, b.movimiento))
}

/** Quiénes se pueden elegir al cargar un pago de sueldo: los activos, por nombre. */
export function personasParaSueldo<T extends { nombre: string; activo: boolean }>(usuarios: T[]): T[] {
  return usuarios.filter((u) => u.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
