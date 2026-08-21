import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, productoVisible } from '../db/db'
import {
  costoDesactualizado,
  precioBajoCosto,
  resumirJornada,
  sinStock,
  totalArqueo,
} from '../lib/calculos'
import { plata } from '../lib/formato'
import { useEstadoNube } from '../sync/useEstadoNube'
import { useSesion } from '../sync/useSesion'
import { nubeConfigurada } from '../sync/config'

interface Alerta {
  clave: string
  texto: string
  detalle?: string
  nivel: 'aviso' | 'error'
  ir: () => void
}

/**
 * Campana de avisos: agrupa todo lo que conviene revisar (costos
 * vencidos, ventas sin costo, diferencias de caja, problemas de
 * sincronizacion) en un solo lugar, en vez de que quede escondido
 * dentro de cada pantalla.
 */
export default function Notificaciones() {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()
  const nube = useEstadoNube()
  const sesion = useSesion()
  const esOwner = sesion.perfil?.rol === 'owner'

  useEffect(() => {
    function afuera(evento: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', afuera)
    return () => document.removeEventListener('mousedown', afuera)
  }, [])

  const desactualizados = useLiveQuery(async () => {
    const todos = await db.productos.filter(productoVisible).toArray()
    return todos.filter((p) => p.activo !== false && costoDesactualizado(p)).length
  }, [])

  const agotados = useLiveQuery(async () => {
    const todos = await db.productos.filter(productoVisible).toArray()
    return todos.filter(sinStock).length
  }, [])

  const bajoCosto = useLiveQuery(async () => {
    const todos = await db.productos.filter(productoVisible).toArray()
    return todos.filter(precioBajoCosto).length
  }, [])

  const mesActual = new Date().toISOString().slice(0, 7)
  const ventasDelMes = useLiveQuery(
    () => db.ventas.where('fecha').between(`${mesActual}-00`, `${mesActual}-32`).toArray(),
    [mesActual],
  )
  const sinCostoDelMes = useMemo(() => {
    const lista = ventasDelMes ?? []
    const sin = lista.filter((v) => v.costoUnitario === null || v.costoUnitario === undefined)
    return { cantidad: sin.length, monto: sin.reduce((s, v) => s + v.total, 0) }
  }, [ventasDelMes])

  const ultimoCierre = useLiveQuery(async () => {
    const cerrados = await db.jornadas.where('estado').equals('cerrado').toArray()
    if (!cerrados.length) return null
    cerrados.sort((a, b) => (a.fecha + a.turno).localeCompare(b.fecha + b.turno))
    const ultima = cerrados[cerrados.length - 1]
    if (!ultima.arqueoCierre) return null
    const [ventas, movimientos] = await Promise.all([
      db.ventas.where('jornadaId').equals(ultima.id).toArray(),
      db.movimientos.where('jornadaId').equals(ultima.id).toArray(),
    ])
    const resumen = resumirJornada(ultima.cajaInicial, ventas, movimientos)
    const contado = totalArqueo(ultima.arqueoCierre)
    return { jornada: ultima, diferencia: contado - resumen.cierreEsperado }
  }, [])

  const solicitudesBorrado = useLiveQuery(
    () =>
      esOwner
        ? db.productos.filter((p) => !!p.solicitudBorrado).count()
        : Promise.resolve(0),
    [esOwner],
  )

  const alertas: Alerta[] = []

  if (bajoCosto && bajoCosto > 0) {
    alertas.push({
      clave: 'bajo-costo',
      texto: `${bajoCosto} ${bajoCosto === 1 ? 'producto se vende' : 'productos se venden'} al costo o por debajo`,
      detalle: 'Cada unidad que sale es plata perdida: hay que revisarles el precio de venta.',
      nivel: 'error',
      ir: () => navegar('/productos?bajoCosto=1'),
    })
  }

  if (esOwner && solicitudesBorrado && solicitudesBorrado > 0) {
    alertas.push({
      clave: 'solicitudes-borrado',
      texto: `${solicitudesBorrado} ${solicitudesBorrado === 1 ? 'solicitud' : 'solicitudes'} de archivado de producto`,
      detalle: 'Alguien del equipo pidió archivar un producto y espera tu autorización.',
      nivel: 'aviso',
      ir: () => navegar('/productos'),
    })
  }

  if (agotados && agotados > 0) {
    alertas.push({
      clave: 'sin-stock',
      texto: `${agotados} ${agotados === 1 ? 'producto se quedó' : 'productos se quedaron'} sin stock`,
      detalle: 'Registrando la compra al proveedor, el stock se actualiza solo.',
      nivel: 'error',
      ir: () => navegar('/productos?sinStock=1'),
    })
  }

  if (desactualizados && desactualizados > 0) {
    alertas.push({
      clave: 'costos',
      texto: `${desactualizados} productos con costo vencido`,
      detalle: 'El margen de contribución les queda inflado.',
      nivel: 'aviso',
      ir: () => navegar('/productos?alertas=1'),
    })
  }

  if (sinCostoDelMes.cantidad > 0) {
    alertas.push({
      clave: 'sin-costo-mes',
      texto: `${sinCostoDelMes.cantidad} ventas de este mes sin costo cargado`,
      detalle: `${plata(sinCostoDelMes.monto)} no entran bien en el margen del mes.`,
      nivel: 'aviso',
      ir: () => navegar('/reportes'),
    })
  }

  if (ultimoCierre && Math.abs(ultimoCierre.diferencia) > 0) {
    const dif = ultimoCierre.diferencia
    alertas.push({
      clave: 'diferencia-caja',
      texto: `Diferencia de caja en el último cierre: ${dif > 0 ? '+' : ''}${plata(dif)}`,
      detalle: `${ultimoCierre.jornada.fecha} · turno ${ultimoCierre.jornada.turno === 'M' ? 'mañana' : 'tarde'}`,
      nivel: 'error',
      ir: () => navegar('/caja'),
    })
  }

  if (nubeConfigurada && nube.estado === 'error') {
    alertas.push({
      clave: 'sync-error',
      texto: 'Hay un problema sincronizando con la nube',
      detalle: nube.error ?? undefined,
      nivel: 'error',
      ir: () => navegar('/ajustes'),
    })
  }

  if (nubeConfigurada && nube.estado === 'desconectado') {
    alertas.push({
      clave: 'sync-desconectado',
      texto: 'Este dispositivo no está vinculado a la nube',
      detalle: 'Los datos no se comparten con los demás dispositivos.',
      nivel: 'aviso',
      ir: () => navegar('/ajustes'),
    })
  }

  return (
    <div className="notificaciones" ref={contenedor}>
      <button
        className="campana"
        onClick={() => setAbierto((a) => !a)}
        aria-label="Notificaciones"
      >
        🔔
        {alertas.length > 0 && <span className="campana-contador">{alertas.length}</span>}
      </button>

      {abierto && (
        <div className="panel-notificaciones">
          {alertas.length === 0 ? (
            <p className="silencio" style={{ padding: 12, margin: 0 }}>
              Sin novedades. Todo en orden.
            </p>
          ) : (
            <ul className="lista">
              {alertas.map((a) => (
                <li
                  className="item notificacion"
                  key={a.clave}
                  onClick={() => {
                    a.ir()
                    setAbierto(false)
                  }}
                >
                  <div>
                    <div className="item-titulo">
                      {a.nivel === 'error' ? '⚠️ ' : ''}
                      {a.texto}
                    </div>
                    {a.detalle && <div className="item-sub">{a.detalle}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
