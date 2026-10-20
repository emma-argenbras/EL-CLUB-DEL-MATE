import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Jornada } from '../db/db'
import { borrarJornada, resumenJornada } from '../db/borrarJornada'
import { fechaLinda, hoyISO, plata } from '../lib/formato'
import { useSesion } from '../sync/useSesion'

interface Fila {
  jornada: Jornada
  ventas: number
  totalVendido: number
  movimientos: number
  /** Hay otro turno cargado para la misma fecha y el mismo turno. */
  duplicado: boolean
}

/**
 * Los turnos de un dia, todos, con la posibilidad de borrar uno.
 *
 * Existe por dos motivos que van juntos.
 *
 * El primero: un turno se creaba y no se sacaba nunca. Para la
 * operacion de todos los dias esta bien --un turno trabajado se
 * corrige, no se borra-- pero deja sin salida el caso del mismo dia
 * cargado dos veces desde dos dispositivos.
 *
 * El segundo: cuando eso pasa, Caja no alcanza para arreglarlo. Caja
 * busca el turno con `.first()`, asi que de dos turnos "19/10 Tarde"
 * muestra uno solo y el otro queda invisible --pero sigue sumando,
 * porque los reportes cuentan las ventas por FECHA y no por turno--.
 * Esta pantalla los muestra a los dos y deja elegir cual se borra.
 */
