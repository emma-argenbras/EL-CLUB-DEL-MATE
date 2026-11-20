import type { Movimiento, Rol, Usuario } from '../db/db'
import { fechaLinda, mesLindo, normalizar, plata } from './formato'

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
 * El sueldo se acuerda **por semana o por mes**. Por semana es un monto
 * fijo que se cobra cada sábado: a cada mes le corresponde ese monto por
 * los sábados que tiene (cuatro o cinco). Por mes es un monto por mes, se
 * pague como se pague. En los dos casos cada pago cuenta para su mes y la
 * diferencia con lo que corresponde es lo que falta.
 *
 * Acá está la cuenta, sin base ni servidor, para poder probarla.
 */

/** Cada cuánto se acuerda un sueldo. */
export type CadaCuanto = 'mes' | 'semana'

/**
 * El día en que cobra quien cobra por semana: el sábado. Es el número que
 * le da Date a ese día de la semana (el domingo es 0).
 */
const DIA_DE_COBRO = 6

/** Un monto acordado, cada cuánto y desde cuándo rige. */
export interface AcuerdoSueldo {
  /**
   * Desde cuándo rige. Por mes, el primer mes: 'yyyy-mm'. Por semana, un
   * día: 'yyyy-mm-dd', y cuentan los sábados desde ese día inclusive.
   */
  desde: string
  /** Por mes o por semana, según `cada`. Cero quiere decir «desde ahí no cobra sueldo». */
  monto: number
  cada: CadaCuanto
  /** Cuándo se cargó. Si hay dos que empiezan el mismo día, vale el último. */
  anotadoEl: number
  por: string | null
}

/**
 * La versión del formato de la ficha. La 2 es la primera que sabe de
 * acuerdos por semana. La app la manda al guardar y la regla del servidor
 * la exige: una versión de la app anterior no conoce esos acuerdos, los
 * saltea al leer y, si guardara la ficha, los borraría. Así el servidor no
 * la deja guardar hasta que se actualice.
 */
