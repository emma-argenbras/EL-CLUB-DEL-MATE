import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, productoVisible, type Producto } from '../db/db'
import { normalizar, plata } from '../lib/formato'

/** Cuantos resultados se muestran. Mas que esto no se lee de parado. */
const TOPE = 12

/**
 * Consulta de precios para el salon.
 *
 * Es la misma informacion que Productos, pero para otra situacion: un
 * cliente parado adelante preguntando cuanto sale algo. Ahi no se
 * navega, no se lee una tabla y no se desplaza una lista: se escribe
 * media palabra y se lee un numero en voz alta.
 *
 * Por eso:
 *
 *   - Arranca con el teclado abierto en el buscador. Un toque menos.
 *   - No hay avisos arriba. Los pendientes del negocio no son asunto de
 *     este momento y correrian el buscador hacia abajo justo cuando
 *     hace falta que este arriba de todo.
 *   - El precio va grande de verdad, porque se lee de parado, a veces
 *     con el celular medio girado y el cliente mirando.
 *   - No se ve ni el costo ni el margen. No es solo por los permisos:
 *     la pantalla se da vuelta sola hacia el cliente, y lo que el
 *     negocio paga por algo no es una conversacion que convenga tener
 *     en el mostrador.
 *
 * El modo se prende por dispositivo (el celular del salon lo tiene
 * prendido, el del dueño no) y no es un candado: desde aca se sale.
 */
export default function ConsultaPrecios() {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Producto[] | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const navegar = useNavigate()

  useEffect(() => {
    entrada.current?.focus()
  }, [])

  useEffect(() => {
    const consulta = normalizar(texto)
    if (consulta.length < 2) {
      setResultados(null)
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
      .limit(60)
      .toArray()
      .then((encontrados) => {
        if (cancelado) return
        // El codigo exacto primero: si alguien lo escribio entero, es
        // exactamente ese y no se tiene que poner a buscarlo en una
        // lista.
        encontrados.sort((a, b) => {
          const exactoA = normalizar(a.codigo) === consulta ? 0 : 1
          const exactoB = normalizar(b.codigo) === consulta ? 0 : 1
          if (exactoA !== exactoB) return exactoA - exactoB
          return a.descripcion.localeCompare(b.descripcion, 'es')
        })
        setResultados(encontrados)
      })

    return () => {
      cancelado = true
    }
  }, [texto])

  function limpiar() {
    setTexto('')
    setResultados(null)
    entrada.current?.focus()
  }

  /**
   * Sale de esta pantalla SIN apagar el modo.
   *
   * La diferencia importa: el modo es como queda configurado este
   * aparato, y apagarlo es una decision de quien lo configuro, no algo
   * que pase porque alguien necesito mirar una venta. La proxima vez
   * que se abra la app, el celular del salon vuelve a abrir aca.
   *
   * Va a /caja y no a /, porque / redirige de nuevo al modo consulta y
   * el boton no haria nada.
   */
  function irAlResto() {
    navegar('/caja')
  }

  const mostrados = resultados?.slice(0, TOPE) ?? []

  return (
    <div className="consulta">
      <div className="consulta-buscador">
        <input
          ref={entrada}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre o código…"
          aria-label="Buscar un producto por nombre o código"
          autoComplete="off"
          inputMode="search"
          enterKeyHint="search"
        />
        {texto !== '' && (
          <button className="consulta-limpiar" onClick={limpiar} aria-label="Borrar la búsqueda">
            ✕
          </button>
        )}
      </div>

      {resultados === null && (
        <p className="consulta-ayuda">
          Escribí dos letras del nombre, o el código.
        </p>
      )}

      {resultados !== null && resultados.length === 0 && (
        <p className="consulta-ayuda">
          No hay ningún producto que diga “{texto.trim()}”.
        </p>
      )}

      {mostrados.map((p) => (
        <div className="consulta-item" key={p.codigo}>
          <div className="consulta-nombre">{p.descripcion}</div>
          <div className="consulta-precio">
            {p.precioVenta != null ? plata(p.precioVenta) : 'Sin precio cargado'}
          </div>
          <div className="consulta-codigo">
            {p.codigo}
            {p.stock != null && ` · quedan ${p.stock}`}
          </div>
        </div>
      ))}

      {resultados !== null && resultados.length > TOPE && (
        <p className="consulta-ayuda">
          Hay {resultados.length - TOPE} más. Escribí otra palabra para achicar la búsqueda.
        </p>
      )}

      <button className="boton-chico consulta-salir" onClick={irAlResto}>
        Ir al resto de la app →
      </button>
    </div>
  )
}
