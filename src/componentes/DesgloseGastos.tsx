import { useState } from 'react'
import type { DesgloseGastos as Desglose, GrupoGastos } from '../lib/calculos'
import { fechaLinda, plata, porcentaje } from '../lib/formato'

/**
 * Abre los dos totales de gastos del periodo para ver de que estan hechos:
 * primero por categoria, y tocando una categoria, el detalle de cada
 * gasto con su fecha.
 *
 * Se separan fijos de variables porque no pesan igual en la cuenta: los
 * variables se restan antes del margen de contribucion y los fijos
 * despues, para llegar al resultado.
 */
export default function DesgloseGastos({
  desglose,
  titulo = 'Gastos del mes en detalle',
}: {
  desglose: Desglose
  titulo?: string
}) {
  if (desglose.total === 0) {
    return (
      <div className="tarjeta">
        <p className="tarjeta-titulo">{titulo}</p>
        <p className="vacio">No hay gastos cargados en este período.</p>
      </div>
    )
  }

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">{titulo}</p>
      <p className="silencio" style={{ marginTop: 0, marginBottom: 12 }}>
        Total: <strong>{plata(desglose.total)}</strong>. Tocá una categoría para ver los
        gastos que la componen.
      </p>

      <Grupo
        titulo="Variables"
        explicacion="Suben cuando se vende más (comisiones, fletes, mercadería). Se restan antes del margen de contribución."
        grupo={desglose.variables}
        totalGeneral={desglose.total}
      />
      <Grupo
        titulo="Fijos"
        explicacion="Se pagan igual se venda mucho o poco (alquiler, sueldos, contador). Se restan después del margen, para llegar al resultado."
        grupo={desglose.fijos}
        totalGeneral={desglose.total}
      />
    </div>
  )
}

function Grupo({
  titulo,
  explicacion,
  grupo,
  totalGeneral,
}: {
  titulo: string
  explicacion: string
  grupo: GrupoGastos
  totalGeneral: number
}) {
  const [abierta, setAbierta] = useState<string | null>(null)

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="fila destacada" style={{ marginTop: 0 }}>
        <span className="fila-etiqueta">Gastos {titulo.toLowerCase()}</span>
        <span className="fila-valor">
          {plata(grupo.total)}
          {totalGeneral > 0 && (
            <span className="silencio" style={{ fontWeight: 400, fontSize: '0.8rem' }}>
              {' '}
              · {porcentaje((grupo.total / totalGeneral) * 100, 0)} del total
            </span>
          )}
        </span>
      </div>
      <p className="silencio" style={{ marginTop: 4, marginBottom: 8 }}>
        {explicacion}
      </p>

      {grupo.categorias.length === 0 ? (
        <p className="vacio" style={{ margin: 0 }}>
          Sin gastos {titulo.toLowerCase()} en este período.
        </p>
      ) : (
        <ul className="lista">
          {grupo.categorias.map((c) => (
            <li key={c.categoria} style={{ display: 'block' }}>
              <div
                className="item"
                style={{ cursor: 'pointer' }}
                onClick={() => setAbierta(abierta === c.categoria ? null : c.categoria)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">
                    {abierta === c.categoria ? '−' : '+'} {c.categoria}
                  </div>
                  <div className="item-sub">
                    {c.movimientos.length}{' '}
                    {c.movimientos.length === 1 ? 'movimiento' : 'movimientos'} ·{' '}
                    {porcentaje(c.porcentaje, 0)} de los {titulo.toLowerCase()}
                  </div>
                </div>
                <div className="item-monto">{plata(c.monto)}</div>
              </div>

              {abierta === c.categoria && (
                <div className="tabla-scroll" style={{ marginBottom: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th className="num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.movimientos.map((m, i) => (
                        <tr key={`${m.fecha}-${m.concepto}-${i}`}>
                          <td>{fechaLinda(m.fecha)}</td>
                          <td style={{ whiteSpace: 'normal', minWidth: 140 }}>
                            {m.concepto}
                            {m.deLaCaja && (
                              <span className="chip" style={{ marginLeft: 6 }}>
                                de la caja del turno
                              </span>
                            )}
                          </td>
                          <td className="num">{plata(m.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
