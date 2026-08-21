import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { desglosarGastos, resumirAnio } from '../lib/calculos'
import { mesLindo, numero, plata, porcentaje } from '../lib/formato'
import DesgloseGastos from './DesgloseGastos'

/**
 * El año completo: como viene en total, y mes por mes para ver la
 * evolucion. Solo se muestran los meses con movimiento, para que un año
 * recien empezado no aparezca lleno de ceros.
 */
export default function ReporteAnual({ anio }: { anio: string }) {
  const ventas = useLiveQuery(
    () => db.ventas.where('fecha').between(`${anio}-00`, `${anio}-99`).toArray(),
    [anio],
  )
  const movimientos = useLiveQuery(
    () => db.movimientos.where('fecha').between(`${anio}-00`, `${anio}-99`).toArray(),
    [anio],
  )

  const anual = useMemo(
    () => resumirAnio(anio, ventas ?? [], movimientos ?? []),
    [anio, ventas, movimientos],
  )
  const desglose = useMemo(() => desglosarGastos(movimientos ?? []), [movimientos])

  const masVendidos = useMemo(() => {
    const mapa = new Map<string, { desc: string; unidades: number; venta: number }>()
    for (const v of ventas ?? []) {
      const clave = v.codigo || v.descripcion
      const actual = mapa.get(clave) ?? { desc: v.descripcion, unidades: 0, venta: 0 }
      actual.unidades += v.cantidad
      actual.venta += v.total
      mapa.set(clave, actual)
    }
    return [...mapa.entries()].sort((a, b) => b[1].venta - a[1].venta).slice(0, 15)
  }, [ventas])

  if (!ventas || !movimientos) return <p className="vacio">Cargando…</p>
  if (anual.meses.length === 0) {
    return <p className="vacio">No hay nada cargado en {anio}.</p>
  }

  const { total } = anual
  const mesesConVentas = anual.meses.filter((m) => m.ventasTotales > 0).length

  return (
    <>
      <div className="tarjeta">
        <p className="tarjeta-titulo">Resultado del año {anio}</p>
        <div className="cifra">
          <div className={total.resultado >= 0 ? 'cifra-valor positivo' : 'cifra-valor negativo'}>
            {plata(total.resultado)}
          </div>
          <div className="cifra-etiqueta">
            {total.resultado >= 0 ? 'a favor' : 'en contra'} · {mesesConVentas}{' '}
            {mesesConVentas === 1 ? 'mes con ventas' : 'meses con ventas'}
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Cómo se arma el año</p>
        <div className="fila">
          <span className="fila-etiqueta">Ventas del año</span>
          <span className="fila-valor">{plata(total.ventasTotales)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">− Costo de la mercadería vendida</span>
          <span className="fila-valor negativo">−{plata(total.costoMercaderia)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">− Gastos variables</span>
          <span className="fila-valor negativo">−{plata(total.gastosVariables)}</span>
        </div>
        <div className="fila destacada">
          <span className="fila-etiqueta">Margen de contribución</span>
          <span
            className={
              total.margenContribucion >= 0 ? 'fila-valor positivo' : 'fila-valor negativo'
            }
          >
            {plata(total.margenContribucion)} · {porcentaje(total.margenContribucionPorcentual)}
          </span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">− Gastos fijos</span>
          <span className="fila-valor negativo">−{plata(total.gastosFijos)}</span>
        </div>
        <div className="fila destacada">
          <span className="fila-etiqueta">Resultado del año</span>
          <span className={total.resultado >= 0 ? 'fila-valor positivo' : 'fila-valor negativo'}>
            {plata(total.resultado)}
          </span>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">El año de un vistazo</p>
        <div className="fila">
          <span className="fila-etiqueta">Venta promedio por mes cerrado</span>
          <span className="fila-valor">{plata(anual.promedioMensual)}</span>
        </div>
        {anual.mejorMes && (
          <div className="fila">
            <span className="fila-etiqueta">Mejor mes</span>
            <span className="fila-valor">
              {mesLindo(anual.mejorMes.mes)} · {plata(anual.mejorMes.ventasTotales)}
            </span>
          </div>
        )}
        {anual.peorMes && (
          <div className="fila">
            <span className="fila-etiqueta">Mes más flojo</span>
            <span className="fila-valor">
              {mesLindo(anual.peorMes.mes)} · {plata(anual.peorMes.ventasTotales)}
            </span>
          </div>
        )}
        <div className="fila">
          <span className="fila-etiqueta">Operaciones · unidades</span>
          <span className="fila-valor">
            {numero(total.operaciones)} · {numero(total.unidades)}
          </span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Días con ventas</span>
          <span className="fila-valor">{numero(total.diasConVentas)}</span>
        </div>
      </div>

      {total.ventasSinCosto > 0 && (
        <div className="aviso aviso-ojo">
          <strong>{total.ventasSinCosto}</strong> ventas del año por{' '}
          <strong>{plata(total.montoSinCosto)}</strong> no tienen costo cargado. Ese monto entra
          entero como ganancia, así que el margen del año sale más alto de lo real.
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Mes por mes</p>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th className="num">Ventas</th>
                <th className="num">Margen</th>
                <th className="num">%</th>
                <th className="num">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {anual.meses.map((m) => (
                <tr key={m.mes}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {mesLindo(m.mes)}
                    {m.enCurso && <div className="item-sub">en curso</div>}
                  </td>
                  <td className="num">{plata(m.ventasTotales)}</td>
                  <td className="num">{plata(m.margenContribucion)}</td>
                  <td className="num">
                    {m.ventasTotales > 0 ? porcentaje(m.margenContribucionPorcentual, 0) : '—'}
                  </td>
                  <td className={m.resultado >= 0 ? 'num positivo' : 'num negativo'}>
                    {plata(m.resultado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
          Solo se muestran los meses con movimiento cargado. El mes en curso suma al total del
          año, pero no se usa para el promedio ni para elegir el mejor y el más flojo: todavía le
          faltan días.
        </p>
      </div>

      <DesgloseGastos desglose={desglose} titulo={`Gastos del año en detalle`} />

      <div className="tarjeta">
        <p className="tarjeta-titulo">Los que más facturaron en el año</p>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Un.</th>
                <th className="num">Venta</th>
              </tr>
            </thead>
            <tbody>
              {masVendidos.map(([codigo, d]) => (
                <tr key={codigo}>
                  <td style={{ whiteSpace: 'normal', minWidth: 150, maxWidth: 220 }}>
                    {d.desc}
                    <div className="item-sub">{codigo}</div>
                  </td>
                  <td className="num">{numero(d.unidades)}</td>
                  <td className="num">{plata(d.venta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
