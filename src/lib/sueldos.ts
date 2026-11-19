import type { Movimiento, Rol } from '../db/db'
import { mesLindo, normalizar, plata } from './formato'

/**
 * Los sueldos (19/11): cuánto se acordó con cada persona y cuánto lleva
 * cobrado en el mes. Y los retiros de los dueños, que son otra cosa pero
 * se llevan igual: por persona.
 *
 * Son dos datos que viven en lugares distintos, a propósito:
 *
 * - **Lo que se le pagó** ya estaba en la app: es un gasto de categoría
 *   SUELDOS, cargado desde Caja (un retiro del cajón) o desde Gastos. Lo
 *   nuevo es que ese gasto dice DE QUIÉN es (`persona`) y, si hace falta,
 *   a qué mes corresponde (`periodoSueldo`).
 * - **Lo que se acordó** es nuevo y es privado: cuánto cobra cada uno no
 *   baja a los aparatos del resto. No está en la base local ni viaja con
 *   la sincronización de todos: se lee del servidor cada vez, sin guardarlo
 *   en el aparato (ver sync/sueldosNube.ts). Lo ven los dueños y quien
 *   está de encargado; lo define solo un dueño; y cada persona ve lo suyo
 *   en «Mi sueldo». Los montos nunca van al código ni al historial
 *   compartido.
 *
 * El sueldo se acuerda **por mes** y se paga como convenga: de una vez o
 * por semana. Cada pago cuenta para su mes y la diferencia con lo acordado
 * es lo que falta: el último pago del mes la cierra.
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
  /**
   * Con qué otros nombres figura en los conceptos de los gastos, separados
   * por coma: «Gabi, Gaby». Sin esto, un pago anotado como «SEMANA GABI» no
   * se reconocía como de Gabriela.
   */
  apodos?: string | null
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
  return `${que}\n\n${antes} Lo ven los dueños, quien está de encargado y ${nombre} en «Mi sueldo». Los meses anteriores no cambian.`
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
 * y quien cobró algo en ese mes aunque ya no esté. Un dueño no cobra
 * sueldo, retira: figura acá solo si se le definió uno o se le cargó un
 * pago (lo suyo está en resumenDeRetiros). Un pago a nombre de alguien
 * que no figura en ningún lado va a «sin asignar»: es preferible verlo
 * suelto a que desaparezca de la cuenta.
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
    const sinNadaQueMostrar = acordado === null && pagos.length === 0
    if (sinNadaQueMostrar && (!persona.activo || persona.rol === 'owner')) continue
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

/**
 * Palabras que hacen pensar en un sueldo. «Semana» entró el 19/11: los
 * pagos de quien cobra por semana se anotaban «SEMANA GABI» y no los
 * encontraba nadie.
 */
const PALABRAS_DE_SUELDO = [
  'sueldo',
  'sueldos',
  'adelanto',
  'adelantos',
  'quincena',
  'aguinaldo',
  'jornal',
  'semana',
  'semanal',
]
const PALABRAS_DE_RETIRO = ['retiro', 'retiros']
/** Palabras de relleno que acompañan a un nombre y no son un apodo. */
const PALABRAS_SUELTAS = ['pago', 'pagos', 'para', 'por', 'del', 'los', 'las', 'mes', 'caja', 'efectivo', 'parte', 'resto', 'saldo']

const enPalabras = (texto: string) => normalizar(texto).split(/[^a-z0-9ñ]+/).filter(Boolean)

/**
 * Con qué palabras puede figurar alguien en el concepto de un gasto: su
 * nombre de pila y sus apodos. Un nombre de menos de tres letras no se
 * usa (aparece adentro de cualquier cosa); un apodo, que lo cargó alguien
 * a propósito, alcanza con dos.
 */
export function comoFigura(p: Pick<PersonaConSueldo, 'nombre' | 'apodos'>): string[] {
  const dePila = enPalabras(p.nombre)[0] ?? ''
  const apodos = enPalabras(p.apodos ?? '').filter((a) => a.length >= 2)
  return [...new Set([...(dePila.length >= 3 ? [dePila] : []), ...apodos])]
}

