import { type Arqueo } from '../db/db'
import { DENOMINACIONES, totalArqueo } from '../lib/calculos'
import { plata } from '../lib/formato'

interface Props {
  arqueo: Arqueo
  onCambiar: (arqueo: Arqueo) => void
  titulo: string
}

/**
 * Conteo de caja por cantidad de billetes.
 * En la planilla se cargaba el monto total por denominacion y habia
 * que hacer la cuenta a mano; aca se carga cuantos billetes hay
 * de cada uno y la app multiplica.
 */
export default function ArqueoCaja({ arqueo, onCambiar, titulo }: Props) {
  function cambiarBillete(denominacion: number, cantidadTexto: string) {
    const cantidad = Math.max(0, Math.floor(Number(cantidadTexto) || 0))
    onCambiar({
      ...arqueo,
      billetes: { ...arqueo.billetes, [String(denominacion)]: cantidad },
    })
  }

  function cambiarMonedas(texto: string) {
    onCambiar({ ...arqueo, monedas: Math.max(0, Number(texto) || 0) })
  }

  const total = totalArqueo(arqueo)

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">{titulo}</p>

      <div className="arqueo-fila">
        <span className="silencio" style={{ fontSize: '0.72rem' }}>
          BILLETE
        </span>
        <span className="silencio" style={{ fontSize: '0.72rem', textAlign: 'center' }}>
          CANTIDAD
        </span>
        <span className="silencio" style={{ fontSize: '0.72rem', textAlign: 'right' }}>
          SUBTOTAL
        </span>
      </div>

      {DENOMINACIONES.map((d) => {
        const cantidad = arqueo.billetes[String(d)] || 0
        return (
          <div className="arqueo-fila" key={d}>
            <span className="arqueo-denominacion">{plata(d)}</span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={cantidad || ''}
              placeholder="0"
              onChange={(e) => cambiarBillete(d, e.target.value)}
            />
            <span className="arqueo-subtotal">{cantidad ? plata(d * cantidad) : '—'}</span>
          </div>
        )
      })}

      <div className="arqueo-fila">
        <span className="arqueo-denominacion">Monedas</span>
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={arqueo.monedas || ''}
          placeholder="0"
          onChange={(e) => cambiarMonedas(e.target.value)}
        />
        <span className="arqueo-subtotal">{arqueo.monedas ? plata(arqueo.monedas) : '—'}</span>
      </div>

      <div className="fila destacada">
        <span className="fila-etiqueta">Total contado</span>
        <span className="fila-valor">{plata(total)}</span>
      </div>
    </div>
  )
}
