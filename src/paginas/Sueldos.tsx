import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { ETIQUETA_CUENTA, conMotivo, db, type Movimiento } from '../db/db'
import { esVariablePorDefecto } from '../lib/borrarGasto'
import { fechaLinda, hoyISO, leerNumero, mesActualISO, mesLindo, plata } from '../lib/formato'
import {
  acuerdoEnPalabras,
  apodoPosible,
  apodosLimpios,
  comoSeCalcula,
  conAcuerdo,
  duenosParaRetiro,
  estadoDelSaldo,
  inicioDelAcuerdo,
  mesDelPago,
  parecenRetiro,
  parecenSueldo,
  personasParaSueldo,
  porQueNoCambia,
  problemaDelAcuerdo,
  resumenDeRetiros,
  resumenDeSueldos,
  textoDeConfirmacionSueldo,
  type AcuerdoSueldo,
  type CadaCuanto,
  type FichaSueldo,
  type PareceSueldo,
  type PersonaConSueldo,
  type RenglonRetiro,
  type RenglonSueldo,
} from '../lib/sueldos'
import { nubeConfigurada } from '../sync/config'
import { ETIQUETA_ROL, puedeDefinirSueldos, puedeTocarUsuarioConRol, tieneMiSueldo } from '../sync/permisos'
import { useSesion } from '../sync/useSesion'

export const MOTIVO_SUELDOS = 'Ordenado desde Sueldos'

type Gasto = RenglonSueldo['pagos'][number]

const dePila = (nombre: string) => nombre.split(' ')[0]
const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/**
 * Sueldos (19/11): cuánto se acordó con cada persona, cuánto lleva
 * cobrado en el mes y cuánto falta. Y los retiros de los dueños, por
 * persona.
 *
 * La ven los dueños y quien está de encargado. Lo acordado lo define solo
 * un dueño, y no está en la base de este aparato: se lee del servidor
 * cada vez que se abre la pantalla y no queda guardado (ver
 * sync/sueldosNube.ts). Lo pagado y lo retirado sí: son los gastos de
 * categoría SUELDOS y RETIRO SOCIOS de siempre, que ahora dicen de quién
 * son.
 */
