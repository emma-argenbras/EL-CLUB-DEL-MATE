import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { ETIQUETA_CUENTA, conMotivo, db, type Movimiento } from '../db/db'
import { fechaLinda, leerNumero, mesActualISO, mesLindo, plata } from '../lib/formato'
import {
  conAcuerdo,
  estadoDelSaldo,
  mesDelPago,
  parecenSueldo,
  personasParaSueldo,
  problemaDelAcuerdo,
  resumenDeSueldos,
  sueldoDelMes,
  textoDeConfirmacionSueldo,
  type FichaSueldo,
  type PersonaConSueldo,
  type RenglonSueldo,
} from '../lib/sueldos'
import { nubeConfigurada } from '../sync/config'
import { ETIQUETA_ROL } from '../sync/permisos'
import { useSesion } from '../sync/useSesion'

export const MOTIVO_SUELDOS = 'Ordenado desde Sueldos'

/**
 * Sueldos (19/11): cuánto se acordó con cada persona, cuánto lleva
 * cobrado en el mes y cuánto falta.
 *
 * La ve solo el dueño. Lo acordado no está en la base de este aparato:
 * se lee del servidor mientras la pantalla está abierta (ver
 * sync/sueldosNube.ts). Lo pagado sí: son los gastos de categoría SUELDOS
 * de siempre, que ahora dicen de quién son.
 */
