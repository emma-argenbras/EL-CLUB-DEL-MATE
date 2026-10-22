import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { fechaLinda, leerNumero, plata, porcentaje } from '../lib/formato'
import { costoSospechoso, margenPorcentual, precioSugerido } from '../lib/calculos'
import {
  confirmarCosto,
  guardarCosto,
  productosParaRevisar,
  type ResultadoGuardar,
} from '../db/revisarCostos'
import { useSinGuardar } from '../lib/sinGuardar'

/** Lo que paso con cada renglon despues de guardar. */
type Estado = { tipo: 'guardado' } | { tipo: 'error'; texto: string }

/**
 * Corregir costos de a muchos, filtrando por proveedor.
 *
 * Sandra actualiza costos con las facturas del proveedor delante.
 * Entrando y saliendo de la ficha de cada producto, de a cien, eso no
 * se termina nunca: acá los corrige en la misma lista.
 *
 * Se escriben el costo y su fecha, y nada más. Y solo en los renglones
 * que ella toca: los demás quedan como están.
 */
export default function RevisionCostos() {
  const [proveedorId, setProveedorId] = useState('')
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [estados, setEstados] = useState<Record<string, Estado>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
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

  const lista = useMemo(
    () => (datos ? productosParaRevisar(datos.productos, proveedorId || null) : []),
    [datos, proveedorId],
  )

  // Cuántos le faltan a cada proveedor: sin esto hay que entrar y salir
  // del filtro para saber por dónde conviene empezar.
  const porProveedor = useMemo(() => {
    if (!datos) return []
    const cuenta = new Map<string, number>()
    for (const { producto } of productosParaRevisar(datos.productos, null)) {
      const id = producto.proveedorId ?? ''
      cuenta.set(id, (cuenta.get(id) ?? 0) + 1)
    }
    const nombre = new Map(datos.proveedores.map((p) => [p.id, p.nombre]))
    return [...cuenta.entries()]
      .map(([id, n]) => ({
        id,
        nombre: id ? (nombre.get(id) ?? `(ficha que no existe: ${id})`) : '(sin proveedor)',
        n,
      }))
      .sort((a, b) => b.n - a.n)
  }, [datos])

  if (!datos) return <p className="vacio">Buscando los costos que faltan…</p>

  const total = porProveedor.reduce((a, b) => a + b.n, 0)

  async function guardar(codigo: string, costoQueSeVeia: number | null) {
    const escrito = leerNumero(borradores[codigo] ?? '')
    if (escrito === null || escrito <= 0) {
      setEstados((e) => ({ ...e, [codigo]: { tipo: 'error', texto: 'Poné un costo mayor a cero.' } }))
      return
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
        if (!confirm(`${aviso}\n\n¿Lo guardo igual?`)) return
      }
    }

    await escribir(codigo, () => guardarCosto(codigo, escrito, costoQueSeVeia))
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
    await escribir(codigo, () => confirmarCosto(codigo, costo))
  }

  async function escribir(codigo: string, accion: () => Promise<ResultadoGuardar>) {
    setGuardando(codigo)
    try {
      const r: ResultadoGuardar = await accion()
      if (r.estado === 'guardado') {
        setEstados((e) => ({ ...e, [codigo]: { tipo: 'guardado' } }))
        setBorradores((b) => ({ ...b, [codigo]: '' }))
      } else if (r.estado === 'no-existe') {
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
    } catch (e) {
      setEstados((x) => ({
        ...x,
        [codigo]: { tipo: 'error', texto: e instanceof Error ? e.message : String(e) },
      }))
    } finally {
      setGuardando(null)
    }
  }

  return (
    <>
      <h2>Revisión de costos</h2>

      <div className="aviso aviso-ojo">
        Los productos <strong>sin costo</strong> o con el <strong>costo vencido</strong>, para
        corregirlos acá mismo. Se guarda el costo y su fecha; el precio de venta, la rentabilidad
        y el stock no se tocan. Solo cambia lo que cargás vos. Si un costo vencido sigue siendo
        el mismo, tocá <strong>«Sigue igual»</strong>: se renueva la fecha sin volver a escribirlo.
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Por proveedor</p>
        <div className="campo">
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Todos ({total})</option>
            {porProveedor.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.n})
              </option>
            ))}
          </select>
        </div>
        <p className="silencio" style={{ marginBottom: 0 }}>
          Con la factura del proveedor delante es más rápido: elegís el proveedor y vas bajando.
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="vacio">
          {proveedorId
            ? 'Este proveedor no tiene costos para revisar. '
            : 'No hay costos para revisar. '}
          Los descontinuados no cuentan: nadie los va a reponer.
        </p>
      ) : (
        <ul className="lista">
          {lista.map(({ producto: p, motivo }) => {
            const escrito = leerNumero(borradores[p.codigo] ?? '')
            const estado = estados[p.codigo]
            const raro = costoSospechoso(p)
            // El margen que quedaría con lo que está escribiendo: es la
            // forma de darse cuenta del cero de menos antes de guardar,
            // no después.
            const margenNuevo =
              escrito !== null && escrito > 0 && p.precioVenta
                ? margenPorcentual(p.precioVenta, escrito)
                : null
            return (
              <li className="item" key={p.codigo} style={{ display: 'block' }}>
                <div className="item-titulo">
                  {p.codigo} · {p.descripcion}
                </div>
                <div className="item-sub">
                  {motivo === 'sin-costo' ? (
                    <span className="chip chip-alerta">SIN COSTO</span>
                  ) : (
                    <>
                      Costo {plata(p.precioCompra)}
                      {p.fechaCompra ? ` desde el ${fechaLinda(p.fechaCompra)}` : ' sin fecha'}
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
                    placeholder="Costo nuevo"
                    style={{ flexGrow: 1, minWidth: 0 }}
                    value={borradores[p.codigo] ?? ''}
                    onChange={(e) => {
                      setBorradores((b) => ({ ...b, [p.codigo]: e.target.value }))
                      setEstados((x) => ({ ...x, [p.codigo]: undefined as never }))
                    }}
                  />
                  {/* Sin nada escrito, un costo vencido se puede
                      confirmar tal cual: muchas veces el proveedor
                      cobra lo mismo y solo falta decirlo. */}
                  {motivo === 'vencido' && escrito === null && p.precioCompra != null ? (
                    <button
                      className="boton-chico"
                      style={{ flex: 'none' }}
                      disabled={guardando === p.codigo}
                      title="El costo sigue siendo el mismo: se renueva la fecha"
                      onClick={() => void confirmar(p.codigo, p.precioCompra!)}
                    >
                      {guardando === p.codigo ? 'Guardando…' : 'Sigue igual'}
                    </button>
                  ) : (
                    <button
                      className="boton-chico"
                      style={{ flex: 'none' }}
                      disabled={guardando === p.codigo || escrito === null}
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

                {estado?.tipo === 'guardado' && (
                  <div className="item-sub positivo">Guardado, con la fecha de hoy.</div>
                )}
                {estado?.tipo === 'error' && (
                  <div className="item-sub negativo">{estado.texto}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
