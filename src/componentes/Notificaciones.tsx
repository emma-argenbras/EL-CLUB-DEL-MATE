import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuditoria } from '../lib/useAuditoria'
import { recordarUrgentes } from '../lib/recordatorios'

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

  const urgentes = hallazgos.filter((h) => h.nivel === 'critico').length

  return (
    <div className="notificaciones" ref={contenedor}>
      <button className="campana" onClick={() => setAbierto((a) => !a)} aria-label="Notificaciones">
        🔔
        {hallazgos.length > 0 && <span className="campana-contador">{hallazgos.length}</span>}
      </button>

      {abierto && (
        <div className="panel-notificaciones">
          {hallazgos.length === 0 ? (
            <p className="silencio" style={{ padding: 12, margin: 0 }}>
              Sin novedades. Todo en orden.
            </p>
          ) : (
            <>
              <ul className="lista">
                {hallazgos.slice(0, 8).map((h) => (
                  <li
                    className="item notificacion"
                    key={h.id}
                    onClick={() => {
                      navegar(h.ruta)
                      setAbierto(false)
                    }}
                  >
                    <div>
                      <div className="item-titulo">
                        {h.nivel === 'critico' ? '⚠️ ' : ''}
                        {h.titulo}
                      </div>
                      <div className="item-sub">{h.comoSeResuelve}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                className="boton-chico"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => {
                  navegar('/panel')
                  setAbierto(false)
                }}
              >
                Ver todo en el Panel
                {urgentes > 0 ? ` · ${urgentes} urgente${urgentes === 1 ? '' : 's'}` : ''}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
