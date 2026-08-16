import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { sembrarCatalogo, sembrarHistorico } from './db/sembrar'
import { nubeConfigurada } from './sync/config'
import Caja from './paginas/Caja'
import Productos from './paginas/Productos'
import Proveedores from './paginas/Proveedores'
import Gastos from './paginas/Gastos'
import Reportes from './paginas/Reportes'
import Ajustes from './paginas/Ajustes'
import Notificaciones from './componentes/Notificaciones'
import ActualizarApp from './componentes/ActualizarApp'

const SECCIONES = [
  { ruta: '/caja', icono: '🧉', texto: 'Caja' },
  { ruta: '/productos', icono: '🏷️', texto: 'Productos' },
  { ruta: '/proveedores', icono: '🚚', texto: 'Provee.' },
  { ruta: '/gastos', icono: '💸', texto: 'Gastos' },
  { ruta: '/reportes', icono: '📊', texto: 'Reportes' },
  { ruta: '/ajustes', icono: '⚙️', texto: 'Ajustes' },
]

// Meses de la planilla vieja ya extraidos y listos para sembrar solos.
const MESES_HISTORICOS = ['2026-07']

export default function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (nubeConfigurada) {
      import('./sync/motor').then((m) => m.iniciarMotor())
    }
    ;(async () => {
      await sembrarCatalogo()
      for (const mes of MESES_HISTORICOS) {
        await sembrarHistorico(mes)
      }
    })()
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
      <ActualizarApp />

      <header className="cabecera">
        <span className="marca">🧉 El Club del Mate</span>
        <Notificaciones />
      </header>

      {error && <div className="aviso aviso-error">No se pudo cargar el catálogo: {error}</div>}

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Navigate to="/caja" replace />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/proveedores" element={<Proveedores />} />
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