export default function TurnosDelDia() {
  const sesion = useSesion()
  const [fecha, setFecha] = useState(hoyISO())
  const [mes, setMes] = useState(hoyISO().slice(0, 7))
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  /**
   * Los dias del mes que tienen mas de un turno cargado para el mismo
   * momento. Sin esto, encontrar los duplicados de agosto era entrar
   * dia por dia a ciegas, 31 veces.
   */
  const diasConRepetidos = useLiveQuery(async () => {
    const jornadas = await db.jornadas
      .where('fecha')
      .between(`${mes}-00`, `${mes}-32`)
      .toArray()
    const cuantos = new Map<string, number>()
    for (const j of jornadas) {
      const clave = `${j.fecha}|${j.turno}`
      cuantos.set(clave, (cuantos.get(clave) ?? 0) + 1)
    }
    const porDia = new Map<string, number>()
    for (const [clave, n] of cuantos) {
      if (n < 2) continue
      const dia = clave.split('|')[0]
      porDia.set(dia, (porDia.get(dia) ?? 0) + n - 1)
    }
    return [...porDia.entries()]
      .map(([dia, demas]) => ({ dia, demas }))
      .sort((a, b) => a.dia.localeCompare(b.dia))
  }, [mes])

  const filas = useLiveQuery(async (): Promise<Fila[]> => {
    const jornadas = await db.jornadas.where('fecha').equals(fecha).toArray()
    const cuantos = new Map<string, number>()
    for (const j of jornadas) cuantos.set(j.turno, (cuantos.get(j.turno) ?? 0) + 1)

    const filas: Fila[] = []
    for (const jornada of jornadas) {
      const resumen = await resumenJornada(jornada.id)
      filas.push({
        jornada,
        ventas: resumen?.ventas.length ?? 0,
        totalVendido: resumen?.totalVendido ?? 0,
        movimientos: resumen?.movimientos.length ?? 0,
        duplicado: (cuantos.get(jornada.turno) ?? 0) > 1,
      })
    }
    return filas.sort(
      (a, b) =>
        a.jornada.turno.localeCompare(b.jornada.turno) ||
        (a.jornada.horaApertura ?? '').localeCompare(b.jornada.horaApertura ?? ''),
    )
  }, [fecha])

  async function borrar(fila: Fila) {
    const { jornada } = fila
    const detalle = [
      `Vas a borrar el turno del ${fechaLinda(jornada.fecha)} ${jornada.turno === 'M' ? 'a la mañana' : 'a la tarde'}.`,
      ``,
      `· Caja inicial: ${plata(jornada.cajaInicial)}`,
      `· ${fila.ventas} ${fila.ventas === 1 ? 'venta' : 'ventas'} por ${plata(fila.totalVendido)}`,
      fila.movimientos > 0
        ? `· ${fila.movimientos} ${fila.movimientos === 1 ? 'movimiento de caja' : 'movimientos de caja'}`
        : null,
      jornada.horaApertura ? `· Abierto a las ${jornada.horaApertura}` : null,
      jornada.horaCierre ? `· Cerrado a las ${jornada.horaCierre}` : null,
      ``,
      `Se borra el turno y todo lo que tiene adentro. No se puede deshacer.`,
      ``,
      `El stock NO se devuelve: se descontó en el dispositivo donde se cargó la venta, así que devolverlo acá lo dejaría inflado.`,
    ]
      .filter((l) => l !== null)
      .join('\n')

    if (!confirm(detalle)) return

    const motivo = prompt(
      '¿Por qué se borra este turno? Queda escrito en el historial y no se puede editar después.',
      '',
    )
    if (motivo === null) return
    if (!motivo.trim()) {
      alert('Hace falta el motivo: sin eso, dentro de seis meses nadie va a saber por qué faltaba este turno.')
      return
    }

    setTrabajando(true)
    setMensaje(null)
    try {
      const r = await borrarJornada(jornada.id, motivo, sesion.email ?? null)
      setMensaje(
        `Turno borrado, con ${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'}${
          r.movimientos > 0 ? ` y ${r.movimientos} ${r.movimientos === 1 ? 'movimiento' : 'movimientos'}` : ''
        }. Queda en el historial con el motivo.`,
      )
    } catch (e) {
      setMensaje(`No se pudo borrar: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTrabajando(false)
    }
  }

  const hayDuplicados = (filas ?? []).some((f) => f.duplicado)

  return (
    <>
      <h2>Turnos del día</h2>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="t-fecha">Día</label>
          <input id="t-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <p className="silencio" style={{ marginBottom: 0 }}>
          Acá se ven <strong>todos</strong> los turnos de ese día, incluso si quedaron dos para el
          mismo. En Caja se ve uno solo.
        </p>
      </div>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="t-mes">Buscar días con turnos repetidos</label>
          <input id="t-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        {diasConRepetidos === undefined ? (
          <p className="silencio" style={{ marginBottom: 0 }}>Revisando…</p>
        ) : diasConRepetidos.length === 0 ? (
          <p className="silencio" style={{ marginBottom: 0 }}>
            Ningún día de ese mes tiene turnos repetidos.
          </p>
        ) : (
          <>
            <p className="silencio" style={{ marginTop: 0 }}>
              {diasConRepetidos.length === 1
                ? 'Un día tiene turnos repetidos:'
                : `${diasConRepetidos.length} días tienen turnos repetidos:`}{' '}
              tocá uno para verlo acá abajo.
            </p>
            <div className="botonera" style={{ flexWrap: 'wrap' }}>
              {diasConRepetidos.map((d) => (
                <button
                  key={d.dia}
                  className={d.dia === fecha ? 'boton-chico boton-principal' : 'boton-chico'}
                  onClick={() => setFecha(d.dia)}
                >
                  {fechaLinda(d.dia)} (+{d.demas})
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

      {hayDuplicados && (
        <div className="aviso aviso-error">
          Hay más de un turno cargado para el mismo momento del día. Casi siempre es el mismo día
          cargado desde dos dispositivos. Mirá cuál tiene las ventas que corresponden y borrá el
          otro.
        </div>
      )}

      {filas && filas.length === 0 && (
        <p className="vacio">No hay ningún turno cargado para ese día.</p>
      )}

      {(filas ?? []).map((f) => (
        <div className="tarjeta" key={f.jornada.id}>
          <p className="tarjeta-titulo">
            {f.jornada.turno === 'M' ? 'Mañana' : 'Tarde'}
            {f.duplicado && <span className="chip chip-alerta"> duplicado</span>}
          </p>
          <div className="fila">
            <span className="fila-etiqueta">Estado</span>
            <span className="fila-valor">
              {f.jornada.estado === 'cerrado' ? `Cerrado ${f.jornada.horaCierre ?? ''}` : 'Abierto'}
            </span>
          </div>
          <div className="fila">
            <span className="fila-etiqueta">Caja inicial</span>
            <span className="fila-valor">{plata(f.jornada.cajaInicial)}</span>
          </div>
          <div className="fila">
            <span className="fila-etiqueta">Ventas</span>
            <span className="fila-valor">
              {f.ventas} por {plata(f.totalVendido)}
            </span>
          </div>
          {f.movimientos > 0 && (
            <div className="fila">
              <span className="fila-etiqueta">Movimientos de caja</span>
              <span className="fila-valor">{f.movimientos}</span>
            </div>
          )}
          {f.jornada.vendedor && (
            <div className="fila">
              <span className="fila-etiqueta">Quien atendió</span>
              <span className="fila-valor">{f.jornada.vendedor}</span>
            </div>
          )}
          <button
            className="boton-peligro"
            style={{ width: '100%', marginTop: 10 }}
            disabled={trabajando}
            onClick={() => borrar(f)}
          >
            {trabajando ? 'Borrando…' : 'Borrar este turno'}
          </button>
        </div>
      ))}
    </>
  )
}
