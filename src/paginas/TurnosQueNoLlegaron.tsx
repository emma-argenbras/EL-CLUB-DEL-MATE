import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { leerTurnosParaRearmar, rearmarTurnos } from '../db/rearmarTurnos'
import { totalArqueo } from '../lib/calculos'
import { fechaLinda, hoyISO, plata } from '../lib/formato'
import { MOTIVO_REARMADO, nombreDelTurno, textoDeConfirmacion, type TurnoParaRearmar } from '../lib/rearmarTurnos'

/**
 * Los turnos que tienen ventas pero no están en el servidor, con todo lo
 * que se puede rearmar de cada uno a la vista, y un botón para crearlos
 * de una vez (20/11). Ver lib/rearmarTurnos.ts.
 *
 * Primero la lista: de dónde sale cada número, si engancha con el turno
 * que sigue y qué no se puede rearmar. Recién abajo el botón, que pregunta
 * cuántos va a crear.
 */
export default function TurnosQueNoLlegaron() {
  const turnos = useLiveQuery(leerTurnosParaRearmar, [])
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  if (!turnos || (turnos.length === 0 && !mensaje)) return null
  const listos = turnos.filter((t) => !t.problema)

  async function rearmar() {
    if (!turnos || listos.length === 0) return
    if (!confirm(textoDeConfirmacion(turnos))) return
    setTrabajando(true)
    setMensaje(null)
    try {
      const r = await rearmarTurnos(turnos, hoyISO())
      const partes = [
        `${r.creados.length} ${r.creados.length === 1 ? 'turno rearmado' : 'turnos rearmados'}. Quedan en el historial con el motivo «${MOTIVO_REARMADO}».`,
        r.yaEstaban.length > 0
          ? `${r.yaEstaban.length} ya ${r.yaEstaban.length === 1 ? 'había llegado' : 'habían llegado'} mientras tanto: no se ${r.yaEstaban.length === 1 ? 'tocó' : 'tocaron'}.`
          : '',
      ]
      setMensaje({ ok: true, texto: partes.filter(Boolean).join(' ') })
    } catch (e) {
      setMensaje({ ok: false, texto: `No se pudo: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <section className="tarjeta" aria-label="Turnos que no llegaron al servidor">
      <p className="tarjeta-titulo">Turnos que no llegaron al servidor</p>
      {mensaje && <div className={mensaje.ok ? 'aviso aviso-ok' : 'aviso aviso-error'}>{mensaje.texto}</div>}
      {turnos.length > 0 && (
        <>
          <p className="silencio" style={{ marginTop: 0 }}>
            Sus ventas están, el turno no: falta con cuánto abrió, el conteo del cierre y la diferencia. Se rearman con
            el historial y con la caja de los turnos de al lado. Las ventas y los egresos no se tocan.
          </p>
          <ul className="lista">
            {turnos.map((t) => (
              <Renglon key={t.id} t={t} />
            ))}
          </ul>
          {listos.length > 0 ? (
            <button className="boton-principal" style={{ width: '100%', marginTop: 10 }} disabled={trabajando} onClick={() => void rearmar()}>
              {trabajando ? 'Rearmando…' : `Rearmar ${listos.length === 1 ? 'el turno' : `los ${listos.length} turnos`}`}
            </button>
          ) : (
            <p className="silencio" style={{ marginBottom: 0 }}>
              Ninguno se puede rearmar solo: hace falta mirarlo con Claude.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Renglon({ t }: { t: TurnoParaRearmar }) {
  return (
    <li className="item" style={{ display: 'block' }}>
      <div className="item-titulo">
        {fechaLinda(t.fecha)} a la {nombreDelTurno(t.turno)}
        {t.vendedor ? ` · ${t.vendedor}` : ''}
      </div>
      <div className="item-sub">
        {t.ventas} {t.ventas === 1 ? 'venta' : 'ventas'} por {plata(t.totalVendido)} ({plata(t.efectivo)} en efectivo)
        {t.egresos > 0 ? ` · egresos y pases ${plata(t.egresos)}` : ''}
        {t.horaApertura ? ` · abrió ${t.horaApertura}` : ''}
        {t.horaCierre ? ` · cerró ${t.horaCierre}` : ''}
      </div>
      {t.turnoPorLaHora && (
        <div className="item-sub">El horario sale de la hora de las ventas: el historial no lo tiene.</div>
      )}
      {t.problema ? (
        <div className="aviso aviso-error" style={{ marginTop: 6 }}>
          {t.problema} Este no se rearma.
        </div>
      ) : (
        <>
          <div className="item-sub">
            Abrió con <strong>{plata(t.cajaInicial ?? 0)}</strong>: {t.deDondeAbre}.
          </div>
          <div className="item-sub">
            Contó al cerrar <strong>{plata(totalArqueo(t.arqueoCierre))}</strong>: {t.deDondeCierra}.
          </div>
          <div className="item-sub">
            Tendría que haber dado {plata(t.esperado ?? 0)}:{' '}
            {t.diferencia === 0 ? (
              <strong>cierra justo</strong>
            ) : (
              <strong>
                {(t.diferencia ?? 0) > 0 ? 'sobran' : 'faltan'} {plata(Math.abs(t.diferencia ?? 0))}
              </strong>
            )}
            {t.diferencia !== 0 ? ' (queda esperando el visto bueno, como cualquier cierre)' : ''}.
          </div>
          {t.engancha && (
            <div className="item-sub">
              {t.engancha.igual
                ? `Engancha: el ${t.engancha.con} abrió con lo mismo.`
                : `No engancha: el ${t.engancha.con} abrió con ${plata(t.engancha.abrio)}.`}
            </div>
          )}
        </>
      )}
    </li>
  )
}
