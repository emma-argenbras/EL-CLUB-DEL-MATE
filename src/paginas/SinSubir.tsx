import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEstadoNube } from '../sync/useEstadoNube'
import { useSesion } from '../sync/useSesion'
import { estaAlMando } from '../sync/permisos'
import type { RenglonRevision, Resultado } from '../sync/sinSubir'

/**
 * Que es lo que el aviso «Hay N cosas sin subir» estaba contando, y que
 * se hizo con cada cosa (ver sync/sinSubir.ts). La revision corre sola
 * cuando el numero no baja; desde aca se puede correr en el momento.
 */

const GRUPOS: { resultado: Resultado; titulo: string; explicacion: string }[] = [
  {
    resultado: 'rechazado',
    titulo: 'El servidor no las acepta',
    explicacion:
      'Están en este aparato y no entran. Son las únicas que siguen contando en el aviso. Mandale una foto de esto a Emmanuel.',
  },
  {
    resultado: 'subido',
    titulo: 'Se subieron ahora',
    explicacion: 'Estaban solo en este aparato. Ya están en el servidor y las ven los demás.',
  },
  {
    resultado: 'ya-estaba',
    titulo: 'Ya estaban en el servidor',
    explicacion: 'Llegaron mientras se revisaba. No hizo falta hacer nada.',
  },
  {
    resultado: 'sacado-de-aca',
    titulo: 'Se habían borrado desde otro aparato',
    explicacion:
      'Alguien las borró a propósito (o era un usuario dado de baja) y este aparato no se había enterado. Se sacaron de acá. En el servidor no cambió nada.',
  },
  {
    resultado: 'retenido',
    titulo: 'De un turno retenido',
    explicacion:
      'No se suben a propósito: el servidor ya tiene ese turno cargado desde otro aparato. Se resuelve en Ajustes → «Cargas retenidas». No cuentan en el aviso.',
  },
  {
    resultado: 'sin-recibir',
    titulo: 'De algo que este aparato no está recibiendo',
    explicacion:
      'Por ahora no se suben: este aparato no se está enterando de lo que cambia en esa parte, y podría ser algo que se borró a propósito desde otro aparato. Se revisan solas cuando vuelve a recibir.',
  },
  {
    resultado: 'firmado-por-otro',
    titulo: 'Renglones del historial firmados por otra persona',
    explicacion:
      'Cada renglón del historial sube a nombre de quien lo hizo. Estos suben solos cuando esa persona entre desde este aparato. No cuentan en el aviso.',
  },
]

export default function SinSubir() {
  const nube = useEstadoNube()
  const sesion = useSesion()
  const alMando = estaAlMando(sesion.perfil)
  const [revisando, setRevisando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function revisar() {
    setRevisando(true)
    setMensaje('')
    try {
      const { revisarPendientes } = await import('../sync/motor')
      const r = await revisarPendientes()
      if (!r) setMensaje('No se pudo revisar: fijate que haya internet y probá de nuevo.')
      else if (r.renglones.length === 0) setMensaje('Revisado: no hay nada sin subir.')
    } finally {
      setRevisando(false)
    }
  }

  async function sacar(r: RenglonRevision) {
    if (
      !confirm(
        `¿Sacar esto de este aparato?\n\n${r.que}\n\nEl servidor no lo acepta (${r.motivo ?? 'sin motivo'}). No se pierde: queda copiado en el servidor como constancia, de donde se puede recuperar.`,
      )
    ) {
      return
    }
    const { sacarDeEsteAparato } = await import('../sync/motor')
    await sacarDeEsteAparato(r.tabla, r.clave)
  }

  const revision = nube.revision
  const cuando = revision
    ? new Date(revision.cuando).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null

  return (
    <>
      <h2>Lo que no subió</h2>

      <div className="tarjeta">
        <p style={{ marginTop: 0 }}>
          {nube.sinSubir === null
            ? 'Todavía no se pudo controlar (hace falta internet y la sesión abierta).'
            : nube.sinSubir === 0
              ? 'Este aparato tiene todo arriba: no hay nada sin subir.'
              : `El aviso dice que hay ${nube.sinSubir} ${nube.sinSubir === 1 ? 'cosa' : 'cosas'} en este aparato que el servidor no tiene.`}
        </p>
        <p className="silencio">
          Si el número no baja solo en un minuto, la app revisa qué es cada cosa y la resuelve:
          sube lo que faltaba, saca lo que ya se había borrado desde otro aparato, y muestra acá
          lo que el servidor no acepta. Lo que se carga en el momento no espera a esto: sube
          enseguida.
        </p>
        <button className="boton-chico" disabled={revisando} onClick={() => void revisar()}>
          {revisando ? 'Revisando…' : 'Revisar ahora'}
        </button>
        {mensaje && <div className="aviso aviso-ok" style={{ marginTop: 8 }}>{mensaje}</div>}
      </div>

      {revision && revision.renglones.length > 0 && (
        <p className="silencio">Última revisión: {cuando} hs</p>
      )}

      {GRUPOS.map((g) => {
        const renglones = revision?.renglones.filter((r) => r.resultado === g.resultado) ?? []
        if (renglones.length === 0) return null
        return (
          <div className="tarjeta" key={g.resultado}>
            <p className="tarjeta-titulo">
              {g.titulo} ({renglones.length})
            </p>
            <p className="silencio" style={{ marginTop: 0 }}>
              {g.explicacion}
              {g.resultado === 'retenido' && alMando && (
                <>
                  {' '}
                  <Link to="/ajustes">Ir a Ajustes</Link>
                </>
              )}
            </p>
            <ul className="lista">
              {renglones.map((r) => (
                <li className="item" key={`${r.tabla}/${r.clave}`} style={{ display: 'block' }}>
                  <div className="item-titulo">{r.que}</div>
                  {r.motivo && <div className="item-sub negativo">{r.motivo}</div>}
                  {g.resultado === 'rechazado' && alMando && (
                    <button
                      className="boton-chico"
                      style={{ marginTop: 6 }}
                      onClick={() => void sacar(r)}
                    >
                      Sacar de este aparato
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </>
  )
}
