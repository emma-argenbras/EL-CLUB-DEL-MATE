import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { aplicarPreciosNuevos, sembrarCatalogo } from './db/sembrar'
import { SECCIONES_CONFIGURABLES, type SeccionId } from './db/db'
import { nubeConfigurada } from './sync/config'
import { seccionesVisibles } from './sync/sesion'
import { marcarArranqueDelHistorial } from './db/db'
import { estaAlMando } from './sync/permisos'
import { leerModoConsulta } from './lib/modoConsulta'
import { useSesion } from './sync/useSesion'
import { useEstadoNube } from './sync/useEstadoNube'
import { descartarRechazos } from './sync/estado'
import { textoDeRetenidos } from './sync/retener'
import { textoDeTurnosSinSubir } from './sync/sinSubir'
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
import RevisionCostos from './paginas/RevisionCostos'
import VentasSinCodigo from './paginas/VentasSinCodigo'
import UnirProveedores from './paginas/UnirProveedores'
import RevisionProveedores from './paginas/RevisionProveedores'
import TurnosDelDia from './paginas/TurnosDelDia'
import SinSubir from './paginas/SinSubir'
import CajaGrande from './paginas/CajaGrande'
import IngresoMercaderia from './paginas/IngresoMercaderia'
import Vencimientos from './paginas/Vencimientos'
import Pedidos from './paginas/Pedidos'
import Notificaciones from './componentes/Notificaciones'
import ActualizarApp, { BotonActualizarApp } from './componentes/ActualizarApp'
import PantallaLogin, { PantallaDesactivada, PantallaSinPerfil } from './componentes/PantallaLogin'
import Icono, { type NombreIcono } from './componentes/Icono'

// Cada seccion configurable (ver SECCIONES_CONFIGURABLES en db.ts) mas su
// ruta e icono de menu. Un owner las ve todas siempre; a un empleado un
// owner le puede prender o apagar cada una desde Ajustes.
// `dibujo` y `textoLargo` son para el menu de arriba de la compu (opcion B,
// 06/11); el celular sigue con el emoji y el texto corto abajo.
interface ItemMenu {
  ruta: string
  icono: string
  texto: string
  textoLargo: string
  dibujo: NombreIcono
}

/** Las pantallas que ya tienen su diseño de compu (opcion B). */
const PANTALLAS_ANCHAS = ['/panel', '/caja']

const NAV_POR_SECCION: Record<SeccionId, ItemMenu> = {
  panel: { ruta: '/panel', icono: '🧭', texto: 'Panel', textoLargo: 'Panel', dibujo: 'panel' },
  caja: { ruta: '/caja', icono: '🧉', texto: 'Caja', textoLargo: 'Caja', dibujo: 'caja' },
  productos: { ruta: '/productos', icono: '🏷️', texto: 'Productos', textoLargo: 'Productos', dibujo: 'productos' },
  proveedores: { ruta: '/proveedores', icono: '🚚', texto: 'Provee.', textoLargo: 'Proveedores', dibujo: 'proveedores' },
  gastos: { ruta: '/gastos', icono: '💸', texto: 'Gastos', textoLargo: 'Gastos', dibujo: 'gastos' },
  reportes: { ruta: '/reportes', icono: '📊', texto: 'Reportes', textoLargo: 'Reportes', dibujo: 'reportes' },
}

