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
  /**
   * Cambios que el servidor no acepto, para mostrarlos hasta que la
   * persona los lea.
   *
   * `error` no alcanza: el proximo snapshot lo borra, y en un rechazo el
   * proximo snapshot es la reversion misma, milisegundos despues. Hasta
   * el 22/10 las ediciones de Sandra se deshacian solas y la app no le
   * llegaba a decir nada.
   */
  rechazos: RechazoVisible[]
}

export interface RechazoVisible {
  id: number
  cuando: number
  texto: string
}

/** Mas que esto no se lee: se muestran los ultimos y el total. */
const RECHAZOS_A_GUARDAR = 20
let proximoIdRechazo = 1

let estado: EstadoSync = {
  estado: nubeConfigurada ? 'desconectado' : 'sin-configurar',
  email: null,
  error: null,
  ultimaRecepcion: null,
  sinSubir: null,
  rechazos: [],
}

export function anotarRechazoVisible(texto: string): void {
  const rechazo = { id: proximoIdRechazo++, cuando: Date.now(), texto }
  fijarEstadoNube({ rechazos: [...estado.rechazos, rechazo].slice(-RECHAZOS_A_GUARDAR) })
}

export function descartarRechazos(): void {
  fijarEstadoNube({ rechazos: [] })
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
