import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, productoVisible, type HistorialProducto } from '../db/db'
import { mesActualISO, mesLindo, numero } from '../lib/formato'
import { useAuditoria } from '../lib/useAuditoria'
import { estadoPermiso, pedirPermiso, recordarUrgentes } from '../lib/recordatorios'
import ListaHallazgos from '../componentes/ListaHallazgos'
import { useSesion } from '../sync/useSesion'

/**
 * Mi dia: lo que tengo para hacer hoy.
 *
 * Sale de la misma auditoria automatica que el Panel, pero filtrada a lo
 * que esta persona puede resolver. No muestra plata ni margen del
 * negocio: es una lista de tareas, no un reporte de ganancias.
 */
export default function MiActividad() {
  const sesion = useSesion()
  const mes = mesActualISO()
  const nombre = sesion.perfil?.nombre ?? 'Vos'
  const email = sesion.email
  const { cargando, hallazgos, pospuestos } = useAuditoria()
  const [permiso, setPermiso] = useState(estadoPermiso())

  // Avisa una vez por dia de lo urgente, si dieron permiso.
  useEffect(() => {
    if (cargando || permiso !== 'granted') return
    recordarUrgentes(hallazgos)
  }, [cargando, hallazgos, permiso])

  const productos = useLiveQuery(() => db.productos.filter(productoVisible).toArray(), [])

  const creadosEsteMes = useMemo(() => {
    if (!productos || !email) return 0
    return productos.filter(
      (p) =>
        p.creadoPor === email &&
        p.creadoEn &&
        new Date(p.creadoEn).toISOString().slice(0, 7) === mes,
    ).length
  }, [productos, email, mes])

  const historialMes = useLiveQuery(
    () =>
      email
        ? db.historialProductos
            .where('cuando')
            .between(new Date(`${mes}-01`).getTime(), new Date(`${mes}-31T23:59:59`).getTime())
            .filter((h) => h.quien === email)
            .toArray()
        : Promise.resolve<HistorialProducto[]>([]),
    [email, mes],
  )
  const actualizadosEsteMes = useMemo(
    () => new Set((historialMes ?? []).map((h) => h.codigo)).size,
    [historialMes],
  )

  const ventas = useLiveQuery(
    () => db.ventas.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )
  const masVendidos = useMemo(() => {
    const mapa = new Map<string, { desc: string; unidades: number }>()
    for (const v of ventas ?? []) {
      const clave = v.codigo || v.descripcion
      const actual = mapa.get(clave) ?? { desc: v.descripcion, unidades: 0 }
      actual.unidades += v.cantidad
      mapa.set(clave, actual)
    }
    return [...mapa.entries()].sort((a, b) => b[1].unidades - a[1].unidades).slice(0, 8)
  }, [ventas])

  const urgentes = hallazgos.filter((h) => h.nivel === 'critico').length

  return (
    <>
      <h2>Mi día</h2>

      {!cargando && (
        <div className={hallazgos.length === 0 ? 'aviso aviso-ok' : 'aviso aviso-ojo'}>
          {hallazgos.length === 0
            ? `¡Todo al día, ${nombre}! No te queda nada pendiente. 🎉`
            : `Hola ${nombre}, tenés ${hallazgos.length} ${hallazgos.length === 1 ? 'cosa' : 'cosas'} para revisar${urgentes > 0 ? `, ${urgentes} ${urgentes === 1 ? 'urgente' : 'urgentes'}` : ''}.`}
          {pospuestos > 0 &&
            ` (${pospuestos} pospuesto${pospuestos === 1 ? '' : 's'} para más adelante.)`}
        </div>
      )}

      {cargando ? <p className="vacio">Revisando…</p> : <ListaHallazgos hallazgos={hallazgos} />}

      {permiso === 'default' && (
        <div className="tarjeta" style={{ marginTop: 12 }}>
          <p className="tarjeta-titulo">Recordatorios</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Si querés, la app te avisa con una notificación cuando quede algo urgente — por
            ejemplo, un turno sin cerrar. Avisa mientras la app está abierta, y como mucho una vez
            por día por cada cosa.
          </p>
          <button
            className="boton-principal"
            style={{ width: '100%' }}
            onClick={async () => setPermiso(await pedirPermiso())}
          >
            Activar recordatorios
          </button>
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Tu trabajo de {mesLindo(mes)}</p>
        <div className="fila">
          <span className="fila-etiqueta">Productos que creaste</span>
          <span className="fila-valor">{numero(creadosEsteMes)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Productos que actualizaste</span>
          <span className="fila-valor">{numero(actualizadosEsteMes)}</span>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Lo más vendido este mes</p>
        {masVendidos.length === 0 ? (
          <p className="vacio">Todavía no hay ventas cargadas este mes.</p>
        ) : (
          <ul className="lista">
            {masVendidos.map(([codigo, d]) => (
              <li className="item" key={codigo}>
                <div className="item-titulo">{d.desc}</div>
                <div className="item-monto">{numero(d.unidades)} un.</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
