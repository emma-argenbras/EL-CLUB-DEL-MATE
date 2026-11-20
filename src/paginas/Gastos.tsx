import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../sync/useSesion'
import { estaAlMando, puedeVerSueldos } from '../sync/permisos'
import {
  duenosParaRetiro,
  personasConocidas,
  personasParaSueldo,
  type PersonaConSueldo,
  type QueParece,
} from '../lib/sueldos'
import SugerenciaDeCarga from '../componentes/SugerenciaDeCarga'
import { esVariablePorDefecto, permisoParaBorrarGasto } from '../lib/borrarGasto'
import { useCambiosSinGuardar } from '../lib/sinGuardar'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CATEGORIAS_GASTO,
  ETIQUETA_CUENTA,
  conMotivo,
  db,
  nuevoId,
  tipoSegunCuenta,
  type CategoriaGasto,
  type CuentaDePago,
  type Movimiento,
  type TipoMovimiento,
} from '../db/db'
import { fechaLinda, hoyISO, leerNumero, mesActualISO, mesLindo, plata } from '../lib/formato'

export default function Gastos() {
  const perfil = useSesion().perfil
  const alMando = estaAlMando(perfil)
  // De quien es cada pago de sueldo (19/11): el nombre sale de las cuentas
  // del equipo, que estan en todos los aparatos. Los montos acordados no.
  const usuarios = useLiveQuery(() => db.usuarios.toArray(), [])
  const nombreDe = useMemo(() => new Map((usuarios ?? []).map((u) => [u.id, u.nombre])), [usuarios])
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

  // Los turnos del mes, para saber si un gasto salió de una caja que ya
  // está cerrada (ver permisoParaBorrarGasto).
  const turnos = useLiveQuery(
    () => db.jornadas.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )
  const turnoDe = useMemo(() => new Map((turnos ?? []).map((j) => [j.id, j])), [turnos])

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

      {alMando && (
        <div className="tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <p className="tarjeta-titulo" style={{ margin: 0 }}>Caja grande</p>
            <div className="item-sub">Saldo, conteos, depósitos y la caja virtual.</div>
          </div>
          <Link className="boton-chico" to="/caja-grande">
            Ver caja grande
          </Link>
        </div>
      )}

      {alMando && (
        <div className="tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <p className="tarjeta-titulo" style={{ margin: 0 }}>📅 Vencimientos</p>
            <div className="item-sub">Alquiler, luz, contador, monotributo: avisa antes y carga el gasto.</div>
          </div>
          <Link className="boton-chico" to="/vencimientos">
            Ver agenda
          </Link>
        </div>
      )}

      {alMando && (
        <div className="tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <p className="tarjeta-titulo" style={{ margin: 0 }}>🧻 Pedidos de insumos</p>
            <div className="item-sub">Lo que anotaron que falta en el local.</div>
          </div>
          <Link className="boton-chico" to="/pedidos">
            Ver pedidos
          </Link>
        </div>
      )}

      {puedeVerSueldos(perfil) && (
        <div className="tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <p className="tarjeta-titulo" style={{ margin: 0 }}>Sueldos</p>
            <div className="item-sub">Lo acordado con cada persona, lo que lleva cobrado y lo que falta.</div>
          </div>
          <Link className="boton-chico" to="/sueldos">
            Ver sueldos
          </Link>
        </div>
      )}

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
        <FormularioGasto
          personas={(usuarios ?? []).map((u) => ({
            id: u.id,
            nombre: u.nombre,
            activo: u.activo,
            rol: u.rol,
            apodos: u.apodos,
            sinCuenta: u.sinCuenta,
          }))}
          onSalir={() => setMostrarForm(false)}
        />
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
            {gastos.map((m) => {
              const permiso = permisoParaBorrarGasto(m, m.jornadaId ? turnoDe.get(m.jornadaId) : undefined, alMando)
              return (
              <li className="item" key={m.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{m.concepto}</div>
                  <div className="item-sub">
                    {fechaLinda(m.fecha)} · {m.categoria ?? 'OTROS'}
                    {m.persona && nombreDe.has(m.persona)
                      ? // Un sueldo o un retiro es «de» alguien; otro pago con
                        // persona (una cuota que se le devuelve a un dueño) es «a» alguien.
                        `${m.categoria === 'SUELDOS' || m.categoria === 'RETIRO SOCIOS' ? ' de ' : ' a '}${nombreDe.get(m.persona)}`
                      : ''}{' '}
                    <span className={m.esVariable ? 'chip' : 'chip chip-banco'}>
                      {m.esVariable ? 'VARIABLE' : 'FIJO'}
                    </span>
                  </div>
                  {/* La cuenta se puede completar desde acá, sin borrar
                      y volver a cargar. Los movimientos viejos no la
                      tienen --el campo no existía--, y son justamente
                      los que hay que poder clasificar. */}
                  <div className="item-sub">
                    <select
                      aria-label={`Cuenta de ${m.concepto}`}
                      value={m.cuenta ?? ''}
                      onChange={(e) =>
                        db.movimientos.update(m.id, {
                          cuenta: (e.target.value || null) as CuentaDePago | null,
                        })
                      }
                      style={{ padding: '2px 6px', fontSize: '0.78rem', width: 'auto' }}
                    >
                      <option value="">¿De qué cuenta salió?</option>
                      {(Object.keys(ETIQUETA_CUENTA) as CuentaDePago[]).map((c) => (
                        <option key={c} value={c}>
                          {ETIQUETA_CUENTA[c]}
                        </option>
                      ))}
                    </select>
                    {/* La categoría también se corrige desde acá (20/11): la
                        compu del local se venía cargando como OTROS. Toma el
                        fijo o variable de la categoría nueva, y queda en el
                        historial. Solo quien está al mando. */}
                    {alMando && (
                      <select
                        aria-label={`Categoría de ${m.concepto}`}
                        value={m.categoria ?? 'OTROS'}
                        onChange={(e) => {
                          const nueva = e.target.value as CategoriaGasto
                          void conMotivo('Categoría corregida desde Gastos', () =>
                            db.movimientos.update(m.id, { categoria: nueva, esVariable: esVariablePorDefecto(nueva) }),
                          )
                        }}
                        style={{ padding: '2px 6px', fontSize: '0.78rem', width: 'auto', marginLeft: 6 }}
                      >
                        {CATEGORIAS_GASTO.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="item-monto">{plata(m.monto)}</div>
                  {permiso.puede ? (
                    <button
                      className="boton-chico"
                      style={{ marginTop: 4 }}
                      onClick={() => {
                        const pregunta = permiso.aviso
                          ? `${permiso.aviso}\n\n¿Borrar igual el gasto "${m.concepto}" de ${plata(m.monto)}?`
                          : `¿Borrar el gasto "${m.concepto}" de ${plata(m.monto)}?`
                        if (confirm(pregunta)) {
                          db.movimientos.delete(m.id)
                        }
                      }}
                    >
                      Borrar
                    </button>
                  ) : (
                    <div className="item-sub silencio" style={{ marginTop: 4, maxWidth: 150 }}>
                      {permiso.porQue}
                    </div>
                  )}
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function FormularioGasto({
  personas,
  onSalir,
}: {
  /** El equipo y los dueños: a quien se le puede cargar un sueldo o un retiro. */
  personas: PersonaConSueldo[]
  onSalir: () => void
}) {
  const activas = personasParaSueldo(personas)
  const duenos = duenosParaRetiro(personas)
  // Para la pregunta al cargar: también los dueños sin cuenta.
  const conocidas = personasConocidas(personas)
  const [fecha, setFecha] = useState(hoyISO())
  const [persona, setPersona] = useState('')
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaGasto>('PROVEEDORES')
  // Arranca como lo pide la categoría que viene elegida: la sugerencia
  // no puede depender de que alguien cambie de categoría.
  const [esVariable, setEsVariable] = useState(esVariablePorDefecto('PROVEEDORES'))
  const [tipo, setTipo] = useState<TipoMovimiento>('GASTO_CAJA_GRANDE')
  const [cuenta, setCuenta] = useState<CuentaDePago | ''>('')
  useCambiosSinGuardar('el gasto', [fecha, concepto, monto, categoria, esVariable, tipo, cuenta, persona])

  // De quien es: en un sueldo, cualquiera del equipo; en un retiro de
  // socios, un dueño (19/11).
  const paraElegir = categoria === 'SUELDOS' ? activas : categoria === 'RETIRO SOCIOS' ? duenos : []

  function elegirCategoria(nueva: CategoriaGasto, deQuien = '') {
    setCategoria(nueva)
    // Sugerimos fijo/variable segun la categoria, pero se puede cambiar.
    setEsVariable(esVariablePorDefecto(nueva))
    setPersona(deQuien)
  }

  function aplicarSugerencia(parece: QueParece, nueva: 'SUELDOS' | 'RETIRO SOCIOS') {
    elegirCategoria(nueva, parece.persona?.id ?? '')
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
      cuenta: cuenta || null,
      jornadaId: null,
      esVariable: tipo === 'INGRESO_CAJA_GRANDE' ? false : esVariable,
      // De quien es, solo en un pago de sueldo o en un retiro de socios.
      ...(tipo === 'GASTO_CAJA_GRANDE' && paraElegir.some((p) => p.id === persona) ? { persona } : {}),
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

      <div className="campo">
        <label htmlFor="g-cuenta">¿De qué cuenta salió? (opcional)</label>
        <select
          id="g-cuenta"
          value={cuenta}
          onChange={(e) => {
            const nueva = e.target.value as CuentaDePago | ''
            setCuenta(nueva)
            // Si sale del cajón del turno, es un egreso de esa caja y
            // no un gasto de caja grande: el tipo lo decide la cuenta.
            if (nueva && tipo !== 'INGRESO_CAJA_GRANDE') setTipo(tipoSegunCuenta(nueva))
          }}
        >
          <option value="">Sin especificar</option>
          {(Object.keys(ETIQUETA_CUENTA) as CuentaDePago[])
            .filter((c) => c !== 'cajon')
            .map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CUENTA[c]}
              </option>
            ))}
        </select>
        <p className="silencio" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
          Sirve para conciliar después cada cuenta con su resumen. Los gastos del cajón del
          turno se cargan desde Caja, en "Egresos".
        </p>
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
          <SugerenciaDeCarga
            concepto={concepto}
            categoria={categoria}
            persona={persona || null}
            personas={conocidas}
            onAplicar={aplicarSugerencia}
          />
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

          {paraElegir.length > 0 && (
            <div className="campo">
              <label htmlFor="g-persona">
                {categoria === 'SUELDOS' ? '¿De quién es el sueldo?' : '¿De quién es el retiro?'}
              </label>
              <select id="g-persona" value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option value="">Elegí…</option>
                {paraElegir.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

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
