import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { cargarArqueosHistoricos, sembrarCatalogo, sembrarHistorico } from './db/sembrar'
import { nubeConfigurada } from './sync/config'
import { useSesion } from './sync/useSesion'
import Caja from './paginas/Caja'
import Productos from './paginas/Productos'
import Proveedores from './paginas/Proveedores'
import Gastos from './paginas/Gastos'
import Reportes from './paginas/Reportes'
import MiActividad from './paginas/MiActividad'
import Ajustes from './paginas/Ajustes'
import Ayuda from './paginas/Ayuda'
import Notificaciones from './componentes/Notificaciones'
import ActualizarApp from './componentes/ActualizarApp'
import PantallaLogin, { PantallaSinPerfil } from './componentes/PantallaLogin'

const SECCIONES_OWNER = [
  { ruta: '/caja', icono: '🧉', texto: 'Caja' },
  { ruta: '/productos', icono: '🏷️', texto: 'Productos' },
  { ruta: '/proveedores', icono: '🚚', texto: 'Provee.' },
  { ruta: '/gastos', icono: '💸', texto: 'Gastos' },
  { ruta: '/reportes', icono: '📊', texto: 'Reportes' },
  { ruta: '/ajustes', icono: '⚙️', texto: 'Ajustes' },
]

const SECCIONES_EMPLEADO = [
  { ruta: '/caja', icono: '🧉', texto: 'Caja' },
  { ruta: '/productos', icono: '🏷️', texto: 'Productos' },
  { ruta: '/proveedores', icono: '🚚', texto: 'Provee.' },
  { ruta: '/gastos', icono: '💸', texto: 'Gastos' },
  { ruta: '/mi-actividad', icono: '⭐', texto: 'Mi día' },
]

// Meses de la planilla vieja ya extraidos y listos para sembrar solos.
const MESES_HISTORICOS = ['2026-07']

export default function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sesion = useSesion()

  useEffect(() => {
    if (nubeConfigurada) {
      import('./sync/motor').then((m) => m.iniciarMotor())
    }
    ;(async () => {
      await sembrarCatalogo()
      for (const mes of MESES_HISTORICOS) {
        await sembrarHistorico(mes)
        await cargarArqueosHistoricos(mes)
      }
    })()
      .then(() => setListo(true))
      .catch((e) => {
        console.error(e)
        setError(String(e))
        setListo(true)
      })
  }, [])

  if (!listo || (nubeConfigurada && sesion.cargando)) {
    return (
      <div className="pantalla-carga">
        <div className="logo-carga">🧉</div>
        <p>{!listo ? 'Preparando El Club del Mate…' : 'Verificando tu sesión…'}</p>
      </div>
    )
  }

  if (nubeConfigurada && !sesion.uid) {
    return <PantallaLogin />
  }

  if (nubeConfigurada && sesion.sinPerfil) {
    return <PantallaSinPerfil email={sesion.email} />
  }

  const esEmpleado = sesion.perfil?.rol === 'empleado'
  const secciones = esEmpleado ? SECCIONES_EMPLEADO : SECCIONES_OWNER

  return (
    <div className="app">
      <ActualizarApp />

      <header className="cabecera">
        <span className="marca">🧉 El Club del Mate</span>
        <div className="acciones-cabecera">
          {nubeConfigurada && sesion.perfil && (
            <button
              className="boton-ayuda"
              style={{ width: 'auto', padding: '0 10px', fontSize: '0.7rem', fontWeight: 700 }}
              title={`Sesión: ${sesion.email ?? ''} · tocá para cerrar sesión`}
              onClick={() => {
                if (confirm(`¿Cerrar la sesión de ${sesion.perfil!.nombre}?`)) {
                  import('./sync/motor').then((m) => m.cerrarSesion())
                }
              }}
            >
              {sesion.perfil.nombre}
            </button>
          )}
          <NavLink to="/ayuda" className="boton-ayuda" aria-label="Ayuda">
            ?
          </NavLink>
          <Notificaciones />
        </div>
      </header>

      {error && <div className="aviso aviso-error">No se pudo cargar el catálogo: {error}</div>}

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Navigate to="/caja" replace />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route
            path="/reportes"
            element={esEmpleado ? <Navigate to="/mi-actividad" replace /> : <Reportes />}
          />
          <Route path="/mi-actividad" element={<MiActividad />} />
          <Route
            path="/ajustes"
            element={esEmpleado ? <Navigate to="/caja" replace /> : <Ajustes />}
          />
          <Route path="/ayuda" element={<Ayuda />} />
          <Route path="*" element={<Navigate to="/caja" replace />} />
        </Routes>
      </main>

      <nav className="menu">
        {secciones.map((s) => (
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
