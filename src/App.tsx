import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { aplicarPreciosNuevos, sembrarCatalogo, sincronizarMesImportado } from './db/sembrar'
import { SECCIONES_CONFIGURABLES, type SeccionId } from './db/db'
import { mesLindo } from './lib/formato'
import { nubeConfigurada } from './sync/config'
import { seccionesVisibles } from './sync/sesion'
import { marcarArranqueDelHistorial } from './db/db'
import { estaAlMando } from './sync/permisos'
import { leerModoConsulta } from './lib/modoConsulta'
import { useSesion } from './sync/useSesion'
import { useEstadoNube } from './sync/useEstadoNube'
import Panel from './paginas/Panel'
import Caja from './paginas/Caja'
import Productos from './paginas/Productos'
import Proveedores from './paginas/Proveedores'
import Gastos from './paginas/Gastos'
import Reportes from './paginas/Reportes'
import MiActividad from './paginas/MiActividad'
import Ajustes from './paginas/Ajustes'
import Historial from './paginas/Historial'
import Ayuda from './paginas/Ayuda'
import ConsultaPrecios from './paginas/ConsultaPrecios'
import RecuperarProductos from './paginas/RecuperarProductos'
import RevisionProveedores from './paginas/RevisionProveedores'
import TurnosDelDia from './paginas/TurnosDelDia'
import Notificaciones from './componentes/Notificaciones'
import ActualizarApp, { BotonActualizarApp } from './componentes/ActualizarApp'
import PantallaLogin, { PantallaDesactivada, PantallaSinPerfil } from './componentes/PantallaLogin'

// Cada seccion configurable (ver SECCIONES_CONFIGURABLES en db.ts) mas su
// ruta e icono de menu. Un owner las ve todas siempre; a un empleado un
// owner le puede prender o apagar cada una desde Ajustes.
const NAV_POR_SECCION: Record<SeccionId, { ruta: string; icono: string; texto: string }> = {
  panel: { ruta: '/panel', icono: '🧭', texto: 'Panel' },
  caja: { ruta: '/caja', icono: '🧉', texto: 'Caja' },
  productos: { ruta: '/productos', icono: '🏷️', texto: 'Productos' },
  proveedores: { ruta: '/proveedores', icono: '🚚', texto: 'Provee.' },
  gastos: { ruta: '/gastos', icono: '💸', texto: 'Gastos' },
  reportes: { ruta: '/reportes', icono: '📊', texto: 'Reportes' },
}

// Meses de la planilla vieja ya extraidos y listos para cargarse solos.
// Todo 2026 desde enero: cada mes se carga una sola vez y nunca pisa un
// turno cargado a mano desde la app.
const MESES_HISTORICOS = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
]

// Actualizaciones de la lista de precios traidas de la BASE DE DATOS.
const LISTAS_DE_PRECIOS = ['2026-08']

