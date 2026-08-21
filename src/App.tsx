import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { aplicarPreciosNuevos, sembrarCatalogo, sincronizarMesImportado } from './db/sembrar'
import { SECCIONES_CONFIGURABLES, type SeccionId } from './db/db'
import { nubeConfigurada } from './sync/config'
import { seccionesVisibles } from './sync/sesion'
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
import ActualizarApp, { BotonActualizarApp } from './componentes/ActualizarApp'
import PantallaLogin, { PantallaDesactivada, PantallaSinPerfil } from './componentes/PantallaLogin'

// Cada seccion configurable (ver SECCIONES_CONFIGURABLES en db.ts) mas su
// ruta e icono de menu. Un owner las ve todas siempre; a un empleado un
// owner le puede prender o apagar cada una desde Ajustes.
const NAV_POR_SECCION: Record<SeccionId, { ruta: string; icono: string; texto: string }> = {
  caja: { ruta: '/caja', icono: '🧉', texto: 'Caja' },
  productos: { ruta: '/productos', icono: '🏷️', texto: 'Productos' },
  proveedores: { ruta: '/proveedores', icono: '🚚', texto: 'Provee.' },
  gastos: { ruta: '/gastos', icono: '💸', texto: 'Gastos' },
  reportes: { ruta: '/reportes', icono: '📊', texto: 'Reportes' },
}

// Meses de la planilla vieja ya extraidos y listos para cargarse solos.
const MESES_HISTORICOS = ['2026-07', '2026-08']

// Actualizaciones de la lista de precios traidas de la BASE DE DATOS.
const LISTAS_DE_PRECIOS = ['2026-08']

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
        await sincronizarMesImportado(mes)
      }
      for (const mes of LISTAS_DE_PRECIOS) {
        await aplicarPreciosNuevos(mes)
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

  if (nubeConfigurada && sesion.desactivada) {
    return <PantallaDesactivada />
  }

  if (nubeConfigurada && !sesion.uid) {
    return <PantallaLogin />
  }

  if (nubeConfigurada && sesion.sinPerfil) {
    return <PantallaSinPerfil email={sesion.email} />
  }

  const esEmpleado = sesion.perfil?.rol === 'empleado'
  const visibles = seccionesVisibles(sesion.perfil)
  const puedeVer = (s: SeccionId) => visibles.includes(s)

  const secciones = [
    ...SECCIONES_CONFIGURABLES.filter(puedeVer).map((s) => NAV_POR_SECCION[s]),
    ...(esEmpleado
      ? [{ ruta: '/mi-actividad', icono: '⭐', texto: 'Mi día' }]
      : [{ ruta: '/ajustes', icono: '⚙️', texto: 'Ajustes' }]),
  ]

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
          <BotonActualizarApp />
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
          <Route
            path="/caja"
            element={puedeVer('caja') ? <Caja /> : <Navigate to="/mi-actividad" replace />}
          />
          <Route
            path="/productos"
            element={puedeVer('productos') ? <Productos /> : <Navigate to="/mi-actividad" replace />}
          />
          <Route
            path="/proveedores"
            element={puedeVer('proveedores') ? <Proveedores /> : <Navigate to="/mi-actividad" replace />}
          />
          <Route
            path="/gastos"
            element={puedeVer('gastos') ? <Gastos /> : <Navigate to="/mi-actividad" replace />}
          />
          <Route
            path="/reportes"
            element={puedeVer('reportes') ? <Reportes /> : <Navigate to="/mi-actividad" replace />}
          />
          <Route path="/mi-actividad" element={<MiActividad />} />
          <Route
            path="/ajustes"
            element={esEmpleado ? <Navigate to="/mi-actividad" replace /> : <Ajustes />}
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
