import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  nuevoId,
  productoVisible,
  MEDIOS_PAGO,
  type ItemCompra,
  type MedioPago,
  type MovimientoProveedor,
  type Producto,
  type Proveedor,
} from '../db/db'
import { costoDesactualizado } from '../lib/calculos'
import { fechaLinda, hoyISO, leerNumero, normalizar, plata } from '../lib/formato'
import { useSesion } from '../sync/useSesion'

export default function Proveedores() {
  const [consulta, setConsulta] = useState('')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const proveedores = useLiveQuery(() => db.proveedores.orderBy('nombre').toArray(), [])
  const productos = useLiveQuery(
    () => db.productos.filter(productoVisible).toArray(),
    [],
  )

  const resumen = useMemo(() => {
    const mapa = new Map<string, { cantidad: number; vencidos: number }>()
    for (const p of productos ?? []) {
      if (!p.proveedorId) continue
      const actual = mapa.get(p.proveedorId) ?? { cantidad: 0, vencidos: 0 }
      actual.cantidad += 1
      if (costoDesactualizado(p)) actual.vencidos += 1
      mapa.set(p.proveedorId, actual)
    }
    return mapa
  }, [productos])

  const sinProveedor = useMemo(
    () => (productos ?? []).filter((p) => !p.proveedorId).length,
    [productos],
  )

  const proveedor = seleccionado ? (proveedores ?? []).find((p) => p.id === seleccionado) : null

  if (proveedor) {
    return (
      <DetalleProveedor
        proveedor={proveedor}
        productos={(productos ?? []).filter((p) => p.proveedorId === proveedor.id)}
        onVolver={() => setSeleccionado(null)}
      />
    )
  }

  const lista = (proveedores ?? []).filter((p) =>
    consulta ? normalizar(p.nombre).includes(normalizar(consulta)) : true,
  )

  return (
    <>
      <h2>Proveedores</h2>

      <div className="tarjeta">
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar proveedor…"
        />
        <div className="botonera" style={{ marginTop: 10 }}>
          <button className="boton-principal" onClick={() => setCreando(true)}>
            + Proveedor nuevo
          </button>
        </div>
      </div>

      {creando && <FormularioProveedor onSalir={() => setCreando(false)} />}

      {sinProveedor > 0 && (
        <div className="aviso aviso-ojo">
          <strong>{sinProveedor}</strong> productos todavía no tienen proveedor asignado. Podés
          asignarlo desde Productos, al editar cada uno.
        </div>
      )}

      <div className="tarjeta">
        {!proveedores ? (
          <p className="vacio">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="vacio">Sin resultados.</p>
        ) : (
          <ul className="lista">
            {lista.map((p) => {
              const datos = resumen.get(p.id) ?? { cantidad: 0, vencidos: 0 }
              return (
                <li className="item" key={p.id} onClick={() => setSeleccionado(p.id)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="item-titulo">{p.nombre}</div>
                    <div className="item-sub">
                      {datos.cantidad} {datos.cantidad === 1 ? 'producto' : 'productos'}
                      {p.contacto ? ` · ${p.contacto}` : ''}
                    </div>
                  </div>
                  {p.activo === false && <span className="chip">Inactivo</span>}
                  {datos.vencidos > 0 && (
                    <span className="chip chip-alerta">{datos.vencidos} costo vencido</span>
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

function FormularioProveedor({
  onSalir,
  onCreado,
}: {
  onSalir: () => void
  onCreado?: (id: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [error, setError] = useState('')

  async function guardar() {
    if (!nombre.trim()) return setError('Ponele un nombre al proveedor.')
    const existe = await db.proveedores.where('nombre').equalsIgnoreCase(nombre.trim()).first()
    if (existe) return setError(`Ya existe un proveedor "${existe.nombre}".`)

    const id = nuevoId()
    const registro: Proveedor = {
      id,
      nombre: nombre.trim(),
      contacto: contacto.trim() || null,
      notas: null,
      activo: true,
    }
    await db.proveedores.add(registro)
    onCreado?.(id)
    onSalir()
  }

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Proveedor nuevo</p>
      {error && <div className="aviso aviso-error">{error}</div>}
      <div className="campo">
        <label htmlFor="prov-nombre">Nombre</label>
        <input
          id="prov-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: MOHICANO"
          autoFocus
        />
      </div>
      <div className="campo">
        <label htmlFor="prov-contacto">Contacto (opcional)</label>
        <input
          id="prov-contacto"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Teléfono, WhatsApp…"
        />
      </div>
      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar}>
          Guardar
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function DetalleProveedor({
  proveedor,
  productos,
  onVolver,
}: {
  proveedor: Proveedor
  productos: Producto[]
  onVolver: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(proveedor.nombre)
  const [contacto, setContacto] = useState(proveedor.contacto ?? '')
  const [porcentaje, setPorcentaje] = useState('')
  const [mensaje, setMensaje] = useState('')

  const ordenados = [...productos].sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
  const conCosto = ordenados.filter((p) => p.precioCompra != null)
  const sinCosto = ordenados.filter((p) => p.precioCompra == null)
  const vencidos = ordenados.filter((p) => costoDesactualizado(p)).length

  async function guardarDatos() {
    await db.proveedores.update(proveedor.id, {
      nombre: nombre.trim() || proveedor.nombre,
      contacto: contacto.trim() || null,
    })
    setEditando(false)
  }

  async function borrarProveedor() {
    if (productos.length > 0) {
      alert('No se puede borrar: todavía tiene productos asignados. Reasignalos primero desde Productos.')
      return
    }
    if (!confirm(`¿Borrar el proveedor "${proveedor.nombre}"?`)) return
    await db.proveedores.delete(proveedor.id)
    onVolver()
  }

  async function alternarActivo() {
    if (proveedor.activo === false) {
      await db.proveedores.update(proveedor.id, { activo: true })
      return
    }
    const sinMarcar = productos.filter((p) => !p.descontinuado)
    const avisoProductos =
      sinMarcar.length > 0
        ? ` Sus ${sinMarcar.length} productos van a dejar de figurar como "costo desactualizado" (siguen viéndose en el catálogo igual que siempre, solo se apaga el aviso).`
        : ''
    if (!confirm(`¿Marcar "${proveedor.nombre}" como inactivo?${avisoProductos}`)) return
    await db.transaction('rw', db.proveedores, db.productos, async () => {
      await db.proveedores.update(proveedor.id, { activo: false })
      for (const p of sinMarcar) {
        await db.productos.update(p.codigo, { descontinuado: true })
      }
    })
    setMensaje(
      sinMarcar.length > 0
        ? `"${proveedor.nombre}" queda inactivo y se marcaron ${sinMarcar.length} productos como descontinuados.`
        : `"${proveedor.nombre}" queda inactivo.`,
    )
  }

  async function actualizarCosto(codigo: string, valor: string) {
    const numero = leerNumero(valor)
    await db.productos.update(codigo, {
      precioCompra: numero,
      fechaCompra: numero != null ? hoyISO() : null,
    })
  }

  async function aplicarAumento() {
    const pct = leerNumero(porcentaje)
    if (!pct) return
    const factor = 1 + pct / 100
    await db.transaction('rw', db.productos, async () => {
      for (const p of conCosto) {
        const nuevo = Math.round((p.precioCompra! * factor) * 100) / 100
        await db.productos.update(p.codigo, { precioCompra: nuevo, fechaCompra: hoyISO() })
      }
    })
    setMensaje(
      `Se actualizó el costo de ${conCosto.length} productos (+${pct}%). Los ${sinCosto.length} sin costo cargado quedaron igual — hay que cargarlos a mano.`,
    )
    setPorcentaje('')
  }

  return (
    <>
      <button className="boton-chico" onClick={onVolver} style={{ marginBottom: 10 }}>
        ← Proveedores
      </button>

      {editando ? (
        <div className="tarjeta">
          <div className="campo">
            <label htmlFor="ed-nombre">Nombre</label>
            <input id="ed-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="ed-contacto">Contacto</label>
            <input
              id="ed-contacto"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
          </div>
          <div className="botonera">
            <button onClick={() => setEditando(false)}>Cancelar</button>
            <button className="boton-principal" onClick={guardarDatos}>
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <div className="tarjeta">
          <div className="fila" style={{ borderBottom: 'none' }}>
            <span className="fila-etiqueta">
              <strong style={{ color: 'var(--tinta)', fontSize: '1.05rem' }}>{proveedor.nombre}</strong>
              {proveedor.contacto ? ` · ${proveedor.contacto}` : ''}
              {proveedor.activo === false && (
                <span className="chip" style={{ marginLeft: 6 }}>
                  Inactivo
                </span>
              )}
            </span>
            <div className="botonera" style={{ flexShrink: 0 }}>
              <button className="boton-chico" onClick={() => setEditando(true)}>
                Editar
              </button>
              <button className="boton-chico" onClick={alternarActivo}>
                {proveedor.activo === false ? 'Reactivar' : 'Marcar inactivo'}
              </button>
            </div>
          </div>
          <p className="silencio" style={{ marginTop: 6, marginBottom: 0 }}>
            {productos.length} productos
            {vencidos > 0 ? ` · ${vencidos} con costo vencido` : ''}
          </p>
          {proveedor.activo === false && (
            <p className="silencio" style={{ marginTop: 6, marginBottom: 0 }}>
              Ya no trabajamos con este proveedor. No aparece para elegir en productos nuevos.
            </p>
          )}
        </div>
      )}

      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

      <CuentaCorriente proveedor={proveedor} productos={productos} />

      {conCosto.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Aumentar todos los costos de este proveedor</p>
          <p className="silencio" style={{ marginBottom: 10 }}>
            Útil cuando el proveedor te avisa una lista nueva con un aumento parejo. Se aplica
            sobre los {conCosto.length} productos que ya tienen costo cargado.
          </p>
          <div className="grilla grilla-2">
            <div className="campo">
              <label htmlFor="pct">Aumento (%)</label>
              <input
                id="pct"
                inputMode="decimal"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="Ej: 8"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="boton-principal"
                style={{ width: '100%' }}
                onClick={aplicarAumento}
                disabled={!porcentaje}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Productos y costos</p>
        {ordenados.length === 0 ? (
          <p className="vacio">Este proveedor todavía no tiene productos asignados.</p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Costo</th>
                  <th>Actualizado</th>
                  <th className="num">Venta</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((p) => (
                  <tr key={p.codigo}>
                    <td style={{ whiteSpace: 'normal', minWidth: 160 }}>
                      {p.descripcion}
                      <div className="item-sub">{p.codigo}</div>
                    </td>
                    <td className="num">
                      <input
                        // La key incluye el precio: si se actualiza desde afuera
                        // (aumento en bloque), React vuelve a montar el input con
                        // el valor nuevo en vez de dejar el viejo pisado.
                        key={`${p.codigo}-${p.precioCompra ?? 'sin'}`}
                        defaultValue={p.precioCompra ?? ''}
                        placeholder="—"
                        inputMode="decimal"
                        style={{ width: 100, textAlign: 'right', padding: '6px 8px' }}
                        onBlur={(e) => actualizarCosto(p.codigo, e.target.value)}
                      />
                    </td>
                    <td>
                      <span className={costoDesactualizado(p) ? 'chip chip-alerta' : 'chip'}>
                        {fechaLinda(p.fechaCompra)}
                      </span>
                    </td>
                    <td className="num">{plata(p.precioVenta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button className="boton-peligro" style={{ width: '100%' }} onClick={borrarProveedor}>
        Borrar proveedor
      </button>
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Cuenta corriente con el proveedor: cada compra suma a lo que se le
 * debe (y ademas suma stock y actualiza el costo de cada producto),
 * cada pago lo descuenta (y ademas genera un gasto de caja grande,
 * categoria PROVEEDORES, para que aparezca solo en Gastos y en el
 * margen del mes sin cargarlo dos veces).
 */
function CuentaCorriente({
  proveedor,
  productos,
}: {
  proveedor: Proveedor
  productos: Producto[]
}) {
  const [accion, setAccion] = useState<'compra' | 'pago' | null>(null)

  const movimientos = useLiveQuery(
    () =>
      db.movimientosProveedor
        .where('proveedorId')
        .equals(proveedor.id)
        .reverse()
        .sortBy('fecha'),
    [proveedor.id],
  )

  const saldo = useMemo(
    () => (movimientos ?? []).reduce((s, m) => s + (m.tipo === 'compra' ? m.monto : -m.monto), 0),
    [movimientos],
  )

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Cuenta corriente</p>

      <div className="fila destacada">
        <span className="fila-etiqueta">
          {saldo > 0 ? 'Le debemos' : saldo < 0 ? 'A favor nuestro' : 'Saldo'}
        </span>
        <span className={saldo > 0 ? 'fila-valor negativo' : 'fila-valor positivo'}>
          {plata(Math.abs(saldo))}
        </span>
      </div>

      {accion === null ? (
        <div className="botonera" style={{ marginTop: 10 }}>
          <button className="boton-principal" onClick={() => setAccion('compra')}>
            + Registrar compra
          </button>
          <button onClick={() => setAccion('pago')}>+ Registrar pago</button>
        </div>
      ) : accion === 'compra' ? (
        <FormularioCompra proveedor={proveedor} productos={productos} onSalir={() => setAccion(null)} />
      ) : (
        <FormularioPago proveedor={proveedor} onSalir={() => setAccion(null)} />
      )}

      {movimientos && movimientos.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="tarjeta-titulo" style={{ marginBottom: 6 }}>
            Movimientos
          </p>
          <ul className="lista">
            {movimientos.map((m) => (
              <li className="item" key={m.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">
                    {m.tipo === 'compra' ? 'Compra' : `Pago · ${m.medioPago}`}
                  </div>
                  <div className="item-sub">
                    {fechaLinda(m.fecha)}
                    {m.tipo === 'compra' && m.items
                      ? ` · ${m.items.length} ${m.items.length === 1 ? 'producto' : 'productos'}`
                      : ''}
                    {m.notas ? ` · ${m.notas}` : ''}
                  </div>
                </div>
                <div className={`item-monto ${m.tipo === 'compra' ? 'negativo' : 'positivo'}`}>
                  {m.tipo === 'compra' ? '+' : '−'}
                  {plata(m.monto)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface LineaCompra {
  codigo: string
  cantidad: string
  costoUnitario: string
}

function lineaVacia(): LineaCompra {
  return { codigo: '', cantidad: '1', costoUnitario: '' }
}

function FormularioCompra({
  proveedor,
  productos,
  onSalir,
}: {
  proveedor: Proveedor
  productos: Producto[]
  onSalir: () => void
}) {
  const sesion = useSesion()
  const [fecha, setFecha] = useState(hoyISO())
  const [lineas, setLineas] = useState<LineaCompra[]>([lineaVacia()])
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')

  const disponibles = productos.filter((p) => p.archivado !== true)

  function actualizarLinea(indice: number, cambios: Partial<LineaCompra>) {
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...cambios } : l)))
  }

  function elegirProducto(indice: number, codigo: string) {
    const producto = disponibles.find((p) => p.codigo === codigo)
    setLineas((prev) =>
      prev.map((l, i) =>
        i === indice
          ? {
              ...l,
              codigo,
              // Precarga el ultimo costo cargado, para no tener que
              // volver a escribirlo si no cambio.
              costoUnitario:
                l.costoUnitario || (producto?.precioCompra != null ? String(producto.precioCompra) : l.costoUnitario),
            }
          : l,
      ),
    )
  }

  const total = lineas.reduce((suma, l) => {
    const cantidad = leerNumero(l.cantidad) ?? 0
    const costo = leerNumero(l.costoUnitario) ?? 0
    return suma + cantidad * costo
  }, 0)

  async function guardar() {
    const validas = lineas.filter(
      (l) => l.codigo && (leerNumero(l.cantidad) ?? 0) > 0 && leerNumero(l.costoUnitario) != null,
    )
    if (validas.length === 0) {
      setError('Agregá al menos un producto con cantidad y costo.')
      return
    }

    const items: ItemCompra[] = validas.map((l) => {
      const producto = disponibles.find((p) => p.codigo === l.codigo)!
      return {
        codigo: l.codigo,
        descripcion: producto.descripcion,
        cantidad: leerNumero(l.cantidad)!,
        costoUnitario: leerNumero(l.costoUnitario)!,
      }
    })
    const montoTotal = items.reduce((s, it) => s + it.cantidad * it.costoUnitario, 0)

    await db.transaction('rw', db.movimientosProveedor, db.productos, async () => {
      const registro: MovimientoProveedor = {
        id: nuevoId(),
        proveedorId: proveedor.id,
        tipo: 'compra',
        fecha,
        monto: montoTotal,
        medioPago: null,
        items,
        notas: notas.trim() || null,
        creadoPor: sesion.email,
      }
      await db.movimientosProveedor.add(registro)
      for (const it of items) {
        const producto = disponibles.find((p) => p.codigo === it.codigo)!
        const stockNuevo = producto.stock != null ? producto.stock + it.cantidad : it.cantidad
        await db.productos.update(it.codigo, {
          stock: stockNuevo,
          precioCompra: it.costoUnitario,
          fechaCompra: fecha,
        })
      }
    })
    onSalir()
  }

  return (
    <div className="tarjeta" style={{ marginTop: 10, background: 'var(--crema)' }}>
      <p className="tarjeta-titulo">Registrar compra</p>
      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="campo">
        <label htmlFor="c-fecha">Fecha</label>
        <input id="c-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      {lineas.map((linea, i) => (
        <div key={i} className="grilla grilla-2" style={{ marginBottom: 6 }}>
          <div className="campo">
            <label htmlFor={`c-prod-${i}`}>Producto</label>
            <select
              id={`c-prod-${i}`}
              value={linea.codigo}
              onChange={(e) => elegirProducto(i, e.target.value)}
            >
              <option value="">Elegir…</option>
              {disponibles.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.descripcion}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor={`c-cant-${i}`}>Cantidad</label>
              <input
                id={`c-cant-${i}`}
                inputMode="numeric"
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
              />
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor={`c-costo-${i}`}>Costo c/u</label>
              <input
                id={`c-costo-${i}`}
                inputMode="decimal"
                value={linea.costoUnitario}
                onChange={(e) => actualizarLinea(i, { costoUnitario: e.target.value })}
                placeholder="0"
              />
            </div>
            {lineas.length > 1 && (
              <button
                className="boton-chico"
                style={{ alignSelf: 'flex-end', marginBottom: 2 }}
                onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}

      <button className="boton-chico" onClick={() => setLineas((prev) => [...prev, lineaVacia()])}>
        + Agregar producto
      </button>

      <div className="campo" style={{ marginTop: 10 }}>
        <label htmlFor="c-notas">Notas (opcional)</label>
        <input id="c-notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Remito, factura…" />
      </div>

      <div className="fila destacada">
        <span className="fila-etiqueta">Total de la compra</span>
        <span className="fila-valor">{plata(total)}</span>
      </div>
      <p className="silencio" style={{ marginTop: 4 }}>
        Al guardar se suma al stock de cada producto y se actualiza su costo — así deja de figurar
        como "costo desactualizado".
      </p>

      <div className="botonera" style={{ marginTop: 10 }}>
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar}>
          Guardar compra
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function FormularioPago({ proveedor, onSalir }: { proveedor: Proveedor; onSalir: () => void }) {
  const sesion = useSesion()
  const [fecha, setFecha] = useState(hoyISO())
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago>('EFECTIVO')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')

  async function guardar() {
    const numero = leerNumero(monto)
    if (!numero || numero <= 0) {
      setError('Cargá un monto válido.')
      return
    }

    await db.transaction('rw', db.movimientosProveedor, db.movimientos, async () => {
      const registro: MovimientoProveedor = {
        id: nuevoId(),
        proveedorId: proveedor.id,
        tipo: 'pago',
        fecha,
        monto: numero,
        medioPago,
        items: null,
        notas: notas.trim() || null,
        creadoPor: sesion.email,
      }
      await db.movimientosProveedor.add(registro)
      await db.movimientos.add({
        id: nuevoId(),
        fecha,
        tipo: 'GASTO_CAJA_GRANDE',
        concepto: `Pago a ${proveedor.nombre}${notas.trim() ? ` (${notas.trim()})` : ''}`,
        monto: numero,
        categoria: 'PROVEEDORES',
        jornadaId: null,
        esVariable: true,
      })
    })
    onSalir()
  }

  return (
    <div className="tarjeta" style={{ marginTop: 10, background: 'var(--crema)' }}>
      <p className="tarjeta-titulo">Registrar pago</p>
      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="grilla grilla-2">
        <div className="campo">
          <label htmlFor="p-fecha-pago">Fecha</label>
          <input
            id="p-fecha-pago"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="p-monto-pago">Monto</label>
          <input
            id="p-monto-pago"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="p-medio">Medio de pago</label>
        <select id="p-medio" value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
          {MEDIOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="p-notas-pago">Notas (opcional)</label>
        <input id="p-notas-pago" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>

      <p className="silencio">
        Este pago va a descontar la deuda y también va a aparecer en Gastos, como gasto variable de
        categoría PROVEEDORES.
      </p>

      <div className="botonera">
        <button onClick={onSalir}>Cancelar</button>
        <button className="boton-principal" onClick={guardar}>
          Guardar pago
        </button>
      </div>
    </div>
  )
}