// El importador de los meses de la planilla vieja se saco el 06/11. Los
// archivos dejaron de publicarse el 15/10 (eran ventas: datos privados), y
// si alguna vez volvian, cada aparato iba a crear su propia copia de esos
// meses, con otros ids: asi aparecieron los 406 turnos retenidos en la Mac.
// Lo historico ya esta en el servidor.

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
  const ruta = useLocation().pathname
  const enConsulta = ruta === '/consulta'
  // Las pantallas ya rehechas para la compu (opcion B, 06/11) usan todo el
  // ancho; las demas, uno mas angosto hasta que les toque, asi los
  // formularios no quedan estirados de punta a punta.
  // Exacta: /caja-grande no es /caja.
  const anchoCompleto = PANTALLAS_ANCHAS.includes(ruta)
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

  const secciones: ItemMenu[] = [
    ...SECCIONES_CONFIGURABLES.filter(puedeVer).map((s) => NAV_POR_SECCION[s]),
    ...(alMando
      ? [{ ruta: '/ajustes', icono: '⚙️', texto: 'Ajustes', textoLargo: 'Ajustes', dibujo: 'ajustes' as const }]
      : [{ ruta: '/mi-actividad', icono: '⭐', texto: 'Mi día', textoLargo: 'Mi día', dibujo: 'midia' as const }]),
  ]

  return (
    <div className="app">
      <ActualizarApp />

      <header className="cabecera">
        <span className="marca">🧉 El Club del Mate</span>
        {/* En la compu (opcion B, 06/11): la marca y las secciones van en
            esta misma barra, arriba; el menu de abajo se esconde. En el
            celular no se ven: sigue todo como estaba. */}
        <span className="marca-escritorio">
          <span className="marca-circulo" aria-hidden="true">ECDM</span>
          El Club del Mate
        </span>
        {!modoConsulta && !enConsulta && (
          <nav className="menu-escritorio" aria-label="Secciones">
            {secciones.map((s) => (
              <NavLink
                key={s.ruta}
                to={s.ruta}
                className={({ isActive }) => (isActive ? 'pestana-menu activo' : 'pestana-menu')}
              >
                <Icono nombre={s.dibujo} />
                {s.textoLargo}
              </NavLink>
            ))}
          </nav>
        )}
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
          Están guardadas en este dispositivo pero no llegaron a los demás. Si no baja sola en
          un minuto, la app revisa qué es cada una.{' '}
          <Link to="/sin-subir">Ver qué es</Link>
        </div>
      )}
      {nubeConfigurada && !enConsulta && estadoNube.retenidos.length > 0 && (
        <div className="aviso aviso-error">
          <strong>Hay cargas de este aparato que no se subieron, a propósito.</strong>{' '}
          {textoDeRetenidos(estadoNube.retenidos)} Avisale a Emmanuel: se resuelve desde Ajustes
          → «Cargas retenidas».
        </div>
      )}
      {nubeConfigurada && !enConsulta && estadoNube.turnosSinSubir.length > 0 && (
        <div className="aviso aviso-error">
          <strong>{textoDeTurnosSinSubir(estadoNube.turnosSinSubir)}</strong>{' '}
          {estadoNube.turnosSinSubir.length === 1 ? 'Está guardado' : 'Están guardados'} solo en este
          aparato. No borres la app ni sus datos, no cierres la sesión, y avisale a Emmanuel.
        </div>
      )}
      {nubeConfigurada && !enConsulta && estadoNube.rechazos.length > 0 && (
        <div className="aviso aviso-error">
          <strong>
            {estadoNube.rechazos.length === 1
              ? 'El servidor no aceptó un cambio.'
              : `El servidor no aceptó ${estadoNube.rechazos.length} cambios.`}
          </strong>{' '}
          Lo que se ve ahora en pantalla es lo que quedó en el servidor. Sacale una foto a este
          aviso y mandásela a Emmanuel.
          <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
            {estadoNube.rechazos.slice(-3).map((r) => (
              <li key={r.id}>{r.texto}</li>
            ))}
          </ul>
          <button className="boton-chico" onClick={descartarRechazos}>
            Entendido
          </button>
        </div>
      )}

      {error && <div className="aviso aviso-error">No se pudo cargar el catálogo: {error}</div>}

      <main className={anchoCompleto ? 'contenido contenido-ancho' : 'contenido'}>
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
          <Route path="/pedidos" element={<Pedidos />} />
          <Route
            path="/vencimientos"
            element={alMando ? <Vencimientos /> : <Navigate to="/caja" replace />}
          />
          <Route
            path="/ingreso"
            element={puedeVer('proveedores') ? <IngresoMercaderia /> : <Navigate to="/mi-actividad" replace />}
          />
          <Route
            path="/caja-grande"
            element={alMando ? <CajaGrande /> : <Navigate to="/caja" replace />}
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
            path="/revision-costos"
            element={alMando ? <RevisionCostos /> : <Navigate to="/caja" replace />}
          />
          <Route path="/sin-subir" element={<SinSubir />} />
          <Route
            path="/ventas-sin-codigo"
            element={alMando ? <VentasSinCodigo /> : <Navigate to="/caja" replace />}
          />
          <Route
            path="/unir-proveedores"
            element={alMando ? <UnirProveedores /> : <Navigate to="/caja" replace />}
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
