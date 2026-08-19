import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './componentes/ErrorBoundary'
import { ProveedorActualizacion } from './componentes/ActualizarApp'
import './estilos.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ProveedorActualizacion>
        <HashRouter>
          <App />
        </HashRouter>
      </ProveedorActualizacion>
    </ErrorBoundary>
  </React.StrictMode>,
)
