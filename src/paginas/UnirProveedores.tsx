import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { plata } from '../lib/formato'
import { fichasParecidas } from '../lib/fichasParecidas'
import {
  armarUnion,
  textoDeConfirmacionUnion,
  unirProveedores,
  type ResultadoUnion,
} from '../db/unirProveedores'

/**
 * Unir dos fichas de proveedor que son el mismo.
 *
 * Despues de que Sandra asociara los productos quedaron fichas
 * repetidas que el id derivado del nombre no junta solo: SALDO y
 * SALDOS, VICTOR ESTEBANEZ y VICTOR ESTEVANEZ.
 *
 * La pantalla sugiere los pares sospechosos, pero no une nada sola:
 * si dos fichas son el mismo proveedor lo sabe una persona, no una
 * regla. La sugerencia ahorra el trabajo de buscarlos; la decision es
 * de quien está mirando.
 */
export default function UnirProveedores() {
  const [idQueda, setIdQueda] = useState('')
  const [idSeAbsorbe, setIdSeAbsorbe] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [hecho, setHecho] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const datos = useLiveQuery(async () => {
    const [proveedores, productos, movimientos] = await Promise.all([
      db.proveedores.toArray(),
      db.productos.toArray(),
      db.movimientosProveedor.toArray(),
    ])
    return { proveedores, productos, movimientos }
  }, [])

  const sugeridos = useMemo(
    () => (datos ? fichasParecidas(datos.proveedores) : []),
    [datos],
  )

  if (!datos) return <p className="vacio">Mirando las fichas…</p>

  const porId = new Map(datos.proveedores.map((p) => [p.id, p]))
  const queda = porId.get(idQueda)
  const seAbsorbe = porId.get(idSeAbsorbe)
  const vista =
    queda && seAbsorbe && queda.id !== seAbsorbe.id
      ? armarUnion(queda, seAbsorbe, datos.productos, datos.movimientos)
      : null

  const ordenadas = [...datos.proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre))

  async function unir() {
    if (!vista || !confirm(textoDeConfirmacionUnion(vista))) return
    setTrabajando(true)
    setError(null)
    try {
      const r = await unirProveedores(vista.queda.id, vista.seAbsorbe.id)
      if (r === 'no-existe') {
        setError('Una de las dos fichas ya no está. Actualizá la pantalla.')
      } else if (r === 'es-la-misma') {
        setError('Son la misma ficha.')
      } else {
        const hecho = r as ResultadoUnion
        setHecho(
          `"${vista.seAbsorbe.nombre}" quedó dentro de "${vista.queda.nombre}": ` +
            `${hecho.productosTocados} productos y ${hecho.movimientosTocados} compras y pagos pasaron a su ficha.`,
        )
        setIdQueda('')
        setIdSeAbsorbe('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <>
      <h2>Unir proveedores</h2>

      {hecho ? (
        <div className="aviso aviso-ok">
          <strong>Listo.</strong> {hecho} Está en el historial como «Unión de proveedores».
        </div>
      ) : (
        <div className="aviso aviso-ojo">
          Cuando el mismo proveedor quedó cargado dos veces. Se eligen las dos fichas, se mira
          qué pasa, y recién ahí se une. <strong>No se cambia nada</strong> hasta que confirmes.
        </div>
      )}

      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Fichas que parecen la misma</p>
        {sugeridos.length === 0 ? (
          <p className="vacio" style={{ margin: 0 }}>
            Ninguna. Igual podés elegir dos a mano acá abajo.
          </p>
        ) : (
          <>
            <p className="silencio" style={{ marginTop: 0 }}>
              Son sugerencias, no decisiones: mirá cada una antes de unir.
            </p>
            <ul className="lista">
              {sugeridos.map((par) => (
                <li className="item" key={`${par.a.id}|${par.b.id}`} style={{ display: 'block' }}>
                  <div className="item-titulo">
                    {par.a.nombre} + {par.b.nombre}
                  </div>
                  <div className="item-sub silencio">{par.porque}</div>
                  <div className="botonera">
                    <button
                      className="boton-chico"
                      onClick={() => {
                        setIdQueda(par.a.id)
                        setIdSeAbsorbe(par.b.id)
                        setHecho(null)
                      }}
                    >
                      Dejar «{par.a.nombre}»
                    </button>
                    <button
                      className="boton-chico"
                      onClick={() => {
                        setIdQueda(par.b.id)
                        setIdSeAbsorbe(par.a.id)
                        setHecho(null)
                      }}
                    >
                      Dejar «{par.b.nombre}»
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Las dos fichas</p>
        <div className="campo">
          <label htmlFor="queda">La ficha que queda</label>
          <select id="queda" value={idQueda} onChange={(e) => setIdQueda(e.target.value)}>
            <option value="">Elegí una…</option>
            {ordenadas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.activo === false ? ' (inactiva)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="absorbe">La que se absorbe, y se borra</label>
          <select id="absorbe" value={idSeAbsorbe} onChange={(e) => setIdSeAbsorbe(e.target.value)}>
            <option value="">Elegí una…</option>
            {ordenadas
              .filter((p) => p.id !== idQueda)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.activo === false ? ' (inactiva)' : ''}
                </option>
              ))}
          </select>
        </div>
      </div>

      {vista && (
        <>
          <div className="tarjeta">
            <p className="tarjeta-titulo">Qué va a pasar</p>
            <div className="fila destacada">
              <span className="fila-etiqueta">Queda</span>
              <span className="fila-valor">{vista.queda.nombre}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Se borra</span>
              <span className="fila-valor">{vista.seAbsorbe.nombre}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Productos que cambian de ficha</span>
              <span className="fila-valor">{vista.productos}</span>
            </div>
            <div className="fila">
              <span className="fila-etiqueta">Compras y pagos que se mudan</span>
              <span className="fila-valor">
                {vista.compras} y {vista.pagos}
              </span>
            </div>
            {vista.compras + vista.pagos > 0 && (
              <div className="fila">
                <span className="fila-etiqueta">Saldo que pasa a su cuenta corriente</span>
                <span className="fila-valor">{plata(vista.saldoQuePasa)}</span>
              </div>
            )}
            {vista.aliasNuevos.length > 0 && (
              <div className="fila">
                <span className="fila-etiqueta">Queda como otro nombre</span>
                <span className="fila-valor">{vista.aliasNuevos.join(', ')}</span>
              </div>
            )}
            {vista.datosQueSeRescatan.length > 0 && (
              <p className="silencio" style={{ marginBottom: 0 }}>
                Se completan con los de «{vista.seAbsorbe.nombre}», porque «{vista.queda.nombre}»
                los tiene vacíos: {vista.datosQueSeRescatan.join(', ')}.
              </p>
            )}
            {vista.productos === 0 && vista.compras + vista.pagos === 0 && (
              <p className="silencio" style={{ marginBottom: 0 }}>
                De «{vista.seAbsorbe.nombre}» no cuelga nada: solo se borra la ficha y su nombre
                queda cargado en «{vista.queda.nombre}».
              </p>
            )}
          </div>

          <div className="tarjeta">
            <button className="boton-principal" onClick={() => void unir()} disabled={trabajando}>
              {trabajando ? 'Uniendo…' : `Unir «${vista.seAbsorbe.nombre}» dentro de «${vista.queda.nombre}»`}
            </button>
          </div>
        </>
      )}
    </>
  )
}
