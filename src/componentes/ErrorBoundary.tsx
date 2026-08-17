import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Sin esto, un error de React en cualquier parte de la app (por ejemplo,
 * un dato con una forma inesperada) desmonta TODA la app y deja una
 * pantalla en blanco, sin ninguna pista de qué pasó. Con esto, al menos
 * se ve el mensaje del error y se puede mandar una captura para
 * solucionarlo, en vez de una pantalla vacía imposible de diagnosticar.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error atrapado por ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="pantalla-carga">
          <div className="logo-carga">🧉</div>
          <div className="tarjeta" style={{ width: 'min(420px, 92vw)', textAlign: 'left' }}>
            <p className="tarjeta-titulo">Algo salió mal</p>
            <p className="silencio" style={{ marginBottom: 10 }}>
              Hubo un error inesperado. Sacale una captura a esto y mandásela a quien mantiene la
              app:
            </p>
            <div
              className="aviso aviso-error"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.78rem' }}
            >
              {this.state.error.message}
            </div>
            <button
              className="boton-principal"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => location.reload()}
            >
              Recargar la app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
