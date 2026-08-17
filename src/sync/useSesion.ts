import { useSyncExternalStore } from 'react'
import { obtenerSesion, suscribirseASesion } from './sesion'

/** Quien esta usando la app ahora mismo (rol incluido), para cualquier pantalla. */
export function useSesion() {
  return useSyncExternalStore(suscribirseASesion, obtenerSesion)
}
