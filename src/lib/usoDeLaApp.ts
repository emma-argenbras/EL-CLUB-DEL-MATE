import { esRecargo, type Jornada, type MovimientoProveedor, type Producto, type Venta } from '../db/db'
import { fechaLinda } from './formato'
import { lunesDe, sumarDias } from './tablero'
import { esVentaSinCodigo } from './ventaSinCodigo'

/**
 * Como se viene usando la app, semana por semana (19/11).
 *
 * Sale de una pregunta de Emmanuel: «¿mejoro el uso, dejaron de usar el
 * Excel?». Desde afuera no se podia contestar: hubo que ir a mirar la
 * fecha de modificacion del Excel. Estos numeros salen de lo que ya esta
 * en cada aparato, sin leer nada nuevo del servidor, y contestan lo
 * mismo cada lunes:
 *
 * - si la caja se carga todos los dias que el local abre;
 * - si las ventas se cargan en el momento o se pasan despues desde el
 *   cuaderno (el dia en que se CARGO contra el dia de la venta);
 * - si las entregas de los proveedores se cargan en la app: cuantos
 *   costos tienen fecha de esa semana y cuantos ingresos de mercaderia
 *   hubo. Es la cuenta que se compara con lo anotado en el Excel.
 *
 * No juzga a nadie: no hay numeros por persona. Es para mirar con el
 * equipo que parte de la app todavia cuesta mas que el cuaderno.
 */

