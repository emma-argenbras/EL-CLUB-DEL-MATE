import { useMemo, useState } from 'react'
import {
  AYUDA,
  CATEGORIAS_AYUDA,
  ayudaParaPerfil,
  buscarAyuda,
  type EntradaAyuda,
} from '../data/ayuda'
import { seccionesVisibles } from '../sync/sesion'
import { useSesion } from '../sync/useSesion'

export default function Ayuda() {
  const [consulta, setConsulta] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const sesion = useSesion()

  // Un empleado ve solo lo que le compete: sin preguntas de dueño ni de
  // secciones que tiene apagadas.
  const disponibles = useMemo(() => {
    const esOwner = !sesion.perfil || sesion.perfil.rol === 'owner'
    return ayudaParaPerfil(AYUDA, esOwner, seccionesVisibles(sesion.perfil))
  }, [sesion.perfil])

  const resultados = useMemo(() => buscarAyuda(consulta, disponibles), [consulta, disponibles])
  const buscando = consulta.trim().length > 0

  function alternar(id: string) {
    setAbierta((actual) => (actual === id ? null : id))
  }

  return (
    <>
      <h2>Ayuda</h2>

      <div className="tarjeta">
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Escribí tu consulta… ej: cómo cierro la caja"
          inputMode="search"
          autoFocus
        />
        <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
          Busca en las {disponibles.length} preguntas de esta guía. No hace falta escribir la
          pregunta entera, alcanza con un par de palabras.
        </p>
      </div>

      {buscando ? (
        <div className="tarjeta">
          <p className="tarjeta-titulo">
            {resultados.length === 0
              ? 'Sin resultados'
              : `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
          {resultados.length === 0 ? (
            <p className="vacio">
              No encontré nada para "{consulta}". Probá con otras palabras, o mirá las categorías
              de abajo borrando la búsqueda.
            </p>
          ) : (
            <ListaPreguntas
              entradas={resultados}
              abierta={abierta}
              onAlternar={alternar}
            />
          )}
        </div>
      ) : (
        <>
          <div className="aviso aviso-ok">
            🧉 Esta guía tiene respuestas para todo lo que podés hacer en la app. Buscá arriba, o
            mirá por tema acá abajo.
          </div>
          {CATEGORIAS_AYUDA.map((categoria) => {
            const entradas = disponibles.filter((e) => e.categoria === categoria)
            if (entradas.length === 0) return null
            return (
              <div className="tarjeta" key={categoria}>
                <p className="tarjeta-titulo">{categoria}</p>
                <ListaPreguntas entradas={entradas} abierta={abierta} onAlternar={alternar} />
              </div>
            )
          })}
        </>
      )}
    </>
  )
}

function ListaPreguntas({
  entradas,
  abierta,
  onAlternar,
}: {
  entradas: EntradaAyuda[]
  abierta: string | null
  onAlternar: (id: string) => void
}) {
  return (
    <ul className="lista">
      {entradas.map((entrada) => (
        <li className="item-ayuda" key={entrada.id}>
          <button className="pregunta-ayuda" onClick={() => onAlternar(entrada.id)}>
            <span>{entrada.pregunta}</span>
            <span className="flecha-ayuda">{abierta === entrada.id ? '−' : '+'}</span>
          </button>
          {abierta === entrada.id && (
            <div className="respuesta-ayuda">
              {entrada.respuesta.split('\n\n').map((parrafo, i) => (
                <p key={i}>{parrafo}</p>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
