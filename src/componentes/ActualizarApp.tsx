import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface EstadoActualizacion {
  necesitaActualizar: boolean
  buscarActualizacion: () => Promise<void>
  aplicarActualizacion: () => void
}

const ContextoActualizacion = createContext<EstadoActualizacion | null>(null)

/**
 * Registra el service worker UNA sola vez (aca) y comparte el estado por
 * contexto: asi la barra que avisa sola y el boton de "buscar actualizacion"
 * del header usan el mismo registro, en vez de registrarlo dos veces.
 */
export function ProveedorActualizacion({ children }: { children: ReactNode }) {
  const registro = useRef<ServiceWorkerRegistration | undefined>(undefined)

  const {
    needRefresh: [necesitaActualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      registro.current = reg
    },
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker:', error)
    },
  })

  async function buscarActualizacion() {
    try {
      await registro.current?.update()
    } catch (error) {
      console.warn('No se pudo buscar actualizaciones:', error)
    }
  }

  return (
    <ContextoActualizacion.Provider
      value={{
        necesitaActualizar,
        buscarActualizacion,
        aplicarActualizacion: () => updateServiceWorker(true),
      }}
    >
      {children}
    </ContextoActualizacion.Provider>
  )
}

export function useActualizacionApp(): EstadoActualizacion {
  const contexto = useContext(ContextoActualizacion)
  if (!contexto) throw new Error('useActualizacionApp debe usarse dentro de ProveedorActualizacion')
  return contexto
}

/**
 * Cuando se publica una version nueva (npm run build + deploy), el
 * navegador la baja sola en segundo plano pero no la aplica hasta que
 * se cierran todas las pestañas: por eso avisamos con un boton, para
 * no cortar una venta a mitad de un cierre de caja.
 */
export default function ActualizarApp() {
  const { necesitaActualizar, aplicarActualizacion } = useActualizacionApp()

  if (!necesitaActualizar) return null

  return (
    <div className="barra-actualizar">
      <span>Hay una versión nueva de la app</span>
      <button className="boton-chico" onClick={aplicarActualizacion}>
        Actualizar
      </button>
    </div>
  )
}

/**
 * Boton de acceso facil en la cabecera: siempre visible (para cualquier
 * rol), para no depender de que la deteccion automatica ya haya avisado.
 * Si ya hay una version esperando, tocarlo la aplica directo; si no,
 * fuerza una busqueda ahora mismo.
 */
export function BotonActualizarApp() {
  const { necesitaActualizar, buscarActualizacion, aplicarActualizacion } = useActualizacionApp()
  const [estado, setEstado] = useState<'quieto' | 'buscando' | 'al-dia'>('quieto')

  async function alTocar() {
    if (necesitaActualizar) {
      aplicarActualizacion()
      return
    }
    setEstado('buscando')
    await buscarActualizacion()
    // Le da un instante a la deteccion (needRefresh) de reaccionar antes
    // de decidir si mostrar "al dia": si encontro algo, el boton ya va a
    // haber cambiado solo a modo "hay una version nueva".
    setTimeout(() => {
      setEstado('al-dia')
      setTimeout(() => setEstado('quieto'), 2000)
    }, 800)
  }

  return (
    <button
      className="boton-ayuda"
      style={{ position: 'relative' }}
      onClick={alTocar}
      disabled={estado === 'buscando'}
      title={necesitaActualizar ? 'Hay una versión nueva: tocá para actualizar' : 'Buscar actualizaciones de la app'}
      aria-label="Actualizar app"
    >
      {estado === 'buscando' ? '⏳' : estado === 'al-dia' && !necesitaActualizar ? '✅' : '🔄'}
      {necesitaActualizar && <span className="campana-contador">!</span>}
    </button>
  )
}
