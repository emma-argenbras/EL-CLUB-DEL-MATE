import { useNavigate } from 'react-router-dom'
import { posponerHallazgo } from '../lib/useAuditoria'
import type { Hallazgo, NivelHallazgo } from '../lib/auditoria'

const CLASE_AVISO: Record<NivelHallazgo, string> = {
  critico: 'aviso aviso-error',
  importante: 'aviso aviso-ojo',
  aviso: 'aviso',
}

const ETIQUETA_NIVEL: Record<NivelHallazgo, string> = {
  critico: '⚠️ Urgente',
  importante: 'Importante',
  aviso: 'Para cuando puedas',
}

/** La fecha de mañana, para posponer un pendiente un dia. */
function manana(): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

/** Dentro de una semana. */
function proximaSemana(): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 7)
  return fecha.toISOString().slice(0, 10)
}

/**
 * Muestra los hallazgos de la auditoria como tarjetas accionables: que
 * pasa, por que importa, como se arregla, y un boton que lleva derecho a
 * la pantalla donde se arregla (ya filtrada).
 */
export default function ListaHallazgos({
  hallazgos,
  onIr,
  conPosponer = true,
}: {
  hallazgos: Hallazgo[]
  onIr?: () => void
  conPosponer?: boolean
}) {
  const navegar = useNavigate()

  return (
    <>
      {hallazgos.map((h) => (
        <div className={CLASE_AVISO[h.nivel]} key={h.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong>{h.titulo}</strong>
            <span className="chip" style={{ flexShrink: 0 }}>
              {ETIQUETA_NIVEL[h.nivel]}
            </span>
          </div>
          <p style={{ margin: '6px 0 0' }}>{h.detalle}</p>
          <p className="silencio" style={{ margin: '6px 0 0' }}>
            <strong>Qué hacer:</strong> {h.comoSeResuelve}
          </p>
          <div className="botonera" style={{ marginTop: 10 }}>
            <button
              className="boton-chico"
              onClick={() => {
                navegar(h.ruta)
                onIr?.()
              }}
            >
              Ir a resolverlo
            </button>
            {conPosponer && h.nivel !== 'critico' && (
              <button
                className="boton-chico"
                title="Deja de mostrarse hasta esa fecha"
                onClick={() => posponerHallazgo(h.id, h.nivel === 'aviso' ? proximaSemana() : manana())}
              >
                {h.nivel === 'aviso' ? 'Recordar en una semana' : 'Recordar mañana'}
              </button>
            )}
          </div>
        </div>
      ))}
      {hallazgos.length === 0 && (
        <div className="aviso aviso-ok" style={{ marginBottom: 0 }}>
          Todo en orden. No hay nada pendiente para hoy. 🎉
        </div>
      )}
    </>
  )
}
