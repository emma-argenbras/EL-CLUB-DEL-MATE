import { nubeConfigurada } from './config'

/**
 * Estado reactivo de la sincronizacion, sin depender del SDK de
 * Firebase: asi cualquier pantalla puede mostrarlo sin forzar la
 * descarga de Firebase antes de que haga falta.
 */
export type EstadoNube = 'sin-configurar' | 'desconectado' | 'conectando' | 'sincronizado' | 'error'

export interface EstadoSync {
  estado: EstadoNube
  email: string | null
  error: string | null
  ultimaRecepcion: number | null
  /**
   * Cuantos registros hay en este dispositivo que el servidor no tiene.
   *
   * null mientras no se pudo averiguar (sin sesion, sin internet, o
   * antes del primer control). Cero es distinto de null: cero quiere
   * decir "se controlo y esta todo arriba".
   *
   * Existe por lo que paso el 19/10: el celular de Gabi tenia un turno
   * entero sin subir y nadie se entero en tres dias. El indicador de la
   * nube decia si estaba conectada, no si quedaba algo pendiente.
   */
  sinSubir: number | null
}

let estado: EstadoSync = {
  estado: nubeConfigurada ? 'desconectado' : 'sin-configurar',
  email: null,
  error: null,
  ultimaRecepcion: null,
  sinSubir: null,
}

const oyentes = new Set<() => void>()

export function fijarEstadoNube(parcial: Partial<EstadoSync>): void {
  estado = { ...estado, ...parcial }
  for (const oyente of oyentes) oyente()
}

export function suscribirseAEstadoNube(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export function obtenerEstadoNube(): EstadoSync {
  return estado
}
