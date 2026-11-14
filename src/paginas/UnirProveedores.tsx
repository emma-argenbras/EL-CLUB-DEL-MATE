import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { plata } from '../lib/formato'
import { fichasParecidas } from '../lib/fichasParecidas'
import { planDeRepetidas } from '../lib/fichasRepetidas'
import { useSesion } from '../sync/useSesion'
import { nubeConfigurada } from '../sync/config'
import {
  avisoDeConstancias,
  resumenDeConstancias,
  type Aviso,
  type RevisionConstancias,
} from '../sync/constancias'
import {
  armarUnion,
  MOTIVO_FICHAS_VACIAS,
  textoDeConfirmacionUnion,
  textoDeConfirmacionVacias,
  unirFichasVacias,
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
  const sesion = useSesion()
  // Las constancias, contra el servidor (13/11): el aviso de la ultima
  // union y el renglon fijo de arriba.
  const [avisoUnion, setAvisoUnion] = useState<Aviso | null>(null)
  const [resumen, setResumen] = useState<Aviso | 'mirando' | null>(null)

  async function revisarConstancias(ids?: string[]): Promise<RevisionConstancias | null> {
    if (!nubeConfigurada) return null
    const { revisarConstanciasDeProveedores } = await import('../sync/motor')
    return revisarConstanciasDeProveedores(ids)
  }

  async function actualizarResumen() {
    if (!nubeConfigurada) return
    setResumen('mirando')
    const r = await revisarConstancias()
    setResumen(
      r
        ? resumenDeConstancias(r)
        : { tipo: 'ojo', texto: 'No se pudo preguntar al servidor: fijate que haya internet.' },
    )
  }

  /** Despues de unir: si las constancias de ESTAS fichas llegaron. */
  async function confirmarConstancias(ids: string[]) {
    if (!nubeConfigurada || ids.length === 0) return
    setAvisoUnion({ tipo: 'ojo', texto: 'Confirmando con el servidor que las constancias llegaron…' })
    setAvisoUnion(avisoDeConstancias(await revisarConstancias(ids)))
    void actualizarResumen()
  }

  useEffect(() => {
    void actualizarResumen()
    // Una vez al entrar: es una pregunta al servidor, no hace falta mas.
  }, [])

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
  // Las de mismo nombre EXACTO (10/11): las vacias se unen de una, las
  // que tienen datos de los dos lados se eligen a mano.
  const repetidas = useMemo(
    () => (datos ? planDeRepetidas(datos.proveedores, datos.productos, datos.movimientos) : null),
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
  // Dos fichas con el mismo nombre se ven iguales en la lista: la cantidad
  // de productos es lo que las distingue.
  const productosDe = new Map<string, number>()
  for (const p of datos.productos) {
    if (p.proveedorId) productosDe.set(p.proveedorId, (productosDe.get(p.proveedorId) ?? 0) + 1)
  }
  // Los pares de nombre identico ya estan arriba (vacias o a mano): en las
  // sugerencias serian dos botones iguales, y con las 94 del 10/11, casi cien.
  const cubiertos = new Set([
    ...(repetidas?.vacias.map((r) => r.vacia.nombre.trim()) ?? []),
    ...(repetidas?.aMano.map((g) => g.nombre) ?? []),
  ])
  const sugeridosVisibles = sugeridos.filter(
    (par) => !(par.a.nombre.trim() === par.b.nombre.trim() && cubiertos.has(par.a.nombre.trim())),
  )
  const conProductos = (p: { id: string; nombre: string }) =>
    `${p.nombre}» · ${productosDe.get(p.id) ?? 0} ${productosDe.get(p.id) === 1 ? 'producto' : 'productos'}`
  const etiqueta = (p: { id: string; nombre: string; activo?: boolean }) =>
    `${p.nombre} · ${productosDe.get(p.id) ?? 0} ${productosDe.get(p.id) === 1 ? 'producto' : 'productos'}${p.activo === false ? ' (inactiva)' : ''}`

  async function unir() {
    if (!vista || !confirm(textoDeConfirmacionUnion(vista))) return
    setTrabajando(true)
    setError(null)
    setAvisoUnion(null)
    try {
      const r = await unirProveedores(vista.queda.id, vista.seAbsorbe.id, sesion.email)
      if (r === 'no-existe') {
        setError('Una de las dos fichas ya no está. Actualizá la pantalla.')
      } else if (r === 'es-la-misma') {
        setError('Son la misma ficha.')
      } else {
        const hecho = r as ResultadoUnion
        setHecho(
          `"${vista.seAbsorbe.nombre}" quedó dentro de "${vista.queda.nombre}": ` +
            `${hecho.productosTocados} productos y ${hecho.movimientosTocados} compras y pagos pasaron a su ficha. ` +
            'Está en el historial como «Unión de proveedores».',
        )
        setIdQueda('')
        setIdSeAbsorbe('')
        void confirmarConstancias([vista.seAbsorbe.id])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTrabajando(false)
    }
  }

  async function unirLasVacias() {
    if (!repetidas || repetidas.vacias.length === 0) return
    if (!confirm(textoDeConfirmacionVacias(repetidas.vacias))) return
    setTrabajando(true)
    setError(null)
    setAvisoUnion(null)
    try {
      const r = await unirFichasVacias(
        repetidas.vacias.map((x) => ({ idVacia: x.vacia.id, idGemela: x.gemela.proveedor.id })),
        sesion.email,
      )
      setHecho(
        `Se ${r.unidas === 1 ? 'unió 1 ficha vacía' : `unieron ${r.unidas} fichas vacías`} a su gemela.` +
          (r.salteadas.length > 0
            ? ` Se ${r.salteadas.length === 1 ? 'salteó 1, que cambió' : `saltearon ${r.salteadas.length}, que cambiaron`} desde que se armó la lista: ` +
              r.salteadas.map((x) => `${x.nombre} (${x.porque})`).join('; ') +
              '.'
            : '') +
          ` Está en el historial como «${MOTIVO_FICHAS_VACIAS}».`,
      )
      void confirmarConstancias(r.idsUnidas)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTrabajando(false)
    }
  }

  const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  const creada = (cuando: number | undefined) =>
    cuando ? new Date(cuando).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  return (
    <>
      <h2>Unir proveedores</h2>

      {hecho ? (
        <div className="aviso aviso-ok">
          <strong>Listo.</strong> {hecho}
        </div>
      ) : (
        <div className="aviso aviso-ojo">
          Cuando el mismo proveedor quedó cargado dos veces. Se eligen las dos fichas, se mira
          qué pasa, y recién ahí se une. <strong>No se cambia nada</strong> hasta que confirmes.
        </div>
      )}

      {avisoUnion && <div className={`aviso aviso-${avisoUnion.tipo}`}>{avisoUnion.texto}</div>}

      {error && <div className="aviso aviso-error">{error}</div>}

      {nubeConfigurada && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Constancias en el servidor</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Cada ficha que se une deja una constancia en el servidor. Es lo que impide que un aparato
            atrasado la vuelva a subir.
          </p>
          {resumen === 'mirando' || resumen === null ? (
            <p className="silencio" style={{ marginBottom: 0 }}>
              Preguntando al servidor…
            </p>
          ) : (
            <div className={`aviso aviso-${resumen.tipo}`} style={{ marginBottom: 0 }}>
              {resumen.texto}
            </div>
          )}
          <button
            className="boton-chico"
            style={{ marginTop: 10 }}
            onClick={() => void actualizarResumen()}
            disabled={resumen === 'mirando'}
          >
            Revisar de nuevo
          </button>
        </div>
      )}

      {repetidas && repetidas.vacias.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Fichas repetidas vacías · {repetidas.vacias.length}</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Tienen el mismo nombre exacto que otra ficha y no tienen ningún producto, ni compras, ni
            pagos. Se unen de una a su gemela, la que tiene los datos. Mirá la lista: no se toca
            nada hasta que confirmes.
          </p>
          <div className="tabla-envoltorio">
            <table className="tabla-turno">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ficha vacía, creada el</th>
                  <th>Gemela, que queda</th>
                  <th>Pasa a la gemela</th>
                </tr>
              </thead>
              <tbody>
                {repetidas.vacias.map(({ vacia, gemela }) => {
                  const plan = armarUnion(gemela.proveedor, vacia, [], [])
                  const pasa = [...plan.datosQueSeRescatan, ...plan.aliasNuevos.map((a) => `otro nombre: ${a}`)]
                  return (
                    <tr key={vacia.id}>
                      <td>{vacia.nombre}</td>
                      <td>
                        {creada(vacia.creadoEn)}
                        {vacia.activo === false && <span className="silencio"> · inactiva</span>}
                      </td>
                      <td>
                        {cuantos(gemela.productos, 'producto', 'productos')}
                        {gemela.movimientos > 0 && ` · ${cuantos(gemela.movimientos, 'compra o pago', 'compras y pagos')}`}
                      </td>
                      <td>{pasa.length > 0 ? pasa.join(', ') : <span className="silencio">nada</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button
            className="boton-principal"
            style={{ marginTop: 12 }}
            onClick={() => void unirLasVacias()}
            disabled={trabajando}
          >
            {trabajando
              ? 'Uniendo…'
              : `Unir ${repetidas.vacias.length === 1 ? 'la ficha vacía' : `las ${repetidas.vacias.length} fichas vacías`} a su gemela`}
          </button>
        </div>
      )}

      {repetidas && repetidas.aMano.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Mismo nombre, con datos en más de una · {repetidas.aMano.length}</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Las dos tienen productos, compras o pagos: hay que mirarlas y unirlas de a una. «Elegir» las
            pone abajo, con la de más productos como la que queda; antes de unir se ve qué pasa.
          </p>
          <ul className="lista">
            {repetidas.aMano.map((g) => (
              <li className="item" key={g.nombre} style={{ display: 'block' }}>
                <div className="item-titulo">{g.nombre}</div>
                <div className="item-sub silencio">
                  {g.fichas
                    .map(
                      (f) =>
                        `${cuantos(f.productos, 'producto', 'productos')}, ${cuantos(f.movimientos, 'compra o pago', 'compras y pagos')}`,
                    )
                    .join(' · ')}
                </div>
                <div className="botonera">
                  <button
                    className="boton-chico"
                    onClick={() => {
                      setIdQueda(g.fichas[0].proveedor.id)
                      setIdSeAbsorbe(g.fichas[1].proveedor.id)
                      setHecho(null)
                    }}
                  >
                    Elegir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Fichas que parecen la misma</p>
        {sugeridosVisibles.length === 0 ? (
          <p className="vacio" style={{ margin: 0 }}>
            Ninguna. Igual podés elegir dos a mano acá abajo.
          </p>
        ) : (
          <>
            <p className="silencio" style={{ marginTop: 0 }}>
              Son sugerencias, no decisiones: mirá cada una antes de unir.
            </p>
            <ul className="lista">
              {sugeridosVisibles.map((par) => (
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
                      Dejar «{conProductos(par.a)}
                    </button>
                    <button
                      className="boton-chico"
                      onClick={() => {
                        setIdQueda(par.b.id)
                        setIdSeAbsorbe(par.a.id)
                        setHecho(null)
                      }}
                    >
                      Dejar «{conProductos(par.b)}
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
                {etiqueta(p)}
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
                  {etiqueta(p)}
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
