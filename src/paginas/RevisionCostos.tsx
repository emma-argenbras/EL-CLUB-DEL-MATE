import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { fechaLinda, hoyISO, leerNumero, plata, porcentaje } from '../lib/formato'
import { costoSospechoso, margenPorcentual, precioSugerido } from '../lib/calculos'
import { remarcar } from '../db/ingresoMercaderia'
import {
  confirmarCosto,
  guardarCosto,
  planillaDelProveedor,
  preciosParaPoner,
  preguntaAntesDePonerPrecios,
  problemaDeLaFecha,
  productosParaRevisar,
  proveedoresConCostos,
  type EnPlanilla,
  type ResultadoGuardar,
} from '../db/revisarCostos'
import { useSinGuardar } from '../lib/sinGuardar'

/** Lo que paso con cada renglon despues de guardar. */
type Estado = { tipo: 'guardado'; texto: string } | { tipo: 'error'; texto: string }

export const MOTIVO_REMARCAR_PLANILLA = 'Remarcado desde la planilla del proveedor'

/**
 * Corregir costos de a muchos, filtrando por proveedor.
 *
 * Sandra actualiza costos con las facturas del proveedor delante.
 * Entrando y saliendo de la ficha de cada producto, de a cien, eso no
 * se termina nunca: acá los corrige en la misma lista.
 *
 * Se escriben el costo y su fecha, y nada más. Y solo en los renglones
 * que ella toca: los demás quedan como están.
 *
 * Tiene dos vistas (19/11). «Para revisar» es la de siempre: los que no
 * tienen costo o lo tienen vencido. «Todos sus productos» es la planilla
 * del proveedor: lo que se seguía haciendo en el Excel cada vez que
 * llegaba mercadería (ver planillaDelProveedor en db/revisarCostos.ts).
 */
