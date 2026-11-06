import type { Hallazgo, NivelHallazgo } from './auditoria'

/**
 * Los avisos agrupados por cuando hay que ocuparse (punto 4 del pedido
 * del 06/11).
 *
 * Hasta el 06/11 la campana contaba todo junto --13 avisos en la Mac de
 * Emmanuel-- y el Panel mostraba cada uno entero, con su detalle y su
 * «que hacer». Lo urgente quedaba mezclado con el mantenimiento, y un
 * numero como «1.207 de 1.337» asustaba sin decir que hacer hoy.
 *
 * Ahora: para hoy (lo urgente), esta semana (lo importante) y cuando
 * puedas (el mantenimiento). La campana cuenta solo lo de hoy.
 */
export type Plazo = 'hoy' | 'semana' | 'cuandoPuedas'

export const PLAZO_DE_NIVEL: Record<NivelHallazgo, Plazo> = {
  critico: 'hoy',
  importante: 'semana',
  aviso: 'cuandoPuedas',
}

export const TITULO_PLAZO: Record<Plazo, string> = {
  hoy: 'Para hoy',
  semana: 'Esta semana',
  cuandoPuedas: 'Cuando puedas',
}

const ORDEN: Plazo[] = ['hoy', 'semana', 'cuandoPuedas']

export function agruparPorPlazo(hallazgos: Hallazgo[]): { plazo: Plazo; hallazgos: Hallazgo[] }[] {
  return ORDEN.map((plazo) => ({
    plazo,
    hallazgos: hallazgos.filter((h) => PLAZO_DE_NIVEL[h.nivel] === plazo),
  })).filter((g) => g.hallazgos.length > 0)
}

/** Lo que cuenta la campana: solo lo de hoy. */
export function contarParaHoy(hallazgos: Hallazgo[]): number {
  return hallazgos.filter((h) => PLAZO_DE_NIVEL[h.nivel] === 'hoy').length
}

/**
 * Cuanto esta al dia, de 0 a 100, para los avisos que tienen un total.
 * null si el aviso no es de ese tipo.
 */
export function avanceDe(h: Pick<Hallazgo, 'cantidad' | 'total'>): number | null {
  if (!h.total || h.cantidad === undefined) return null
  return Math.max(0, Math.min(100, Math.round(((h.total - h.cantidad) / h.total) * 100)))
}
