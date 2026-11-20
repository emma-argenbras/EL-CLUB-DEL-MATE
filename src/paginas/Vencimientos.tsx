import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CATEGORIAS_GASTO,
  db,
  ETIQUETA_CUENTA,
  type CategoriaGasto,
  type CuentaDePago,
  type Usuario,
  type Vencimiento,
} from '../db/db'
import {
  archivarVencimiento,
  engancharGasto,
  guardarVencimiento,
  marcarPagado,
  problemaDelVencimiento,
  type DatosVencimiento,
} from '../db/vencimientos'
import {
  agenda,
  AVISAR_DIAS_ANTES,
  CATEGORIAS_FIJAS,
  cuandoVence,
  cuotaDelPeriodo,
  estadoDeLaDeuda,
  gastosParaEnganchar,
  nombreDelMes,
  periodoDe,
  SUGERIDOS,
  type Situacion,
} from '../lib/vencimientos'
import { duenosParaRetiro } from '../lib/sueldos'
import { fechaLinda, hoyISO, leerNumero, plata } from '../lib/formato'
import { useCambiosSinGuardar } from '../lib/sinGuardar'

/**
 * La agenda de pagos que se repiten (punto 18 del pedido del 06/11). La
 * logica esta en lib/vencimientos.ts y db/vencimientos.ts.
 */
