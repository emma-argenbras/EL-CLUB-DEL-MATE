import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CATEGORIAS_GASTO,
  db,
  nuevoId,
  type CategoriaGasto,
  type Movimiento,
  type TipoMovimiento,
} from '../db/db'
import { fechaLinda, hoyISO, leerNumero, mesActualISO, mesLindo, plata } from '../lib/formato'

/** Gastos que suelen ser fijos: no cambian con cuánto se vende. */
const FIJOS_POR_DEFECTO: CategoriaGasto[] = [
  'ALQUILER',
  'SERVICIOS',
  'SUELDOS',
  'CONTADOR',
  'IMPUESTOS',
  'MANTENIMIENTO',
]

export default function Gastos() {
  const [mes, setMes] = useState(mesActualISO())
  const [mostrarForm, setMostrarForm] = useState(false)

  const movimientos = useLiveQuery(
    () =>
      db.movimientos
        .where('fecha')
        .between(`${mes}-00`, `${mes}-32`)
        .toArray(),
    [mes],
  )

  const { gastos, aCajaGrande, ingresos, fijos, variables } = useMemo(() => {
    const lista = movimientos ?? []
    const gastos = lista.filter(
      (m) => m.tipo === 'GASTO_CAJA_GRANDE' || m.tipo === 'EGRESO_CAJA',
    )
    return {
      gastos: gastos.sort((a, b) => b.fecha.localeCompare(a.fecha)),
      aCajaGrande: lista
        .filter((m) => m.tipo === 'A_CAJA_GRANDE')
        .reduce((s, m) => s + m.monto, 0),
      ingresos: lista
        .filter((m) => m.tipo === 'INGRESO_CAJA_GRANDE')
        .reduce((s, m) => s + m.monto, 0),
      fijos: gastos.filter((m) => !m.esVariable).reduce((s, m) => s + m.monto, 0),
      variables: gastos.filter((m) => m.esVariable).reduce((s, m) => s + m.monto, 0),
    }
  }, [movimientos])

  return (
    <>
      <h2>Gastos</h2>

      <div className="tarjeta">
        <label htmlFor="mes-gastos">Mes</label>
        <input
          id="mes-gastos"
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        />
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">{mesLindo(mes)}</p>
        <div className="fila">
          <span className="fila-etiqueta">Gastos variables</span>
          <span className="fila-valor">{plata(variables)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Gastos fijos</span>
          <span className="fila-valor">{plata(fijos)}</span>
        </div>
        <div className="fila destacada">
          <span className="fila-etiqueta">Total de gastos</span>
          <span className="fila-valor">{plata(fijos + variables)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Efectivo pasado a caja grande</span>
          <span className="fila-valor">{plata(aCajaGrande)}</span>
        </div>
        {ingresos > 0 && (
          <div className="fila">
            <span className="fila-etiqueta">Otros ingresos a caja grande</span>
            <span className="fila-valor">{plata(ingresos)}</span>
          </div>
        )}
      </div>

      {mostrarForm ? (
        <FormularioGasto onSalir={() => setMostrarForm(false)} />
      ) : (
        <button className="boton-principal" onClick={() => setMostrarForm(true)}>
          + Cargar gasto
        </button>
      )}

      <div className="tarjeta" style={{ marginTop: 12 }}>
        <p className="tarjeta-titulo">Detalle</p>
        {!movimientos ? (
          <p className="vacio">Cargando…</p>
        ) : gastos.length === 0 ? (
          <p className="vacio">Todavía no hay gastos cargados en {mesLindo(mes)}.</p>
        ) : (
          <ul className="lista">
            {gastos.map((m) => (
              <li className="item" key={m.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{m.concepto}</div>
                  <div className="item-sub">
                    {fechaLinda(m.fecha)} · {m.categoria ?? 'OTROS'}{' '}
                    <span className={m.esVariable ? 'chip' : 'chip chip-banco'}>
                      {m.esVariable ? 'VARIABLE' : 'FIJO'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="item-monto">{plata(m.monto)}</div>
                  <button
                    className="boton-chico"
                    style={{ marginTop: 4 }}
                    onClick={() => {
                      if (confirm(`¿Borrar el gasto "${m.concepto}"?`)) {
                        db.movimientos.delete(m.id)
                      }
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function FormularioGasto({ onSalir }: { onSalir: () => void }) {
  const [fecha, setFecha] = useState(hoyISO())
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaGasto>('PROVEEDORES')
  const [esVariable, setEsVariable] = useState(false)
  const [tipo, setTipo] = useState<TipoMovimiento>('GASTO_CAJA_GRANDE')

  function elegirCategoria(nueva: CategoriaGasto) {
    setCategoria(nueva)
    // Sugerimos fijo/variable segun la categoria, pero se puede cambiar.
    setEsVariable(!FIJOS_POR_DEFECTO.includes(nueva))
  }

  async function guardar() {
    const valor = leerNumero(monto)
    if (!valor || valor <= 0 || !concepto.trim()) return
    const registro: Movimiento = {
      id: nuevoId(),
      fecha,
      tipo,
      concepto: concepto.trim(),
      monto: valor,
      categoria,
      jornadaId: null,
      esVariable: tipo === 'INGRESO_CAJA_GRANDE' ? false : esVariable,
    }
    await db.movimientos.add(registro)
    onSalir()
  }

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Cargar movimiento</p>

      <div className="campo">
        <label htmlFor="g-tipo">Tipo</label>
        <select
          id="g-tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
        >
          <option value="GASTO_CAJA_GRANDE">Gasto pagado con caja grande</option>
          <option value="INGRESO_CAJA_GRANDE">Ingreso a caja grande</option>
        </select>
      </div>

      <div className="grilla grilla-2">
        <div className="campo">
          <label htmlFor="g-fecha">Fecha</label>
          <input
            id="g-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="g-monto">Monto</label>
          <input
            id="g-monto"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="g-concepto">Concepto</label>
        <input
          id="g-concepto"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Ej: ALQUILER, TURCO, LUZ E INTERNET"
        />
      </div>

      {tipo === 'GASTO_CAJA_GRANDE' && (
        <>
          <div className="campo">
            <label htmlFor="g-cat">Categoría</label>
            <select
              id="g-cat"
              value={categoria}
              onChange={(e) => elegirCategoria(e.target.value as CategoriaGasto)}
            >
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label>¿Cómo afecta al margen?</label>
            <div className="botonera">
              <button
                className={!esVariable ? 'pestana activa' : 'pestana'}
                onClick={() => setEsVariable(false)}
              >
                Fijo
              </button>
              <button
                className={esVariable ? 'pestana activa' : 'pestana'}
                onClick={() => setEsVariable(true)}
              >
                Variable
              </button>
            </div>
            <p className="silencio" style={{ marginTop: 6 }}>
              {esVariable
                ? 'Los gastos variables se restan del margen de contribución (suben si vendés más).'
                : 'Los gastos fijos se pagan igual vendas o no, y se restan después del margen.'}
            </p>
          </div>
        </>
      )}

      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar}>
          Guardar
        </button>
      </div>
    </div>
  )
}
