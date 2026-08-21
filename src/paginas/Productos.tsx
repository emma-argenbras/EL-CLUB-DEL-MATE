import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db, nuevoId, productoVisible, type HistorialProducto, type Producto } from '../db/db'
import {
  costoDesactualizado,
  margenPorcentual,
  precioAtrasado,
  precioBajoCosto,
  precioDesactualizado,
  redondearPrecio,
  sinStock,
} from '../lib/calculos'
import { fechaLinda, hoyISO, leerNumero, normalizar, plata, porcentaje } from '../lib/formato'
import { useSesion } from '../sync/useSesion'
import { CompartirProducto } from '../componentes/BotonWhatsApp'

/** Las alertas que se pueden usar para filtrar el catalogo. */
type Filtro =
  | 'costoViejo'
  | 'precioViejo'
  | 'precioAtrasado'
  | 'sinStock'
  | 'bajoCosto'
  | 'sinPrecio'
  | 'stockNegativo'
  | 'sinNombre'
  | null

const DESCRIPCION_FILTRO: Record<Exclude<Filtro, null>, string> = {
  costoViejo: 'mostrando solo los de costo vencido',
  precioViejo: 'mostrando solo los que no se remarcan hace más de un año',
  precioAtrasado: 'mostrando solo los que están por debajo de su rentabilidad',
  sinStock: 'mostrando solo los que están sin stock',
  bajoCosto: 'mostrando solo los que se venden bajo costo',
  sinPrecio: 'mostrando solo los que no tienen precio de venta',
  stockNegativo: 'mostrando solo los que tienen el stock en negativo',
  sinNombre: 'mostrando solo los que figuran sin nombre',
}

/** Los mismos criterios que usa el motor de auditoria. */
const sinPrecioDeVenta = (p: Producto) => !p.descontinuado && !p.precioVenta
const stockEnNegativo = (p: Producto) => typeof p.stock === 'number' && p.stock < 0
const sinNombrePropio = (p: Producto) => {
  const d = (p.descripcion ?? '').trim()
  return !d || d.toUpperCase() === (p.codigo ?? '').trim().toUpperCase()
}

/** El Panel enlaza a Productos con el filtro ya puesto. */
function filtroDeLaURL(parametros: URLSearchParams): Filtro {
  if (parametros.get('bajoCosto') === '1') return 'bajoCosto'
  if (parametros.get('sinPrecio') === '1') return 'sinPrecio'
  if (parametros.get('stockNegativo') === '1') return 'stockNegativo'
  if (parametros.get('sinNombre') === '1') return 'sinNombre'
  if (parametros.get('precioAtrasado') === '1') return 'precioAtrasado'
  if (parametros.get('precioViejo') === '1') return 'precioViejo'
  if (parametros.get('sinStock') === '1') return 'sinStock'
  if (parametros.get('alertas') === '1') return 'costoViejo'
  return null
}

