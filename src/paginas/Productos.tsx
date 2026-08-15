import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Producto } from '../db/db'
import { costoDesactualizado, margenPorcentual } from '../lib/calculos'
import { fechaLinda, hoyISO, leerNumero, normalizar, plata, porcentaje } from '../lib/formato'

export default function Productos() {
  const [consulta, setConsulta] = useState('')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [creando, setCreando] = useState(false)
  const [soloAlertas, setSoloAlertas] = useState(false)

  const total = useLiveQuery(() => db.productos.count(), [])

  const resultados = useLiveQuery(async () => {
    const partes = normalizar(consulta).split(/\s+/).filter(Boolean)
    if (!partes.length && !soloAlertas) {
      return db.productos.orderBy('descripcion').limit(50).toArray()
    }
    const encontrados = await db.productos
      .filter((p) => partes.every((parte) => p.busqueda.includes(parte)))
      .limit(soloAlertas ? 2000 : 100)
      .toArray()
    if (soloAlertas) {
      return encontrados.filter((p) => costoDesactualizado(p)).slice(0, 100)
    }
    return encontrados
  }, [consulta, soloAlertas])

  const desactualizados = useLiveQuery(async () => {
    const todos = await db.productos.toArray()
    return todos.filter((p) => costoDesactualizado(p)).length
  }, [])

  if (editando || creando) {
    return (
      <FormularioProducto
        producto={editando}
        onSalir={() => {
          setEditando(null)
          setCreando(false)
        }}
      />
    )
  }

  return (
    <>
      <h2>Productos</h2>

      {desactualizados !== undefined && desactualizados > 0 && (
        <div className="aviso aviso-ojo">
          <strong>{desactualizados}</strong> de {total} productos tienen el precio de compra
          vencido o sin cargar. El margen de contribución les queda inflado, porque el precio de
          venta está actualizado y el de compra no.{' '}
          <button
            className="boton-chico"
            style={{ marginTop: 6 }}
            onClick={() => setSoloAlertas(!soloAlertas)}
          >
            {soloAlertas ? 'Ver todos' : 'Ver esos productos'}
          </button>
        </div>
      )}

      <div className="tarjeta">
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por código o nombre…"
          inputMode="search"
        />
        <div className="botonera" style={{ marginTop: 10 }}>
          <button className="boton-principal" onClick={() => setCreando(true)}>
            + Producto nuevo
          </button>
        </div>
        <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
          {total ?? '…'} productos en el catálogo
          {soloAlertas ? ' · mostrando solo los de costo vencido' : ''}
        </p>
      </div>

      <div className="tarjeta">
        {!resultados ? (
          <p className="vacio">Buscando…</p>
        ) : resultados.length === 0 ? (
          <p className="vacio">Sin resultados.</p>
        ) : (
          <ul className="lista">
            {resultados.map((p) => {
              const margen = p.precioVenta
                ? margenPorcentual(p.precioVenta, p.precioCompra)
                : null
              return (
                <li className="item" key={p.codigo} onClick={() => setEditando(p)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="item-titulo">{p.descripcion}</div>
                    <div className="item-sub">
                      {p.codigo}
                      {p.proveedor ? ` · ${p.proveedor}` : ''}
                      {p.stock !== null && p.stock !== undefined ? ` · stock ${p.stock}` : ''}
                    </div>
                    <div className="item-sub">
                      Costo {plata(p.precioCompra)} · Margen{' '}
                      {margen === null ? '—' : porcentaje(margen)}
                      {costoDesactualizado(p) && (
                        <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                          COSTO VIEJO
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="item-monto">{plata(p.precioVenta)}</div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function FormularioProducto({
  producto,
  onSalir,
}: {
  producto: Producto | null
  onSalir: () => void
}) {
  const nuevo = !producto
  const [codigo, setCodigo] = useState(producto?.codigo ?? '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '')
  const [proveedor, setProveedor] = useState(producto?.proveedor ?? '')
  const [precioCompra, setPrecioCompra] = useState(
    producto?.precioCompra != null ? String(producto.precioCompra) : '',
  )
  const [rentabilidad, setRentabilidad] = useState(
    producto?.rentabilidad != null ? String(Math.round(producto.rentabilidad * 100)) : '',
  )
  const [precioVenta, setPrecioVenta] = useState(
    producto?.precioVenta != null ? String(producto.precioVenta) : '',
  )
  const [fechaCompra, setFechaCompra] = useState(producto?.fechaCompra ?? '')
  const [stock, setStock] = useState(
    producto?.stock != null ? String(producto.stock) : '',
  )
  const [error, setError] = useState('')

  const compraNum = leerNumero(precioCompra)
  const ventaNum = leerNumero(precioVenta)
  const rentNum = leerNumero(rentabilidad)

  const sugerido = useMemo(() => {
    if (!compraNum || !rentNum) return null
    return Math.round(compraNum * (1 + rentNum / 100))
  }, [compraNum, rentNum])

  const margen = ventaNum && compraNum ? margenPorcentual(ventaNum, compraNum) : null

  async function guardar() {
    const cod = codigo.trim().toUpperCase()
    if (!cod) return setError('Falta el código.')
    if (!descripcion.trim()) return setError('Falta la descripción.')
    if (nuevo) {
      const existe = await db.productos.get(cod)
      if (existe) return setError(`Ya existe un producto con el código ${cod}.`)
    }

    const registro: Producto = {
      codigo: cod,
      descripcion: descripcion.trim(),
      proveedor: proveedor.trim() || null,
      fechaCompra: fechaCompra || null,
      precioCompra: compraNum,
      rentabilidad: rentNum != null ? rentNum / 100 : null,
      precioVenta: ventaNum,
      fechaPrecioVenta:
        ventaNum !== producto?.precioVenta ? hoyISO() : (producto?.fechaPrecioVenta ?? null),
      busqueda: normalizar(`${cod} ${descripcion}`),
      stock: stock.trim() === '' ? null : Number(stock),
      activo: true,
    }
    await db.productos.put(registro)
    onSalir()
  }

  async function borrar() {
    if (!producto) return
    if (!confirm(`¿Borrar ${producto.descripcion} del catálogo?`)) return
    await db.productos.delete(producto.codigo)
    onSalir()
  }

  return (
    <>
      <h2>{nuevo ? 'Producto nuevo' : 'Editar producto'}</h2>

      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="p-codigo">Código</label>
          <input
            id="p-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            disabled={!nuevo}
            placeholder="Ej: MR002"
          />
        </div>
        <div className="campo">
          <label htmlFor="p-desc">Descripción</label>
          <input
            id="p-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: MATE GALLETA"
          />
        </div>
        <div className="campo">
          <label htmlFor="p-prov">Proveedor</label>
          <input
            id="p-prov"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Ej: MOHICANO"
          />
        </div>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Precios</p>
        <div className="grilla grilla-2">
          <div className="campo">
            <label htmlFor="p-compra">Precio de compra</label>
            <input
              id="p-compra"
              inputMode="decimal"
              value={precioCompra}
              onChange={(e) => setPrecioCompra(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="campo">
            <label htmlFor="p-fecha">Fecha de compra</label>
            <input
              id="p-fecha"
              type="date"
              value={fechaCompra}
              onChange={(e) => setFechaCompra(e.target.value)}
            />
          </div>
        </div>

        <div className="grilla grilla-2">
          <div className="campo">
            <label htmlFor="p-rent">Rentabilidad objetivo (%)</label>
            <input
              id="p-rent"
              inputMode="decimal"
              value={rentabilidad}
              onChange={(e) => setRentabilidad(e.target.value)}
              placeholder="130"
            />
          </div>
          <div className="campo">
            <label htmlFor="p-venta">Precio de venta</label>
            <input
              id="p-venta"
              inputMode="decimal"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {sugerido !== null && (
          <div className="fila">
            <span className="fila-etiqueta">Precio sugerido según rentabilidad</span>
            <span className="fila-valor">
              {plata(sugerido)}{' '}
              <button
                className="boton-chico"
                style={{ marginLeft: 6 }}
                onClick={() => setPrecioVenta(String(sugerido))}
              >
                Usar
              </button>
            </span>
          </div>
        )}

        {margen !== null && ventaNum && compraNum && (
          <div className="fila destacada">
            <span className="fila-etiqueta">Margen real</span>
            <span className="fila-valor">
              {plata(ventaNum - compraNum)} · {porcentaje(margen)}
            </span>
          </div>
        )}

        {producto?.fechaPrecioVenta && (
          <p className="silencio" style={{ marginTop: 8 }}>
            Precio de venta actualizado el {fechaLinda(producto.fechaPrecioVenta)}.
          </p>
        )}
      </div>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="p-stock">Stock (dejalo vacío si no querés controlarlo)</label>
          <input
            id="p-stock"
            type="number"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Sin control de stock"
          />
        </div>
        <p className="silencio">
          Si cargás un número, cada venta lo descuenta sola.
        </p>
      </div>

      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar}>
          Guardar
        </button>
      </div>
      {!nuevo && (
        <button className="boton-peligro" style={{ width: '100%', marginTop: 8 }} onClick={borrar}>
          Borrar producto
        </button>
      )}
    </>
  )
}