export default function Sueldos() {
  const sesion = useSesion()
  const puedeDefinir = puedeDefinirSueldos(sesion.perfil)
  const [mes, setMes] = useState(mesActualISO())
  const [fichas, setFichas] = useState<FichaSueldo[] | null>(null)
  const [noSePudoLeer, setNoSePudoLeer] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [apodoOfrecido, setApodoOfrecido] = useState<{ persona: PersonaConSueldo; apodo: string } | null>(null)

  const leer = useCallback(async () => {
    setLeyendo(true)
    try {
      const { leerFichasDeSueldo } = await import('../sync/sueldosNube')
      setFichas(await leerFichasDeSueldo())
      setNoSePudoLeer(null)
    } catch (e) {
      setNoSePudoLeer(e instanceof Error ? e.message : String(e))
    } finally {
      setLeyendo(false)
    }
  }, [])

  useEffect(() => {
    if (nubeConfigurada) void leer()
  }, [leer])

  const usuarios = useLiveQuery(() => db.usuarios.toArray(), [])
  const pagos = useLiveQuery(() => db.movimientos.where('categoria').equals('SUELDOS').toArray(), [])
  const delMes = useLiveQuery(
    () => db.movimientos.where('fecha').between(`${mes}-00`, `${mes}-32`).toArray(),
    [mes],
  )

  const personas: PersonaConSueldo[] = useMemo(
    () =>
      (usuarios ?? []).map((u) => ({
        id: u.id,
        nombre: u.nombre,
        activo: u.activo,
        rol: u.rol,
        apodos: u.apodos,
        sinCuenta: u.sinCuenta,
      })),
    [usuarios],
  )
  // Se puede trabajar con los pagos aunque lo acordado no se haya podido
  // leer: sin fichas, la cuenta sale con «sin definir».
  const seIntentoLeer = fichas !== null || noSePudoLeer !== null
  const resumen = useMemo(
    () => (seIntentoLeer && pagos ? resumenDeSueldos(personas, fichas ?? [], pagos, mes) : null),
    [seIntentoLeer, personas, fichas, pagos, mes],
  )
  const retiros = useMemo(() => resumenDeRetiros(personas, delMes ?? [], mes), [personas, delMes, mes])
  const sueldosSugeridos = useMemo(() => parecenSueldo(delMes ?? [], personas, mes), [delMes, personas, mes])
  const retirosSugeridos = useMemo(() => parecenRetiro(delMes ?? [], personas, mes), [delMes, personas, mes])
  const elegibles = useMemo(() => personasParaSueldo(personas), [personas])
  const duenos = useMemo(() => duenosParaRetiro(personas), [personas])

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

  async function guardarAcuerdo(persona: PersonaConSueldo, monto: number, desde: string, cada: CadaCuanto) {
    setError(null)
    setAviso(null)
    try {
      const { guardarFichaDeSueldo, leerFichaDeSueldo } = await import('../sync/sueldosNube')
      // La ficha se guarda entera. Se vuelve a leer justo antes: si otro
      // dueño cargó un acuerdo mientras esta pantalla estaba abierta, se
      // agrega sobre esa y no sobre la copia vieja de acá.
      const ficha = await leerFichaDeSueldo(persona.id)
      const anteriores = ficha?.acuerdos ?? []
      const acuerdo: AcuerdoSueldo = { desde, monto, cada, anotadoEl: Date.now(), por: sesion.email }
      const noCambia = porQueNoCambia(anteriores, acuerdo)
      if (noCambia) {
        setError(`El sueldo de ${persona.nombre} no se guardó. ${noCambia}`)
        return
      }
      if (!confirm(textoDeConfirmacionSueldo(persona.nombre, acuerdo, anteriores))) return
      const nueva = conAcuerdo(ficha, persona, acuerdo)
      await guardarFichaDeSueldo(nueva)
      setFichas((antes) => [...(antes ?? []).filter((f) => f.id !== nueva.id), nueva])
      setEditando(null)
      setAviso(`Listo: quedó guardado el sueldo de ${persona.nombre}. ${acuerdoEnPalabras(acuerdo)}.`)
    } catch (e) {
      setError(`El sueldo de ${persona.nombre} no se guardó. ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** Un cambio sobre UN gasto, que queda en el historial con su motivo. */
  async function tocarPago(m: Pick<Movimiento, 'id'>, cambios: Partial<Movimiento>, queSeHizo: string) {
    setError(null)
    setApodoOfrecido(null)
    await conMotivo(MOTIVO_SUELDOS, () => db.movimientos.update(m.id, cambios))
    setAviso(queSeHizo)
  }

  const personaDe = (id: string) => personas.find((p) => p.id === id)
  const nombreDe = (id: string) => personaDe(id)?.nombre ?? 'esa persona'

  /**
   * Alguien dijo a mano de quién era un gasto que la app no supo
   * reconocer. Si el concepto tiene UNA palabra que puede ser su apodo,
   * se ofrece recordarla: la próxima vez la app ya sabe.
   */
  function ofrecerApodo(concepto: string, id: string) {
    const persona = personaDe(id)
    const apodo = apodoPosible(concepto, personas)
    if (!persona || !apodo) return
    if (!puedeTocarUsuarioConRol(sesion.perfil, persona.rol ?? 'empleado')) return
    setApodoOfrecido({ persona, apodo: conMayuscula(apodo) })
  }

  async function recordarApodo() {
    if (!apodoOfrecido) return
    const { persona, apodo } = apodoOfrecido
    const juntos = apodosLimpios([persona.apodos ?? '', apodo].join(', '))
    await conMotivo(MOTIVO_SUELDOS, () => db.usuarios.update(persona.id, { apodos: juntos }))
    setApodoOfrecido(null)
    setAviso(`Listo: de ahora en más, un gasto que diga «${apodo}» se reconoce como de ${persona.nombre}.`)
  }

  async function pasarASueldo(m: Gasto, id: string, sabiaDeQuien: boolean) {
    await tocarPago(
      m,
      { categoria: 'SUELDOS', esVariable: false, persona: id },
      `«${m.concepto}» pasó a sueldos, a nombre de ${nombreDe(id)}.`,
    )
    if (!sabiaDeQuien) ofrecerApodo(m.concepto, id)
  }

  async function pasarARetiro(m: Gasto, id: string, sabiaDeQuien: boolean) {
    await tocarPago(
      m,
      { categoria: 'RETIRO SOCIOS', esVariable: esVariablePorDefecto('RETIRO SOCIOS'), persona: id },
      `«${m.concepto}» pasó a retiros de socios, a nombre de ${nombreDe(id)}.`,
    )
    if (!sabiaDeQuien) ofrecerApodo(m.concepto, id)
  }

  return (
    <>
      <div className="silencio" style={{ marginBottom: 12 }}>
        <Link to="/gastos">Gastos</Link> / Sueldos
        {tieneMiSueldo(sesion.perfil) && (
          <>
            {' · '}
            <Link to="/mi-sueldo">Ver solo lo mío</Link>
          </>
        )}
      </div>
      <h2>Sueldos y retiros</h2>

      <div className="aviso aviso-ojo">
        <strong>Esta pantalla la ven los dueños y quien está de encargado.</strong> Lo que se acordó
        con cada persona no se guarda en este aparato: se lee del servidor cada vez.{' '}
        {puedeDefinir
          ? 'Cada persona ve solo lo suyo, en «Mi sueldo».'
          : 'Lo acordado lo define un dueño; desde acá podés decir de quién es cada pago y a qué mes corresponde.'}
      </div>

      {error && (
        <div className="aviso aviso-error" role="alert">
          {error}
        </div>
      )}
      {aviso && <div className="aviso aviso-ok">{aviso}</div>}
      {apodoOfrecido && (
        <div className="aviso aviso-ojo" role="status">
          ¿A {apodoOfrecido.persona.nombre} le dicen <strong>«{apodoOfrecido.apodo}»</strong>? Si lo
          recordás, la próxima vez la app ya sabe de quién es.
          <div className="botonera" style={{ marginTop: 8 }}>
            <button onClick={() => setApodoOfrecido(null)}>No</button>
            <button className="boton-principal" onClick={() => void recordarApodo()}>
              Sí, recordarlo
            </button>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <label htmlFor="mes-sueldos">Mes</label>
        <input id="mes-sueldos" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
      </div>

      {noSePudoLeer && (
        <div className="aviso aviso-error" role="alert">
          <strong>No se pudo leer lo acordado.</strong> {noSePudoLeer} Los pagos y los retiros sí se
          ven: están en este aparato.
          <div style={{ marginTop: 8 }}>
            <button className="boton-chico" onClick={() => void leer()} disabled={leyendo}>
              {leyendo ? 'Leyendo…' : 'Probar de nuevo'}
            </button>
          </div>
        </div>
      )}

      {!resumen ? (
        <p className="vacio">Leyendo los sueldos del servidor…</p>
      ) : (
        <>
          <section className="tarjeta" aria-label="Total del mes">
            <p className="tarjeta-titulo">Sueldos de {mesLindo(mes)}</p>
            <div className="fila">
              <span className="fila-etiqueta">Acordado</span>
              <span className="fila-valor">{fichas ? plata(resumen.acordado) : '—'}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Pagado</span>
              <span className="fila-valor">{plata(resumen.pagado)}</span>
            </div>
            <div className="fila destacada">
              <span className="fila-etiqueta">Falta pagar</span>
              <span className="fila-valor">{fichas ? plata(resumen.falta) : '—'}</span>
            </div>
            <p className="silencio" style={{ marginBottom: 0 }}>
              A quien cobra por semana le corresponde, en cada mes, su monto por los sábados que tiene
              el mes: cuatro o cinco. Cada pago cuenta para el mes de su fecha, salvo que se le diga
              otro.
            </p>
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
              seLeyo={fichas !== null}
              puedeDefinir={puedeDefinir && fichas !== null}
              editando={editando === r.persona.id}
              onEditar={(abrir) => {
                setEditando(abrir ? r.persona.id : null)
                setAviso(null)
              }}
              onGuardar={(monto, desde, cada) => void guardarAcuerdo(r.persona, monto, desde, cada)}
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
                            ).then(() => ofrecerApodo(m.concepto, id))
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

          {sueldosSugeridos.length > 0 && (
            <Sugeridos
              titulo="¿Esto es un sueldo?"
              etiqueta="Gastos que parecen un sueldo"
              explicacion={`Gastos de ${mesLindo(mes)} con otra categoría, que nombran a alguien del equipo o dicen «sueldo», «adelanto» o «semana». Si lo es, decí de quién: pasa a la categoría SUELDOS, como gasto fijo. Si no, no toques nada.`}
              lista={sueldosSugeridos}
              personas={elegibles}
              vacio="Sí, es sueldo de…"
              prefijo="Es sueldo de"
              onElegir={(m, id, sabia) => void pasarASueldo(m, id, sabia)}
            />
          )}
        </>
      )}

      <section className="tarjeta" aria-label="Retiros de los dueños">
        <p className="tarjeta-titulo">Retiros de los dueños · {mesLindo(mes)}</p>
        <div className="fila destacada">
          <span className="fila-etiqueta">Retirado en el mes</span>
          <span className="fila-valor">{plata(retiros.total)}</span>
        </div>
        <p className="silencio" style={{ marginBottom: 0 }}>
          Lo que cada dueño saca para él, del cajón o de otra cuenta: gastos de categoría RETIRO SOCIOS
          que dicen de quién son. No es un sueldo y no hay nada acordado contra qué comparar.
        </p>
        {duenos.length === 0 && (
          <p className="silencio" style={{ marginBottom: 0 }}>
            No hay ningún dueño en la lista. Un dueño que no usa la app se agrega sin cuenta: Ajustes →
            Usuarios del equipo → «+ Dueño que no usa la app».
          </p>
        )}
      </section>

      {retiros.renglones.map((r) => (
        <TarjetaRetiros
          key={r.persona.id}
          renglon={r}
          onQuitar={(m) =>
            void tocarPago(m, { persona: null }, `El retiro de ${plata(m.monto)} quedó sin asignar.`)
          }
        />
      ))}

      {retiros.sinAsignar.length > 0 && (
        <section className="tarjeta" aria-label="Retiros sin asignar">
          <p className="tarjeta-titulo">Retiros sin asignar · {retiros.sinAsignar.length}</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Están cargados como retiro de socios, pero no dicen de quién son.
          </p>
          <ul className="lista">
            {retiros.sinAsignar.map((m) => (
              <li className="item" key={m.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{m.concepto}</div>
                  <div className="item-sub">
                    {fechaLinda(m.fecha)}
                    {m.cuenta ? ` · ${ETIQUETA_CUENTA[m.cuenta]}` : ''}
                  </div>
                  <div className="item-sub">
                    <SelectorPersona
                      etiqueta={`De quién es el retiro ${m.concepto}`}
                      personas={duenos}
                      onElegir={(id) =>
                        void tocarPago(
                          m,
                          { persona: id },
                          `El retiro de ${plata(m.monto)} quedó a nombre de ${nombreDe(id)}.`,
                        ).then(() => ofrecerApodo(m.concepto, id))
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

      {retirosSugeridos.length > 0 && (
        <Sugeridos
          titulo="¿Esto es un retiro de un dueño?"
          etiqueta="Gastos que parecen un retiro"
          explicacion={`Gastos de ${mesLindo(mes)} con otra categoría, que nombran a un dueño o dicen «retiro». Si lo es, decí de quién: pasa a la categoría RETIRO SOCIOS. Si no, no toques nada.`}
          lista={retirosSugeridos}
          personas={duenos}
          vacio="Sí, es un retiro de…"
          prefijo="Es un retiro de"
          onElegir={(m, id, sabia) => void pasarARetiro(m, id, sabia)}
        />
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

/**
 * Gastos que parecen un sueldo (o un retiro) y están en otra categoría.
 * Si el concepto nombra a alguien, alcanza con un toque; si no, se elige.
 */
function Sugeridos({
  titulo,
  etiqueta,
  explicacion,
  lista,
  personas,
  vacio,
  prefijo,
  onElegir,
}: {
  titulo: string
  etiqueta: string
  explicacion: string
  lista: PareceSueldo[]
  personas: PersonaConSueldo[]
  vacio: string
  prefijo: string
  onElegir: (m: Gasto, id: string, sabiaDeQuien: boolean) => void
}) {
  return (
    <section className="tarjeta" aria-label={etiqueta}>
      <p className="tarjeta-titulo">
        {titulo} · {lista.length}
      </p>
      <p className="silencio" style={{ marginTop: 0 }}>
        {explicacion}
      </p>
      <ul className="lista">
        {lista.map(({ movimiento: m, sugerida }) => (
          <li className="item" key={m.id}>
            <div style={{ minWidth: 0 }}>
              <div className="item-titulo">{m.concepto}</div>
              <div className="item-sub">
                {fechaLinda(m.fecha)} · {m.categoria ?? 'OTROS'}
                {sugerida ? ` · parece de ${sugerida.nombre}` : ''}
              </div>
              <div className="item-sub" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {sugerida && personas.some((p) => p.id === sugerida.id) && (
                  <button
                    className="boton-chico"
                    aria-label={`${prefijo} ${sugerida.nombre} (${m.concepto})`}
                    onClick={() => onElegir(m, sugerida.id, true)}
                  >
                    Sí, es de {dePila(sugerida.nombre)}
                  </button>
                )}
                <SelectorPersona
                  etiqueta={`${prefijo} (${m.concepto})`}
                  vacio={sugerida ? 'Es de otra persona…' : vacio}
                  personas={personas}
                  onElegir={(id) => onElegir(m, id, sugerida?.id === id)}
                />
              </div>
            </div>
            <div className="item-monto">{plata(m.monto)}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TarjetaRetiros({
  renglon,
  onQuitar,
}: {
  renglon: RenglonRetiro
  onQuitar: (m: Gasto) => void
}) {
  const { persona, retirado, retiros } = renglon
  return (
    <section className="tarjeta" aria-label={`Retiros de ${persona.nombre}`}>
      <p className="tarjeta-titulo">
        {persona.nombre}
        {persona.rol ? ` · ${ETIQUETA_ROL[persona.rol]}` : ''}
        {!persona.activo && ' · ya no está activa'}
      </p>
      <div className="fila destacada">
        <span className="fila-etiqueta">
          Retiró en el mes{retiros.length > 0 ? ` (${retiros.length} ${retiros.length === 1 ? 'retiro' : 'retiros'})` : ''}
        </span>
        <span className="fila-valor">{plata(retirado)}</span>
      </div>
      {retiros.length > 0 && (
        <ul className="lista" style={{ marginTop: 12 }}>
          {retiros.map((m) => (
            <li className="item" key={m.id}>
              <div style={{ minWidth: 0 }}>
                <div className="item-titulo">{m.concepto}</div>
                <div className="item-sub">
                  {fechaLinda(m.fecha)}
                  {m.cuenta ? ` · ${ETIQUETA_CUENTA[m.cuenta]}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="item-monto">{plata(m.monto)}</div>
                <button className="boton-chico" style={{ marginTop: 4 }} onClick={() => onQuitar(m)}>
                  No es de {dePila(persona.nombre)}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TarjetaPersona({
  renglon,
  mes,
  ficha,
  seLeyo,
  puedeDefinir,
  editando,
  onEditar,
  onGuardar,
  onQuitar,
  onMoverDeMes,
}: {
  renglon: RenglonSueldo
  mes: string
  ficha: FichaSueldo | null
  /** Si lo acordado se pudo leer del servidor. Si no, no se sabe: no es «sin definir». */
  seLeyo: boolean
  /** Definir o cambiar lo acordado: solo un dueño, y con las fichas leídas. */
  puedeDefinir: boolean
  editando: boolean
  onEditar: (abrir: boolean) => void
  onGuardar: (monto: number, desde: string, cada: CadaCuanto) => void
  onQuitar: (m: Gasto) => void
  onMoverDeMes: (m: Gasto, mes: string) => void
}) {
  const { persona, acordado, detalle, pagado, pagos } = renglon
  const estado = estadoDelSaldo(renglon)
  const cuenta = comoSeCalcula(detalle, hoyISO())
  const [cada, setCada] = useState<CadaCuanto>('semana')
  const [monto, setMonto] = useState('')
  const [desdeMes, setDesdeMes] = useState(mes)
  const [desdeDia, setDesdeDia] = useState(`${mes}-01`)
  const [problema, setProblema] = useState<string | null>(null)

  function abrir() {
    // Arranca como está hoy. Quien todavía no tiene nada, por semana: es
    // como se cobra en el local.
    const como: CadaCuanto = detalle?.cada ?? 'semana'
    const actual = como === 'semana' ? detalle?.tramos[detalle.tramos.length - 1]?.monto : acordado
    setCada(como)
    setMonto(actual ? String(actual) : '')
    setDesdeMes(mes)
    setDesdeDia(`${mes}-01`)
    setProblema(null)
    onEditar(true)
  }

  function guardar() {
    const valor = monto.trim() === '' ? null : leerNumero(monto)
    const desde = cada === 'semana' ? desdeDia : desdeMes
    const mal = problemaDelAcuerdo(valor, desde, cada)
    setProblema(mal)
    if (mal || valor === null) return
    onGuardar(valor, desde, cada)
  }

  const acuerdos = [...(ficha?.acuerdos ?? [])].sort(
    (a, b) => inicioDelAcuerdo(b).localeCompare(inicioDelAcuerdo(a)) || b.anotadoEl - a.anotadoEl,
  )

  return (
    <section className="tarjeta" aria-label={`Sueldo de ${persona.nombre}`}>
      <p className="tarjeta-titulo">
        {persona.nombre}
        {persona.rol ? ` · ${ETIQUETA_ROL[persona.rol]}` : ''}
        {!persona.activo && ' · ya no está activa'}
      </p>
      {persona.apodos && (
        <p className="silencio" style={{ marginTop: 0 }}>
          En los gastos también figura como: {persona.apodos}.
        </p>
      )}
      <div className="fila">
        <span className="fila-etiqueta">Sueldo de {mesLindo(mes)}</span>
        <span className="fila-valor">
          {!seLeyo ? '—' : acordado === null ? 'Sin definir' : plata(acordado)}
        </span>
      </div>
      {seLeyo && cuenta && (
        <p className="silencio cuenta-del-sueldo" style={{ margin: '0 0 6px' }}>
          {cuenta}
        </p>
      )}
      <div className="fila">
        <span className="fila-etiqueta">
          Cobró en el mes{pagos.length > 0 ? ` (${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'})` : ''}
        </span>
        <span className="fila-valor">{plata(pagado)}</span>
      </div>
      {seLeyo && (
        <div className="fila destacada">
          <span className="fila-etiqueta">{estado.etiqueta}</span>
          <span className="fila-valor">{estado.monto === null ? '—' : plata(estado.monto)}</span>
        </div>
      )}

      {editando && puedeDefinir ? (
        <div style={{ marginTop: 12 }}>
          <div className="campo">
            <label htmlFor={`cada-${persona.id}`}>Cómo cobra</label>
            <select
              id={`cada-${persona.id}`}
              value={cada}
              onChange={(e) => setCada(e.target.value === 'mes' ? 'mes' : 'semana')}
            >
              <option value="semana">Por semana: un monto fijo cada sábado</option>
              <option value="mes">Por mes</option>
            </select>
          </div>
          <div className="grilla grilla-2">
            <div className="campo">
              <label htmlFor={`sueldo-${persona.id}`}>
                {cada === 'semana' ? 'Monto por semana' : 'Sueldo por mes'}
              </label>
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
              <label htmlFor={`desde-${persona.id}`}>
                {cada === 'semana' ? 'Desde qué día' : 'Desde qué mes'}
              </label>
              {cada === 'semana' ? (
                <input
                  id={`desde-${persona.id}`}
                  type="date"
                  value={desdeDia}
                  onChange={(e) => setDesdeDia(e.target.value)}
                />
              ) : (
                <input
                  id={`desde-${persona.id}`}
                  type="month"
                  value={desdeMes}
                  onChange={(e) => setDesdeMes(e.target.value)}
                />
              )}
            </div>
          </div>
          {problema && <div className="aviso aviso-error">{problema}</div>}
          <p className="silencio" style={{ marginTop: 0 }}>
            {cada === 'semana'
              ? 'Cuentan los sábados desde ese día: a cada mes le corresponde el monto por los sábados que tiene, cuatro o cinco. Lo anterior no cambia. Si el monto quedó mal, cargalo de nuevo con el mismo día: vale el último. Para dejar de pagarle, poné 0.'
              : 'Los meses anteriores a ese no cambian. Si empezó a mitad de mes, cargá primero ese mes con lo que le corresponde y después el mes siguiente con el sueldo entero. Para dejar de pagarle un sueldo, poné 0.'}
          </p>
          <div className="botonera">
            <button onClick={() => onEditar(false)}>Cancelar</button>
            <button className="boton-principal" onClick={guardar}>
              Guardar
            </button>
          </div>
        </div>
      ) : (
        puedeDefinir && (
          <button className="boton-chico" style={{ marginTop: 10 }} onClick={abrir}>
            {acordado === null ? 'Definir sueldo' : 'Cambiar el sueldo'}
          </button>
        )
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
                  No es de {dePila(persona.nombre)}
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
                {acuerdoEnPalabras(a)}
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