export default function Productos() {
  const [parametros] = useSearchParams()
  const sesion = useSesion()
  const esOwner = sesion.perfil?.rol === 'owner'
  const [consulta, setConsulta] = useState('')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [creando, setCreando] = useState(false)
  // Un solo filtro por vez. Antes era un booleano por alerta y cada
  // boton tenia que acordarse de apagar todos los demas a mano; con
  // cinco alertas eso ya no cerraba.
  const [filtro, setFiltro] = useState<Filtro>(filtroDeLaURL(parametros))
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

  const filtrando = filtro !== null

  const resultados = useLiveQuery(async () => {
    if (verArchivados) {
      return db.productos.filter((p) => p.archivado === true).limit(200).toArray()
    }
    const partes = normalizar(consulta).split(/\s+/).filter(Boolean)
    if (!partes.length && !filtrando) {
      return db.productos.orderBy('descripcion').filter(productoVisible).limit(50).toArray()
    }
    const encontrados = await db.productos
      .filter(
        (p) => productoVisible(p) && partes.every((parte) => p.busqueda.includes(parte)),
      )
      .limit(filtrando ? 2000 : 100)
      .toArray()
    if (filtro === 'bajoCosto') return encontrados.filter(precioBajoCosto).slice(0, 100)
    if (filtro === 'precioAtrasado') {
      // Los que mas plata dejan sobre la mesa, primero.
      return encontrados
        .filter((p) => precioAtrasado(p))
        .sort((a, b) => (precioAtrasado(b)?.falta ?? 0) - (precioAtrasado(a)?.falta ?? 0))
        .slice(0, 100)
    }
    if (filtro === 'precioViejo') {
      return encontrados.filter((p) => precioDesactualizado(p)).slice(0, 100)
    }
    if (filtro === 'sinPrecio') return encontrados.filter(sinPrecioDeVenta).slice(0, 100)
    if (filtro === 'stockNegativo') return encontrados.filter(stockEnNegativo).slice(0, 100)
    if (filtro === 'sinNombre') return encontrados.filter(sinNombrePropio).slice(0, 100)
    if (filtro === 'sinStock') return encontrados.filter(sinStock).slice(0, 100)
    if (filtro === 'costoViejo') return encontrados.filter((p) => costoDesactualizado(p)).slice(0, 100)
    return encontrados
  }, [consulta, filtro, verArchivados, filtrando])

  const conteoAlertas = useLiveQuery(async () => {
    const todos = await db.productos.filter(productoVisible).toArray()
    return {
      desactualizados: todos.filter((p) => costoDesactualizado(p)).length,
      agotados: todos.filter(sinStock).length,
      bajoCosto: todos.filter(precioBajoCosto).length,
      precioAtrasado: todos.filter((p) => precioAtrasado(p)).length,
      precioViejo: todos.filter((p) => precioDesactualizado(p)).length,
      sinPrecio: todos.filter(sinPrecioDeVenta).length,
      stockNegativo: todos.filter(stockEnNegativo).length,
      sinNombre: todos.filter(sinNombrePropio).length,
    }
  }, [])
  const desactualizados = conteoAlertas?.desactualizados
  const agotados = conteoAlertas?.agotados
  const bajoCosto = conteoAlertas?.bajoCosto
  const atrasados = conteoAlertas?.precioAtrasado
  const precioViejo = conteoAlertas?.precioViejo
  const sinPrecio = conteoAlertas?.sinPrecio
  const stockNegativo = conteoAlertas?.stockNegativo
  const sinNombre = conteoAlertas?.sinNombre

  async function aprobarSolicitud(p: Producto) {
    const queda = p.stock !== null && p.stock !== undefined && p.stock > 0
    const aviso = queda
      ? `Ojo: todavía figuran ${p.stock} en stock. Si lo archivás no se va a poder vender.\n\n`
      : ''
    if (
      !confirm(
        `${aviso}¿Archivar "${p.descripcion}"? Deja de verse en el catálogo y en Caja, pero se conserva su historial de ventas para siempre.`,
      )
    ) {
      return
    }
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
                    {p.codigo} · pedido por {p.solicitudBorrado?.porNombre}
                    {p.solicitudBorrado?.cuando
                      ? ` · ${fechaLinda(new Date(p.solicitudBorrado.cuando).toISOString().slice(0, 10))}`
                      : ''}
                    {p.solicitudBorrado?.motivo ? ` · "${p.solicitudBorrado.motivo}"` : ''}
                  </div>
                  {/* Lo que hay que mirar antes de decidir: si queda
                      stock, archivarlo es dejar de poder venderlo. */}
                  <div className="item-sub">
                    Se vende a {plata(p.precioVenta)} · costo {plata(p.precioCompra)} ·{' '}
                    {p.stock === null || p.stock === undefined
                      ? 'stock sin llevar'
                      : `quedan ${p.stock}`}
                    {precioBajoCosto(p) && (
                      <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                        BAJO COSTO
                      </span>
                    )}
                  </div>
                  {!p.descontinuado && (
                    <p className="silencio" style={{ margin: '6px 0 0' }}>
                      Si todavía queda stock para vender, conviene{' '}
                      <button
                        className="boton-chico"
                        onClick={() => setEditando(p)}
                        style={{ padding: '2px 6px', minHeight: 0 }}
                      >
                        marcarlo como descontinuado
                      </button>{' '}
                      en vez de archivarlo: deja de pedir costo nuevo pero se puede seguir
                      vendiendo.
                    </p>
                  )}
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

      {!verArchivados && (
        <>
          <Alerta
            n={bajoCosto}
            tono="error"
            activo={filtro === 'bajoCosto'}
            onToggle={() => setFiltro(filtro === 'bajoCosto' ? null : 'bajoCosto')}
          >
            <strong>{bajoCosto}</strong>{' '}
            {bajoCosto === 1 ? 'producto se vende' : 'productos se venden'} al costo o por debajo:
            cada unidad que sale es plata perdida.
          </Alerta>

          <Alerta
            n={sinPrecio}
            tono="error"
            activo={filtro === 'sinPrecio'}
            onToggle={() => setFiltro(filtro === 'sinPrecio' ? null : 'sinPrecio')}
          >
            <strong>{sinPrecio}</strong>{' '}
            {sinPrecio === 1 ? 'producto no tiene' : 'productos no tienen'} precio de venta: no se
            pueden cargar en una venta ni aparecen en el catálogo que ven los clientes.
          </Alerta>

          <Alerta
            n={stockNegativo}
            tono="error"
            activo={filtro === 'stockNegativo'}
            onToggle={() => setFiltro(filtro === 'stockNegativo' ? null : 'stockNegativo')}
          >
            <strong>{stockNegativo}</strong>{' '}
            {stockNegativo === 1 ? 'producto tiene' : 'productos tienen'} el stock en negativo: se
            vendieron más unidades de las que figuraban.
          </Alerta>

          <Alerta
            n={atrasados}
            tono="error"
            activo={filtro === 'precioAtrasado'}
            onToggle={() => setFiltro(filtro === 'precioAtrasado' ? null : 'precioAtrasado')}
          >
            <strong>{atrasados}</strong>{' '}
            {atrasados === 1 ? 'producto está más barato' : 'productos están más baratos'} de lo
            que dice su propia rentabilidad. Con el costo y el markup que ya tienen cargados, el
            precio debería ser más alto.
          </Alerta>

          <Alerta
            n={agotados}
            tono="error"
            activo={filtro === 'sinStock'}
            onToggle={() => setFiltro(filtro === 'sinStock' ? null : 'sinStock')}
          >
            <strong>{agotados}</strong>{' '}
            {agotados === 1 ? 'producto se quedó' : 'productos se quedaron'} sin stock. Conviene
            reponerlos: registrando la compra al proveedor, el stock se actualiza solo.
          </Alerta>

          <Alerta
            n={precioViejo}
            tono="ojo"
            activo={filtro === 'precioViejo'}
            onToggle={() => setFiltro(filtro === 'precioViejo' ? null : 'precioViejo')}
          >
            <strong>{precioViejo}</strong> de {total} productos no se remarcan hace más de un año.
            El <strong>precio de venta</strong> quedó donde estaba mientras todo aumentaba.
          </Alerta>

          <Alerta
            n={sinNombre}
            tono="ojo"
            activo={filtro === 'sinNombre'}
            onToggle={() => setFiltro(filtro === 'sinNombre' ? null : 'sinNombre')}
          >
            <strong>{sinNombre}</strong>{' '}
            {sinNombre === 1 ? 'producto figura' : 'productos figuran'} solo con su código, sin
            nombre. Así salen en las ventas, en los reportes y en el catálogo.
          </Alerta>

          <Alerta
            n={desactualizados}
            tono="ojo"
            activo={filtro === 'costoViejo'}
            onToggle={() => setFiltro(filtro === 'costoViejo' ? null : 'costoViejo')}
          >
            <strong>{desactualizados}</strong> de {total} productos tienen el{' '}
            <strong>costo</strong> vencido o sin cargar. Esto no cambia lo que le cobrás al
            cliente: hace que el margen del reporte salga más alto de lo real.
          </Alerta>
        </>
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
            : `${total ?? '…'} productos en el catálogo${filtro ? ` · ${DESCRIPCION_FILTRO[filtro]}` : ''}`}
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
                      {sinStock(p) && (
                        <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                          SIN STOCK
                        </span>
                      )}
                    </div>
                    <div className="item-sub">
                      Costo {plata(p.precioCompra)}
                      {p.fechaCompra ? ` (${fechaLinda(p.fechaCompra)})` : ''} · Precio desde{' '}
                      {p.fechaPrecioVenta ? fechaLinda(p.fechaPrecioVenta) : 'siempre'}
                    </div>
                    <div className="item-sub">
                      Margen {margen === null ? '—' : porcentaje(margen)}
                      {precioBajoCosto(p) && (
                        <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                          BAJO COSTO
                        </span>
                      )}
                      {p.descontinuado ? (
                        <span className="chip" style={{ marginLeft: 6 }}>
                          Descontinuado
                        </span>
                      ) : (
                        <>
                          {costoDesactualizado(p) && (
                            <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                              COSTO VIEJO
                            </span>
                          )}
                          {precioDesactualizado(p) && (
                            <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                              PRECIO VIEJO
                            </span>
                          )}
                          {precioAtrasado(p) && (
                            <span className="chip chip-alerta" style={{ marginLeft: 6 }}>
                              BAJO SU MARKUP
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {verArchivados ? (
                    <button className="boton-chico" onClick={() => reactivar(p)}>
                      Reactivar
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="item-monto">{plata(p.precioVenta)}</div>
                      <CompartirProducto producto={p} chico />
                    </div>
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

    const cambioElCosto = compraNum !== (producto?.precioCompra ?? null)
    const tocoLaFecha = (fechaCompra || null) !== (producto?.fechaCompra ?? null)
    const fechaCompraFinal =
      cambioElCosto && !tocoLaFecha ? hoyISO() : fechaCompra || null

    const registro: Producto = {
      codigo: cod,
      descripcion: descripcion.trim(),
      proveedor: nombreProveedor,
      proveedorId: idProveedor,
      // Las dos fechas se comportan igual: cada una marca cuando se
      // toco SU numero. La del costo se ponia a mano y quedaba vieja
      // aunque el costo hubiera cambiado, que es justo lo que hacia que
      // el aviso de "costo vencido" no fuera confiable.
      //
      // Si la persona edito la fecha ella misma, se respeta: sirve para
      // cargar una compra de la semana pasada.
      fechaCompra: fechaCompraFinal,
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

      {!nuevo && producto && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Pasarle este producto a un cliente</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            Abre tu WhatsApp con el nombre, el precio y el enlace al catálogo ya escritos.
            Vos elegís a quién mandárselo.
          </p>
          <CompartirProducto
            producto={{ ...producto, precioVenta: ventaNum ?? producto.precioVenta }}
          />
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

/* ------------------------------------------------------------------ */

/**
 * Un aviso del catalogo con su boton para filtrar. Se desaparece solo
 * cuando no hay nada que avisar, asi el llamador no tiene que repetir
 * el chequeo en cada uno.
 */
function Alerta({
  n,
  tono,
  activo,
  onToggle,
  children,
}: {
  n: number | undefined
  tono: 'error' | 'ojo'
  activo: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  if (n === undefined || n === 0) return null
  return (
    <div className={tono === 'error' ? 'aviso aviso-error' : 'aviso aviso-ojo'}>
      {children}{' '}
      <button className="boton-chico" style={{ marginTop: 6 }} onClick={onToggle}>
        {activo ? 'Ver todos' : 'Ver esos productos'}
      </button>
    </div>
  )
}
