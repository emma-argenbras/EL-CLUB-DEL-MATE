import { useEffect, useState } from 'react'

/**
 * Si la pantalla es la de la compu (opcion B, 06/11). Tiene que coincidir
 * con el `@media (min-width: 1024px)` de estilos.css: lo que se acomoda con
 * CSS y lo que se arma distinto con esto cambian juntos.
 */
export const CONSULTA_COMPU = '(min-width: 1024px)'

export function useEsCompu(): boolean {
  const [es, setEs] = useState(() => window.matchMedia?.(CONSULTA_COMPU).matches === true)
  useEffect(() => {
    const m = window.matchMedia?.(CONSULTA_COMPU)
    if (!m) return
    const cambio = () => setEs(m.matches)
    cambio()
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])
  return es
}
