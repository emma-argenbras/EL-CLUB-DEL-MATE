import type { NombreTabla } from '../db/db'
import { haceCuanto } from '../lib/formato'
import type { EstadoSync } from './estado'

/**
 * Qué pasa cuando se cae la escucha del servidor de una tabla (13/11).
 *
 * Cada tabla tiene su escucha (onSnapshot). Firestore reintenta solo los
 * cortes de internet, pero cuando una escucha termina en error --la
 * cuota diaria de lecturas agotada, un permiso, la base del navegador
 * que falla-- la da por terminada y no avisa nada más. Hasta el 13/11
 * la app no la volvía a abrir: ese aparato dejaba de recibir esa tabla
 * hasta que alguien recargaba. Y como las otras tablas seguían
 * recibiendo, el estado volvía a decir «Sincronizado» al segundo. A
 * Sandra le faltaban seis productos del 29/10 y la app no decía nada.
 *
 * Peor todavía: un aparato que no recibe sigue subiendo. No se entera
 * de lo que se borra en otro lado, y la revisión de «sin subir» lo
 * vuelve a subir.
 *
 * Ahora la escucha caída se vuelve a abrir sola, cada vez con más
 * espera, y mientras tanto la app dice qué no está recibiendo.
 */

/**
 * Cuánto esperar antes de volver a abrirla, según cuántas veces se
 * cayó seguida. La última se repite: se sigue intentando cada cinco
 * minutos, porque la cuota de lecturas vuelve sola a medianoche de
 * California (las 5 de la mañana acá) y no hay que recargar para eso.
 */
export const ESPERAS_PARA_REABRIR = [15_000, 30_000, 60_000, 2 * 60_000, 5 * 60_000] as const

export function esperaParaReabrir(caidas: number): number {
  const i = Math.min(Math.max(caidas - 1, 0), ESPERAS_PARA_REABRIR.length - 1)
  return ESPERAS_PARA_REABRIR[i]
}

export interface TablaSinRecibir {
  tabla: NombreTabla
  /** Cuándo se cayó. No cambia mientras los reintentos siguen fallando. */
  desde: number
  /** Cuántas veces seguidas se cayó. */
  caidas: number
  /** Lo que dijo Firestore la última vez. */
  error: string
  /** El código del error de Firestore ('resource-exhausted', 'permission-denied'…), si vino. */
  codigo?: string | null
}

/** Una caída más de la escucha de esa tabla. */
export function anotarCaida(
  lista: TablaSinRecibir[],
  tabla: NombreTabla,
  error: string,
  ahora: number,
  codigo: string | null = null,
): TablaSinRecibir[] {
  const antes = lista.find((t) => t.tabla === tabla)
  return [
    ...lista.filter((t) => t.tabla !== tabla),
    { tabla, desde: antes?.desde ?? ahora, caidas: (antes?.caidas ?? 0) + 1, error, codigo },
  ]
}

/** La escucha de esa tabla volvió a recibir del servidor. */
export function anotarQueVolvio(lista: TablaSinRecibir[], tabla: NombreTabla): TablaSinRecibir[] {
  return lista.filter((t) => t.tabla !== tabla)
}

const EN_PALABRAS: Record<NombreTabla, string> = {
  productos: 'productos',
  jornadas: 'turnos',
  ventas: 'ventas',
  movimientos: 'movimientos de caja',
  proveedores: 'proveedores',
  usuarios: 'usuarios',
  historialProductos: 'historial viejo de precios',
  movimientosProveedor: 'compras y pagos a proveedores',
  historial: 'historial',
  borrados: 'borrados',
  arqueosCuenta: 'conteos de la caja grande',
  vencimientos: 'vencimientos',
  pedidos: 'pedidos',
}

/** "productos, ventas y turnos", en el orden en que se cayeron. */
function enumerar(lista: TablaSinRecibir[]): string {
  const nombres = lista.map((t) => EN_PALABRAS[t.tabla] ?? t.tabla)
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

export function textoDeTablasSinRecibir(lista: TablaSinRecibir[], ahora = Date.now()): string {
  if (lista.length === 0) return ''
  const desde = Math.min(...lista.map((t) => t.desde))
  return `Este aparato no está recibiendo los cambios de ${enumerar(lista)}. Se cortó ${haceCuanto(desde, ahora)}.`
}

/**
 * Qué hacer, para quien está en el mostrador. Si se agotó la cuota
 * diaria de lecturas, recargar no sirve: vuelve sola a la madrugada.
 */
export function consejoDeTablasSinRecibir(lista: TablaSinRecibir[]): string {
  const base =
    'Lo que cargues acá se guarda y se sube igual: no se pierde nada. Lo que cambien en otros aparatos, en cambio, no te llega.'
  if (lista.some((t) => t.codigo === 'resource-exhausted')) {
    return `${base} El servidor llegó al límite de lecturas del día y vuelve solo a la madrugada: recargar no lo arregla. Avisale a Emmanuel.`
  }
  return `${base} La app lo vuelve a intentar sola. Si en diez minutos sigue este cartel, recargá la app; si después de recargar sigue, avisale a Emmanuel.`
}

/**
 * El estado después de recibir algo de una tabla. Si otra sigue caída,
 * NO es «Sincronizado»: eso es justamente lo que tapaba el problema.
 */
export function estadoTrasRecibir(
  lista: TablaSinRecibir[],
  ahora: number,
): Pick<EstadoSync, 'estado' | 'error' | 'ultimaRecepcion'> {
  if (lista.length === 0) return { estado: 'sincronizado', error: null, ultimaRecepcion: ahora }
  return { estado: 'error', error: textoDeTablasSinRecibir(lista, ahora), ultimaRecepcion: ahora }
}
