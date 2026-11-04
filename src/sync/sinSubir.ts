import type { NombreTabla } from '../db/db'
import { fechaLinda, plata } from '../lib/formato'
import { cuelgaDeRetenido, type TurnoRetenido } from './retener'

/**
 * Que es cada cosa que el aviso «Hay N cosas sin subir» esta contando.
 *
 * El aviso compara CANTIDADES por tabla (ver contarSinSubir en el motor):
 * es barato y sirve para lo que se hizo, que es darse cuenta de que un
 * aparato carga y no sube. Pero no dice que es lo que falta, y el 04/11
 * la Mac de Sandra quedo diciendo «1» y la PC de Gabriela «3», fijos,
 * mientras las ventas del dia subian bien. Un numero que no baja y que
 * nadie puede explicar entrena a la gente a no mirarlo.
 *
 * Lo que puede quedar en un aparato sin estar en el servidor, de forma
 * fija y no solo por un rato:
 *
 * - Algo que se BORRO a proposito desde otro aparato (hay constancia en
 *   `borrados`) y este no se entero. La subida inicial lo saltea --bien,
 *   no lo revive-- pero tampoco lo sacaba de aca, asi que contaba para
 *   siempre. Se saca de este aparato: es lo que el servidor ya decidio.
 * - Un turno RETENIDO para no duplicarlo (ver retener.ts), con sus
 *   ventas y egresos. No se sube a proposito y tiene su propio cartel:
 *   no cuenta aca.
 * - Un renglon del HISTORIAL firmado por otra persona: las reglas solo
 *   dejan subirlo a nombre de quien esta conectado, asi que desde otra
 *   sesion no sube nunca. Sube solo cuando esa persona entra desde este
 *   aparato. No es algo que quien esta conectado haya cargado y se este
 *   perdiendo: no cuenta en el aviso, y se muestra en el detalle.
 * - Algo que el servidor RECHAZO. La subida inicial lo reintentaba en
 *   cada arranque y fallaba en silencio (y en el mismo lote arrastraba a
 *   todo lo demas). Ahora se intenta de a uno y, si no entra, queda con
 *   el motivo a la vista.
 * - Un USUARIO que el servidor ya no tiene. Los usuarios se crean y se
 *   dan de baja en el servidor, nunca en un aparato: si aca quedo uno que
 *   alla no esta, es viejo. Subirlo podria revivir a alguien dado de baja,
 *   con sus permisos. Se saca de este aparato (menos el propio).
 * - Lo demas simplemente no habia subido todavia: se sube.
 */

export type Destino = 'ya-borrado' | 'usuario-viejo' | 'retenido' | 'firmado-por-otro' | 'subir'

export interface Pendiente {
  tabla: NombreTabla
  clave: string
  fila: Record<string, unknown>
}

/** La clave de una fila en su tabla: el codigo en productos, el id en las demas. */
export function claveDeFila(tabla: NombreTabla, fila: Record<string, unknown>): string {
  return String(tabla === 'productos' ? fila.codigo : fila.id)
}

const TABLAS_DE_HISTORIAL: NombreTabla[] = ['historial', 'historialProductos']

export function clasificarPendiente(
  p: Pendiente,
  contexto: {
    /** `tabla/clave` de lo borrado a proposito, segun el servidor. */
    borrados: Set<string>
    /** Ids de los turnos retenidos en este aparato. */
    retenidos: Set<string>
    /** Quien esta conectado. */
    email: string | null
    uid?: string | null
  },
): Destino {
  if (contexto.borrados.has(`${p.tabla}/${p.clave}`)) return 'ya-borrado'
  if (p.tabla === 'usuarios' && p.clave !== contexto.uid) return 'usuario-viejo'
  if (cuelgaDeRetenido(p.tabla, p.fila, contexto.retenidos)) return 'retenido'
  if (TABLAS_DE_HISTORIAL.includes(p.tabla) && p.fila.quien !== contexto.email) {
    return 'firmado-por-otro'
  }
  return 'subir'
}

/** Cuantas filas de esa tabla son de los turnos retenidos: no se suben a proposito. */
export function filasRetenidasEn(tabla: NombreTabla, retenidos: TurnoRetenido[]): number {
  if (tabla === 'jornadas') return retenidos.length
  if (tabla === 'ventas') return retenidos.reduce((s, t) => s + t.ventas, 0)
  if (tabla === 'movimientos') return retenidos.reduce((s, t) => s + t.movimientos, 0)
  return 0
}