export default function RevisionCostos() {
  const [params, setParams] = useSearchParams()
  // El proveedor y la vista viven en la direccion: se puede llegar
  // directo desde la ficha del proveedor, y recargar no los pierde.
  const proveedorId = params.get('proveedor') ?? ''
  const verTodos = proveedorId !== '' && params.get('todos') === '1'
  const [fecha, setFecha] = useState(hoyISO())
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [estados, setEstados] = useState<Record<string, Estado>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [avisoPrecios, setAvisoPrecios] = useState('')
  const entradas = useRef(new Map<string, HTMLInputElement>())
  useSinGuardar(
    'costos escritos en la revisión',
    Object.values(borradores).some((b) => b.trim() !== ''),
  )

  const datos = useLiveQuery(async () => {
    const [productos, proveedores] = await Promise.all([
      db.productos.toArray(),
      db.proveedores.toArray(),
    ])
    return { productos, proveedores }
  }, [])

  // Cuántos tiene cada proveedor y cuántos le faltan: sin esto hay que
  // entrar y salir del filtro para saber por dónde conviene empezar.
  const porProveedor = useMemo(
    () => (datos ? proveedoresConCostos(datos.productos, datos.proveedores) : []),
    [datos],
  )
  const planilla = useMemo(
    () => (datos && proveedorId ? planillaDelProveedor(datos.productos, proveedorId) : null),
    [datos, proveedorId],
  )
  const filas: EnPlanilla[] = useMemo(() => {
    if (!datos) return []
    if (verTodos && planilla) return planilla.filas
    return productosParaRevisar(datos.productos, proveedorId || null).map(({ producto, motivo }) => ({
      producto,
      estado: motivo,
    }))
  }, [datos, verTodos, planilla, proveedorId])
  // Los que quedaron por debajo de su markup. Solo en la planilla: en
  // «para revisar» todos los costos están vacíos o vencidos, y sobre un
  // costo así no se sugiere ningún precio.
  const paraPoner = useMemo(() => (verTodos ? preciosParaPoner(filas) : []), [verTodos, filas])

  if (!datos) return <p className="vacio">Buscando los costos que faltan…</p>

  const total = porProveedor.reduce((a, b) => a + b.paraRevisar, 0)
  const elegido = porProveedor.find((p) => p.id === proveedorId)
  const hoy = hoyISO()
  const fechaMal = problemaDeLaFecha(fecha, hoy)

  function elegir(id: string, todos: boolean) {
    setAvisoPrecios('')
    const nuevos = new URLSearchParams()
    if (id) nuevos.set('proveedor', id)
    if (id && todos) nuevos.set('todos', '1')
    setParams(nuevos, { replace: true })
  }

  /** Guarda el costo escrito en ese renglón. Devuelve si quedó guardado. */
  async function guardar(codigo: string, costoQueSeVeia: number | null): Promise<boolean> {
    const escrito = leerNumero(borradores[codigo] ?? '')
    if (escrito === null || escrito <= 0) {
      setEstados((e) => ({ ...e, [codigo]: { tipo: 'error', texto: 'Poné un costo mayor a cero.' } }))
      return false
    }

    // Segundo freno, antes de escribir. Un cero de más o de menos al
    // tipear es el error más común que hay cargando costos, y acá se
    // cargan de a muchos y rápido. El número que queda se mira contra
    // el precio de venta: si no cierra, se pregunta.
    const producto = datos?.productos.find((p) => p.codigo === codigo)
    if (producto) {
      const quedaria = { ...producto, precioCompra: escrito }
      const raro = costoSospechoso(quedaria)
      const bajoCosto = producto.precioVenta != null && escrito >= producto.precioVenta
      if (raro || bajoCosto) {
        const aviso = bajoCosto
          ? `Con un costo de ${plata(escrito)} estarías vendiendo a ${plata(producto.precioVenta)}, o sea al costo o por debajo.`
          : `Con un costo de ${plata(escrito)} el producto se vendería ${raro!.veces.toFixed(0)} veces más caro de lo que ese costo explica${raro!.costoProbable ? `. ¿No serán ${plata(raro!.costoProbable)}?` : '.'}`
        if (!confirm(`${aviso}\n\n¿Lo guardo igual?`)) return false
      }
    }

    return escribir(codigo, () => guardarCosto(codigo, escrito, costoQueSeVeia, fecha))
  }

  // "Lo confirmé, sigue valiendo lo mismo": renueva la fecha sin
  // volver a tipear el número.
  async function confirmar(codigo: string, costo: number) {
    const producto = datos?.productos.find((p) => p.codigo === codigo)
    const raro = producto ? costoSospechoso(producto) : null
    if (
      raro &&
      !confirm(
        `Ojo: con ${plata(costo)} el producto se vende ${raro.veces.toFixed(0)} veces más caro de lo que ese costo explica${raro.costoProbable ? `. ¿No serán ${plata(raro.costoProbable)}?` : '.'}\n\n¿Confirmar ${plata(costo)} igual?`,
      )
    ) {
      return
    }
    await escribir(codigo, () => confirmarCosto(codigo, costo, fecha))
  }

  async function escribir(codigo: string, accion: () => Promise<ResultadoGuardar>): Promise<boolean> {
    setGuardando(codigo)
    try {
      const r: ResultadoGuardar = await accion()
      if (r.estado === 'guardado') {
        setEstados((e) => ({
          ...e,
          [codigo]: {
            tipo: 'guardado',
            texto: fecha === hoy ? 'Guardado, con la fecha de hoy.' : `Guardado, con fecha ${fechaLinda(fecha)}.`,
          },
        }))
        setBorradores((b) => ({ ...b, [codigo]: '' }))
        return true
      }
      if (r.estado === 'no-existe') {
        setEstados((e) => ({
          ...e,
          [codigo]: { tipo: 'error', texto: 'Ese producto ya no está. Actualizá la pantalla.' },
        }))
      } else {
        setEstados((e) => ({
          ...e,
          [codigo]: {
            tipo: 'error',
            texto: `No se guardó: alguien le puso ${plata(r.costoAhora)} mientras tanto. Mirá cuál de los dos va y volvé a cargarlo.`,
          },
        }))
      }
      return false
    } catch (e) {
      setEstados((x) => ({
        ...x,
        [codigo]: { tipo: 'error', texto: e instanceof Error ? e.message : String(e) },
      }))
      return false
    } finally {
      setGuardando(null)
    }
  }

  /**
   * Enter en un costo: guarda y pasa al renglón de abajo, como en una
   * planilla. Sin esto, veinte productos son veinte viajes al mouse.
   */
  async function guardarYSeguir(codigo: string, costoQueSeVeia: number | null) {
    const i = filas.findIndex((f) => f.producto.codigo === codigo)
    const siguiente = filas[i + 1]?.producto.codigo
    if ((await guardar(codigo, costoQueSeVeia)) && siguiente) entradas.current.get(siguiente)?.focus()
  }

  /** El costo ya cambió: poner el precio que pide el markup, en ese producto. */
  async function ponerPrecio(codigo: string, descripcion: string, actual: number, sugerido: number) {
    if (
      !confirm(
        `¿Poner el precio de ${descripcion} en ${plata(sugerido)}?\n\nHoy está en ${plata(actual)}. Queda en el historial con el motivo.`,
      )
    ) {
      return
    }
    const n = await remarcar([{ codigo, precioNuevo: sugerido }], MOTIVO_REMARCAR_PLANILLA)
    setEstados((e) => ({
      ...e,
      [codigo]: {
        tipo: 'guardado',
        texto: n === 1 ? `El precio quedó en ${plata(sugerido)}.` : 'No hizo falta: el precio ya estaba así.',
      },
    }))
  }

  /**
   * Todos los precios que quedaron atrasados, de una. Escribe en varios
   * productos: pregunta antes diciendo cuántos, y queda en el historial.
   */
  async function ponerTodosLosPrecios() {
    if (paraPoner.length === 0) return
    if (!confirm(preguntaAntesDePonerPrecios(paraPoner, elegido?.nombre ?? 'este proveedor'))) return
    try {
      const n = await remarcar(
        paraPoner.map((x) => ({ codigo: x.codigo, precioNuevo: x.sugerido })),
        MOTIVO_REMARCAR_PLANILLA,
      )
      setAvisoPrecios(
        n === 0
          ? 'No hizo falta: los precios ya estaban así.'
          : `Listo: ${n === 1 ? 'se cambió 1 precio' : `se cambiaron ${n} precios`}. Acordate de las etiquetas.`,
      )
    } catch (e) {
      setAvisoPrecios(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <h2>Revisión de costos</h2>

      {verTodos ? (
        <div className="aviso aviso-ojo">
          <strong>La planilla de {elegido?.nombre ?? 'este proveedor'}:</strong> todos sus productos,
          en el orden de sus códigos. Escribí el costo nuevo y apretá <strong>Enter</strong>: se guarda
          y pasa al de abajo. Si un costo no cambió, tocá <strong>«Sigue igual»</strong> y se renueva la
          fecha. El precio de venta no cambia solo: cuando el costo lo deja atrasado, aparece el botón
          para ponerlo, y al final de la lista podés ponerlos todos juntos.
        </div>
      ) : (
        <div className="aviso aviso-ojo">
          Los productos <strong>sin costo</strong> o con el <strong>costo vencido</strong>, para
          corregirlos acá mismo. Se guarda el costo y su fecha; el precio de venta, la rentabilidad
          y el stock no se tocan. Solo cambia lo que cargás vos. Si un costo vencido sigue siendo
          el mismo, tocá <strong>«Sigue igual»</strong>: se renueva la fecha sin volver a escribirlo.
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Por proveedor</p>
        <div className="campo">
          <select
            aria-label="Proveedor"
            value={proveedorId}
            onChange={(e) => elegir(e.target.value, verTodos)}
          >
            <option value="">Todos ({total} para revisar)</option>
            {porProveedor.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.paraRevisar > 0 ? `${p.paraRevisar} para revisar de ${p.productos}` : `${p.productos}, al día`})
              </option>
            ))}
          </select>
        </div>
        {proveedorId === '' ? (
          <p className="silencio" style={{ marginBottom: 0 }}>
            Elegí un proveedor para ver también su planilla: todos sus productos, como en el Excel,
            para cargar los costos de una entrega bajando por la lista.
          </p>
        ) : (
          <>
            <div className="botonera">
              <button className={!verTodos ? 'pestana activa' : 'pestana'} onClick={() => elegir(proveedorId, false)}>
                Para revisar ({elegido?.paraRevisar ?? 0})
              </button>
              <button className={verTodos ? 'pestana activa' : 'pestana'} onClick={() => elegir(proveedorId, true)}>
                Todos sus productos ({elegido?.productos ?? 0})
              </button>
            </div>
            <div className="campo" style={{ marginTop: 10, marginBottom: 0 }}>
              <label htmlFor="fecha-compra">Fecha de la compra</label>
              <input
                id="fecha-compra"
                type="date"
                value={fecha}
                max={hoy}
                onChange={(e) => setFecha(e.target.value)}
              />
              {fechaMal ? (
                <p className="negativo" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
                  {fechaMal}
                </p>
              ) : (
                <p className="silencio" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
                  Es la fecha con la que queda cada costo que guardes: la de la factura, si no es la
                  de hoy.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {verTodos && planilla && planilla.descontinuados > 0 && (
        <p className="silencio">
          {planilla.descontinuados === 1
            ? 'Hay 1 producto descontinuado de este proveedor que no se muestra.'
            : `Hay ${planilla.descontinuados} productos descontinuados de este proveedor que no se muestran.`}{' '}
          Si volvió a entrar, sacale la marca desde <Link to="/productos">Productos</Link>.
        </p>
      )}

      {filas.length === 0 ? (
        <p className="vacio">
          {verTodos
            ? 'Este proveedor no tiene productos activos. '
            : proveedorId
              ? 'Este proveedor no tiene costos para revisar. '
              : 'No hay costos para revisar. '}
          Los descontinuados no cuentan: nadie los va a reponer.
        </p>
      ) : (
        <ul className="lista" aria-label={verTodos ? 'Planilla del proveedor' : 'Costos para revisar'}>
          {filas.map(({ producto: p, estado: situacion }) => {
            const escrito = leerNumero(borradores[p.codigo] ?? '')
            const estado = estados[p.codigo]
            const raro = costoSospechoso(p)
            // El precio que pide el markup solo se ofrece con el costo al
            // día: sugerir un precio sobre un costo vencido sería
            // remarcar con un número que nadie confirmó.
            const atrasado = paraPoner.find((x) => x.codigo === p.codigo) ?? null
            // El margen que quedaría con lo que está escribiendo: es la
            // forma de darse cuenta del cero de menos antes de guardar,
            // no después.
            const margenNuevo =
              escrito !== null && escrito > 0 && p.precioVenta
                ? margenPorcentual(p.precioVenta, escrito)
                : null
            // Sin nada escrito, un costo que ya está se puede confirmar
            // tal cual: muchas veces el proveedor cobra lo mismo y solo
            // falta decirlo. En «para revisar» eso vale para los
            // vencidos; en la planilla, para cualquiera con costo.
            const sePuedeConfirmar =
              escrito === null && p.precioCompra != null && (situacion === 'vencido' || verTodos)
            return (
              <li className="item" key={p.codigo} style={{ display: 'block' }}>
                <div className="item-titulo">
                  {p.codigo} · {p.descripcion}
                </div>
                <div className="item-sub">
                  {situacion === 'sin-costo' ? (
                    <span className="chip chip-alerta">SIN COSTO</span>
                  ) : (
                    <>
                      Costo {plata(p.precioCompra)}
                      {p.fechaCompra ? ` desde el ${fechaLinda(p.fechaCompra)}` : ' sin fecha'}
                      {verTodos && situacion === 'vencido' && (
                        <>
                          {' '}
                          <span className="chip chip-alerta">VENCIDO</span>
                        </>
                      )}
                    </>
                  )}
                  {' · se vende a '}
                  {plata(p.precioVenta)}
                  {p.rentabilidad != null && ` · markup ${porcentaje(p.rentabilidad * 100, 0)}`}
                </div>

                {raro && (
                  <div className="item-sub negativo">
                    Ojo: con ese costo se vende {raro.veces.toFixed(0)} veces más caro de lo que
                    debería{raro.costoProbable ? `. ¿No será ${plata(raro.costoProbable)}?` : '.'}
                  </div>
                )}

                {/* En una sola fila: se corrigen de a cien y cada
                    renglon que ocupa el doble es el doble de scroll. */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    placeholder="Costo nuevo"
                    aria-label={`Costo nuevo de ${p.codigo}`}
                    style={{ flexGrow: 1, minWidth: 0 }}
                    value={borradores[p.codigo] ?? ''}
                    ref={(el) => {
                      if (el) entradas.current.set(p.codigo, el)
                      else entradas.current.delete(p.codigo)
                    }}
                    onChange={(e) => {
                      setBorradores((b) => ({ ...b, [p.codigo]: e.target.value }))
                      setEstados((x) => ({ ...x, [p.codigo]: undefined as never }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || guardando !== null || fechaMal) return
                      e.preventDefault()
                      if (escrito !== null) void guardarYSeguir(p.codigo, p.precioCompra ?? null)
                    }}
                  />
                  {sePuedeConfirmar ? (
                    <button
                      className="boton-chico"
                      style={{ flex: 'none' }}
                      disabled={guardando === p.codigo || fechaMal !== null}
                      title="El costo sigue siendo el mismo: se renueva la fecha"
                      onClick={() => void confirmar(p.codigo, p.precioCompra!)}
                    >
                      {guardando === p.codigo ? 'Guardando…' : 'Sigue igual'}
                    </button>
                  ) : (
                    <button
                      className="boton-chico"
                      style={{ flex: 'none' }}
                      disabled={guardando === p.codigo || escrito === null || fechaMal !== null}
                      onClick={() => void guardar(p.codigo, p.precioCompra ?? null)}
                    >
                      {guardando === p.codigo ? 'Guardando…' : 'Guardar'}
                    </button>
                  )}
                </div>

                {margenNuevo !== null && (
                  <div className={margenNuevo <= 0 ? 'item-sub negativo' : 'item-sub silencio'}>
                    Con ese costo el margen queda en {porcentaje(margenNuevo)}
                    {p.rentabilidad != null &&
                      ` · el precio que pediría su markup es ${plata(precioSugerido({ ...p, precioCompra: escrito! }))}`}
                    {margenNuevo <= 0 && ' — estarías vendiendo bajo costo.'}
                  </div>
                )}

                {estado?.tipo === 'guardado' && <div className="item-sub positivo">{estado.texto}</div>}
                {estado?.tipo === 'error' && (
                  <div className="item-sub negativo">{estado.texto}</div>
                )}

                {/* El costo quedó cargado y el precio se despegó de su
                    markup: en el Excel se actualizaba solo; acá es un
                    toque, porque cambiar un precio es también cambiar
                    la etiqueta en el local. */}
                {atrasado && escrito === null && (
                  <div className="item-sub" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>
                      Su markup pide <strong>{plata(atrasado.sugerido)}</strong>: se dejan de cobrar{' '}
                      {plata(atrasado.sugerido - atrasado.actual)} por unidad.
                    </span>
                    <button
                      className="boton-chico"
                      onClick={() => void ponerPrecio(p.codigo, p.descripcion, atrasado.actual, atrasado.sugerido)}
                    >
                      Poner {plata(atrasado.sugerido)}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* En el Excel el precio se movía solo al cambiar el costo. Acá,
          al terminar de bajar por la columna, es un botón: cambiar un
          precio es también cambiar una etiqueta en el local. */}
      {paraPoner.length > 0 && (
        <section className="tarjeta" aria-label="Precios por debajo de su markup">
          <p className="tarjeta-titulo">Precios por debajo de su markup ({paraPoner.length})</p>
          <ul className="lista" style={{ marginBottom: 10 }}>
            {paraPoner.map((x) => (
              <li className="item" key={x.codigo}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">
                    {x.codigo} · {x.descripcion}
                  </div>
                </div>
                <div className="item-sub" style={{ flex: 'none', textAlign: 'right' }}>
                  {plata(x.actual)} → <strong>{plata(x.sugerido)}</strong>
                </div>
              </li>
            ))}
          </ul>
          <button className="boton-principal" onClick={() => void ponerTodosLosPrecios()}>
            {paraPoner.length === 1 ? 'Poner ese precio' : `Poner los ${paraPoner.length} precios`}
          </button>
        </section>
      )}
      {avisoPrecios && (
        <p className="aviso aviso-ok" role="status">
          {avisoPrecios}
        </p>
      )}
    </>
  )
}