export default function Vencimientos() {
  const hoy = hoyISO()
  const datos = useLiveQuery(async () => {
    const [vencimientos, turnoAbierto, usuarios] = await Promise.all([
      db.vencimientos.toArray(),
      db.jornadas.where('estado').equals('abierto').first(),
      db.usuarios.toArray(),
    ])
    // Alcanza con los ultimos meses: la agenda mira el mes pasado y este.
    // Una deuda en cuotas, desde su primera cuota: para contar las pagadas.
    const desde = [`${periodoDe(hoy).slice(0, 4)}-01`, ...vencimientos.flatMap((v) => (v.cuotas ? [v.cuotas.periodo] : []))].sort()[0]
    const movimientos = await db.movimientos.where('fecha').aboveOrEqual(`${desde}-00`).toArray()
    return { vencimientos, movimientos, turnoAbierto: turnoAbierto ?? null, usuarios }
  }, [hoy])
  const [editando, setEditando] = useState<Vencimiento | 'nuevo' | null>(null)
  const [pagando, setPagando] = useState<string | null>(null)
  const [verArchivados, setVerArchivados] = useState(false)
  const [mensaje, setMensaje] = useState('')

  if (!datos) return <p className="vacio">Cargando la agenda…</p>

  const lista = agenda(datos.vencimientos, hoy, datos.movimientos)
  const archivados = datos.vencimientos.filter((v) => v.activo === false)
  const nombres = new Map(datos.usuarios.map((u) => [u.id, u.nombre]))
  const nombreDe = (id: string | null | undefined) => (id ? (nombres.get(id) ?? null) : null)
  const deudas = datos.vencimientos
    .filter((v) => v.activo !== false && v.cuotas)
    .map((v) => ({ v, e: estadoDeLaDeuda(v, datos.movimientos)! }))
  const delMes = lista.filter((s) => s.periodo === periodoDe(hoy))
  const pagadoMes = delMes.reduce((t, s) => t + (s.pago?.monto ?? 0), 0)
  const faltaMes = delMes
    .filter((s) => s.estado !== 'pagado')
    .reduce((t, s) => t + (s.vencimiento.montoAproximado ?? 0), 0)

  return (
    <>
      <h2>Vencimientos</h2>
      <p className="silencio" style={{ marginTop: 0 }}>
        Los pagos que se repiten todos los meses. La app avisa en el Panel unos días antes y el día
        que vencen. Al marcarlos pagados se carga el gasto, con su categoría.
      </p>

      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

      {lista.length > 0 && (
        <div className="grilla grilla-2">
          <div className="tarjeta cifra">
            <div className="cifra-valor">{plata(pagadoMes)}</div>
            <div className="cifra-etiqueta">pagado de la agenda en {nombreDelMes(periodoDe(hoy), hoy)}</div>
          </div>
          <div className="tarjeta cifra">
            <div className="cifra-valor">{plata(faltaMes)}</div>
            <div className="cifra-etiqueta">falta pagar este mes (aprox.)</div>
          </div>
        </div>
      )}

      {deudas.length > 0 && (
        <section className="tarjeta" aria-label="Deudas en cuotas">
          <p className="tarjeta-titulo">Deudas en cuotas</p>
          <ul className="lista">
            {deudas.map(({ v, e }) => (
              <li className="item" key={v.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">
                    {v.concepto}
                    {nombreDe(v.aQuien) ? ` · a ${nombreDe(v.aQuien)}` : ''}
                  </div>
                  <div className="item-sub">
                    {e.quedan === 0
                      ? `Cuotas ${v.cuotas!.primera} a ${v.cuotas!.total}: pagadas todas.`
                      : `Cuotas ${v.cuotas!.primera} a ${v.cuotas!.total}: ${e.pagadas} ${e.pagadas === 1 ? 'pagada' : 'pagadas'}, ${e.quedan === 1 ? 'queda 1' : `quedan ${e.quedan}`}. Sigue la ${e.siguiente}; la última vence en ${nombreDelMes(e.ultimoPeriodo, hoy)}.`}
                  </div>
                </div>
                <div className="item-monto">
                  {e.quedan === 0 ? '—' : e.montoQueda === null ? `${e.quedan} ${e.quedan === 1 ? 'cuota' : 'cuotas'}` : plata(e.montoQueda)}
                </div>
              </li>
            ))}
          </ul>
          <p className="silencio" style={{ marginBottom: 0 }}>
            Lo que queda es aproximado: las cuotas que faltan por el monto de la agenda.
          </p>
        </section>
      )}

      <div className="tarjeta">
        {lista.length === 0 ? (
          <p className="vacio">
            Todavía no hay nada en la agenda. Tocá «+ Agregar un vencimiento»: hay botones para los
            de siempre (alquiler, luz, internet, contador, monotributo, la tarjeta).
          </p>
        ) : (
          <ul className="lista">
            {lista.map((s) => (
              <RenglonVencimiento
                key={s.vencimiento.id}
                s={s}
                hoy={hoy}
                abierto={pagando === s.vencimiento.id}
                onPagar={() => setPagando(pagando === s.vencimiento.id ? null : s.vencimiento.id)}
                onEditar={() => setEditando(s.vencimiento)}
                nombreDe={nombreDe}
                movimientos={datos.movimientos}
                turnoAbierto={datos.turnoAbierto}
                onListo={(texto) => {
                  setPagando(null)
                  setMensaje(texto)
                }}
              />
            ))}
          </ul>
        )}

        {editando === null && (
          <div className="botonera" style={{ marginTop: 10 }}>
            <button className="boton-principal" onClick={() => setEditando('nuevo')}>
              + Agregar un vencimiento
            </button>
          </div>
        )}
      </div>

      {editando !== null && (
        <FormularioVencimiento
          vencimiento={editando === 'nuevo' ? null : editando}
          existentes={datos.vencimientos}
          duenos={duenosParaRetiro(datos.usuarios)}
          hoy={hoy}
          onSalir={(texto) => {
            setEditando(null)
            if (texto) setMensaje(texto)
          }}
        />
      )}

      {archivados.length > 0 && (
        <div className="tarjeta">
          <button className="boton-chico" onClick={() => setVerArchivados(!verArchivados)}>
            {verArchivados ? 'Ocultar' : 'Ver'} los que se sacaron de la agenda ({archivados.length})
          </button>
          {verArchivados && (
            <ul className="lista" style={{ marginTop: 8 }}>
              {archivados.map((v) => (
                <li className="item" key={v.id}>
                  <div>
                    <div className="item-titulo">{v.concepto}</div>
                    <div className="item-sub">El {v.dia} de cada mes</div>
                  </div>
                  <button className="boton-chico" onClick={() => void archivarVencimiento(v.id, true)}>
                    Volver a la agenda
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function RenglonVencimiento({
  s,
  hoy,
  abierto,
  onPagar,
  onEditar,
  nombreDe,
  movimientos,
  turnoAbierto,
  onListo,
}: {
  s: Situacion
  hoy: string
  abierto: boolean
  onPagar: () => void
  onEditar: () => void
  nombreDe: (id: string | null | undefined) => string | null
  movimientos: import('../db/db').Movimiento[]
  turnoAbierto: import('../db/db').Jornada | null
  onListo: (texto: string) => void
}) {
  const v = s.vencimiento
  const cuota = cuotaDelPeriodo(v, s.periodo)
  const chip =
    s.estado === 'pagado' || s.estado === 'terminado'
      ? 'chip'
      : s.estado === 'vencido' || s.dias <= 0
        ? 'chip chip-peligro'
        : s.estado === 'por-vencer'
          ? 'chip chip-alerta'
          : 'chip chip-banco'
  return (
    <li className="item" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="item-titulo">
            {v.concepto}{' '}
            <span className={chip} style={{ marginLeft: 4 }}>
              {cuandoVence(s)}
            </span>
          </div>
          <div className="item-sub">
            {s.estado === 'terminado'
              ? 'Ya pasó la última cuota.'
              : s.estado === 'pagado' && s.pago
                ? `Pagado el ${fechaLinda(s.pago.fecha)}: ${plata(s.pago.monto)} · ${s.proximo ? `el próximo vence el ${fechaLinda(s.proximo)}` : 'era la última cuota'}`
                : `${s.periodo !== periodoDe(hoy) ? `El de ${nombreDelMes(s.periodo, hoy)}: ` : ''}vence el ${fechaLinda(s.fecha)}${v.montoAproximado ? ` · aprox. ${plata(v.montoAproximado)}` : ''}`}
          </div>
          <div className="item-sub">
            {cuota !== null && v.cuotas && s.estado !== 'terminado' ? `Cuota ${cuota} de ${v.cuotas.total} · ` : ''}
            {nombreDe(v.aQuien) ? `A ${nombreDe(v.aQuien)} · ` : ''}
            {v.categoria} · {ETIQUETA_CUENTA[v.cuenta]}
            {v.notas ? ` · ${v.notas}` : ''}
          </div>
        </div>
        <div className="botonera" style={{ marginTop: 0, flexDirection: 'column', flex: 'none' }}>
          {s.estado !== 'pagado' && s.estado !== 'terminado' && (
            <button className="boton-chico" onClick={onPagar}>
              {abierto ? 'Cerrar' : 'Marcar pagado'}
            </button>
          )}
          <button className="boton-chico" onClick={onEditar}>
            Editar
          </button>
        </div>
      </div>
      {abierto && (
        <PagarVencimiento s={s} hoy={hoy} movimientos={movimientos} turnoAbierto={turnoAbierto} onListo={onListo} />
      )}
    </li>
  )
}

function PagarVencimiento({
  s,
  hoy,
  movimientos,
  turnoAbierto,
  onListo,
}: {
  s: Situacion
  hoy: string
  movimientos: import('../db/db').Movimiento[]
  turnoAbierto: import('../db/db').Jornada | null
  onListo: (texto: string) => void
}) {
  const v = s.vencimiento
  const [monto, setMonto] = useState(v.montoAproximado ? String(v.montoAproximado) : '')
  const [cuenta, setCuenta] = useState<CuentaDePago>(v.cuenta === 'cajon' && !turnoAbierto ? 'cajaGrande' : v.cuenta)
  const [fecha, setFecha] = useState(hoy)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const yaCargados = gastosParaEnganchar(v, [s.periodo, periodoDe(hoy)], movimientos)
  const mes = nombreDelMes(s.periodo, hoy)
  const cuota = cuotaDelPeriodo(v, s.periodo)
  const queSePaga = cuota !== null && v.cuotas ? `cuota ${cuota} de ${v.cuotas.total}, ${mes}` : mes

  async function pagar() {
    setGuardando(true)
    setError('')
    try {
      await marcarPagado(v, s.periodo, {
        fecha,
        monto: leerNumero(monto) ?? 0,
        cuenta,
        jornadaId: turnoAbierto?.id ?? null,
        hoy,
      })
      onListo(`${v.concepto} de ${mes}: pagado, y el gasto quedó cargado.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  async function enganchar(id: string) {
    try {
      await engancharGasto(id, v, s.periodo, hoy)
      onListo(`${v.concepto} de ${mes}: pagado con el gasto que ya estaba cargado.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="ticket-pago" style={{ marginTop: 8 }}>
      {error && <div className="aviso aviso-error">{error}</div>}
      {yaCargados.length > 0 && (
        <div className="aviso aviso-ojo">
          ¿Ya lo cargaste en Gastos? Elegilo y no se carga dos veces
          {v.cuotas ? ` (si está como OTROS, pasa a ${v.categoria})` : ''}:
          <ul className="lista" style={{ marginTop: 6 }}>
            {yaCargados.slice(0, 4).map((m) => (
              <li className="item" key={m.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{m.concepto}</div>
                  <div className="item-sub">
                    {fechaLinda(m.fecha)} · {plata(m.monto)}
                  </div>
                </div>
                <button className="boton-chico" onClick={() => void enganchar(m.id)}>
                  Es este
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grilla grilla-2">
        <div className="campo">
          <label htmlFor={`pv-monto-${v.id}`}>Cuánto se pagó ({queSePaga})</label>
          <input id={`pv-monto-${v.id}`} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`pv-fecha-${v.id}`}>Fecha</label>
          <input id={`pv-fecha-${v.id}`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`pv-cuenta-${v.id}`}>¿De dónde salió la plata?</label>
        <select id={`pv-cuenta-${v.id}`} value={cuenta} onChange={(e) => setCuenta(e.target.value as CuentaDePago)}>
          {(Object.keys(ETIQUETA_CUENTA) as CuentaDePago[]).map((c) => (
            <option key={c} value={c} disabled={c === 'cajon' && !turnoAbierto}>
              {ETIQUETA_CUENTA[c]}
              {c === 'cajon' && !turnoAbierto ? ' (no hay turno abierto)' : ''}
            </option>
          ))}
        </select>
      </div>
      <button className="boton-principal" disabled={guardando} onClick={() => void pagar()}>
        {guardando ? 'Guardando…' : `Pagado: cargar el gasto de ${plata(leerNumero(monto) ?? 0)}`}
      </button>
    </div>
  )
}

function FormularioVencimiento({
  vencimiento,
  existentes,
  duenos,
  hoy,
  onSalir,
}: {
  vencimiento: Vencimiento | null
  existentes: Vencimiento[]
  /** A quién puede deberle el local: los dueños, con cuenta o sin. */
  duenos: Usuario[]
  hoy: string
  onSalir: (texto?: string) => void
}) {
  const [concepto, setConcepto] = useState(vencimiento?.concepto ?? '')
  const [dia, setDia] = useState(vencimiento ? String(vencimiento.dia) : '')
  const [monto, setMonto] = useState(vencimiento?.montoAproximado != null ? String(vencimiento.montoAproximado) : '')
  const [categoria, setCategoria] = useState<CategoriaGasto>(vencimiento?.categoria ?? 'SERVICIOS')
  const [cuenta, setCuenta] = useState<CuentaDePago>(vencimiento?.cuenta ?? 'cajaGrande')
  const [esVariable, setEsVariable] = useState(vencimiento?.esVariable ?? false)
  const [avisar, setAvisar] = useState(String(vencimiento?.avisarDiasAntes ?? AVISAR_DIAS_ANTES))
  const [notas, setNotas] = useState(vencimiento?.notas ?? '')
  // Una deuda en cuotas (20/11): cuántas, desde cuál paga el local y a quién.
  const [enCuotas, setEnCuotas] = useState(!!vencimiento?.cuotas)
  const [total, setTotal] = useState(vencimiento?.cuotas ? String(vencimiento.cuotas.total) : '')
  const [primera, setPrimera] = useState(vencimiento?.cuotas ? String(vencimiento.cuotas.primera) : '1')
  const [periodoCuota, setPeriodoCuota] = useState(vencimiento?.cuotas?.periodo ?? periodoDe(hoy))
  const [aQuien, setAQuien] = useState(vencimiento?.aQuien ?? '')
  const [error, setError] = useState('')
  useCambiosSinGuardar('el vencimiento', [concepto, dia, monto, categoria, cuenta, esVariable, avisar, notas, enCuotas, total, primera, periodoCuota, aQuien])

  const datos: DatosVencimiento = {
    concepto,
    dia: Number(dia),
    montoAproximado: monto.trim() === '' ? null : (leerNumero(monto) ?? Number.NaN),
    categoria,
    cuenta,
    esVariable,
    avisarDiasAntes: Number(avisar),
    notas,
    cuotas: enCuotas ? { total: Number(total), primera: Number(primera), periodo: periodoCuota } : null,
    aQuien: aQuien || null,
  }
  const problema = problemaDelVencimiento(datos)
  const yaEstan = new Set(existentes.map((v) => v.concepto.toLowerCase()))

  function sugerido(sg: (typeof SUGERIDOS)[number]) {
    setConcepto(sg.concepto)
    setCategoria(sg.categoria)
    setDia(String(sg.dia))
    setEsVariable(!CATEGORIAS_FIJAS.includes(sg.categoria))
  }

  /** Una compra del local en cuotas que se le devuelve a un dueño. */
  function deudaEnCuotas() {
    setEnCuotas(true)
    setCategoria('EQUIPAMIENTO')
    setEsVariable(false)
  }

  async function guardar() {
    if (problema) {
      setError(problema)
      return
    }
    try {
      await guardarVencimiento(datos, hoy, vencimiento?.id)
      onSalir(`${datos.concepto.trim()}: ${vencimiento ? 'guardado' : 'agregado a la agenda'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function sacar() {
    if (!vencimiento) return
    if (!confirm(`¿Sacar «${vencimiento.concepto}» de la agenda? Sus pagos quedan en Gastos; se puede volver a poner.`)) return
    await archivarVencimiento(vencimiento.id, false)
    onSalir(`${vencimiento.concepto}: fuera de la agenda.`)
  }

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">{vencimiento ? `Editar: ${vencimiento.concepto}` : 'Agregar un vencimiento'}</p>
      {error && <div className="aviso aviso-error">{error}</div>}
      {!vencimiento && (
        <div className="botonera" style={{ marginTop: 0, marginBottom: 10 }}>
          {SUGERIDOS.filter((sg) => !yaEstan.has(sg.concepto.toLowerCase())).map((sg) => (
            <button key={sg.concepto} className="boton-chico" style={{ flex: 'none' }} onClick={() => sugerido(sg)}>
              {sg.concepto}
            </button>
          ))}
          <button className="boton-chico" style={{ flex: 'none' }} onClick={deudaEnCuotas}>
            Una deuda en cuotas
          </button>
        </div>
      )}
      <div className="campo">
        <label htmlFor="v-concepto">Qué se paga</label>
        <input id="v-concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Alquiler, luz, contador…" />
      </div>
      <div className="grilla grilla-2">
        <div className="campo">
          <label htmlFor="v-dia">Día del mes</label>
          <input id="v-dia" type="number" min={1} max={31} inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="v-monto">{enCuotas ? 'Monto de cada cuota (aprox.)' : 'Monto aproximado'}</label>
          <input id="v-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <div className="grilla grilla-2">
        <div className="campo">
          <label htmlFor="v-categoria">Categoría</label>
          <select
            id="v-categoria"
            value={categoria}
            onChange={(e) => {
              const c = e.target.value as CategoriaGasto
              setCategoria(c)
              setEsVariable(!CATEGORIAS_FIJAS.includes(c))
            }}
          >
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="v-cuenta">Sale de</label>
          <select id="v-cuenta" value={cuenta} onChange={(e) => setCuenta(e.target.value as CuentaDePago)}>
            {(Object.keys(ETIQUETA_CUENTA) as CuentaDePago[]).map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CUENTA[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grilla grilla-2">
        <div className="campo">
          <label htmlFor="v-avisar">Avisar días antes</label>
          <input id="v-avisar" type="number" min={0} max={15} inputMode="numeric" value={avisar} onChange={(e) => setAvisar(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="v-tipo">Gasto</label>
          <select id="v-tipo" value={esVariable ? 'variable' : 'fijo'} onChange={(e) => setEsVariable(e.target.value === 'variable')}>
            <option value="fijo">Fijo (se paga igual se venda o no)</option>
            <option value="variable">Variable</option>
          </select>
        </div>
      </div>
      <label className="campo" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={enCuotas} onChange={(e) => setEnCuotas(e.target.checked)} style={{ width: 'auto' }} />
        Es una deuda en cuotas
      </label>
      {enCuotas && (
        <div className="tarjeta" style={{ background: 'var(--crema)', marginBottom: 10 }}>
          <div className="grilla grilla-2">
            <div className="campo">
              <label htmlFor="v-cuotas">Cuotas en total</label>
              <input id="v-cuotas" type="number" min={1} max={120} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Ej: 6" />
            </div>
            <div className="campo">
              <label htmlFor="v-primera">La primera que paga el local</label>
              <input id="v-primera" type="number" min={1} inputMode="numeric" value={primera} onChange={(e) => setPrimera(e.target.value)} />
            </div>
          </div>
          <div className="grilla grilla-2">
            <div className="campo">
              <label htmlFor="v-periodo-cuota">Mes en que vence esa cuota</label>
              <input id="v-periodo-cuota" type="month" value={periodoCuota} onChange={(e) => setPeriodoCuota(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="v-a-quien">¿A quién se le debe?</label>
              <select id="v-a-quien" value={aQuien} onChange={(e) => setAQuien(e.target.value)}>
                <option value="">A nadie de la lista</option>
                {duenos.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="silencio" style={{ margin: 0, fontSize: '0.8rem' }}>
            Por ejemplo, algo del local que un dueño pagó con su tarjeta: si la primera cuota la pagó él
            y el local le devuelve de la 2 a la 6, poné 6 en total y 2 la primera. Antes de esa cuota no
            se reclama nada, y después de la última la deuda queda terminada.
          </p>
        </div>
      )}
      <div className="campo">
        <label htmlFor="v-notas">Notas</label>
        <input id="v-notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="N° de cliente, a quién se transfiere…" />
      </div>
      <div className="botonera">
        <button onClick={() => onSalir()}>Cancelar</button>
        <button className="boton-principal" onClick={() => void guardar()} disabled={problema !== null}>
          {vencimiento ? 'Guardar' : 'Agregar a la agenda'}
        </button>
      </div>
      {vencimiento && (
        <button className="boton-chico" style={{ marginTop: 8 }} onClick={() => void sacar()}>
          Sacar de la agenda
        </button>
      )}
    </div>
  )
}
