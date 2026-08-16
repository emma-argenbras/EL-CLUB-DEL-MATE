import { useSyncExternalStore } from 'react'
import { obtenerEstadoNube, suscribirseAEstadoNube } from './estado'

/** Estado reactivo de la sincronizacion con la nube, para usar en cualquier pantalla. */
export function useEstadoNube() {
  return useSyncExternalStore(suscribirseAEstadoNube, obtenerEstadoNube)
}