export default function App() {
  const [listo, setListo] = useState(false)
  const [paso, setPaso] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sesion = useSesion()
  // undefined mientras no se leyo todavia. Importa la diferencia con
  // false: si se tomara "todavia no se" por "apagado", el celular del
  // salon abriria un instante en el Panel --con los avisos-- y recien
  // despues saltaria al buscador.
  const modoConsulta = useLiveQuery(() => leerModoConsulta(), [])
  const enConsulta = useLocation().pathname === '/consulta'
  const estadoNube = useEstadoNube()

  useEffect(() => {
    if (nubeConfigurada) {
      import('./sync/motor').then((m) => m.iniciarMotor())
    }
    ;(async () => {
      setPaso('Cargando el catálogo de productos…')
      await sembrarCatalogo()
      // Deja la constancia de desde cuando el historial registra de
      // verdad: la tabla existio dos meses sin grabar nada, y el
      // silencio de ese tramo no puede leerse como "no se toco nada".
      await marcarArranqueDelHistorial()
      // La primera vez son ocho meses de planilla: conviene ir contando
      // en que va, para que no parezca que se colgo.
      for (const mes of MESES_HISTORICOS) {
        setPaso(`Trayendo las ventas de ${mesLindo(mes)}…`)
        await sincronizarMesImportado(mes)
      }
      for (const mes of LISTAS_DE_PRECIOS) {
        setPaso('Actualizando la lista de precios…')
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

  if (!listo || modoConsulta === undefined || (nubeConfigurada && sesion.cargando)) {
    return (
      <div className="pantalla-carga">
        <div className="logo-carga">🧉</div>
        <p>{!listo ? paso || 'Preparando El Club del Mate…' : 'Verificando tu sesión…'}</p>
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

  const alMando = estaAlMando(sesion.perfil)
  const visibles = seccionesVisibles(sesion.perfil)
  const puedeVer = (s: SeccionId) => visibles.includes(s)

  const secciones = [
    ...SECCIONES_CONFIGURABLES.filter(puedeVer).map((s) => NAV_POR_SECCION[s]),
    ...(alMando
      ? [{ ruta: '/ajustes', icono: '⚙️', texto: 'Ajustes' }]
      : [{ ruta: '/mi-actividad', icono: '⭐', texto: 'Mi día' }]),
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
          {/* La campana es el resumen de los pendientes del negocio. En
              el celular del salon no es informacion util: nadie va a
              resolver un costo vencido entre dos clientes, y el numerito
              rojo arriba de todo es exactamente el ruido que este modo
              viene a sacar. Se esconde en los dos casos: cuando el
              aparato esta configurado como el del salon, y cuando se
              esta mirando la pantalla de consulta --aunque sea de paso,
              desde "Probarlo"--. */}
          {!modoConsulta && !enConsulta && <Notificaciones />}
        </div>
      </header>

      {/* Los dos carteles del 20/10. Van arriba de todo y en todas las
          pantallas a proposito: el aviso de que este dispositivo estaba
          solo existia --en Ajustes, escrito como un paso de instalacion
          pendiente-- y nadie lo leyo nunca. Un empleado ni siquiera
          puede entrar a Ajustes. */}
      {!nubeConfigurada && !enConsulta && (
        <div className="aviso aviso-error">
          <strong>Este dispositivo no está conectado.</strong> Lo que cargues acá se guarda
          solo en este aparato: no lo ve nadie más y se pierde si el aparato se pierde.
          Avisá antes de seguir cargando.
        </div>
      )}
      {nubeConfigurada && !enConsulta && (estadoNube.sinSubir ?? 0) > 0 && (
        <div className="aviso aviso-ojo">
          <strong>
            {estadoNube.sinSubir === 1
              ? 'Hay 1 cosa sin subir al servidor.'
              : `Hay ${estadoNube.sinSubir} cosas sin subir al servidor.`}
          </strong>{' '}
          Están guardadas en este dispositivo pero no llegaron a los demás. Si tenés internet
          y no baja en unos minutos, avisá antes de seguir cargando.
        </div>
      )}

      {error && <div className="aviso aviso-error">No se pudo cargar el catálogo: {error}</div>}

      <main className="contenido">
        <Routes>
          <Route
            path="/"
            element={
              <Navigate
                to={modoConsulta ? '/consulta' : puedeVer('panel') ? '/panel' : '/caja'}
                replace
              />
            }
          />
          <Route path="/consulta" element={<ConsultaPrecios />} />
          <Route
            path="/panel"
            element={puedeVer('panel') ? <Panel /> : <Navigate to="/caja" replace />}
          />
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
            element={alMando ? <Ajustes /> : <Navigate to="/mi-actividad" replace />}
          />
          <Route
            path="/turnos"
            element={alMando ? <TurnosDelDia /> : <Navigate to="/caja" replace />}
          />
          <Route
            path="/recuperar"
            element={alMando ? <RecuperarProductos /> : <Navigate to="/caja" replace />}
          />
          <Route
            path="/revision-proveedores"
            element={alMando ? <RevisionProveedores /> : <Navigate to="/caja" replace />}
          />
          <Route
            path="/historial"
            element={alMando ? <Historial /> : <Navigate to="/mi-actividad" replace />}
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
