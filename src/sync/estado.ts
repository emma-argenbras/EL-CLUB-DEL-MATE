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
}

let estado: EstadoSync = {
  estado: nubeConfigurada ? 'desconectado' : 'sin-configurar',
  email: null,
  error: null,
  ultimaRecepcion: null,
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
