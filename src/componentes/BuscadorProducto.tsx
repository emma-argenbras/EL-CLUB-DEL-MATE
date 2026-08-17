import { useEffect, useRef, useState } from 'react'
import { db, productoVisible, type Producto } from '../db/db'
import { normalizar, plata } from '../lib/formato'

interface Props {
  onElegir: (producto: Producto) => void
  autoFoco?: boolean
}

/**
 * Buscador de productos por codigo o por nombre.
 * Sirve escribir "mate calabaza" o el codigo exacto: si el codigo
 * coincide justo, se puede confirmar con Enter sin tocar la lista.
 */
export default function BuscadorProducto({ onElegir, autoFoco }: Props) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [abierto, setAbierto] = useState(false)
  const [marcado, setMarcado] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFoco) entrada.current?.focus()
  }, [autoFoco])

  useEffect(() => {
    const consulta = normalizar(texto)
    if (consulta.length < 2) {
      setResultados([])
      return
    }
    let cancelado = false
    const partes = consulta.split(/\s+/).filter(Boolean)

    db.productos
      .filter(
        (p) =>
          p.activo !== false &&
          productoVisible(p) &&
          partes.every((parte) => p.busqueda.includes(parte)),
      )
      .limit(25)
      .toArray()
      .then((encontrados) => {
        if (cancelado) return
        // Primero el codigo exacto, despues los que empiezan igual.
        encontrados.sort((a, b) => {
          const exactoA = normalizar(a.codigo) === consulta ? 0 : 1
          const exactoB = normalizar(b.codigo) === consulta ? 0 : 1
          if (exactoA !== exactoB) return exactoA - exactoB
          return a.descripcion.localeCompare(b.descripcion, 'es')
        })
        setResultados(encontrados)
        setMarcado(0)
      })

    return () => {
      cancelado = true
    }
  }, [texto])

  useEffect(() => {
    function afuera(evento: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', afuera)
    return () => document.removeEventListener('mousedown', afuera)
  }, [])

  function elegir(producto: Producto) {
    onElegir(producto)
    setTexto('')
    setResultados([])
    setAbierto(false)
    entrada.current?.focus()
  }

  function teclas(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (!resultados.length) return
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setMarcado((i) => Math.min(i + 1, resultados.length - 1))
      setAbierto(true)
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setMarcado((i) => Math.max(i - 1, 0))
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      const elegido = resultados[marcado]
      if (elegido) elegir(elegido)
    } else if (evento.key === 'Escape') {
      setAbierto(false)
    }
  }

  return (
    <div className="buscador" ref={contenedor}>
      <input
        ref={entrada}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        placeholder="Código o nombre del producto…"
        autoComplete="off"
        inputMode="search"
      />
      {abierto && resultados.length > 0 && (
        <div className="sugerencias">
          {resultados.map((p, i) => (
            <div
              key={p.codigo}
              className={i === marcado ? 'sugerencia marcada' : 'sugerencia'}
              onMouseEnter={() => setMarcado(i)}
              onClick={() => elegir(p)}
            >
              <div className="item-titulo">{p.descripcion}</div>
              <div className="item-sub">
                {p.codigo} · {plata(p.precioVenta)}
                {p.stock !== null && p.stock !== undefined ? ` · stock ${p.stock}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      {abierto && texto.length >= 2 && resultados.length === 0 && (
        <div className="sugerencias">
          <div className="sugerencia silencio">Sin resultados para “{texto}”</div>
        </div>
      )}
    </div>
  )
}