export default function Sueldos() {
  const sesion = useSesion()
  const [mes, setMes] = useState(mesActualISO())
  const [fichas, setFichas] = useState<FichaSueldo[] | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)

  useEffect(() => {
    if (!nubeConfigurada) return
    let cancelar: (() => void) | null = null
    let vivo = true
    import('../sync/sueldosNube')
      .then(({ escucharFichasDeSueldo }) => {
        if (!vivo) return
        cancelar = escucharFichasDeSueldo(
          (lista, delServidor) => {
            setFichas(lista)
            setConfirmado(delServidor)
            setError(null)
          },
          (mensaje) => setError(mensaje),
        )
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    return () => {
      vivo = false
      cancelar?.()
    }
  }, [])

  const usuarios = useLiveQuery(() => db.usuarios.toArray(), [])
  const pagos = useLiveQuery(() => db.movimientos.where('categoria').equals('SUELDOS').toArray(), [])
  const delMes = useLiveQuery(
    () => db.movimientos.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )

  const personas: PersonaConSueldo[] = useMemo(
    () => (usuarios ?? []).map((u) => ({ id: u.id, nombre: u.nombre, activo: u.activo, rol: u.rol })),
    [usuarios],
  )
  const resumen = useMemo(
    () => (fichas && pagos ? resumenDeSueldos(personas, fichas, pagos, mes) : null),
    [personas, fichas, pagos, mes],
  )
  const sugeridos = useMemo(() => parecenSueldo(delMes ?? [], personas, mes), [delMes, personas, mes])
  const elegibles = useMemo(() => personasParaSueldo(personas), [personas])

  if (!nubeConfigurada) {
    return (
      <>
        <h2>Sueldos</h2>
        <div className="aviso aviso-ojo">
          Para llevar los sueldos hacen falta las cuentas del equipo, y este dispositivo no está
          conectado al servidor.
        </div>
      </>
    )
  }

  async function guardarAcuerdo(persona: PersonaConSueldo, monto: number, desde: string) {
    const ficha = fichas?.find((f) => f.id === persona.id) ?? null
    const anterior = sueldoDelMes(ficha?.acuerdos ?? [], desde)
    if (!confirm(textoDeConfirmacionSueldo(persona.nombre, monto, desde, anterior))) return
    setError(null)
    setAviso(null)
    try {
      const { guardarFichaDeSueldo } = await import('../sync/sueldosNube')
      const nueva = conAcuerdo(ficha, persona, {
        desde,
        monto,
        anotadoEl: Date.now(),
        por: sesion.email,
      })
      const como = await guardarFichaDeSueldo(nueva, (mensaje) => {
        setAviso(null)
        setError(`El sueldo de ${persona.nombre} no se guardó. ${mensaje}`)
      })
      setEditando(null)
      setAviso(
        como === 'guardado'
          ? `Listo: el sueldo de ${persona.nombre} quedó en ${plata(monto)} desde ${mesLindo(desde)}.`
          : `El sueldo de ${persona.nombre} quedó guardado en este aparato. Sube solo cuando haya conexión.`,
      )
    } catch (e) {
      setError(`El sueldo de ${persona.nombre} no se guardó. ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** Un cambio sobre UN gasto, que queda en el historial con su motivo. */
  async function tocarPago(m: Pick<Movimiento, 'id'>, cambios: Partial<Movimiento>, queSeHizo: string) {
    setError(null)
    await conMotivo(MOTIVO_SUELDOS, () => db.movimientos.update(m.id, cambios))
    setAviso(queSeHizo)
  }

  const nombreDe = (id: string) => personas.find((p) => p.id === id)?.nombre ?? 'esa persona'

  return (
    <>
      <div className="silencio" style={{ marginBottom: 12 }}>
        <Link to="/gastos">Gastos</Link> / Sueldos
      </div>
      <h2>Sueldos</h2>

      <div className="aviso aviso-ojo">
        <strong>Esta pantalla la ves solo vos.</strong> Lo que se acordó con cada persona no baja a
        los aparatos del resto. Lo que se le pagó sí se ve en Gastos, como siempre.
      </div>

      {error && (
        <div className="aviso aviso-error" role="alert">
          {error}
        </div>
      )}
      {aviso && <div className="aviso aviso-ok">{aviso}</div>}

      <div className="tarjeta">
        <label htmlFor="mes-sueldos">Mes</label>
        <input id="mes-sueldos" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
      </div>

      {!resumen ? (
        <p className="vacio">{error ? 'No se pudieron leer los sueldos.' : 'Leyendo los sueldos del servidor…'}</p>
      ) : (
        <>
          <section className="tarjeta" aria-label="Total del mes">
            <p className="tarjeta-titulo">Sueldos de {mesLindo(mes)}</p>
            <div className="fila">
              <span className="fila-etiqueta">Acordado</span>
              <span className="fila-valor">{plata(resumen.acordado)}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Pagado</span>
              <span className="fila-valor">{plata(resumen.pagado)}</span>
            </div>
            <div className="fila destacada">
              <span className="fila-etiqueta">Falta pagar</span>
              <span className="fila-valor">{plata(resumen.falta)}</span>
            </div>
            {!confirmado && (
              <p className="silencio" style={{ marginBottom: 0 }}>
                Sin conexión: se muestra lo último que este aparato leyó del servidor.
              </p>
            )}
          </section>

          {resumen.renglones.length === 0 && (
            <p className="vacio">
              Todavía no hay nadie en el equipo. Las cuentas se crean en Ajustes → Usuarios.
            </p>
          )}

          {resumen.renglones.map((r) => (
            <TarjetaPersona
              key={r.persona.id}
              renglon={r}
              mes={mes}
              ficha={fichas?.find((f) => f.id === r.persona.id) ?? null}
              editando={editando === r.persona.id}
              onEditar={(abrir) => {
                setEditando(abrir ? r.persona.id : null)
                setAviso(null)
              }}
              onGuardar={(monto, desde) => void guardarAcuerdo(r.persona, monto, desde)}
              onQuitar={(m) =>
                void tocarPago(m, { persona: null }, `El pago de ${plata(m.monto)} quedó sin asignar.`)
              }
              onMoverDeMes={(m, nuevo) =>
                void tocarPago(
                  m,
                  { periodoSueldo: nuevo === m.fecha.slice(0, 7) ? null : nuevo },
                  `El pago de ${plata(m.monto)} ahora cuenta como sueldo de ${mesLindo(nuevo)}.`,
                )
              }
            />
          ))}

          {resumen.sinAsignar.length > 0 && (
            <section className="tarjeta" aria-label="Pagos sin asignar">
              <p className="tarjeta-titulo">Pagos de sueldo sin asignar · {resumen.sinAsignar.length}</p>
              <p className="silencio" style={{ marginTop: 0 }}>
                Están cargados como sueldo, pero no dicen de quién son. Elegí la persona y pasan a su
                cuenta.
              </p>
              <ul className="lista">
                {resumen.sinAsignar.map((m) => (
                  <li className="item" key={m.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="item-titulo">{m.concepto}</div>
                      <div className="item-sub">
                        {fechaLinda(m.fecha)}
                        {m.cuenta ? ` · ${ETIQUETA_CUENTA[m.cuenta]}` : ''}
                      </div>
                      <div className="item-sub">
                        <SelectorPersona
                          etiqueta={`De quién es ${m.concepto}`}
                          personas={elegibles}
                          onElegir={(id) =>
                            void tocarPago(
                              m,
                              { persona: id },
                              `El pago de ${plata(m.monto)} quedó a nombre de ${nombreDe(id)}.`,
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="item-monto">{plata(m.monto)}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sugeridos.length > 0 && (
            <section className="tarjeta" aria-label="Gastos que parecen un sueldo">
              <p className="tarjeta-titulo">¿Esto es un sueldo? · {sugeridos.length}</p>
              <p className="silencio" style={{ marginTop: 0 }}>
                Gastos de {mesLindo(mes)} con otra categoría, que nombran a alguien del equipo o dicen
                «sueldo» o «adelanto». Si lo es, elegí de quién: pasa a la categoría SUELDOS, como gasto
                fijo. Si no, no toques nada.
              </p>
              <ul className="lista">
                {sugeridos.map(({ movimiento: m, sugerida }) => (
                  <li className="item" key={m.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="item-titulo">{m.concepto}</div>
                      <div className="item-sub">
                        {fechaLinda(m.fecha)} · {m.categoria ?? 'OTROS'}
                        {sugerida ? ` · parece de ${sugerida.nombre}` : ''}
                      </div>
                      <div className="item-sub">
                        <SelectorPersona
                          etiqueta={`Es sueldo de (${m.concepto})`}
                          vacio="Sí, es sueldo de…"
                          personas={elegibles}
                          onElegir={(id) =>
                            void tocarPago(
                              m,
                              { categoria: 'SUELDOS', esVariable: false, persona: id },
                              `«${m.concepto}» pasó a sueldos, a nombre de ${nombreDe(id)}.`,
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="item-monto">{plata(m.monto)}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}

function SelectorPersona({
  etiqueta,
  personas,
  onElegir,
  vacio = '¿De quién es?',
}: {
  etiqueta: string
  personas: PersonaConSueldo[]
  onElegir: (id: string) => void
  vacio?: string
}) {
  return (
    <select
      aria-label={etiqueta}
      value=""
      onChange={(e) => e.target.value && onElegir(e.target.value)}
      style={{ padding: '2px 6px', fontSize: '0.78rem', width: 'auto' }}
    >
      <option value="">{vacio}</option>
      {personas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </select>
  )
}

function TarjetaPersona({
  renglon,
  mes,
  ficha,
  editando,
  onEditar,
  onGuardar,
  onQuitar,
  onMoverDeMes,
}: {
  renglon: RenglonSueldo
  mes: string
  ficha: FichaSueldo | null
  editando: boolean
  onEditar: (abrir: boolean) => void
  onGuardar: (monto: number, desde: string) => void
  onQuitar: (m: RenglonSueldo['pagos'][number]) => void
  onMoverDeMes: (m: RenglonSueldo['pagos'][number], mes: string) => void
}) {
  const { persona, acordado, pagado, pagos } = renglon
  const estado = estadoDelSaldo(renglon)
  const [monto, setMonto] = useState('')
  const [desde, setDesde] = useState(mes)
  const [problema, setProblema] = useState<string | null>(null)

  function abrir() {
    setMonto(acordado ? String(acordado) : '')
    setDesde(mes)
    setProblema(null)
    onEditar(true)
  }

  function guardar() {
    const valor = monto.trim() === '' ? null : leerNumero(monto)
    const mal = problemaDelAcuerdo(valor, desde)
    setProblema(mal)
    if (mal || valor === null) return
    onGuardar(valor, desde)
  }

  const acuerdos = [...(ficha?.acuerdos ?? [])].sort(
    (a, b) => b.desde.localeCompare(a.desde) || b.anotadoEl - a.anotadoEl,
  )

  return (
    <section className="tarjeta" aria-label={`Sueldo de ${persona.nombre}`}>
      <p className="tarjeta-titulo">
        {persona.nombre}
        {persona.rol ? ` · ${ETIQUETA_ROL[persona.rol]}` : ''}
        {!persona.activo && ' · ya no está activa'}
      </p>
      <div className="fila">
        <span className="fila-etiqueta">Sueldo de {mesLindo(mes)}</span>
        <span className="fila-valor">{acordado === null ? 'Sin definir' : plata(acordado)}</span>
      </div>
      <div className="fila">
        <span className="fila-etiqueta">
          Cobró en el mes{pagos.length > 0 ? ` (${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'})` : ''}
        </span>
        <span className="fila-valor">{plata(pagado)}</span>
      </div>
      <div className="fila destacada">
        <span className="fila-etiqueta">{estado.etiqueta}</span>
        <span className="fila-valor">{estado.monto === null ? '—' : plata(estado.monto)}</span>
      </div>

      {editando ? (
        <div style={{ marginTop: 12 }}>
          <div className="grilla grilla-2">
            <div className="campo">
              <label htmlFor={`sueldo-${persona.id}`}>Sueldo por mes</label>
              <input
                id={`sueldo-${persona.id}`}
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="campo">
              <label htmlFor={`desde-${persona.id}`}>Desde qué mes</label>
              <input
                id={`desde-${persona.id}`}
                type="month"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
          </div>
          {problema && <div className="aviso aviso-error">{problema}</div>}
          <p className="silencio" style={{ marginTop: 0 }}>
            Los meses anteriores a ese no cambian. Para dejar de pagarle un sueldo, poné 0.
          </p>
          <div className="botonera">
            <button onClick={() => onEditar(false)}>Cancelar</button>
            <button className="boton-principal" onClick={guardar}>
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <button className="boton-chico" style={{ marginTop: 10 }} onClick={abrir}>
          {acordado === null ? 'Definir sueldo' : 'Cambiar el sueldo'}
        </button>
      )}

      {pagos.length > 0 && (
        <ul className="lista" style={{ marginTop: 12 }}>
          {pagos.map((m) => (
            <li className="item" key={m.id}>
              <div style={{ minWidth: 0 }}>
                <div className="item-titulo">{m.concepto}</div>
                <div className="item-sub">
                  {fechaLinda(m.fecha)}
                  {m.cuenta ? ` · ${ETIQUETA_CUENTA[m.cuenta]}` : ''}
                </div>
                <div className="item-sub">
                  <label style={{ fontSize: '0.78rem' }}>
                    Corresponde a{' '}
                    <input
                      type="month"
                      aria-label={`Mes al que corresponde ${m.concepto}`}
                      value={mesDelPago(m)}
                      onChange={(e) => e.target.value && e.target.value !== mesDelPago(m) && onMoverDeMes(m, e.target.value)}
                      style={{ padding: '2px 6px', fontSize: '0.78rem', width: 'auto' }}
                    />
                  </label>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="item-monto">{plata(m.monto)}</div>
                <button className="boton-chico" style={{ marginTop: 4 }} onClick={() => onQuitar(m)}>
                  No es de {persona.nombre.split(' ')[0]}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {acuerdos.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="silencio">Cómo fue cambiando el sueldo</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {acuerdos.map((a) => (
              <li key={`${a.desde}-${a.anotadoEl}`} className="silencio">
                Desde {mesLindo(a.desde)}: {a.monto === 0 ? 'sin sueldo' : plata(a.monto)}
                {a.anotadoEl > 0 &&
                  ` (cargado el ${new Date(a.anotadoEl).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
