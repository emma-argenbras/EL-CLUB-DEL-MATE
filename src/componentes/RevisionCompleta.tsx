import { useMemo, useState } from 'react'
import {
  ETIQUETA_MODULO,
  revisionCompleta,
  type DatosAuditoria,
  type Hallazgo,
  type ModuloAuditoria,
  type ResultadoControl,
} from '../lib/auditoria'
import type { SeccionId } from '../db/db'

const ORDEN: ModuloAuditoria[] = ['caja', 'productos', 'proveedores', 'gastos', 'sistema']

const SENAL: Record<ResultadoControl['estado'], { icono: string; clase: string }> = {
  bien: { icono: '✓', clase: 'control-bien' },
  'no-corrio': { icono: '?', clase: 'control-no-corrio' },
  critico: { icono: '!', clase: 'control-critico' },
  importante: { icono: '!', clase: 'control-importante' },
  aviso: { icono: '·', clase: 'control-aviso' },
}

/**
 * La revision completa: todos los controles que corre la app, con el
 * resultado de cada uno.
 *
 * El resto del Panel muestra solo lo que hay para hacer, que es lo util
 * para trabajar. Esto es lo otro: la foto entera, incluyendo lo que dio
 * bien. Sin esto, "no hay avisos" y "no se reviso nada" se ven igual, y
 * no hay forma de saber si el negocio esta sano o si la app se quedo
 * callada.
 *
 * Viene cerrada porque es larga y no se mira todos los dias.
 */
export default function RevisionCompleta({
  hallazgos,
  esOwner,
  secciones,
  datos,
}: {
  hallazgos: Hallazgo[]
  esOwner: boolean
  secciones?: SeccionId[]
  datos?: DatosAuditoria
}) {
  const [abierta, setAbierta] = useState(false)
  const controles = useMemo(
    () => revisionCompleta(hallazgos, esOwner, secciones, datos),
    [hallazgos, esOwner, secciones, datos],
  )

  const bien = controles.filter((c) => c.estado === 'bien').length
  const noCorrieron = controles.filter((c) => c.estado === 'no-corrio').length

  const porModulo = useMemo(() => {
    const mapa = new Map<ModuloAuditoria, ResultadoControl[]>()
    for (const c of controles) {
      const actual = mapa.get(c.modulo)
      if (actual) actual.push(c)
      else mapa.set(c.modulo, [c])
    }
    return mapa
  }, [controles])

  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <p className="tarjeta-titulo">Revisión completa</p>
      <div className="fila">
        <span className="fila-etiqueta">Controles que corre la app</span>
        <span className="fila-valor">
          {bien} de {controles.length - noCorrieron} en orden
        </span>
      </div>
      {noCorrieron > 0 && (
        <div className="fila">
          <span className="fila-etiqueta">Sin poder revisar</span>
          <span className="fila-valor">{noCorrieron}</span>
        </div>
      )}
      <p className="silencio" style={{ marginTop: 6 }}>
        Todo lo que la app revisa sola cada vez que la abrís, incluido lo que dio bien.
      </p>

      <button
        className="boton-chico"
        style={{ width: '100%', marginTop: 4 }}
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
      >
        {abierta ? 'Ocultar el detalle' : 'Ver los ' + controles.length + ' controles'}
      </button>

      {abierta && (
        <div style={{ marginTop: 14 }}>
          {ORDEN.filter((m) => porModulo.has(m)).map((modulo) => (
            <div key={modulo} style={{ marginBottom: 14 }}>
              <p className="etiqueta-modulo">{ETIQUETA_MODULO[modulo]}</p>
              <ul className="lista-controles">
                {(porModulo.get(modulo) ?? []).map((c) => (
                  <li key={c.id} className="control">
                    <span className={`control-senal ${SENAL[c.estado].clase}`} aria-hidden="true">
                      {SENAL[c.estado].icono}
                    </span>
                    <span>
                      <span className="control-que">{c.que}</span>
                      <span className="control-resultado">{c.resultado}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