/** Los apodos como se guardan: sin espacios de más, separados por coma. Vacío es null. */
export function apodosLimpios(texto: string): string | null {
  const lista = texto
    .split(',')
    .map((a) => a.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
  return lista.length > 0 ? [...new Set(lista)].join(', ') : null
}

/**
 * La palabra de un concepto que puede ser el apodo de alguien: «GABI» en
 * «SEMANA GABI». Sirve para ofrecer recordarla cuando alguien asigna a
 * mano un pago que la app no supo de quién era.
 *
 * Solo se ofrece cuando no hay dudas: sacando las palabras de sueldo y de
 * retiro, los números y las que ya son de alguien, tiene que quedar UNA
 * sola, de tres letras o más. Con dos candidatas no se adivina.
 */
export function apodoPosible(concepto: string, personas: PersonaConSueldo[]): string | null {
  const deAlguien = new Set(personas.flatMap(comoFigura))
  const candidatas = [...new Set(enPalabras(concepto))].filter(
    (p) =>
      p.length >= 3 &&
      !/^\d+$/.test(p) &&
      !PALABRAS_DE_SUELDO.includes(p) &&
      !PALABRAS_DE_RETIRO.includes(p) &&
      !PALABRAS_SUELTAS.includes(p) &&
      !deAlguien.has(p),
  )
  return candidatas.length === 1 ? candidatas[0] : null
}

export interface QueParece {
  /** Un sueldo (de alguien del equipo) o un retiro (de un dueño). */
  que: 'sueldo' | 'retiro'
  /** De quién, si el concepto nombra a alguien. */
  persona: PersonaConSueldo | null
}

/**
 * Qué parece un gasto por lo que dice su concepto.
 *
 * Manda a quién nombra: si nombra a un dueño es un retiro, si nombra a
 * alguien del equipo es un sueldo, diga lo que diga el resto. Sin nombre,
 * deciden las palabras: «adelanto» o «semana» hacen pensar en un sueldo,
 * «retiro» en un retiro. Es una sugerencia: nunca cambia nada sola.
 */
export function queParece(concepto: string, personas: PersonaConSueldo[]): QueParece | null {
  const palabras = enPalabras(concepto)
  if (palabras.length === 0) return null
  const nombrada = personas.find((p) => comoFigura(p).some((n) => palabras.includes(n))) ?? null
  if (nombrada) return { que: nombrada.rol === 'owner' ? 'retiro' : 'sueldo', persona: nombrada }
  if (palabras.some((p) => PALABRAS_DE_SUELDO.includes(p))) return { que: 'sueldo', persona: null }
  if (palabras.some((p) => PALABRAS_DE_RETIRO.includes(p))) return { que: 'retiro', persona: null }
  return null
}

/** La categoría con la que habría que cargarlo. */
export function categoriaQueSugiere(parece: QueParece): 'SUELDOS' | 'RETIRO SOCIOS' {
  return parece.que === 'sueldo' ? 'SUELDOS' : 'RETIRO SOCIOS'
}

/** La pregunta que se le hace a quien está cargando el gasto. */
export function preguntaDeLaSugerencia(parece: QueParece): string {
  if (parece.que === 'sueldo') {
    return parece.persona ? `¿Es el sueldo de ${parece.persona.nombre}?` : '¿Es un sueldo?'
  }
  return parece.persona ? `¿Es un retiro de ${parece.persona.nombre}?` : '¿Es un retiro de un dueño?'
}

/**
 * Si el formulario ya está como la sugerencia pide: la categoría, y la
 * persona cuando el concepto nombra a alguien. Con eso no hay nada que
 * ofrecer.
 */
export function sugerenciaAplicada(
  parece: QueParece,
  categoria: string | null,
  persona: string | null,
): boolean {
  if (categoria !== categoriaQueSugiere(parece)) return false
  return parece.persona === null || persona === parece.persona.id
}

export interface PareceSueldo {
  movimiento: Gasto
  /** De quién parece ser, si el concepto nombra a alguien. */
  sugerida: PersonaConSueldo | null
}

function losQueParecen(
  que: QueParece['que'],
  movimientos: Gasto[],
  personas: PersonaConSueldo[],
  mes: string,
): PareceSueldo[] {
  const lista: PareceSueldo[] = []
  for (const m of movimientos) {
    if (!esGasto(m) || m.categoria === 'SUELDOS' || m.categoria === 'RETIRO SOCIOS') continue
    if (m.fecha.slice(0, 7) !== mes) continue
    const parece = queParece(m.concepto, personas)
    if (parece?.que !== que) continue
    lista.push({ movimiento: m, sugerida: parece.persona })
  }
  return lista.sort((a, b) => porFecha(a.movimiento, b.movimiento))
}

/**
 * Gastos del mes que parecen un pago de sueldo y están cargados con otra
 * categoría: el concepto nombra a alguien del equipo (por su nombre o por
 * un apodo) o dice «sueldo», «adelanto» o «semana». Son sugerencias para
 * que alguien los mire; no se cambia nada solo. Los que nombran a un
 * dueño no entran: eso es un retiro (ver parecenRetiro).
 */
export function parecenSueldo(
  movimientos: Gasto[],
  personas: PersonaConSueldo[],
  mes: string,
): PareceSueldo[] {
  return losQueParecen('sueldo', movimientos, personas, mes)
}

/**
 * Gastos del mes que parecen el retiro de un dueño y están cargados con
 * otra categoría: el concepto nombra a un dueño o dice «retiro».
 */
export function parecenRetiro(
  movimientos: Gasto[],
  personas: PersonaConSueldo[],
  mes: string,
): PareceSueldo[] {
  return losQueParecen('retiro', movimientos, personas, mes)
}

/** Quiénes se pueden elegir al cargar un pago de sueldo: los activos, por nombre. */
export function personasParaSueldo<T extends { nombre: string; activo: boolean }>(usuarios: T[]): T[] {
  return usuarios.filter((u) => u.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** De quién puede ser un retiro de socios: los dueños activos, por nombre. */
export function duenosParaRetiro<T extends { nombre: string; activo: boolean; rol?: Rol }>(usuarios: T[]): T[] {
  return personasParaSueldo(usuarios).filter((u) => u.rol === 'owner')
}

/** Un retiro de socios: lo que un dueño saca para él, del cajón o de otra cuenta. */
export function esRetiroDeSocio(m: Pick<Movimiento, 'tipo' | 'categoria'>): boolean {
  return esGasto(m) && m.categoria === 'RETIRO SOCIOS'
}

export interface RenglonRetiro {
  persona: PersonaConSueldo
  retirado: number
  retiros: Gasto[]
}

export interface ResumenRetiros {
  mes: string
  renglones: RenglonRetiro[]
  /** Retiros del mes que no dicen de quién son. */
  sinAsignar: Gasto[]
  total: number
}

/**
 * Los retiros de los dueños en el mes, por persona.
 *
 * No hay nada acordado contra lo que comparar: un dueño retira lo que
 * retira. Lo que importa es que cada retiro diga de quién es, para que la
 * administración lleve la cuenta de cada uno. Aparecen todos los dueños
 * activos, hayan retirado o no, y cualquier otra persona a cuyo nombre
 * haya un retiro ese mes. Cuenta la fecha del retiro.
 */
export function resumenDeRetiros(
  personas: PersonaConSueldo[],
  movimientos: Gasto[],
  mes: string,
): ResumenRetiros {
  const conocidas = new Map(personas.map((p) => [p.id, p]))
  const retirosDe = new Map<string, Gasto[]>()
  const sinAsignar: Gasto[] = []
  for (const m of movimientos) {
    if (!esRetiroDeSocio(m) || m.fecha.slice(0, 7) !== mes) continue
    if (m.persona && conocidas.has(m.persona)) {
      retirosDe.set(m.persona, [...(retirosDe.get(m.persona) ?? []), m])
    } else {
      sinAsignar.push(m)
    }
  }
  const renglones: RenglonRetiro[] = []
  for (const persona of conocidas.values()) {
    const retiros = (retirosDe.get(persona.id) ?? []).sort(porFecha)
    if (retiros.length === 0 && !(persona.activo && persona.rol === 'owner')) continue
    renglones.push({ persona, retirado: retiros.reduce((s, m) => s + m.monto, 0), retiros })
  }
  renglones.sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre, 'es'))
  return {
    mes,
    renglones,
    sinAsignar: sinAsignar.sort(porFecha),
    total: renglones.reduce((s, r) => s + r.retirado, 0) + sinAsignar.reduce((s, m) => s + m.monto, 0),
  }
}

export interface MiSueldo {
  mes: string
  /** null: todavía no hay un sueldo definido que alcance a ese mes. */
  acordado: number | null
  pagado: number
  saldo: number | null
  pagos: Gasto[]
}

/**
 * «Mi sueldo»: lo de UNA persona en un mes, para que lo vea ella. Lo
 * acordado sale de su ficha (la única que el servidor le deja leer); lo
 * cobrado, de los pagos de sueldo a su nombre.
 */
export function miSueldoDelMes(
  ficha: Pick<FichaSueldo, 'acuerdos'> | null,
  movimientos: Gasto[],
  idPersona: string,
  mes: string,
): MiSueldo {
  const pagos = movimientos
    .filter((m) => esPagoDeSueldo(m) && m.persona === idPersona && mesDelPago(m) === mes)
    .sort(porFecha)
  const acordado = sueldoDelMes(ficha?.acuerdos ?? [], mes)
  const pagado = pagos.reduce((s, m) => s + m.monto, 0)
  return { mes, acordado, pagado, saldo: acordado === null ? null : acordado - pagado, pagos }
}

/** El saldo dicho a la persona que cobra, no a quien paga. */
export function estadoDeMiSaldo(r: Pick<MiSueldo, 'acordado' | 'saldo'>): {
  etiqueta: string
  monto: number | null
} {
  if (r.acordado === null || r.saldo === null) return { etiqueta: 'Todavía no hay un sueldo cargado', monto: null }
  if (r.saldo > 0) return { etiqueta: 'Te falta cobrar', monto: r.saldo }
  if (r.saldo < 0) return { etiqueta: 'Cobraste de más', monto: -r.saldo }
  return { etiqueta: 'Estás al día', monto: 0 }
}
