import { useEffect, useMemo, useState } from 'react'
import { enlaceWhatsApp, mensajeConsulta, TELEFONO_TIENDA } from '../lib/whatsapp'

/**
 * Un producto del catalogo publico. Los nombres son de una letra porque
 * el archivo se descarga entero en el celular de un cliente: con 1.280
 * productos, la diferencia se nota.
 */
interface ProductoPublico {
  /** codigo */ c: string
  /** descripcion */ d: string
  /** precio de venta */ p: number
  /** texto normalizado para buscar */ b: string
}

/** De a cuantos se van mostrando, para que la pagina abra rapido. */
const TANDA = 48

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function plata(pesos: number): string {
  return `$ ${pesos.toLocaleString('es-AR')}`
}

export default function CatalogoPublico() {
  const [productos, setProductos] = useState<ProductoPublico[] | null>(null)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [cuantos, setCuantos] = useState(TANDA)

  useEffect(() => {
    // BASE_URL y no '/': asi sigue andando si algun dia la app deja
    // de estar en la raiz del dominio.
    fetch(`${import.meta.env.BASE_URL}catalogo.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(setProductos)
      .catch(() => setError(true))
  }, [])

  const resultados = useMemo(() => {
    if (!productos) return []
    const termino = normalizar(busqueda)
    if (!termino) return productos
    // Todas las palabras tienen que aparecer: "mate alpaca" no trae
    // todos los mates y todas las bombillas de alpaca.
    const palabras = termino.split(' ')
    return productos.filter((p) => palabras.every((w) => p.b.includes(w)))
  }, [productos, busqueda])

  // Al buscar de nuevo se vuelve a empezar desde arriba.
  useEffect(() => setCuantos(TANDA), [busqueda])

  return (
    <>
      <header className="tapa">
        <div className="tapa-centro">
          <p className="logo">🧉</p>
          <h1>El Club del Mate</h1>
          <p className="lugar">Concordia, Entre Ríos</p>
        </div>
      </header>

      <main className="hoja">
        <div className="buscador">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscá un mate, una bombilla, un termo…"
            aria-label="Buscar en el catálogo"
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="aviso">
            No se pudo cargar el catálogo. Probá recargar la página en un ratito.
          </p>
        )}

        {!productos && !error && <p className="aviso">Cargando el catálogo…</p>}

        {productos && (
          <>
            <p className="conteo">
              {resultados.length === 0
                ? 'No encontramos nada con esa búsqueda.'
                : resultados.length === productos.length
                  ? `${productos.length} productos`
                  : `${resultados.length} de ${productos.length} productos`}
            </p>

            <ul className="grilla">
              {resultados.slice(0, cuantos).map((p) => (
                <li className="producto" key={`${p.c}-${p.d}`}>
                  <div className="producto-datos">
                    <h2>{p.d}</h2>
                    {p.c && <p className="codigo">{p.c}</p>}
                  </div>
                  <div className="producto-pie">
                    <span className="precio">{plata(p.p)}</span>
                    {TELEFONO_TIENDA && (
                      <a
                        className="consultar"
                        href={enlaceWhatsApp(
                          mensajeConsulta({ codigo: p.c, descripcion: p.d, precioVenta: p.p }),
                          TELEFONO_TIENDA,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Consultar
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {resultados.length > cuantos && (
              <button className="mas" onClick={() => setCuantos((n) => n + TANDA)}>
                Ver más productos
              </button>
            )}
          </>
        )}
      </main>

      <footer className="pie">
        <p>
          Los precios pueden cambiar sin aviso. Consultá disponibilidad antes de acercarte.
        </p>
        <p className="firma">El Club del Mate · Concordia, Entre Ríos</p>
      </footer>
    </>
  )
}