/** El dia, en la hora del aparato, en que se cargo algo. */
export function diaDeCarga(creadoEn: number): string {
  const d = new Date(creadoEn)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export interface SemanaDeUso {
  lunes: string
  sabado: string
  /** De lunes a sabado, los dias que ya pasaron (hoy cuenta). */
  diasHabiles: number
  diasConCaja: number
  diasSinCaja: string[]
  /** Turnos de dias anteriores a hoy que siguen abiertos. */
  turnosSinCerrar: number
  /** Renglones de venta de esa semana (sin los recargos de tarjeta). */
  ventas: number
  /** Cargadas el mismo dia de la venta. */
  ventasEnElDia: number
  /** Cargadas uno o mas dias despues. */
  ventasDespues: number
  ventasSinCodigo: number
  /** Productos cuyo costo tiene fecha de esa semana. */
  costosActualizados: number
  /** Ingresos de mercaderia (compras) con fecha de esa semana. */
  ingresos: number
}

export interface DatosDeUso {
  jornadas: Pick<Jornada, 'fecha' | 'estado'>[]
  ventas: Pick<Venta, 'fecha' | 'codigo' | 'creadoEn'>[]
  productos: Pick<Producto, 'fechaCompra' | 'archivado'>[]
  movimientosProveedor: Pick<MovimientoProveedor, 'fecha' | 'tipo'>[]
}

/**
 * Las ultimas semanas, de la mas nueva a la mas vieja. La primera es la
 * que esta en curso: sus dias habiles son los que pasaron hasta hoy.
 */
export function usoPorSemana(datos: DatosDeUso, hoy: string, semanas = 6): SemanaDeUso[] {
  const lista: SemanaDeUso[] = []
  const esteLunes = lunesDe(hoy)
  for (let n = 0; n < semanas; n++) {
    const lunes = sumarDias(esteLunes, -7 * n)
    const sabado = sumarDias(lunes, 5)
    const domingo = sumarDias(lunes, 6)
    const enLaSemana = (fecha: string | null | undefined) => !!fecha && fecha >= lunes && fecha <= domingo

    const conCaja = new Set(datos.jornadas.filter((j) => enLaSemana(j.fecha)).map((j) => j.fecha))
    const habiles = [0, 1, 2, 3, 4, 5].map((i) => sumarDias(lunes, i)).filter((d) => d <= hoy)
    const ventas = datos.ventas.filter((v) => enLaSemana(v.fecha) && !esRecargo(v))

    lista.push({
      lunes,
      sabado,
      diasHabiles: habiles.length,
      diasConCaja: habiles.filter((d) => conCaja.has(d)).length,
      diasSinCaja: habiles.filter((d) => !conCaja.has(d)),
      turnosSinCerrar: datos.jornadas.filter((j) => enLaSemana(j.fecha) && j.estado === 'abierto' && j.fecha < hoy).length,
      ventas: ventas.length,
      ventasEnElDia: ventas.filter((v) => v.creadoEn != null && diaDeCarga(v.creadoEn) === v.fecha).length,
      ventasDespues: ventas.filter((v) => v.creadoEn != null && diaDeCarga(v.creadoEn) > v.fecha).length,
      ventasSinCodigo: ventas.filter((v) => esVentaSinCodigo(v)).length,
      costosActualizados: datos.productos.filter((p) => !p.archivado && enLaSemana(p.fechaCompra)).length,
      ingresos: datos.movimientosProveedor.filter((m) => m.tipo === 'compra' && enLaSemana(m.fecha)).length,
    })
  }
  return lista
}

/** Que tan al dia se cargaron las ventas de una semana, en porcentaje. Sin ventas, null. */
export function porcentajeEnElDia(s: Pick<SemanaDeUso, 'ventasEnElDia' | 'ventasDespues'>): number | null {
  const conDato = s.ventasEnElDia + s.ventasDespues
  return conDato === 0 ? null : Math.round((s.ventasEnElDia / conDato) * 100)
}

export type Senal = 'bien' | 'mirar' | 'mal'

/**
 * Como leer una semana de un vistazo. Los cortes son a ojo y estan aca
 * para cambiarlos en un solo lugar:
 * - mal: falto cargar la caja algun dia, o quedo un turno sin cerrar;
 * - mirar: mas de una de cada diez ventas se cargo despues;
 * - bien: lo demas.
 */
export function senalDeLaSemana(s: SemanaDeUso): Senal {
  if (s.diasSinCaja.length > 0 || s.turnosSinCerrar > 0) return 'mal'
  const enElDia = porcentajeEnElDia(s)
  if (enElDia !== null && enElDia < 90) return 'mirar'
  return 'bien'
}

const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`

/** Un renglon de texto por semana, para leer o para copiar. */
export function renglonDeLaSemana(s: SemanaDeUso): string {
  const partes = [`caja ${s.diasConCaja} de ${plural(s.diasHabiles, 'día', 'días')}`]
  if (s.turnosSinCerrar > 0) partes.push(plural(s.turnosSinCerrar, 'turno sin cerrar', 'turnos sin cerrar'))
  if (s.ventas === 0) {
    partes.push('sin ventas cargadas')
  } else {
    const enElDia = porcentajeEnElDia(s)
    partes.push(
      `${plural(s.ventas, 'venta', 'ventas')}` +
        (enElDia === null ? '' : `, ${enElDia} % cargadas en el día`) +
        (s.ventasDespues > 0 ? ` (${s.ventasDespues} después)` : ''),
    )
  }
  partes.push(plural(s.costosActualizados, 'costo actualizado', 'costos actualizados'))
  partes.push(plural(s.ingresos, 'ingreso de mercadería', 'ingresos de mercadería'))
  return partes.join(' · ')
}

/** Lo mismo que muestra la pantalla, en texto, para mandar por WhatsApp. */
export function resumenParaCopiar(semanas: SemanaDeUso[]): string {
  if (semanas.length === 0) return ''
  const renglones = semanas.map(
    (s, i) => `${i === 0 ? 'Esta semana' : `Semana del ${fechaLinda(s.lunes)}`}: ${renglonDeLaSemana(s)}`,
  )
  const sinCaja = semanas.flatMap((s) => s.diasSinCaja)
  return [
    'Cómo venimos con la app',
    ...renglones,
    ...(sinCaja.length > 0 ? [`Días sin caja: ${sinCaja.map(fechaLinda).join(', ')}`] : []),
  ].join('\n')
}
