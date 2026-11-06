import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CriterioFlete, type Producto } from '../db/db'
import {
  cambiosDeCosto,
  comprasDeProducto,
  ETIQUETA_CRITERIO,
  paraRemarcar,
  problemaDelIngreso,
  registrarIngreso,
  remarcar,
  repartirFlete,
  type CambioDeCosto,
  type RenglonIngreso,
} from '../db/ingresoMercaderia'
import { fechaLinda, haceCuanto, hoyISO, leerNumero, normalizar, plata, porcentaje } from '../lib/formato'
import {
  descartarBorradorCompra,
  guardarBorradorCompra,
  leerBorradorCompra,
  listarBorradoresCompra,
  tieneContenido,
  type LineaBorrador,
} from '../lib/borradorCompra'
import { useSinGuardar } from '../lib/sinGuardar'
import { estaAlMando } from '../sync/permisos'
import { useSesion } from '../sync/useSesion'
import BuscadorProducto from '../componentes/BuscadorProducto'

/**
 * Ingreso de mercaderia (puntos 10 y 11 del pedido del 06/11): lo que
 * llego de un proveedor, con su flete repartido en el costo. La logica
 * esta en db/ingresoMercaderia.ts.
 */
export default function IngresoMercaderia() {
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const sesion = useSesion()
  const alMando = estaAlMando(sesion.perfil)

  // El proveedor vive en la direccion (?proveedor=): recargar o volver
  // atras no lo pierde, y el borrador se recupera solo.
  const proveedorId = params.get('proveedor') ?? ''
  const [fecha, setFecha] = useState(hoyISO())
  const [comprobante, setComprobante] = useState('')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaBorrador[]>([])
  const [conFlete, setConFlete] = useState(false)
  const [flete, setFlete] = useState('')
  const [criterio, setCriterio] = useState<CriterioFlete>('costo')
  const [transportista, setTransportista] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState<{ proveedor: string; cambios: CambioDeCosto[]; productos: number } | null>(
    null,
  )
  // El borrador de este proveedor (ver lib/borradorCompra.ts): una compra
  // de veinte renglones no se pierde si se cierra la app a la mitad.
  const [listo, setListo] = useState(false)
  const [recuperadoDe, setRecuperadoDe] = useState<number | null>(null)

  const proveedores = useLiveQuery(() => db.proveedores.orderBy('nombre').toArray(), [])
  const activos = (proveedores ?? []).filter((p) => p.activo !== false || p.id === proveedorId)
  const proveedor = (proveedores ?? []).find((p) => p.id === proveedorId) ?? null
  const nombres = useMemo(() => new Map((proveedores ?? []).map((p) => [p.id, p.nombre])), [proveedores])

  const codigos = lineas.map((l) => l.codigo)
  const productos = useLiveQuery(
    async () => new Map((await db.productos.bulkGet(codigos)).filter((p): p is Producto => !!p).map((p) => [p.codigo, p])),
    [codigos.join('|')],
  )
  const compras = useLiveQuery(() => db.movimientosProveedor.where('tipo').equals('compra').toArray(), [])
  // Los ingresos que quedaron a medio cargar en este aparato.
  const borradores = useLiveQuery(() => listarBorradoresCompra(), [proveedorId, hecho])

  /** Elegir el proveedor lo deja en la direccion: asi recargar no lo pierde. */
  function elegirProveedor(id: string) {
    setParams(id ? { proveedor: id } : {}, { replace: true })
  }

  useSinGuardar('un ingreso de mercadería', lineas.length > 0 && !hecho)

  useEffect(() => {
    setListo(false)
    setRecuperadoDe(null)
    // Lo cargado para otro proveedor no se arrastra a este: queda en su
    // propio borrador.
    setLineas([])
    setNotas('')
    setComprobante('')
    setConFlete(false)
    setFlete('')
    setCriterio('costo')
    setTransportista('')
    setFecha(hoyISO())
    if (!proveedorId) {
      setListo(true)
      return
    }
    let vigente = true
    void leerBorradorCompra(proveedorId).then((b) => {
      if (!vigente) return
      if (b) {
        setFecha(b.fecha)
        setLineas(b.lineas.filter((l) => l.codigo))
        setNotas(b.notas)
        setComprobante(b.comprobante ?? '')
        setConFlete(Boolean(b.flete))
        setFlete(b.flete ?? '')
        setCriterio(b.criterio ?? 'costo')
        setTransportista(b.transportista ?? '')
        setRecuperadoDe(b.guardadoEn)
      }
      setListo(true)
    })
    return () => {
      vigente = false
    }
  }, [proveedorId])

  useEffect(() => {
    if (!listo || !proveedorId || hecho) return
    const espera = setTimeout(() => {
      void guardarBorradorCompra(proveedorId, {
        fecha,
        lineas,
        notas,
        comprobante,
        flete: conFlete ? flete : '',
        criterio,
        transportista,
      })
    }, 300)
    return () => clearTimeout(espera)
  }, [listo, proveedorId, hecho, fecha, lineas, notas, comprobante, conFlete, flete, criterio, transportista])

  // Lo que ya se puede leer de cada renglon.
  const renglones: (RenglonIngreso | null)[] = lineas.map((l) => {
    const p = productos?.get(l.codigo)
    if (!p) return null
    return {
      producto: p,
      cantidad: leerNumero(l.cantidad) ?? 0,
      costoUnitario: l.costoUnitario.trim() === '' ? Number.NaN : (leerNumero(l.costoUnitario) ?? Number.NaN),
    }
  })
  const validos = renglones.filter((r): r is RenglonIngreso => r !== null)
  const montoFlete = conFlete ? (leerNumero(flete) ?? 0) : 0
  const { porUnidad, porRenglon } = repartirFlete(
    validos.map((r) => ({ cantidad: r.cantidad, costoUnitario: Number.isFinite(r.costoUnitario) ? r.costoUnitario : 0 })),
    montoFlete,
    criterio,
  )
  const mercaderia = validos.reduce(
    (s, r) => s + r.cantidad * (Number.isFinite(r.costoUnitario) ? r.costoUnitario : 0),
    0,
  )
  const problema = problemaDelIngreso(proveedorId || null, validos, montoFlete)

  function ultimaCompra(codigo: string) {
    return comprasDeProducto(codigo, compras ?? [])[0] ?? null
  }

  function agregar(p: Producto) {
    setError('')
    const igual = lineas.find((l) => l.codigo === p.codigo)
    if (igual) {
      cambiarLinea(p.codigo, { cantidad: String((leerNumero(igual.cantidad) ?? 0) + 1) })
      return
    }
    // El costo arranca con el de la ultima factura (sin flete), o con el
    // costo cargado si nunca se registro una compra.
    const ultima = ultimaCompra(p.codigo)
    const costo = ultima?.costoUnitario ?? p.precioCompra
    setLineas((ls) => [...ls, { codigo: p.codigo, cantidad: '1', costoUnitario: costo != null ? String(costo) : '' }])
  }

  function cambiarLinea(codigo: string, cambios: Partial<LineaBorrador>) {
    setLineas((ls) => ls.map((l) => (l.codigo === codigo ? { ...l, ...cambios } : l)))
  }

  /**
   * Alta de un producto sin salir del ingreso, con el proveedor puesto.
   * El precio de venta queda vacio a proposito: lo pone quien lo decide,
   * mirando el costo y la rentabilidad, no el apuro de la carga.
   */
  async function productoNuevo() {
    if (!proveedor) {
      setError('Elegí primero el proveedor.')
      return
    }
    const codigo = prompt('Código del producto nuevo (el que usa el proveedor o el del local):')
    const cod = codigo?.trim().toUpperCase()
    if (!cod) return
    const existe = await db.productos.get(cod)
    if (existe) {
      alert(`Ya existe un producto con el código ${cod}: «${existe.descripcion}». Buscalo y elegilo.`)
      return
    }
    const descripcion = prompt(`Nombre del producto ${cod}:`)?.trim()
    if (!descripcion) return
    await db.productos.add({
      codigo: cod,
      descripcion,
      proveedor: proveedor.nombre,
      proveedorId: proveedor.id,
      fechaCompra: null,
      precioCompra: null,
      rentabilidad: null,
      precioVenta: null,
      fechaPrecioVenta: null,
      busqueda: normalizar(`${cod} ${descripcion}`),
      stock: null,
      activo: true,
    })
    setLineas((ls) => [...ls, { codigo: cod, cantidad: '1', costoUnitario: '' }])
  }

  async function empezarDeNuevo() {
    if (proveedorId) await descartarBorradorCompra(proveedorId)
    setLineas([])
    setNotas('')
    setComprobante('')
    setConFlete(false)
    setFlete('')
    setTransportista('')
    setFecha(hoyISO())
    setRecuperadoDe(null)
  }

  async function cancelar() {
    if (
      tieneContenido({ lineas, notas }) &&
      !confirm('¿Descartar el ingreso que estás cargando? Se borra lo que escribiste.')
    ) {
      return
    }
    await empezarDeNuevo()
    navegar('/proveedores')
  }

  async function confirmar() {
    if (problema || !proveedor) {
      setError(problema ?? 'Elegí el proveedor.')
      return
    }
    if (renglones.some((r) => r === null)) {
      setError('Hay un producto que ya no está en el catálogo. Sacalo y volvé a buscarlo.')
      return
    }
    setGuardando(true)
    try {
      const { subieron } = cambiosDeCosto(validos, porUnidad)
      await registrarIngreso({
        proveedor: { id: proveedor.id, nombre: proveedor.nombre },
        fecha,
        comprobante,
        notas,
        renglones: validos,
        flete: montoFlete > 0 ? { monto: montoFlete, criterio, transportista } : null,
        quien: sesion.email,
      })
      await descartarBorradorCompra(proveedor.id)
      setHecho({ proveedor: proveedor.nombre, cambios: subieron, productos: validos.length })
      setLineas([])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  if (hecho) {
    return (
      <Hecho
        hecho={hecho}
        alMando={alMando}
        onOtro={() => {
          setHecho(null)
          void empezarDeNuevo()
        }}
        proveedorId={proveedorId}
      />
    )
  }

  return (
    <>
      <h2>Ingreso de mercadería</h2>

      <div className="tarjeta">
        {error && <div className="aviso aviso-error">{error}</div>}
        {recuperadoDe !== null && (
          <div className="aviso aviso-ojo">
            Recuperé el ingreso que quedó a medio cargar ({haceCuanto(recuperadoDe)}). Revisalo y
            confirmalo cuando esté completo.{' '}
            <button className="boton-chico" onClick={() => void empezarDeNuevo()}>
              Empezar de nuevo
            </button>
          </div>
        )}
        <div className="campo">
          <label htmlFor="ing-proveedor">Proveedor</label>
          <select
            id="ing-proveedor"
            value={proveedorId}
            onChange={(e) => {
              if (lineas.length > 0 && !confirm('¿Cambiar de proveedor? Lo cargado queda guardado como borrador del anterior.')) return
              elegirProveedor(e.target.value)
            }}
          >
            <option value="">Elegí el proveedor…</option>
            {activos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="grilla grilla-2">
          <div className="campo">
            <label htmlFor="ing-fecha">Fecha</label>
            <input id="ing-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="ing-comprobante">Remito o factura</label>
            <input
              id="ing-comprobante"
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              placeholder="N° (opcional)"
            />
          </div>
        </div>
      </div>

      {!proveedorId && (borradores ?? []).length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">A medio cargar en este aparato</p>
          <ul className="lista">
            {(borradores ?? []).map(({ proveedorId: id, borrador }) => (
              <li className="item" key={id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{nombres.get(id) ?? id}</div>
                  <div className="item-sub">
                    {borrador.lineas.filter((l) => l.codigo).length} productos ·{' '}
                    {haceCuanto(borrador.guardadoEn)}
                  </div>
                </div>
                <button className="boton-chico" onClick={() => elegirProveedor(id)}>
                  Seguir
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {proveedorId && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Lo que llegó</p>
          <BuscadorProducto onElegir={agregar} autoFoco={lineas.length === 0} />
          <div className="botonera" style={{ marginTop: 8 }}>
            <button className="boton-chico" onClick={() => void productoNuevo()}>
              + Producto nuevo
            </button>
          </div>

          {lineas.length === 0 ? (
            <p className="silencio" style={{ marginTop: 8 }}>
              Buscá cada producto por código o nombre y cargá cuántos llegaron y a qué costo (el
              de la factura, sin el flete).
            </p>
          ) : (
            <ul className="lista ticket-lista">
              {lineas.map((l, i) => {
                const p = productos?.get(l.codigo)
                const ultima = ultimaCompra(l.codigo)
                const iValido = validos.findIndex((r) => r.producto.codigo === l.codigo)
                const fleteUnidad = iValido >= 0 ? (porUnidad[iValido] ?? 0) : 0
                const costo = leerNumero(l.costoUnitario)
                const final = costo != null ? Math.round((costo + fleteUnidad) * 100) / 100 : null
                const antes = p?.precioCompra ?? null
                return (
                  <li className="ticket-renglon" key={l.codigo}>
                    <div className="item" style={{ borderBottom: 'none', padding: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="item-titulo">{p?.descripcion ?? l.codigo}</div>
                        <div className="item-sub">
                          {l.codigo}
                          {p?.stock != null && ` · stock ${p.stock}`}
                          {ultima
                            ? ` · última compra ${fechaLinda(ultima.fecha)}${nombres.get(ultima.proveedorId) ? `, ${nombres.get(ultima.proveedorId)}` : ''}: ${plata(ultima.costoUnitario)}`
                            : antes != null
                              ? ` · costo cargado ${plata(antes)}`
                              : ' · sin costo cargado'}
                        </div>
                      </div>
                      <button
                        className="boton-chico"
                        onClick={() => setLineas((ls) => ls.filter((x) => x.codigo !== l.codigo))}
                        aria-label={`Sacar ${p?.descripcion ?? l.codigo}`}
                      >
                        Sacar
                      </button>
                    </div>
                    <div className="grilla grilla-3" style={{ marginTop: 6 }}>
                      <div className="campo">
                        <label htmlFor={`ing-cant-${i}`}>Llegaron</label>
                        <input
                          id={`ing-cant-${i}`}
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={l.cantidad}
                          onChange={(e) => cambiarLinea(l.codigo, { cantidad: e.target.value })}
                        />
                      </div>
                      <div className="campo">
                        <label htmlFor={`ing-costo-${i}`}>Costo c/u</label>
                        <input
                          id={`ing-costo-${i}`}
                          inputMode="decimal"
                          value={l.costoUnitario}
                          onChange={(e) => cambiarLinea(l.codigo, { costoUnitario: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="campo">
                        <label>Subtotal</label>
                        <div className="ticket-subtotal">
                          {plata((leerNumero(l.cantidad) ?? 0) * (costo ?? 0))}
                        </div>
                      </div>
                    </div>
                    {final != null && (montoFlete > 0 || (antes != null && final !== antes)) && (
                      <div className="item-sub">
                        {montoFlete > 0 && `+ ${plata(fleteUnidad)} de flete = `}
                        <strong>{plata(final)} c/u</strong>
                        {antes != null && antes > 0 && final !== antes && (
                          <span className={final > antes ? 'negativo' : 'positivo'}>
                            {' '}
                            ({final > antes ? '+' : ''}
                            {porcentaje(((final - antes) / antes) * 100, 1)} contra {plata(antes)})
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {proveedorId && lineas.length > 0 && (
        <div className="tarjeta">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={conFlete}
              onChange={(e) => setConFlete(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Vino con flete (transporte, encomienda)
          </label>
          {conFlete && (
            <>
              <div className="grilla grilla-2" style={{ marginTop: 8 }}>
                <div className="campo">
                  <label htmlFor="ing-flete">Cuánto salió el flete</label>
                  <input
                    id="ing-flete"
                    inputMode="decimal"
                    value={flete}
                    onChange={(e) => setFlete(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="campo">
                  <label htmlFor="ing-transporte">Transporte</label>
                  <input
                    id="ing-transporte"
                    value={transportista}
                    onChange={(e) => setTransportista(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="campo">
                <label>Cómo se reparte</label>
                <div className="pestanas">
                  {(['costo', 'unidades'] as const).map((c) => (
                    <button
                      key={c}
                      className={criterio === c ? 'pestana activa' : 'pestana'}
                      onClick={() => setCriterio(c)}
                    >
                      {ETIQUETA_CRITERIO[c]}
                    </button>
                  ))}
                </div>
                <p className="silencio" style={{ margin: '6px 0 0', fontSize: '0.8rem' }}>
                  {criterio === 'costo'
                    ? 'Cada producto carga flete según lo que vale: un mate de $ 40.000 carga diez veces más que una bombilla de $ 4.000.'
                    : 'Cada unidad carga lo mismo. Sirve cuando los productos son parecidos.'}{' '}
                  El flete se suma al costo de cada producto: es lo que de verdad cuesta tenerlo
                  en el local. No es deuda del proveedor; se paga como siempre.
                </p>
              </div>
              {montoFlete > 0 && validos.length > 1 && (
                <p className="silencio" style={{ margin: 0, fontSize: '0.8rem' }}>
                  Reparto:{' '}
                  {validos
                    .map((r, i) => `${r.producto.descripcion} ${plata(porRenglon[i] ?? 0)}`)
                    .join(' · ')}
                </p>
              )}
            </>
          )}

          <div className="ticket-totales">
            <div>
              <span>Mercadería (se le debe al proveedor)</span>
              <span>{plata(mercaderia)}</span>
            </div>
            {montoFlete > 0 && (
              <div>
                <span>Flete</span>
                <span>{plata(montoFlete)}</span>
              </div>
            )}
            <div className="ticket-total">
              <span>Costo puesto en el local</span>
              <span>{plata(mercaderia + montoFlete)}</span>
            </div>
          </div>

          <div className="campo" style={{ marginTop: 10 }}>
            <label htmlFor="ing-notas">Notas (opcional)</label>
            <input id="ing-notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          {problema && <p className="item-sub negativo">{problema}</p>}
          <p className="silencio">
            Al confirmar, sube el stock de cada producto, su costo pasa a ser el de esta compra (con
            el flete) y la compra suma a la cuenta de {proveedor?.nombre ?? 'el proveedor'}.
          </p>
          <div className="botonera">
            <button onClick={() => void cancelar()}>Cancelar</button>
            <button
              className="boton-principal"
              onClick={() => void confirmar()}
              disabled={guardando || problema !== null}
            >
              {guardando ? 'Guardando…' : `Confirmar ingreso`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Hecho({
  hecho,
  alMando,
  onOtro,
  proveedorId,
}: {
  hecho: { proveedor: string; cambios: CambioDeCosto[]; productos: number }
  alMando: boolean
  onOtro: () => void
  proveedorId: string
}) {
  const candidatos = paraRemarcar(hecho.cambios)
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(candidatos.map((c) => c.codigo)))
  const [mensaje, setMensaje] = useState('')

  async function remarcarElegidos() {
    const lista = candidatos.filter((c) => elegidos.has(c.codigo))
    if (lista.length === 0) return
    const ej = lista[0]
    const cuantos = lista.length === 1 ? '1 producto' : `${lista.length} productos`
    if (
      !confirm(
        `Vas a cambiar el precio de venta de ${cuantos} al que pide su rentabilidad.\n\nPor ejemplo, ${ej.descripcion}: de ${ej.precioVenta != null ? plata(ej.precioVenta) : 'sin precio'} a ${plata(ej.sugerido!)}.\n\nQueda en el historial con el motivo.`,
      )
    ) {
      return
    }
    try {
      const n = await remarcar(
        lista.map((c) => ({ codigo: c.codigo, precioNuevo: c.sugerido! })),
        `Remarcado al ingresar mercadería de ${hecho.proveedor}`,
      )
      setMensaje(`Listo: ${n === 1 ? 'se remarcó 1 producto' : `se remarcaron ${n} productos`}.`)
      setElegidos(new Set())
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <h2>Ingreso de mercadería</h2>
      <div className="aviso aviso-ok">
        Ingreso de {hecho.proveedor} guardado: {hecho.productos}{' '}
        {hecho.productos === 1 ? 'producto' : 'productos'} con el stock y el costo al día.
      </div>

      {hecho.cambios.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Subieron de costo ({hecho.cambios.length})</p>
          <ul className="lista">
            {hecho.cambios.map((c) => {
              const remarcable = candidatos.some((x) => x.codigo === c.codigo)
              return (
                <li className="item" key={c.codigo}>
                  <div style={{ minWidth: 0 }}>
                    <div className="item-titulo">{c.descripcion}</div>
                    <div className="item-sub">
                      Costo {plata(c.antes ?? 0)} → {plata(c.ahora)}
                      {c.variacion != null && ` (+${porcentaje(c.variacion, 1)})`}
                    </div>
                    <div className="item-sub">
                      Precio {c.precioVenta != null ? plata(c.precioVenta) : 'sin cargar'}
                      {c.sugerido != null
                        ? remarcable
                          ? ` · su rentabilidad pide ${plata(c.sugerido)}`
                          : ' · todavía alcanza para su rentabilidad'
                        : ' · sin rentabilidad cargada'}
                    </div>
                  </div>
                  {alMando && remarcable && (
                    <input
                      type="checkbox"
                      style={{ width: 'auto', flex: 'none' }}
                      aria-label={`Remarcar ${c.descripcion}`}
                      checked={elegidos.has(c.codigo)}
                      onChange={(e) =>
                        setElegidos((s) => {
                          const n = new Set(s)
                          if (e.target.checked) n.add(c.codigo)
                          else n.delete(c.codigo)
                          return n
                        })
                      }
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}
          {candidatos.length > 0 &&
            (alMando ? (
              <button
                className="boton-principal"
                disabled={elegidos.size === 0}
                onClick={() => void remarcarElegidos()}
              >
                Remarcar {elegidos.size === 1 ? '1 producto' : `${elegidos.size} productos`} al precio sugerido
              </button>
            ) : (
              <p className="silencio">
                Hay {candidatos.length === 1 ? '1 producto' : `${candidatos.length} productos`} que
                conviene remarcar. Emmanuel y Sandra los ven en el Panel, en «más baratos de lo que
                dice su rentabilidad».
              </p>
            ))}
        </div>
      )}

      <div className="botonera">
        <button onClick={onOtro}>Cargar otro ingreso</button>
        <Link className="boton-chico" to={`/proveedores?ver=${encodeURIComponent(proveedorId)}`}>
          Ver la cuenta del proveedor
        </Link>
      </div>
    </>
  )
}