/**
 * Lo que de verdad falta subir en una tabla, a partir de las cantidades.
 * Se descuenta lo que no se sube a proposito: lo retenido y lo que ya se
 * sabe que esta firmado por otra persona.
 */
export function faltanEnTabla(aca: number, alla: number, aDescontar: number): number {
  return Math.max(0, aca - aDescontar - alla)
}

const TURNO: Record<string, string> = { M: 'mañana', T: 'tarde' }

/** Que es, en palabras, para el detalle. */
export function describirPendiente(p: Pendiente): string {
  const f = p.fila
  const fecha = typeof f.fecha === 'string' ? fechaLinda(f.fecha) : ''
  switch (p.tabla) {
    case 'ventas':
      return `Venta del ${fecha}${f.hora ? ` a las ${f.hora}` : ''}: ${f.descripcion ?? f.codigo ?? 'sin descripción'}, ${plata(Number(f.total ?? 0))}`
    case 'jornadas':
      return `Turno del ${fecha} ${TURNO[String(f.turno)] ?? ''}${f.vendedor ? `, de ${f.vendedor}` : ''}`.trim()
    case 'movimientos':
      return `Movimiento de caja del ${fecha}: ${f.concepto ?? 'sin concepto'}, ${plata(Number(f.monto ?? 0))}`
    case 'productos':
      return `Producto ${p.clave}: ${f.descripcion ?? ''}`.trim()
    case 'proveedores':
      return `Proveedor ${f.nombre ?? p.clave}`
    case 'movimientosProveedor':
      return `Movimiento de cuenta corriente del ${fecha}: ${plata(Number(f.monto ?? 0))}`
    case 'historial':
      return `Renglón del historial: ${f.queEs ?? `${f.tabla} ${f.clave}`}, anotado por ${f.quienNombre ?? f.quien ?? 'alguien'}`
    case 'historialProductos':
      return `Renglón viejo del historial de ${f.codigo}, anotado por ${f.quienNombre ?? f.quien ?? 'alguien'}`
    case 'borrados':
      return `Constancia de borrado de ${f.tabla} ${f.clave}`
    case 'usuarios':
      return `Usuario ${f.email ?? p.clave}`
    default:
      return `${p.tabla} ${p.clave}`
  }
}

export type Resultado =
  | 'subido'
  | 'ya-estaba'
  | 'sacado-de-aca'
  | 'retenido'
  | 'firmado-por-otro'
  | 'rechazado'

export interface RenglonRevision {
  tabla: NombreTabla
  clave: string
  que: string
  resultado: Resultado
  /** Por que no entro, cuando no entro. */
  motivo?: string
}

export interface Revision {
  cuando: number
  renglones: RenglonRevision[]
}

/** Lo que queda contando en el aviso despues de revisar. */
export function siguenPendientes(revision: Revision): RenglonRevision[] {
  return revision.renglones.filter((r) => r.resultado === 'rechazado')
}

/** Cuantos de esa tabla no se cuentan en el aviso: firmados por otra persona. */
export function firmadosPorOtroEn(tabla: NombreTabla, revision: Revision | null): number {
  if (!revision) return 0
  return revision.renglones.filter((r) => r.tabla === tabla && r.resultado === 'firmado-por-otro')
    .length
}

/** El motivo de un rechazo, en criollo. */
export function motivoDeRechazo(tabla: NombreTabla, fila: Record<string, unknown>, error: unknown): string {
  const codigo = (error as { code?: unknown } | null)?.code
  if (codigo === 'permission-denied') {
    if (tabla === 'jornadas' && fila.cierreAutorizado != null) {
      return 'Es un turno con un cierre autorizado, y las reglas no dejan crear un turno que ya trae la autorización. Lo tiene que subir alguien al mando desde este aparato.'
    }
    return 'Las reglas del servidor no dejan subirlo con la sesión de quien está conectado.'
  }
  if (codigo === 'unavailable') return 'No había conexión con el servidor. Se vuelve a intentar solo.'
  return error instanceof Error ? error.message : String(error)
}
