import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ETIQUETA_CUENTA, db, type Movimiento } from '../db/db'
import { fechaLinda, hoyISO, mesActualISO, mesLindo, plata } from '../lib/formato'
import { comoSeCalcula, estadoDeMiSaldo, miSueldoDelMes, type FichaSueldo } from '../lib/sueldos'
import { nubeConfigurada } from '../sync/config'
import { useSesion } from '../sync/useSesion'

/**
 * «Mi sueldo» (19/11): lo de una persona en el mes, para que lo vea ella.
 * Lo que le corresponde (por semana, según los sábados del mes), lo que
 * lleva cobrado y lo que falta.
 *
 * Lo acordado sale de su ficha, que es la única que el servidor le deja
 * leer, y no se guarda en el aparato: esta pantalla se abre también en la
 * compu del local, que es de todos (ver sync/sueldosNube.ts). Lo cobrado
 * son los pagos de sueldo a su nombre, que ya están en el aparato como
 * cualquier otro gasto.
 */
export default function MiSueldo() {
  const sesion = useSesion()
  const uid = sesion.uid
  const [mes, setMes] = useState(mesActualISO())
  const [ficha, setFicha] = useState<FichaSueldo | null>(null)
  const [leida, setLeida] = useState(false)
  const [noSePudoLeer, setNoSePudoLeer] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)

  const leer = useCallback(async () => {
    if (!uid) return
    setLeyendo(true)
    try {
      const { leerFichaDeSueldo } = await import('../sync/sueldosNube')
      setFicha(await leerFichaDeSueldo(uid))
      setLeida(true)
      setNoSePudoLeer(null)
    } catch (e) {
      setNoSePudoLeer(e instanceof Error ? e.message : String(e))
    } finally {
      setLeyendo(false)
    }
  }, [uid])

  useEffect(() => {
    if (nubeConfigurada) void leer()
  }, [leer])

  const pagos = useLiveQuery(
    () =>
      uid
        ? db.movimientos
            .where('categoria')
            .equals('SUELDOS')
            .filter((m) => m.persona === uid)
            .toArray()
        : Promise.resolve<Movimiento[]>([]),
    [uid],
  )
  const mio = useMemo(
    () => (uid && pagos ? miSueldoDelMes(leida ? ficha : null, pagos, uid, mes) : null),
    [uid, pagos, leida, ficha, mes],
  )

  if (!nubeConfigurada || !uid) {
    return (
      <>
        <h2>Mi sueldo</h2>
        <div className="aviso aviso-ojo">
          Para ver tu sueldo hace falta tu cuenta, y este dispositivo no está conectado al servidor.
        </div>
      </>
    )
  }

  const estado = mio ? estadoDeMiSaldo(mio) : null
  const cuenta = mio && leida ? comoSeCalcula(mio.detalle, hoyISO()) : null

  return (
    <>
      <h2>Mi sueldo</h2>

      <div className="aviso aviso-ojo">
        <strong>Acá ves solo lo tuyo.</strong> Lo que se acordó con vos lo ven también los dueños y
        quien está de encargado, y no queda guardado en este aparato.
      </div>

      <div className="tarjeta">
        <label htmlFor="mes-mi-sueldo">Mes</label>
        <input
          id="mes-mi-sueldo"
          type="month"
          value={mes}
          onChange={(e) => e.target.value && setMes(e.target.value)}
        />
      </div>

      {noSePudoLeer && (
        <div className="aviso aviso-error" role="alert">
          <strong>No se pudo leer lo acordado.</strong> {noSePudoLeer} Lo que cobraste sí se ve: está
          en este aparato.
          <div style={{ marginTop: 8 }}>
            <button className="boton-chico" onClick={() => void leer()} disabled={leyendo}>
              {leyendo ? 'Leyendo…' : 'Probar de nuevo'}
            </button>
          </div>
        </div>
      )}

      {!mio || !estado || (!leida && !noSePudoLeer) ? (
        <p className="vacio">Leyendo tu sueldo…</p>
      ) : (
        <section className="tarjeta" aria-label="Mi sueldo del mes">
          <p className="tarjeta-titulo">Tu sueldo de {mesLindo(mes)}</p>
          <div className="fila">
            <span className="fila-etiqueta">
              {mio.detalle?.cada === 'semana' ? 'Te corresponde en el mes' : 'Acordado'}
            </span>
            <span className="fila-valor">
              {!leida ? '—' : mio.acordado === null ? 'Sin definir' : plata(mio.acordado)}
            </span>
          </div>
          {cuenta && (
            <p className="silencio cuenta-del-sueldo" style={{ margin: '0 0 6px' }}>
              {cuenta}
            </p>
          )}
          <div className="fila">
            <span className="fila-etiqueta">
              Cobraste
              {mio.pagos.length > 0 ? ` (${mio.pagos.length} ${mio.pagos.length === 1 ? 'pago' : 'pagos'})` : ''}
            </span>
            <span className="fila-valor">{plata(mio.pagado)}</span>
          </div>
          {leida && (
            <div className="fila destacada">
              <span className="fila-etiqueta">{estado.etiqueta}</span>
              <span className="fila-valor">{estado.monto === null ? '—' : plata(estado.monto)}</span>
            </div>
          )}
          {leida && mio.acordado === null && (
            <p className="silencio" style={{ marginBottom: 0 }}>
              Todavía no hay un sueldo cargado para vos en la app. Lo define un dueño.
            </p>
          )}

          {mio.pagos.length === 0 ? (
            <p className="silencio" style={{ marginBottom: 0 }}>
              No hay pagos a tu nombre en {mesLindo(mes)}. Si cobraste y no figura, avisale a quien
              lleva la administración: puede estar cargado sin tu nombre.
            </p>
          ) : (
            <ul className="lista" style={{ marginTop: 12 }}>
              {mio.pagos.map((m) => (
                <li className="item" key={m.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="item-titulo">{m.concepto}</div>
                    <div className="item-sub">
                      {fechaLinda(m.fecha)}
                      {m.cuenta ? ` · ${ETIQUETA_CUENTA[m.cuenta]}` : ''}
                      {m.periodoSueldo && m.periodoSueldo !== m.fecha.slice(0, 7)
                        ? ` · cuenta para ${mesLindo(m.periodoSueldo)}`
                        : ''}
                    </div>
                  </div>
                  <div className="item-monto">{plata(m.monto)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