export const FORMA_DE_LA_FICHA = 2

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
  /** Un dueño que no usa la app: no tiene cuenta y solo retira (ver duenoSinCuenta). */
  sinCuenta?: boolean
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/
const DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** El día como fecha, sin husos: la cuenta de sábados no depende de dónde esté el aparato. */
function fechaDe(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

/**
 * Una ficha como vino del servidor, sin confiar en su forma: lo que no
 * se entiende se saltea en vez de romper la pantalla.
 */
export function fichaDesdeDatos(id: string, datos: unknown): FichaSueldo {
  const d = (datos ?? {}) as Record<string, unknown>
  const acuerdos: AcuerdoSueldo[] = []
  for (const crudo of Array.isArray(d.acuerdos) ? d.acuerdos : []) {
    const a = (crudo ?? {}) as Record<string, unknown>
    // Sin `cada` es por mes. Con algo que no se conoce, se saltea: tomarlo
    // por mes mostraría un número que nadie acordó.
    const cada = a.cada === undefined ? 'mes' : a.cada
    if (cada !== 'mes' && cada !== 'semana') continue
    if (typeof a.desde !== 'string' || !(cada === 'semana' ? esDia(a.desde) : esMes(a.desde))) continue
    if (typeof a.monto !== 'number' || !Number.isFinite(a.monto) || a.monto < 0) continue
    acuerdos.push({
      desde: a.desde,
      monto: a.monto,
      cada,
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

/** Un día que existe: '2026-02-30' no. */
export function esDia(texto: string): boolean {
  return DIA.test(texto) && fechaDe(texto).toISOString().slice(0, 10) === texto
}

/**
 * Los sábados de un mes, del primero al último: son cuatro o cinco. De
 * algo que no es un mes no sale ninguno (ningún día suyo existe).
 */
export function sabadosDelMes(mes: string): string[] {
  const sabados: string[] = []
  for (let d = 1; d <= 31; d++) {
    const dia = `${mes}-${String(d).padStart(2, '0')}`
    if (esDia(dia) && fechaDe(dia).getUTCDay() === DIA_DE_COBRO) sabados.push(dia)
  }
  return sabados
}

/** El día en que un acuerdo empieza a regir: por mes, el 1.º de ese mes. */
export function inicioDelAcuerdo(a: Pick<AcuerdoSueldo, 'desde'>): string {
  return a.desde.length === 7 ? `${a.desde}-01` : a.desde
}

/**
 * El acuerdo que rige un día: el último que empezó. Si dos empiezan el
 * mismo día, el que se cargó último (así se corrige un monto mal puesto).
 */
function vigenteEl(acuerdos: AcuerdoSueldo[], dia: string): AcuerdoSueldo | null {
  let vigente: AcuerdoSueldo | null = null
  for (const a of acuerdos) {
    const inicio = inicioDelAcuerdo(a)
    if (inicio > dia) continue
    if (
      !vigente ||
      inicio > inicioDelAcuerdo(vigente) ||
      (inicio === inicioDelAcuerdo(vigente) && a.anotadoEl >= vigente.anotadoEl)
    ) {
      vigente = a
    }
  }
  return vigente
}

/** Un monto por semana y los sábados del mes en que rige. */
export interface TramoSemanal {
  monto: number
  sabados: string[]
}

/** Lo que corresponde en un mes y de dónde sale. */
export interface LoAcordado {
  /** Lo que corresponde en el mes entero. */
  monto: number
  cada: CadaCuanto
  /**
   * Por semana: cada monto con sus sábados. Es uno solo, salvo el mes en
   * que el monto cambió. Por mes, vacío.
   */
  tramos: TramoSemanal[]
}

/**
 * Lo que corresponde en un mes, o null si no hay nada acordado que lo
 * alcance.
 *
 * Se mira sábado por sábado. Los que caen bajo un acuerdo por semana suman
 * su monto: noviembre de 2026 tiene cuatro, octubre tuvo cinco. Si ningún
 * sábado del mes es por semana, vale el acuerdo por mes que rija.
 *
 * El mes en que se pasa de «por mes» a «por semana» cuenta solo los sábados
 * desde el cambio: no se prorratea la parte por mes. Y un acuerdo por
 * semana que empieza después del último sábado no toca ese mes.
 */
export function acordadoEnElMes(acuerdos: AcuerdoSueldo[], mes: string): LoAcordado | null {
  const sabados = sabadosDelMes(mes)
  if (sabados.length === 0) return null
  const tramos: TramoSemanal[] = []
  for (const sabado of sabados) {
    const a = vigenteEl(acuerdos, sabado)
    if (a?.cada !== 'semana') continue
    const tramo = tramos.find((t) => t.monto === a.monto)
    if (tramo) tramo.sabados.push(sabado)
    else tramos.push({ monto: a.monto, sabados: [sabado] })
  }
  if (tramos.length > 0) {
    return { monto: tramos.reduce((s, t) => s + t.monto * t.sabados.length, 0), cada: 'semana', tramos }
  }
  const delMes = vigenteEl(acuerdos, sabados[sabados.length - 1])
  return delMes ? { monto: delMes.monto, cada: 'mes', tramos: [] } : null
}

/** Lo que corresponde ese mes, o null si todavía no se definió nada que lo alcance. */
export function sueldoDelMes(acuerdos: AcuerdoSueldo[], mes: string): number | null {
  return acordadoEnElMes(acuerdos, mes)?.monto ?? null
}

const DIAS_DE_LA_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «sábado 07/11/2026»: el día con su nombre, para que se vea si es sábado. */
export function diaLindo(dia: string): string {
  return esDia(dia) ? `${DIAS_DE_LA_SEMANA[fechaDe(dia).getUTCDay()]} ${fechaLinda(dia)}` : dia
}

const cuantosSabados = (n: number) => `${n} ${n === 1 ? 'sábado' : 'sábados'}`

/** La cuenta de un mes por semana: «$ 100 por semana × 4 sábados». */
function cuentaDeSabados(tramos: TramoSemanal[]): string {
  if (tramos.length === 1) return `${plata(tramos[0].monto)} por semana × ${cuantosSabados(tramos[0].sabados.length)}`
  return tramos.map((t) => `${cuantosSabados(t.sabados.length)} a ${plata(t.monto)}`).join(' y ')
}

/**
 * De dónde sale lo que corresponde en el mes cuando se cobra por semana:
 * «$ 100 por semana × 4 sábados». En el mes en curso dice además cuántos
 * sábados van, para que «falta» se lea bien: a mitad de mes falta lo de los
 * sábados que todavía no llegaron. Por mes no hay nada que explicar: null.
 */
export function comoSeCalcula(detalle: LoAcordado | null, hoy: string): string | null {
  if (!detalle || detalle.cada !== 'semana') return null
  const cuenta = cuentaDeSabados(detalle.tramos)
  const sabados = detalle.tramos.flatMap((t) => t.sabados)
  const enCurso = sabados.some((s) => s.slice(0, 7) === hoy.slice(0, 7))
  const van = sabados.filter((s) => s <= hoy).length
  return enCurso && van < sabados.length ? `${cuenta} · van ${van}` : cuenta
}

/** Un acuerdo en una línea: «Desde el sábado 07/11/2026: $ 100 por semana». */
export function acuerdoEnPalabras(a: AcuerdoSueldo): string {
  const desde = a.cada === 'semana' ? `el ${diaLindo(a.desde)}` : mesLindo(a.desde)
  return `Desde ${desde}: ${a.monto === 0 ? 'sin sueldo' : `${plata(a.monto)} por ${a.cada}`}`
}

/** Por qué no se puede guardar ese acuerdo, o null si está bien. */
export function problemaDelAcuerdo(monto: number | null, desde: string, cada: CadaCuanto): string | null {
  if (monto === null || !Number.isFinite(monto)) {
    return cada === 'semana' ? 'Escribí el monto de la semana.' : 'Escribí el monto del sueldo.'
  }
  if (monto < 0) return 'El sueldo no puede ser negativo.'
  if (cada === 'semana') return esDia(desde) ? null : 'Elegí desde qué día rige.'
  return esMes(desde) ? null : 'Elegí desde qué mes rige.'
}

/**
 * Por qué ese acuerdo no cambiaría nada, o null si está bien.
 *
 * Pasa al querer volver a «por mes» desde un mes en el que rige uno por
 * semana que empieza después del día 1.º: vale el que empezó último, así
 * que el de por semana seguiría mandando en ese mes y en los que siguen.
 * Se avisa antes de guardar algo que no se va a ver en ningún lado.
 */
export function porQueNoCambia(anteriores: AcuerdoSueldo[], nuevo: AcuerdoSueldo): string | null {
  if (nuevo.cada !== 'mes') return null
  if (acordadoEnElMes([...anteriores, nuevo], nuevo.desde)?.cada === 'mes') return null
  return `En ${mesLindo(nuevo.desde)} ya rige un acuerdo por semana que empieza después del día 1.º, y ese seguiría valiendo. Para pasar a «por mes», elegí desde el mes siguiente.`
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

/**
 * La pregunta antes de guardar: a quién, cuánto, desde cuándo y qué había.
 * Por semana dice además cuánto le queda correspondiendo en ese mes, con
 * los sábados contados: es la forma de ver antes de guardar si el día
 * elegido es el que se quería.
 */
export function textoDeConfirmacionSueldo(
  nombre: string,
  nuevo: AcuerdoSueldo,
  anteriores: AcuerdoSueldo[],
): string {
  const mes = nuevo.desde.slice(0, 7)
  const anterior = sueldoDelMes(anteriores, mes)
  const antes =
    anterior === null
      ? 'Hasta ahora no tenía un sueldo definido para ese mes.'
      : `Para ese mes tenía ${plata(anterior)}.`
  const quienLoVe = `Lo ven los dueños, quien está de encargado y ${nombre} en «Mi sueldo».`
  if (nuevo.cada === 'semana') {
    const que =
      nuevo.monto === 0
        ? `¿Dejar a ${nombre} sin sueldo desde el ${diaLindo(nuevo.desde)}?`
        : `¿Dejar el sueldo de ${nombre} en ${plata(nuevo.monto)} por semana, que cobra cada sábado, desde el ${diaLindo(nuevo.desde)}?`
    const queda = acordadoEnElMes([...anteriores, nuevo], mes)
    const enElMes =
      queda?.cada === 'semana'
        ? `En ${mesLindo(mes)} le corresponden ${plata(queda.monto)}: ${cuentaDeSabados(queda.tramos)}.`
        : `Desde ese día ya no queda ningún sábado en ${mesLindo(mes)}: empieza a contar el mes siguiente.`
    return `${que}\n\n${enElMes} ${antes} ${quienLoVe} Lo anterior a ese día no cambia.`
  }
  const que =
    nuevo.monto === 0
      ? `¿Dejar a ${nombre} sin sueldo desde ${mesLindo(nuevo.desde)}?`
      : `¿Dejar el sueldo de ${nombre} en ${plata(nuevo.monto)} por mes desde ${mesLindo(nuevo.desde)}?`
  return `${que}\n\n${antes} ${quienLoVe} Los meses anteriores no cambian.`
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
  /** Lo que le corresponde en el mes. null: todavía no se le definió un sueldo que lo alcance. */
  acordado: number | null
  /** De dónde sale: por mes, o por semana con sus sábados. */
  detalle: LoAcordado | null
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
 * El mes de sueldos: una fila por persona, con lo que le corresponde en
 * el mes (por semana, según sus sábados), lo pagado y lo que falta.
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
    const detalle = acordadoEnElMes(fichaDe.get(persona.id)?.acuerdos ?? [], mes)
    const acordado = detalle ? detalle.monto : null
    const pagos = (pagosDe.get(persona.id) ?? []).sort(porFecha)
    const sinNadaQueMostrar = acordado === null && pagos.length === 0
    if (sinNadaQueMostrar && (!persona.activo || persona.rol === 'owner')) continue
    const pagado = pagos.reduce((s, m) => s + m.monto, 0)
    renglones.push({
      persona,
      acordado,
      detalle,
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

const activosPorNombre = <T extends { nombre: string; activo: boolean }>(usuarios: T[]): T[] =>
  usuarios.filter((u) => u.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

/**
 * Quiénes se pueden elegir al cargar un pago de sueldo: los activos, por
 * nombre. Un dueño sin cuenta no: no trabaja en el local, solo retira.
 */
export function personasParaSueldo<T extends { nombre: string; activo: boolean; sinCuenta?: boolean }>(
  usuarios: T[],
): T[] {
  return activosPorNombre(usuarios).filter((u) => !u.sinCuenta)
}

/** De quién puede ser un retiro de socios: los dueños activos, con cuenta o sin, por nombre. */
export function duenosParaRetiro<T extends { nombre: string; activo: boolean; rol?: Rol }>(usuarios: T[]): T[] {
  return activosPorNombre(usuarios).filter((u) => u.rol === 'owner')
}

/**
 * A quiénes puede nombrar el concepto de un gasto: todos los activos, el
 * equipo y los dueños, con cuenta o sin. Es la lista que mira la pregunta
 * «¿Es el sueldo de …?» / «¿Es un retiro de …?» al cargar.
 */
export function personasConocidas<T extends { nombre: string; activo: boolean }>(usuarios: T[]): T[] {
  return activosPorNombre(usuarios)
}

/**
 * El comienzo del id de un dueño sin cuenta. Los de las cuentas son el uid
 * de Firebase Auth (letras y números, sin guiones), así que no se pisan.
 */
export const PREFIJO_SIN_CUENTA = 'sin-cuenta-'

/** El motivo con el que queda en el historial. */
export const MOTIVO_DUENO_SIN_CUENTA = 'Dueño sin cuenta, para anotar sus retiros'

const nombreLimpio = (nombre: string) => nombre.trim().replace(/\s+/g, ' ')

/**
 * Por qué no se puede agregar ese dueño sin cuenta, o null si está bien.
 * Con el mismo nombre que alguien activo no: la app no sabría a quién se
 * refiere un gasto que lo nombra.
 */
export function problemaDelDuenoSinCuenta(
  nombre: string,
  existentes: { nombre: string; activo: boolean }[],
): string | null {
  const limpio = nombreLimpio(nombre)
  if (!limpio) return 'Escribí el nombre.'
  const igual = existentes.find((u) => u.activo && normalizar(u.nombre) === normalizar(limpio))
  return igual ? `Ya hay alguien activo que se llama ${igual.nombre}.` : null
}

/**
 * Un dueño que no usa la app (19/11), listo para guardar: sin mail ni
 * clave, así que no puede entrar. Está para anotarle los retiros. Lo que
 * se evita es crearle una cuenta que nadie usa, que sería un acceso total
 * de más.
 */
export function duenoSinCuenta(nombre: string, id: string): Usuario {
  return {
    id: `${PREFIJO_SIN_CUENTA}${id}`,
    email: '',
    nombre: nombreLimpio(nombre),
    rol: 'owner',
    activo: true,
    secciones: null,
    apodos: null,
    sinCuenta: true,
  }
}

/** La pregunta antes de agregarlo. */
export function textoDeConfirmacionDuenoSinCuenta(nombre: string): string {
  const limpio = nombreLimpio(nombre)
  return `¿Agregar a ${limpio} a los dueños, sin cuenta?\n\nNo va a tener mail ni clave: no puede entrar a la app. Está para anotarle los retiros, que se ven en Sueldos → «Retiros de los dueños».`
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
  /** Lo que le corresponde en el mes. null: todavía no hay un sueldo definido que lo alcance. */
  acordado: number | null
  detalle: LoAcordado | null
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
  const detalle = acordadoEnElMes(ficha?.acuerdos ?? [], mes)
  const acordado = detalle ? detalle.monto : null
  const pagado = pagos.reduce((s, m) => s + m.monto, 0)
  return { mes, acordado, detalle, pagado, saldo: acordado === null ? null : acordado - pagado, pagos }
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
  /** Lo que le corresponde en el mes. null: todavía no hay un sueldo definido que lo alcance. */
  acordado: number | null
  detalle: LoAcordado | null
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
  const detalle = acordadoEnElMes(ficha?.acuerdos ?? [], mes)
  const acordado = detalle ? detalle.monto : null
  const pagado = pagos.reduce((s, m) => s + m.monto, 0)
  return { mes, acordado, detalle, pagado, saldo: acordado === null ? null : acordado - pagado, pagos }
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
