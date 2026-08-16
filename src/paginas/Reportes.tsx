import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { costoDesactualizado, resumirMes } from '../lib/calculos'
import { fechaLinda, mesActualISO, mesLindo, plata, porcentaje, numero } from '../lib/formato'

export default function Reportes() {
  const navegar = useNavigate()
  const [mes, setMes] = useState(mesActualISO())

  const ventas = useLiveQuery(
    () => db.ventas.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )
  const movimientos = useLiveQuery(
    () => db.movimientos.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )

  const resumen = useMemo(
    () => resumirMes(ventas ?? [], movimientos ?? []),
    [ventas, movimientos],
  )

  const porDia = useMemo(() => {
    const mapa = new Map<string, { venta: number; costo: number }>()
    for (const v of ventas ?? []) {
      const actual = mapa.get(v.fecha) ?? { venta: 0, costo: 0 }
      actual.venta += v.total
      actual.costo += (v.costoUnitario ?? 0) * v.cantidad
      mapa.set(v.fecha, actual)
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [ventas])

  const masVendidos = useMemo(() => {
    const mapa = new Map<string, { desc: string; unidades: number; venta: number; margen: number }>()
    for (const v of ventas ?? []) {
      const actual = mapa.get(v.codigo) ?? {
        desc: v.descripcion,
        unidades: 0,
        venta: 0,
        margen: 0,
      }
      actual.unidades += v.cantidad
      actual.venta += v.total
      if (v.costoUnitario != null) {
        actual.margen += (v.precioUnitario - v.costoUnitario) * v.cantidad
      }
      mapa.set(v.codigo, actual)
    }
    return [...mapa.entries()].sort((a, b) => b[1].venta - a[1].venta).slice(0, 12)
  }, [ventas])

  const productos = useLiveQuery(() => db.productos.toArray(), [])

  const aActualizar = useMemo(() => {
    if (!ventas || !productos) return { lista: [], monto: 0, montoTotal: 0 }
    const catalogo = new Map(productos.map((p) => [p.codigo, p]))
    const mapa = new Map<string, { desc: string; unidades: number; monto: number }>()
    let montoTotal = 0
    for (const v of ventas) {
      montoTotal += v.total
      const producto = v.codigo ? catalogo.get(v.codigo) : undefined
      if (producto && !costoDesactualizado(producto)) continue
      const actual = mapa.get(v.codigo || v.descripcion) ?? {
        desc: v.descripcion,
        unidades: 0,
        monto: 0,
      }
      actual.unidades += v.cantidad
      actual.monto += v.total
      mapa.set(v.codigo || v.descripcion, actual)
    }
    const lista = [...mapa.entries()].sort((a, b) => b[1].monto - a[1].monto)
    const monto = lista.reduce((s, [, d]) => s + d.monto, 0)
    return { lista, monto, montoTotal }
  }, [ventas, productos])

  const cargando = !ventas || !movimientos
  const sinDatos = !cargando && resumen.operaciones === 0

  return (
    <>
      <h2>Reportes</h2>

      <div className="tarjeta">
        <label htmlFor="mes-rep">Mes</label>
        <input id="mes-rep" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
      </div>

      {cargando ? (
        <p className="vacio">Cargando…</p>
      ) : sinDatos ? (
        <p className="vacio">No hay ventas cargadas en {mesLindo(mes)}.</p>
      ) : (
        <>
          {/* ---- El número que importa ---- */}
          <div className="tarjeta">
            <p className="tarjeta-titulo">Margen de contribución · {mesLindo(mes)}</p>
            <div className="cifra">
              <div
                className={
                  resumen.margenContribucion >= 0
                    ? 'cifra-valor positivo'
                    : 'cifra-valor negativo'
                }
              >
                {plata(resumen.margenContribucion)}
              </div>
              <div className="cifra-etiqueta">
                {porcentaje(resumen.margenContribucionPorcentual)} sobre la venta
              </div>
            </div>
          </div>

          {/* ---- Cómo se llega a ese número ---- */}
          <div className="tarjeta">
            <p className="tarjeta-titulo">Cómo se arma</p>
            <div className="fila">
              <span className="fila-etiqueta">Ventas en efectivo</span>
              <span className="fila-valor">{plata(resumen.ventasEfectivo)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Ventas por banco (tarjetas, transferencias)</span>
              <span className="fila-valor">{plata(resumen.ventasBanco)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">
                <strong>Ventas totales</strong>
              </span>
              <span className="fila-valor">{plata(resumen.ventasTotales)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">− Costo de la mercadería vendida</span>
              <span className="fila-valor negativo">−{plata(resumen.costoMercaderia)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">− Gastos variables</span>
              <span className="fila-valor negativo">−{plata(resumen.gastosVariables)}</span>
            </div>
            <div className="fila destacada">
              <span className="fila-etiqueta">Margen de contribución</span>
              <span
                className={
                  resumen.margenContribucion >= 0 ? 'fila-valor positivo' : 'fila-valor negativo'
                }
              >
                {plata(resumen.margenContribucion)}
              </span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">− Gastos fijos</span>
              <span className="fila-valor negativo">−{plata(resumen.gastosFijos)}</span>
            </div>
            <div className="fila destacada">
              <span className="fila-etiqueta">Resultado del mes</span>
              <span
                className={resumen.resultado >= 0 ? 'fila-valor positivo' : 'fila-valor negativo'}
              >
                {plata(resumen.resultado)}
              </span>
            </div>
            <p className="silencio" style={{ marginTop: 10 }}>
              {resumen.resultado >= 0
                ? 'El mes dio a favor: el margen alcanzó para cubrir los gastos fijos.'
                : `El mes dio en contra: faltaron ${plata(Math.abs(resumen.resultado))} para cubrir los gastos fijos.`}
            </p>
          </div>

          {/* ---- Advertencia de calidad de datos ---- */}
          {resumen.ventasSinCosto > 0 && (
            <div className="aviso aviso-ojo">
              <strong>{resumen.ventasSinCosto}</strong>{' '}
              {resumen.ventasSinCosto === 1 ? 'venta' : 'ventas'} por{' '}
              <strong>{plata(resumen.montoSinCosto)}</strong> no tienen precio de compra cargado.
              Ese monto entra completo como margen, así que el número real es más bajo. Cargá el
              costo en Productos para que la cuenta cierre.
            </div>
          )}

          {/* ---- Que actualizar para que el margen sea real ---- */}
          {aActualizar.lista.length > 0 && (
            <div className="tarjeta">
              <p className="tarjeta-titulo">Para que este margen sea real</p>
              <p className="silencio" style={{ marginBottom: 10 }}>
                <strong>{plata(aActualizar.monto)}</strong> de lo vendido en {mesLindo(mes)} (
                {aActualizar.montoTotal > 0
                  ? porcentaje((aActualizar.monto / aActualizar.montoTotal) * 100, 0)
                  : '—'}
                ) corresponde a productos con el costo de compra vencido o sin cargar. Actualizando
                estos primeros, el margen se corrige solo:
              </p>
              <ul className="lista">
                {aActualizar.lista.slice(0, 15).map(([codigo, d]) => (
                  <li
                    className="item notificacion"
                    key={codigo}
                    onClick={() => navegar('/productos?alertas=1')}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="item-titulo">{d.desc}</div>
                      <div className="item-sub">
                        {codigo || 'sin código'} · {numero(d.unidades)} un.
                      </div>
                    </div>
                    <div className="item-monto">{plata(d.monto)}</div>
                  </li>
                ))}
              </ul>
              {aActualizar.lista.length > 15 && (
                <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
                  Y {aActualizar.lista.length - 15} productos más.
                </p>
              )}
            </div>
          )}

          {/* ---- Actividad ---- */}
          <div className="tarjeta">
            <p className="tarjeta-titulo">Actividad</p>
            <div className="fila">
              <span className="fila-etiqueta">Operaciones</span>
              <span className="fila-valor">{numero(resumen.operaciones)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Unidades vendidas</span>
              <span className="fila-valor">{numero(resumen.unidades)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Días con ventas</span>
              <span className="fila-valor">{numero(resumen.diasConVentas)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Venta promedio por operación</span>
              <span className="fila-valor">
                {plata(
                  resumen.operaciones ? resumen.ventasTotales / resumen.operaciones : 0,
                )}
              </span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Venta promedio por día abierto</span>
              <span className="fila-valor">
                {plata(
                  resumen.diasConVentas ? resumen.ventasTotales / resumen.diasConVentas : 0,
                )}
              </span>
            </div>
          </div>

          {/* ---- Ranking ---- */}
          <div className="tarjeta">
            <p className="tarjeta-titulo">Los que más facturan</p>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Un.</th>
                    <th className="num">Venta</th>
                    <th className="num">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {masVendidos.map(([codigo, d]) => (
                    <tr key={codigo}>
                      <td
                        style={{
                          whiteSpace: 'normal',
                          minWidth: 150,
                          maxWidth: 220,
                        }}
                      >
                        {d.desc}
                        <div className="item-sub">{codigo}</div>
                      </td>
                      <td className="num">{numero(d.unidades)}</td>
                      <td className="num">{plata(d.venta)}</td>
                      <td className="num">{plata(d.margen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- Día por día ---- */}
          <div className="tarjeta">
            <p className="tarjeta-titulo">Día por día</p>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Venta</th>
                    <th className="num">Costo</th>
                    <th className="num">Margen bruto</th>
                  </tr>
                </thead>
                <tbody>
                  {porDia.map(([fecha, d]) => (
                    <tr key={fecha}>
                      <td>{fechaLinda(fecha)}</td>
                      <td className="num">{plata(d.venta)}</td>
                      <td className="num">{plata(d.costo)}</td>
                      <td className="num">{plata(d.venta - d.costo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
