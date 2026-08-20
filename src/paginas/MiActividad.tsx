import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, productoVisible, type HistorialProducto } from '../db/db'
import { costoDesactualizado, sinStock } from '../lib/calculos'
import { mesActualISO, mesLindo, numero } from '../lib/formato'
import { useSesion } from '../sync/useSesion'

/**
 * El reporte de un empleado no muestra plata ni margen: muestra su propio
 * trabajo (que tan al dia esta con los costos, cuanto cargo este mes) y
 * lo que mas se vende, para que le sirva para hacer bien su trabajo sin
 * exponerle numeros de ganancia del negocio.
 */
export default function MiActividad() {
  const sesion = useSesion()
  const mes = mesActualISO()
  const nombre = sesion.perfil?.nombre ?? 'Vos'
  const email = sesion.email

  const productos = useLiveQuery(() => db.productos.filter(productoVisible).toArray(), [])
  const pendientes = useMemo(
    () => (productos ?? []).filter((p) => costoDesactualizado(p)),
    [productos],
  )
  const agotados = useMemo(() => (productos ?? []).filter(sinStock), [productos])

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
      const actual = mapa.get(v.codigo) ?? { desc: v.descripcion, unidades: 0 }
      actual.unidades += v.cantidad
      mapa.set(v.codigo, actual)
    }
    return [...mapa.entries()].sort((a, b) => b[1].unidades - a[1].unidades).slice(0, 8)
  }, [ventas])

  const cargando = !productos || !ventas
  const todoAlDia = pendientes.length === 0 && agotados.length === 0

  const pendiente: string[] = []
  if (pendientes.length > 0) {
    pendiente.push(
      `${pendientes.length} ${pendientes.length === 1 ? 'producto' : 'productos'} con el costo vencido o sin cargar`,
    )
  }
  if (agotados.length > 0) {
    pendiente.push(
      `${agotados.length} sin stock`,
    )
  }

  return (
    <>
      <h2>Mi día</h2>

      {!cargando && (
        <div className={todoAlDia ? 'aviso aviso-ok' : 'aviso aviso-ojo'}>
          {todoAlDia
            ? `¡Todo al día, ${nombre}! No queda nada pendiente. 🎉`
            : `Hola ${nombre}, quedan ${pendiente.join(' y ')}.`}
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Tu actividad de {mesLindo(mes)}</p>
        <div className="fila">
          <span className="fila-etiqueta">Productos que creaste</span>
          <span className="fila-valor">{numero(creadosEsteMes)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Productos que actualizaste</span>
          <span className="fila-valor">{numero(actualizadosEsteMes)}</span>
        </div>
        <div className="fila destacada">
          <span className="fila-etiqueta">Costos pendientes en todo el catálogo</span>
          <span className="fila-valor">{numero(pendientes.length)}</span>
        </div>
        <div className="fila destacada">
          <span className="fila-etiqueta">Productos sin stock</span>
          <span className="fila-valor">{numero(agotados.length)}</span>
        </div>
      </div>

      {agotados.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Sin stock — hay que reponer</p>
          <ul className="lista">
            {agotados.slice(0, 12).map((p) => (
              <li className="item" key={p.codigo}>
                <div className="item-titulo">{p.descripcion}</div>
                <span className="chip chip-alerta">
                  {p.stock === 0 ? 'SIN STOCK' : `${p.stock}`}
                </span>
              </li>
            ))}
          </ul>
          {agotados.length > 12 && (
            <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
              Y {agotados.length - 12} más — buscalos en Productos.
            </p>
          )}
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Para ponerse al día</p>
          <ul className="lista">
            {pendientes.slice(0, 12).map((p) => (
              <li className="item" key={p.codigo}>
                <div className="item-titulo">{p.descripcion}</div>
                <span className="chip chip-alerta">COSTO VIEJO</span>
              </li>
            ))}
          </ul>
          {pendientes.length > 12 && (
            <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
              Y {pendientes.length - 12} más — buscalos en Productos.
            </p>
          )}
        </div>
      )}

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
