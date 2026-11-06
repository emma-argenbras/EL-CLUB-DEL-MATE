import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuditoria } from '../lib/useAuditoria'
import { recordarUrgentes } from '../lib/recordatorios'
import { agruparPorPlazo, contarParaHoy, TITULO_PLAZO } from '../lib/agruparAvisos'

/**
 * Campana de avisos: la cara corta de la auditoria automatica.
 *
 * Sale del mismo motor que el Panel y que Mi dia (src/lib/auditoria.ts),
 * asi los tres dicen siempre lo mismo. Aca va solo el titulo de cada
 * hallazgo; el detalle y el "que hacer" estan en el Panel.
 */
export default function Notificaciones() {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()
  const { cargando, hallazgos } = useAuditoria()

  useEffect(() => {
    function afuera(evento: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', afuera)
    return () => document.removeEventListener('mousedown', afuera)
  }, [])

  // Recordatorio del navegador para lo urgente, una vez por dia.
  useEffect(() => {
    if (cargando) return
    recordarUrgentes(hallazgos)
  }, [cargando, hallazgos])

  // La campana cuenta solo lo de hoy (06/11): lo demas esta adentro.
  const paraHoy = contarParaHoy(hallazgos)

  return (
    <div className="notificaciones" ref={contenedor}>
      <button className="campana" onClick={() => setAbierto((a) => !a)} aria-label="Notificaciones">
        🔔
        {paraHoy > 0 && <span className="campana-contador">{paraHoy}</span>}
      </button>

      {abierto && (
        <div className="panel-notificaciones">
          {hallazgos.length === 0 ? (
            <p className="silencio" style={{ padding: 12, margin: 0 }}>
              Sin novedades. Todo en orden.
            </p>
          ) : (
            <>
              {agruparPorPlazo(hallazgos).map(({ plazo, hallazgos: delPlazo }) =>
                plazo === 'cuandoPuedas' ? (
                  <p className="silencio" key={plazo} style={{ padding: '8px 12px', margin: 0 }}>
                    {TITULO_PLAZO[plazo]}: {delPlazo.length}{' '}
                    {delPlazo.length === 1 ? 'aviso' : 'avisos'} de mantenimiento, en el Panel.
                  </p>
                ) : (
                  <div key={plazo}>
                    <p className="tarjeta-titulo" style={{ padding: '10px 12px 0', margin: 0 }}>
                      {TITULO_PLAZO[plazo]} · {delPlazo.length}
                    </p>
                    <ul className="lista">
                      {delPlazo.slice(0, 6).map((h) => (
                        <li
                          className="item notificacion"
                          key={h.id}
                          onClick={() => {
                            navegar(h.ruta)
                            setAbierto(false)
                          }}
                        >
                          <div className="item-titulo">{h.titulo}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
              <button
                className="boton-chico"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => {
                  navegar('/panel')
                  setAbierto(false)
                }}
              >
                Ver todo en el Panel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
