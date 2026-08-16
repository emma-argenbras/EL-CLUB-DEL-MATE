import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Cuando se publica una version nueva (npm run build + deploy), el
 * navegador la baja sola en segundo plano pero no la aplica hasta que
 * se cierran todas las pestañas: por eso avisamos con un boton, para
 * no cortar una venta a mitad de un cierre de caja.
 */
export default function ActualizarApp() {
  const {
    needRefresh: [necesitaActualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker:', error)
    },
  })

  if (!necesitaActualizar) return null

  return (
    <div className="barra-actualizar">
      <span>Hay una versión nueva de la app</span>
      <button className="boton-chico" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  )
}
