import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { sembrarCatalogo } from './db/sembrar'
import Caja from './paginas/Caja'
import Productos from './paginas/Productos'
import Gastos from './paginas/Gastos'
import Reportes from './paginas/Reportes'
import Ajustes from './paginas/Ajustes'

const SECCIONES = [
  { ruta: '/caja', icono: '🧉', texto: 'Caja' },
  { ruta: '/productos', icono: '🏷️', texto: 'Productos' },
  { ruta: '/gastos', icono: '💸', texto: 'Gastos' },
  { ruta: '/reportes', icono: '📊', texto: 'Reportes' },
  { ruta: '/ajustes', icono: '⚙️', texto: 'Ajustes' },
]

export default function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    sembrarCatalogo()
      .then(() => setListo(true))
      .catch((e) => {
        console.error(e)
        setError(String(e))
        setListo(true)
      })
  }, [])

  if (!listo) {
    return (
      <div className="pantalla-carga">
        <div className="logo-carga">🧉</div>
        <p>Preparando El Club del Mate…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="cabecera">
        <span className="marca">🧉 El Club del Mate</span>
      </header>

      {error && <div className="aviso aviso-error">No se pudo cargar el catálogo: {error}</div>}

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Navigate to="/caja" replace />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/caja" replace />} />
        </Routes>
      </main>

      <nav className="menu">
        {SECCIONES.map((s) => (
          <NavLink
            key={s.ruta}
            to={s.ruta}
            className={({ isActive }) => (isActive ? 'menu-item activo' : 'menu-item')}
          >
            <span className="menu-icono">{s.icono}</span>
            <span className="menu-texto">{s.texto}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
