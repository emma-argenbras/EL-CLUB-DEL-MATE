import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nuevoId, type Producto, type Proveedor } from '../db/db'
import { costoDesactualizado } from '../lib/calculos'
import { fechaLinda, hoyISO, leerNumero, normalizar, plata } from '../lib/formato'

export default function Proveedores() {
  const [consulta, setConsulta] = useState('')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const proveedores = useLiveQuery(() => db.proveedores.orderBy('nombre').toArray(), [])
  const productos = useLiveQuery(() => db.productos.toArray(), [])

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
            </span>
            <button className="boton-chico" onClick={() => setEditando(true)}>
              Editar
            </button>
          </div>
          <p className="silencio" style={{ marginTop: 6, marginBottom: 0 }}>
            {productos.length} productos
            {vencidos > 0 ? ` · ${vencidos} con costo vencido` : ''}
          </p>
        </div>
      )}

      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

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
