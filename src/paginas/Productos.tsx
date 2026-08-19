import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db, nuevoId, productoVisible, type HistorialProducto, type Producto } from '../db/db'
import { costoDesactualizado, margenPorcentual, redondearPrecio } from '../lib/calculos'
import { fechaLinda, hoyISO, leerNumero, normalizar, plata, porcentaje } from '../lib/formato'
import { useSesion } from '../sync/useSesion'

export default function Productos() {
  const [parametros] = useSearchParams()
  const sesion = useSesion()
  const esOwner = sesion.perfil?.rol === 'owner'
  const [consulta, setConsulta] = useState('')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [creando, setCreando] = useState(false)
  const [soloAlertas, setSoloAlertas] = useState(parametros.get('alertas') === '1')
  const [verArchivados, setVerArchivados] = useState(false)

  const total = useLiveQuery(() => db.productos.filter(productoVisible).count(), [])
  const proveedores = useLiveQuery(() => db.proveedores.orderBy('nombre').toArray(), [])
  const nombresProveedor = useMemo(
    () => new Map((proveedores ?? []).map((p) => [p.id, p.nombre])),
    [proveedores],
  )

  const solicitudes = useLiveQuery(
    () =>
      esOwner
        ? db.productos.filter((p) => !!p.solicitudBorrado).toArray()
        : Promise.resolve<Producto[]>([]),
    [esOwner],
  )

  const resultados = useLiveQuery(async () => {
    if (verArchivados) {
      return db.productos.filter((p) => p.archivado === true).limit(200).toArray()
    }
    const partes = normalizar(consulta).split(/\s+/).filter(Boolean)
    if (!partes.length && !soloAlertas) {
      return db.productos.orderBy('descripcion').filter(productoVisible).limit(50).toArray()
    }
    const encontrados = await db.productos
      .filter(
        (p) => productoVisible(p) && partes.every((parte) => p.busqueda.includes(parte)),
      )
      .limit(soloAlertas ? 2000 : 100)
      .toArray()
    if (soloAlertas) {
      return encontrados.filter((p) => costoDesactualizado(p)).slice(0, 100)
    }
    return encontrados
  }, [consulta, soloAlertas, verArchivados])

  const desactualizados = useLiveQuery(async () => {
    const todos = await db.productos.filter(productoVisible).toArray()
    return todos.filter((p) => costoDesactualizado(p)).length
  }, [])

  async function aprobarSolicitud(p: Producto) {
    await db.productos.update(p.codigo, { archivado: true, solicitudBorrado: null })
  }

  async function rechazarSolicitud(p: Producto) {
    await db.productos.update(p.codigo, { solicitudBorrado: null })
  }

  async function reactivar(p: Producto) {
    await db.productos.update(p.codigo, { archivado: false })
  }

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

      {esOwner && solicitudes && solicitudes.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">
            {solicitudes.length} {solicitudes.length === 1 ? 'solicitud' : 'solicitudes'} de
            archivado pendiente{solicitudes.length === 1 ? '' : 's'}
          </p>
          <ul className="lista">
            {solicitudes.map((p) => (
              <li className="item" key={p.codigo} style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{p.descripcion}</div>
                  <div className="item-sub">
                    Pedido por {p.solicitudBorrado?.porNombre} · {fechaLinda(hoyISO())}
                    {p.solicitudBorrado?.motivo ? ` · "${p.solicitudBorrado.motivo}"` : ''}
                  </div>
                </div>
                <div className="botonera" style={{ flexShrink: 0 }}>
                  <button className="boton-chico" onClick={() => rechazarSolicitud(p)}>
                    Rechazar
                  </button>
                  <button
                    className="boton-chico boton-peligro"
                    onClick={() => aprobarSolicitud(p)}
                  >
                    Archivar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {desactualizados !== undefined && desactualizados > 0 && !verArchivados && (
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
          disabled={verArchivados}
        />
        <div className="botonera" style={{ marginTop: 10 }}>
          <button className="boton-principal" onClick={() => setCreando(true)}>
            + Producto nuevo
          </button>
        </div>
        <p className="silencio" style={{ marginTop: 8, marginBottom: 0 }}>
          {verArchivados
            ? 'Mostrando productos archivados'
            : `${total ?? '…'} productos en el catálogo${soloAlertas ? ' · mostrando solo los de costo vencido' : ''}`}
          {esOwner && (
            <>
              {' · '}
              <button className="boton-chico" onClick={() => setVerArchivados(!verArchivados)}>
                {verArchivados ? 'Ver catálogo activo' : 'Ver archivados'}
              </button>
            </>
          )}
        </p>
      </div>

      <div className="tarjeta">
        {!resultados ? (
          <p className="vacio">Buscando…</p>
        ) : resultados.length === 0 ? (
          <p className="vacio">{verArchivados ? 'No hay productos archivados.' : 'Sin resultados.'}</p>
        ) : (
          <ul className="lista">
            {resultados.map((p) => {
              const margen = p.precioVenta
                ? margenPorcentual(p.precioVenta, p.precioCompra)
                : null
              return (
                <li
                  className="item"
                  key={p.codigo}
                  onClick={() => !verArchivados && setEditando(p)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="item-titulo">{p.descripcion}</div>
                    <div className="item-sub">
                      {p.codigo}
                      {p.proveedorId && nombresProveedor.get(p.proveedorId)
                        ? ` · ${nombresProveedor.get(p.proveedorId)}`
                        : ''}
                      {p.stock !== null && p.stock !== undefined ? ` · stock ${p.stock}` : ''}
                    </div>
                    <div className="item-sub">
                      Costo {plata(p.precioCompra)} · Margen{' '}
                      {margen === null ? '—' : porcentaje(margen)}
                      {p.descontinuado ? (
                        <span className="chip" style={{ marginLeft: 6 }}>
                          Descontinuado
                        </span>
                      ) : (
                        costoDesactualizado(p) && (
                          <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                            COSTO VIEJO
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  {verArchivados ? (
                    <button className="boton-chico" onClick={() => reactivar(p)}>
                      Reactivar
                    </button>
                  ) : (
                    <div className="item-monto">{plata(p.precioVenta)}</div>
                  )}
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
  const sesion = useSesion()
  const esOwner = sesion.perfil?.rol === 'owner'
  const nuevo = !producto
  const [codigo, setCodigo] = useState(producto?.codigo ?? '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '')
  const [proveedorId, setProveedorId] = useState(producto?.proveedorId ?? '')
  const [nuevoProveedor, setNuevoProveedor] = useState('')
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
  const [descontinuado, setDescontinuado] = useState(producto?.descontinuado ?? false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const proveedores = useLiveQuery(() => db.proveedores.orderBy('nombre').toArray(), [])
  const historial = useLiveQuery(
    () =>
      producto
        ? db.historialProductos.where('codigo').equals(producto.codigo).reverse().sortBy('cuando')
        : Promise.resolve([] as HistorialProducto[]),
    [producto?.codigo],
  )

  const compraNum = leerNumero(precioCompra)
  const ventaNum = leerNumero(precioVenta)
  const rentNum = leerNumero(rentabilidad)

  const sugerido = useMemo(() => {
    if (!compraNum || !rentNum) return null
    return redondearPrecio(compraNum * (1 + rentNum / 100))
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

    let idProveedor = proveedorId || null
    if (idProveedor === 'nuevo') {
      const nombre = nuevoProveedor.trim()
      if (!nombre) return setError('Escribí el nombre del proveedor nuevo.')
      const existente = await db.proveedores.where('nombre').equalsIgnoreCase(nombre).first()
      if (existente) {
        idProveedor = existente.id
      } else {
        idProveedor = nuevoId()
        await db.proveedores.add({
          id: idProveedor,
          nombre,
          contacto: null,
          notas: null,
          activo: true,
        })
      }
    }
    const nombreProveedor = idProveedor
      ? ((await db.proveedores.get(idProveedor))?.nombre ?? null)
      : null

    // Un empleado no puede cambiar el precio de venta: si lo intenta (el
    // campo esta deshabilitado en la UI, esto es el resguardo del lado
    // de los datos) se conserva el que ya tenia el producto.
    const ventaFinal = esOwner ? ventaNum : (producto?.precioVenta ?? ventaNum)

    const registro: Producto = {
      codigo: cod,
      descripcion: descripcion.trim(),
      proveedor: nombreProveedor,
      proveedorId: idProveedor,
      fechaCompra: fechaCompra || null,
      precioCompra: compraNum,
      rentabilidad: rentNum != null ? rentNum / 100 : null,
      precioVenta: ventaFinal,
      fechaPrecioVenta:
        ventaFinal !== producto?.precioVenta ? hoyISO() : (producto?.fechaPrecioVenta ?? null),
      busqueda: normalizar(`${cod} ${descripcion}`),
      stock: stock.trim() === '' ? null : Number(stock),
      activo: true,
      archivado: producto?.archivado ?? false,
      descontinuado,
    }
    await db.productos.put(registro)
    onSalir()
  }

  async function archivar() {
    if (!producto) return
    if (!confirm(`¿Archivar "${producto.descripcion}"? Deja de verse en el catálogo y en Caja, pero se conserva su historial de ventas y ediciones para siempre.`)) return
    await db.productos.update(producto.codigo, { archivado: true, solicitudBorrado: null })
    onSalir()
  }

  async function solicitarArchivado() {
    if (!producto || !sesion.email || !sesion.perfil) return
    const motivo = prompt('¿Por qué querés archivar este producto? (opcional)') ?? ''
    await db.productos.update(producto.codigo, {
      solicitudBorrado: {
        por: sesion.email,
        porNombre: sesion.perfil.nombre,
        cuando: Date.now(),
        motivo: motivo.trim() || null,
      },
    })
    setMensaje('Listo, le queda avisado al dueño para que lo autorice.')
  }

  return (
    <>
      <h2>{nuevo ? 'Producto nuevo' : 'Editar producto'}</h2>

      {error && <div className="aviso aviso-error">{error}</div>}
      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}
      {producto?.solicitudBorrado && (
        <div className="aviso aviso-ojo">
          {producto.solicitudBorrado.porNombre} pidió archivar este producto
          {producto.solicitudBorrado.motivo ? `: "${producto.solicitudBorrado.motivo}"` : '.'}
          {esOwner ? ' Podés autorizarlo o rechazarlo desde el listado de Productos.' : ' Está a la espera de que un dueño lo autorice.'}
        </div>
      )}

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
          <select
            id="p-prov"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
          >
            <option value="">Sin proveedor</option>
            {(proveedores ?? [])
              .filter((prov) => prov.activo !== false || prov.id === producto?.proveedorId)
              .map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.nombre}
                  {prov.activo === false ? ' (inactivo)' : ''}
                </option>
              ))}
            <option value="nuevo">+ Proveedor nuevo…</option>
          </select>
          {proveedorId === 'nuevo' && (
            <input
              style={{ marginTop: 8 }}
              value={nuevoProveedor}
              onChange={(e) => setNuevoProveedor(e.target.value)}
              placeholder="Nombre del proveedor nuevo"
              autoFocus
            />
          )}
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
              disabled={!nuevo && !esOwner}
            />
            {!nuevo && !esOwner && (
              <p className="silencio" style={{ marginTop: 4 }}>
                Solo un dueño puede cambiar el precio de venta.
              </p>
            )}
          </div>
        </div>

        {sugerido !== null && (esOwner || nuevo) && (
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

      <div className="tarjeta">
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            fontSize: '0.92rem',
          }}
        >
          <input
            type="checkbox"
            checked={descontinuado}
            onChange={(e) => setDescontinuado(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Ya no se fabrica / no se repone
        </label>
        <p className="silencio" style={{ marginTop: 6, marginBottom: 0 }}>
          Sigue viéndose en el catálogo y se puede seguir vendiendo (por si queda stock), pero
          deja de figurar como "costo desactualizado" — nadie va a actualizar el costo de algo
          que no se vuelve a comprar.
        </p>
      </div>

      {historial && historial.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Historial de ediciones</p>
          <ul className="lista">
            {historial.slice(0, 10).map((h) => (
              <li className="item-ayuda" key={h.id} style={{ padding: '8px 0' }}>
                <div className="item-sub">
                  <strong>{h.quienNombre}</strong> cambió <strong>{h.campo}</strong>:{' '}
                  {String(h.valorAnterior ?? '—')} → {String(h.valorNuevo ?? '—')}
                  <br />
                  {fechaLinda(new Date(h.cuando).toISOString().slice(0, 10))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar}>
          Guardar
        </button>
      </div>
      {!nuevo && !producto?.solicitudBorrado && (
        <button
          className="boton-peligro"
          style={{ width: '100%', marginTop: 8 }}
          onClick={esOwner ? archivar : solicitarArchivado}
        >
          {esOwner ? 'Archivar producto' : 'Solicitar archivado'}
        </button>
      )}
    </>
  )
}
