import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { esDueno } from '../sync/permisos'
import { nubeConfigurada } from '../sync/config'
import { useSesion } from '../sync/useSesion'
import { fechaLinda, plata, porcentaje } from '../lib/formato'
import {
  aplicarPlanRecuperacion,
  armarPlanRecuperacion,
  textoDeConfirmacionRecuperacion,
  valoresDelHistorial,
  type Fuente,
  type PlanRecuperacion,
} from '../db/recuperarProductos'
import { leerFuente } from '../lib/fuentesRecuperacion'

/** Una fuente cargada de un archivo, con la fecha que le puso el dueño. */
interface Archivo {
  id: string
  nombreArchivo: string
  texto: string
  /** La fecha de los costos del archivo, para los que no traen la suya. */
  fecha: string
}

const NOMBRE_HISTORIAL = 'Historial de la app'

/**
 * Recuperar los costos y proveedores que se perdieron el 20/10.
 *
 * La pantalla no escribe nada hasta el botón del final: primero muestra
 * exactamente qué se va a rellenar, de dónde sale cada dato y cuántos
 * productos quedan sin arreglo. Y lo que rellena es solo lo que está
 * vacío — recuperar lo viejo pisando lo nuevo sería el mismo error del
 * 20/10 al revés.
 */
export default function RecuperarProductos() {
  const sesion = useSesion()
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [usarHistorial, setUsarHistorial] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [hecho, setHecho] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  const datos = useLiveQuery(async () => {
    const [productos, renglones] = await Promise.all([
      db.productos.toArray(),
      db.historial.where('tabla').equals('productos').toArray(),
    ])
    return { productos, historial: valoresDelHistorial(renglones) }
  }, [])

  if (!datos) return <p className="vacio">Mirando los productos…</p>

  let fuentes: Fuente[] = []
  let errorArchivo: string | null = null
  try {
    fuentes = [
      ...(usarHistorial
        ? [{ nombre: NOMBRE_HISTORIAL, fecha: null, valores: datos.historial }]
        : []),
      ...archivos.map((a) => leerFuente(a.nombreArchivo, a.texto, a.fecha || null)),
    ]
  } catch (e) {
    errorArchivo = e instanceof Error ? e.message : String(e)
  }

  const plan: PlanRecuperacion | null = errorArchivo
    ? null
    : armarPlanRecuperacion(datos.productos, fuentes)

  // El historial solo anota si hay a quién atribuirle el cambio, y una
  // operación que toca cientos de productos sin dejar constancia es
  // justo lo que el historial existe para evitar.
  const hayQuienFirme = !nubeConfigurada || Boolean(sesion.perfil)
  const puedeAplicar = esDueno(sesion.perfil) && hayQuienFirme

  async function cargar(lista: FileList | null) {
    if (!lista) return
    setError(null)
    const nuevos: Archivo[] = []
    for (const archivo of Array.from(lista)) {
      nuevos.push({
        id: `${archivo.name}-${Date.now()}-${nuevos.length}`,
        nombreArchivo: archivo.name,
        texto: await archivo.text(),
        fecha: '',
      })
    }
    setArchivos((previos) => [...previos, ...nuevos])
  }

  function mover(indice: number, hacia: number) {
    setArchivos((previos) => {
      const copia = [...previos]
      const destino = indice + hacia
      if (destino < 0 || destino >= copia.length) return previos
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
  }

  async function aplicar() {
    if (!plan || !confirm(textoDeConfirmacionRecuperacion(plan))) return
    setTrabajando(true)
    setError(null)
    try {
      setHecho(await aplicarPlanRecuperacion(plan))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <>
      <h2>Recuperar costos y proveedores</h2>

      {hecho !== null ? (
        <div className="aviso aviso-ok">
          <strong>Listo.</strong> Se rellenaron {hecho} productos. Quedó todo en el historial como
          «Recuperación de costos y proveedores». Lo que ya tenía dato quedó intacto.
        </div>
      ) : (
        <div className="aviso aviso-ojo">
          Esta pantalla <strong>solo rellena lo que está vacío</strong>. Nunca pisa un costo ni un
          proveedor cargado, así que no deshace nada de lo que se cargó esta semana. No se escribe
          nada hasta el botón del final.
        </div>
      )}

      {error && (
        <div className="aviso aviso-error">
          No se pudo aplicar: {error}. Lo que alcanzó a rellenarse quedó en el historial; se puede
          volver a correr, porque lo ya rellenado deja de estar vacío y no se vuelve a tocar.
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Qué falta hoy</p>
        <div className="fila">
          <span className="fila-etiqueta">Productos sin costo</span>
          <span className="fila-valor negativo">{plan?.costosVacios ?? '—'}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Productos sin proveedor</span>
          <span className="fila-valor negativo">{plan?.proveedoresVacios ?? '—'}</span>
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">De dónde se saca</p>
        <p className="silencio" style={{ marginTop: 0 }}>
          Las fuentes se consultan <strong>en este orden</strong> y gana la primera que tenga el
          dato. La de arriba manda.
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 0',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={usarHistorial}
            onChange={(e) => setUsarHistorial(e.target.checked)}
          />
          <span className="fila-etiqueta" style={{ flexGrow: 1 }}>
            1. {NOMBRE_HISTORIAL}
          </span>
          <span className="fila-valor">{datos.historial.size} productos</span>
        </label>
        <p className="silencio" style={{ marginTop: 0 }}>
          Lo más nuevo y lo más preciso: guarda, campo por campo, el último valor que tuvo cada
          producto. Cada costo viene con la fecha que tenía.
        </p>

        <ul className="lista">
          {archivos.map((a, i) => (
            <li className="item" key={a.id} style={{ display: 'block' }}>
              <div className="item-titulo">
                {(usarHistorial ? 2 : 1) + i}. {a.nombreArchivo}
              </div>
              <label className="item-sub" style={{ display: 'block' }}>
                Fecha de los costos de este archivo, para los que no traigan la suya:{' '}
                <input
                  type="date"
                  value={a.fecha}
                  onChange={(e) =>
                    setArchivos((previos) =>
                      previos.map((x) => (x.id === a.id ? { ...x, fecha: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <div className="botonera">
                <button className="boton-chico" onClick={() => mover(i, -1)} disabled={i === 0}>
                  Subir
                </button>
                <button
                  className="boton-chico"
                  onClick={() => mover(i, 1)}
                  disabled={i === archivos.length - 1}
                >
                  Bajar
                </button>
                <button
                  className="boton-chico"
                  onClick={() => setArchivos((p) => p.filter((x) => x.id !== a.id))}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>

        <label className="item-sub" style={{ display: 'block' }}>
          Agregar un archivo (.csv o .json):{' '}
          <input
            type="file"
            accept=".csv,.json"
            multiple
            onChange={(e) => {
              void cargar(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <p className="silencio">
          El archivo se lee acá, en el celular o la computadora: no se sube a ningún lado y no
          queda guardado. Si se cierra la pantalla, hay que volver a cargarlo.
        </p>
      </div>

      {errorArchivo && (
        <div className="aviso aviso-error">No se pudo leer un archivo: {errorArchivo}</div>
      )}

      {plan && (
        <>
          <div className="tarjeta">
            <p className="tarjeta-titulo">Vista previa</p>
            {plan.cambios.length === 0 ? (
              <p className="vacio">
                Con estas fuentes no hay nada para rellenar. Si falta algo, cargá el Excel o la foto
                de agosto como archivo.
              </p>
            ) : (
              <>
                <div className="fila destacada">
                  <span className="fila-etiqueta">Productos que se rellenan</span>
                  <span className="fila-valor">{plan.cambios.length}</span>
                </div>
                {plan.porFuente.map((f) => (
                  <div className="fila" key={f.nombre}>
                    <span className="fila-etiqueta">{f.nombre}</span>
                    <span className="fila-valor">
                      {f.costos} costos · {f.proveedores} proveedores
                    </span>
                  </div>
                ))}
                <div className="fila">
                  <span className="fila-etiqueta">
                    De los costos recuperados, cuántos quedan como «costo vencido»
                  </span>
                  <span className="fila-valor">{plan.costosVencidos}</span>
                </div>
                <div className="fila">
                  <span className="fila-etiqueta">
                    Les falta algo y ninguna fuente lo tiene (se cargan a mano)
                  </span>
                  <span className="fila-valor">{plan.sinFuente}</span>
                </div>
              </>
            )}
          </div>

          {plan.cambios.length > 0 && (
            <div className="tarjeta">
              <p className="tarjeta-titulo">Qué le entra a cada producto</p>
              <ul className="lista">
                {(verTodos ? plan.cambios : plan.cambios.slice(0, 50)).map((c) => (
                  <li className="item" key={c.codigo} style={{ display: 'block' }}>
                    <div className="item-titulo">
                      {c.codigo} · {c.descripcion}
                    </div>
                    {c.precioCompra != null && (
                      <div className="item-sub">
                        costo {plata(c.precioCompra)}
                        {c.rentabilidad != null && ` · rentabilidad ${porcentaje(c.rentabilidad * 100, 0)}`}
                        {' · '}
                        {c.fechaCompra ? `comprado el ${fechaLinda(c.fechaCompra)}` : 'sin fecha'}
                        <span className="silencio"> (de {c.fuenteCosto})</span>
                      </div>
                    )}
                    {c.proveedor && (
                      <div className="item-sub">
                        proveedor {c.proveedor}
                        <span className="silencio"> (de {c.fuenteProveedor})</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {!verTodos && plan.cambios.length > 50 && (
                <button className="boton-chico" onClick={() => setVerTodos(true)}>
                  Ver los {plan.cambios.length} productos
                </button>
              )}
            </div>
          )}

          {plan.cambios.length > 0 && (
            <div className="tarjeta">
              {!hayQuienFirme && (
                <p className="silencio" style={{ marginTop: 0 }}>
                  Hay que entrar con tu usuario: sin sesión el historial no anota quién lo hizo, y
                  esto toca cientos de productos.
                </p>
              )}
              {hayQuienFirme && !puedeAplicar && (
                <p className="silencio" style={{ marginTop: 0 }}>
                  La recuperación la aplica el dueño. La pantalla se puede mirar igual.
                </p>
              )}
              <button
                className="boton-principal"
                onClick={() => void aplicar()}
                disabled={!puedeAplicar || trabajando}
              >
                {trabajando ? 'Rellenando…' : `Rellenar ${plan.cambios.length} productos`}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
