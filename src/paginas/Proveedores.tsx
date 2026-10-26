import { useEffect, useMemo, useState } from 'react'
import { useCambiosSinGuardar } from '../lib/sinGuardar'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  conMotivo,
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
import { ETIQUETA_CUENTA, FORMAS_DE_COMPRA, tipoSegunCuenta, type CuentaDePago } from '../db/db'
import { idDeProveedor } from '../lib/idProveedor'
import { enlaceWhatsApp, soloDigitos } from '../lib/whatsapp'
import { fechaLinda, haceCuanto, hoyISO, leerNumero, normalizar, plata } from '../lib/formato'
import { egresoIgual, preguntaPagoRepetido } from '../lib/egresoRepetido'
import {
  descartarBorradorCompra,
  guardarBorradorCompra,
  leerBorradorCompra,
  tieneContenido,
} from '../lib/borradorCompra'
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

/**
 * Los campos de la ficha de un proveedor. Uno solo, para el alta y para
 * la edicion.
 *
 * Antes eran dos formularios distintos: el alta pedia nombre y
 * contacto, la edicion agregaba los otros nombres. Resultado: un
 * proveedor cargado nuevo nacia a medias y habia que entrar a editarlo
 * para completarlo, cosa que nadie hace. Con la carga a mano eso es la
 * diferencia entre tener la ficha del proveedor o no tenerla.
 *
 * Los datos son los que hacen falta para COMPRARLE: por donde se le
 * escribe, a quien, a que cuenta se le transfiere y con que
 * condiciones. No es una agenda: es lo que se necesita a la hora de
 * reponer.
 */
function CamposProveedor({
  valores,
  alCambiar,
}: {
  valores: FichaProveedor
  alCambiar: (cambios: Partial<FichaProveedor>) => void
}) {
  const campo = (
    clave: keyof FichaProveedor,
    etiqueta: string,
    extra: { placeholder?: string; autoFocus?: boolean } = {},
  ) => (
    <div className="campo">
      <label htmlFor={`pf-${clave}`}>{etiqueta}</label>
      <input
        id={`pf-${clave}`}
        value={valores[clave] ?? ''}
        onChange={(e) => alCambiar({ [clave]: e.target.value })}
        {...extra}
      />
    </div>
  )

  return (
    <>
      {campo('nombre', 'Nombre', { placeholder: 'Ej: MOHICANO', autoFocus: true })}
      {campo('contacto', 'Teléfono / WhatsApp', { placeholder: 'Ej: 345 4123456' })}

      <div className="campo">
        <label htmlFor="pf-comoSeCompra">¿Cómo se le compra?</label>
        <select
          id="pf-comoSeCompra"
          value={valores.comoSeCompra ?? ''}
          onChange={(e) => alCambiar({ comoSeCompra: e.target.value })}
        >
          <option value="">Sin especificar</option>
          {FORMAS_DE_COMPRA.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {campo('web', 'Página web o Instagram', { placeholder: '@mohicano o mohicano.com.ar' })}
      {campo('ciudad', 'Ciudad', { placeholder: 'Ej: Concordia' })}
      {campo('aliasCbu', 'Alias o CBU para transferir')}
      {campo('titular', 'Titular de esa cuenta', { placeholder: 'A nombre de quién' })}

      <div className="campo">
        <label htmlFor="pf-notas">Condiciones</label>
        <textarea
          id="pf-notas"
          rows={3}
          value={valores.notas ?? ''}
          onChange={(e) => alCambiar({ notas: e.target.value })}
          placeholder="Forma de pago, plazo, mínimo de compra…"
        />
      </div>

      <div className="campo">
        <label htmlFor="pf-alias">Otros nombres</label>
        <input
          id="pf-alias"
          value={valores.alias ?? ''}
          onChange={(e) => alCambiar({ alias: e.target.value })}
          placeholder="Separados por coma"
        />
        <p className="silencio" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
          Otras formas en las que aparece escrito este mismo proveedor. La app las reconoce
          como la misma ficha, así que no se crea una copia.
        </p>
      </div>
    </>
  )
}

/** La ficha tal como se edita: todo texto, incluidos los otros nombres. */
interface FichaProveedor {
  nombre: string
  contacto: string
  comoSeCompra: string
  web: string
  ciudad: string
  aliasCbu: string
  titular: string
  notas: string
  alias: string
}

function fichaVacia(): FichaProveedor {
  return {
    nombre: '',
    contacto: '',
    comoSeCompra: '',
    web: '',
    ciudad: '',
    aliasCbu: '',
    titular: '',
    notas: '',
    alias: '',
  }
}

function fichaDe(p: Proveedor): FichaProveedor {
  return {
    nombre: p.nombre,
    contacto: p.contacto ?? '',
    comoSeCompra: p.comoSeCompra ?? '',
    web: p.web ?? '',
    ciudad: p.ciudad ?? '',
    aliasCbu: p.aliasCbu ?? '',
    titular: p.titular ?? '',
    notas: p.notas ?? '',
    alias: (p.alias ?? []).join(', '),
  }
}

/** Lo que se guarda en la base a partir de lo que se escribio. */
function datosDeLaFicha(f: FichaProveedor) {
  const limpio = (v: string) => v.trim() || null
  return {
    nombre: f.nombre.trim(),
    contacto: limpio(f.contacto),
    comoSeCompra: limpio(f.comoSeCompra),
    web: limpio(f.web),
    ciudad: limpio(f.ciudad),
    aliasCbu: limpio(f.aliasCbu),
    titular: limpio(f.titular),
    notas: limpio(f.notas),
    alias: f.alias
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  }
}

function FormularioProveedor({
  onSalir,
  onCreado,
}: {
  onSalir: () => void
  onCreado?: (id: string) => void
}) {
  const [ficha, setFicha] = useState<FichaProveedor>(fichaVacia)
  const [error, setError] = useState('')
  useCambiosSinGuardar('la ficha del proveedor', ficha)

  async function guardar() {
    if (!ficha.nombre.trim()) return setError('Ponele un nombre al proveedor.')
    // El id sale del nombre (ver lib/idProveedor.ts), asi que buscar
    // por id ya es buscar por nombre: encuentra tambien a "Mohicano "
    // cuando el que existe se llama "MOHICANO".
    const id = idDeProveedor(ficha.nombre)
    const existe =
      (await db.proveedores.get(id)) ??
      (await db.proveedores.where('nombre').equalsIgnoreCase(ficha.nombre.trim()).first())
    if (existe) return setError(`Ya existe un proveedor "${existe.nombre}".`)

    await db.proveedores.add({
      id,
      ...datosDeLaFicha(ficha),
      activo: true,
      creadoEn: Date.now(),
      actualizadoEn: Date.now(),
    })
    onCreado?.(id)
    onSalir()
  }

  return (
    <div className="tarjeta">
      <p className="tarjeta-titulo">Proveedor nuevo</p>
      {error && <div className="aviso aviso-error">{error}</div>}
      <CamposProveedor
        valores={ficha}
        alCambiar={(cambios) => setFicha((prev) => ({ ...prev, ...cambios }))}
      />
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
  const [ficha, setFicha] = useState<FichaProveedor>(() => fichaDe(proveedor))
  const [porcentaje, setPorcentaje] = useState('')
  const [mensaje, setMensaje] = useState('')

  const ordenados = [...productos].sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
  const conCosto = ordenados.filter((p) => p.precioCompra != null)
  const sinCosto = ordenados.filter((p) => p.precioCompra == null)
  const vencidos = ordenados.filter((p) => costoDesactualizado(p)).length

  async function guardarDatos() {
    const datos = datosDeLaFicha(ficha)
    await db.proveedores.update(proveedor.id, {
      ...datos,
      nombre: datos.nombre || proveedor.nombre,
      actualizadoEn: Date.now(),
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

  /**
   * Marca el proveedor inactivo, o lo reactiva.
   *
   * Marcar inactivo arrastra a sus productos: los deja descontinuados,
   * que es lo que apaga el aviso de "costo desactualizado" --nadie va a
   * actualizar el costo de algo que no se vuelve a comprar--.
   *
   * El problema era la vuelta: reactivar devolvia el proveedor pero
   * dejaba a los productos descontinuados para siempre, y nada lo
   * decia. Con el orden de proveedores hecho a mano, marcar uno
   * inactivo por error y reactivarlo dejaba 40 productos marcados sin
   * que se notara. Ahora la reactivacion ofrece deshacerlo, y la
   * confirmacion de marcar inactivo dice que eso es lo que va a pasar.
   */
  async function alternarActivo() {
    if (proveedor.activo === false) {
      const marcados = productos.filter((p) => p.descontinuado)
      let desmarcar = false
      if (marcados.length > 0) {
        desmarcar = confirm(
          `Reactivar "${proveedor.nombre}".\n\n${marcados.length} de sus productos están marcados como descontinuados, probablemente de cuando se lo marcó inactivo.\n\n¿Querés sacarles también esa marca?\n\nAceptar: se reactiva el proveedor y sus ${marcados.length} productos vuelven a figurar normales.\nCancelar: se reactiva el proveedor y los productos quedan descontinuados.`,
        )
      }
      await db.transaction('rw', db.proveedores, db.productos, async () => {
        await db.proveedores.update(proveedor.id, { activo: true })
        if (desmarcar) {
          for (const p of marcados) {
            await db.productos.update(p.codigo, { descontinuado: false })
          }
        }
      })
      setMensaje(
        desmarcar
          ? `"${proveedor.nombre}" vuelve a estar activo y ${marcados.length} productos dejaron de estar descontinuados.`
          : `"${proveedor.nombre}" vuelve a estar activo.`,
      )
      return
    }

    const sinMarcar = productos.filter((p) => !p.descontinuado)
    const avisoProductos =
      sinMarcar.length > 0
        ? `\n\nSus ${sinMarcar.length} productos quedan marcados como DESCONTINUADOS: siguen viéndose y vendiéndose igual, pero dejan de pedir que les actualices el costo.\n\nSi después lo reactivás, la app te va a preguntar si querés sacarles esa marca.`
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

  /**
   * Sube el costo de todo el catalogo de un proveedor de una.
   *
   * Es la unica accion de la app que escribe en cientos de productos con
   * un solo toque, y antes lo hacia sin preguntar nada: se apretaba el
   * boton y 300 costos cambiaban. Un numero mal tecleado --un 50 donde
   * iba un 5-- no tenia vuelta atras mas que a mano, producto por
   * producto.
   *
   * Por eso ahora avisa CUANTOS productos va a tocar antes de tocarlos,
   * y muestra un ejemplo concreto con el producto mas caro: un
   * porcentaje es abstracto, "de $ 20.000 a $ 30.000" no.
   *
   * Y queda en el historial con motivo, para que los 300 renglones se
   * lean como un aumento y no como 300 ediciones sueltas del mismo
   * segundo.
   */
  async function aplicarAumento() {
    const pct = leerNumero(porcentaje)
    if (!pct) return
    const factor = 1 + pct / 100

    const caro = conCosto.reduce((a, b) => (b.precioCompra! > a.precioCompra! ? b : a))
    const ejemplo = `Por ejemplo, ${caro.descripcion}: de ${plata(caro.precioCompra!)} a ${plata(Math.round(caro.precioCompra! * factor * 100) / 100)}.`
    const verbo = pct > 0 ? 'aumentar' : 'bajar'
    const cuantos =
      conCosto.length === 1
        ? 'el costo de 1 producto'
        : `el costo de los ${conCosto.length} productos`
    if (
      !confirm(
        `Vas a ${verbo} ${cuantos} de "${proveedor.nombre}" un ${Math.abs(pct)}%.\n\n${ejemplo}\n\nNo se puede deshacer de una: habría que corregir cada producto a mano.`,
      )
    )
      return

    const motivo = `Aumento ${pct > 0 ? '+' : ''}${pct}% a ${proveedor.nombre}`
    await conMotivo(motivo, async () => {
      await db.transaction('rw', db.productos, async () => {
        for (const p of conCosto) {
          const nuevo = Math.round((p.precioCompra! * factor) * 100) / 100
          await db.productos.update(p.codigo, { precioCompra: nuevo, fechaCompra: hoyISO() })
        }
      })
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
          <CamposProveedor
            valores={ficha}
            alCambiar={(cambios) => setFicha((prev) => ({ ...prev, ...cambios }))}
          />
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
              {/* Si no hay contacto se dice, en vez de no mostrar nada:
                  sin esto el campo parecia no existir, y se reporto
                  justamente asi ("al editar no me aparece el contacto").
                  Aparecia: lo que no aparecia era el renglon vacio. */}
              {proveedor.contacto ? (
                ` · ${proveedor.contacto}`
              ) : (
                <span className="silencio"> · sin contacto cargado</span>
              )}
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

          {/* La ficha se lee acá. Si estos datos solo se vieran al
              editar, cargarlos no serviría de nada: se cargan para
              usarlos en el momento de comprar. */}
          {proveedor.comoSeCompra && (
            <div className="fila">
              <span className="fila-etiqueta">Se le compra por</span>
              <span className="fila-valor">{proveedor.comoSeCompra}</span>
            </div>
          )}
          {proveedor.contacto && (
            <div className="fila">
              <span className="fila-etiqueta">Teléfono / WhatsApp</span>
              <span className="fila-valor">
                <a
                  href={enlaceWhatsApp('', soloDigitos(proveedor.contacto))}
                  target="_blank"
                  rel="noreferrer"
                >
                  {proveedor.contacto}
                </a>
              </span>
            </div>
          )}
          {proveedor.web && (
            <div className="fila">
              <span className="fila-etiqueta">Web / Instagram</span>
              <span className="fila-valor">{proveedor.web}</span>
            </div>
          )}
          {proveedor.ciudad && (
            <div className="fila">
              <span className="fila-etiqueta">Ciudad</span>
              <span className="fila-valor">{proveedor.ciudad}</span>
            </div>
          )}
          {proveedor.aliasCbu && (
            <div className="fila">
              <span className="fila-etiqueta">Para transferir</span>
              <span className="fila-valor">
                {proveedor.aliasCbu}
                {proveedor.titular ? ` · ${proveedor.titular}` : ''}
              </span>
            </div>
          )}
          {proveedor.notas && (
            <div className="fila" style={{ display: 'block' }}>
              <span className="fila-etiqueta">Condiciones</span>
              <div style={{ marginTop: 2 }}>{proveedor.notas}</div>
            </div>
          )}
          {(proveedor.alias ?? []).length > 0 && (
            <div className="fila">
              <span className="fila-etiqueta">Otros nombres</span>
              <span className="fila-valor">{(proveedor.alias ?? []).join(', ')}</span>
            </div>
          )}
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

  /**
   * Deshace un movimiento cargado por error. Un pago se lleva tambien el
   * gasto que genero en Gastos; una compra devuelve el stock que habia
   * sumado. El costo que la compra dejo cargado en cada producto NO se
   * revierte: no sabemos cual era el anterior, y avisamos de eso.
   */
  async function borrarMovimiento(m: MovimientoProveedor) {
    if (m.tipo === 'pago') {
      if (!confirm(`¿Borrar el pago de ${plata(m.monto)}? También se borra el gasto que generó en Gastos.`)) return
      await db.transaction('rw', db.movimientosProveedor, db.movimientos, async () => {
        await db.movimientosProveedor.delete(m.id)
        if (m.movimientoGastoId) await db.movimientos.delete(m.movimientoGastoId)
      })
      return
    }

    const items = m.items ?? []
    const conStock = items.filter((it) => productos.some((p) => p.codigo === it.codigo && p.stock != null))
    const aviso = conStock.length > 0
      ? ` Se va a descontar del stock lo que esta compra había sumado (${conStock.length} ${conStock.length === 1 ? 'producto' : 'productos'}).`
      : ''
    if (!confirm(`¿Borrar la compra de ${plata(m.monto)}?${aviso} El costo que quedó cargado en los productos no se revierte solo: si hace falta, corregilo a mano.`)) return

    await db.transaction('rw', db.movimientosProveedor, db.productos, async () => {
      await db.movimientosProveedor.delete(m.id)
      for (const it of items) {
        const producto = await db.productos.get(it.codigo)
        if (!producto || producto.stock == null) continue
        await db.productos.update(it.codigo, { stock: producto.stock - it.cantidad })
      }
    })
  }

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
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className={`item-monto ${m.tipo === 'compra' ? 'negativo' : 'positivo'}`}>
                    {m.tipo === 'compra' ? '+' : '−'}
                    {plata(m.monto)}
                  </div>
                  <button
                    className="boton-chico"
                    style={{ marginTop: 4 }}
                    onClick={() => borrarMovimiento(m)}
                  >
                    Borrar
                  </button>
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
  // El borrador (ver lib/borradorCompra.ts). `listo` evita que el
  // formulario vacio pise el borrador antes de haberlo leido.
  const [listo, setListo] = useState(false)
  const [recuperadoDe, setRecuperadoDe] = useState<number | null>(null)

  useEffect(() => {
    let vigente = true
    void leerBorradorCompra(proveedor.id).then((b) => {
      if (!vigente) return
      if (b) {
        setFecha(b.fecha)
        setLineas(b.lineas)
        setNotas(b.notas)
        setRecuperadoDe(b.guardadoEn)
      }
      setListo(true)
    })
    return () => {
      vigente = false
    }
  }, [proveedor.id])

  useEffect(() => {
    if (!listo) return
    // Un instante de espera: no hace falta escribir en la base con cada
    // tecla, y si se cierra la app se pierde, como mucho, la ultima.
    const espera = setTimeout(() => {
      void guardarBorradorCompra(proveedor.id, { fecha, lineas, notas })
    }, 300)
    return () => clearTimeout(espera)
  }, [listo, proveedor.id, fecha, lineas, notas])

  async function empezarDeNuevo() {
    await descartarBorradorCompra(proveedor.id)
    setFecha(hoyISO())
    setLineas([lineaVacia()])
    setNotas('')
    setRecuperadoDe(null)
  }

  async function cancelar() {
    if (
      tieneContenido({ lineas, notas }) &&
      !confirm('¿Descartar la compra que estás cargando? Se borra lo que escribiste.')
    ) {
      return
    }
    await descartarBorradorCompra(proveedor.id)
    onSalir()
  }

  const disponibles = productos.filter((p) => p.archivado !== true)

  function actualizarLinea(indice: number, cambios: Partial<LineaCompra>) {
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...cambios } : l)))
  }

  /**
   * Da de alta un producto sin salir de la compra, con el proveedor ya
   * puesto.
   *
   * Antes habia que cortar la carga, ir a Productos, crearlo, volver y
   * empezar de nuevo. Cargando a mano eso pasa seguido: casi toda
   * compra trae algo que todavia no esta en el catalogo.
   *
   * El precio de venta queda vacio a proposito: lo pone quien lo
   * decide, mirando el costo y la rentabilidad, no el apuro de la
   * carga. El producto aparece despues en el aviso de "sin precio de
   * venta".
   */
  async function crearProductoNuevo(indice: number) {
    const codigo = prompt('Código del producto nuevo (el que usa el proveedor o el del local):')
    if (codigo === null) return
    const cod = codigo.trim().toUpperCase()
    if (!cod) return

    const existe = await db.productos.get(cod)
    if (existe) {
      alert(`Ya existe un producto con el código ${cod}: "${existe.descripcion}". Elegilo de la lista.`)
      return
    }

    const descripcion = prompt(`Nombre del producto ${cod}:`)
    if (descripcion === null) return
    if (!descripcion.trim()) {
      alert('Hace falta el nombre.')
      return
    }

    await db.productos.add({
      codigo: cod,
      descripcion: descripcion.trim(),
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
    // El costo y el stock los deja la compra al guardarse, como con
    // cualquier otro producto: no hace falta cargarlos dos veces.
    actualizarLinea(indice, { codigo: cod })
  }

  function elegirProducto(indice: number, codigo: string) {
    if (codigo === 'nuevo') {
      void crearProductoNuevo(indice)
      return
    }
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

    // Se lee de la base y no de la lista que tiene la pantalla: un
    // producto recien dado de alta desde aca todavia puede no estar en
    // esa lista, y antes eso reventaba al guardar. De paso, el stock
    // que se suma es el de este momento y no el de cuando se abrio el
    // formulario.
    const items: ItemCompra[] = []
    for (const l of validas) {
      const producto = await db.productos.get(l.codigo)
      if (!producto) {
        setError(`No encuentro el producto ${l.codigo}. Volvé a elegirlo de la lista.`)
        return
      }
      items.push({
        codigo: l.codigo,
        descripcion: producto.descripcion,
        cantidad: leerNumero(l.cantidad)!,
        costoUnitario: leerNumero(l.costoUnitario)!,
      })
    }
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
        const producto = await db.productos.get(it.codigo)
        if (!producto) continue
        const stockNuevo = producto.stock != null ? producto.stock + it.cantidad : it.cantidad
        await db.productos.update(it.codigo, {
          stock: stockNuevo,
          precioCompra: it.costoUnitario,
          fechaCompra: fecha,
        })
      }
    })
    await descartarBorradorCompra(proveedor.id)
    onSalir()
  }

  return (
    <div className="tarjeta" style={{ marginTop: 10, background: 'var(--crema)' }}>
      <p className="tarjeta-titulo">Registrar compra</p>
      {error && <div className="aviso aviso-error">{error}</div>}
      {recuperadoDe !== null && (
        <div className="aviso aviso-ojo">
          Recuperé la compra que quedó a medio cargar ({haceCuanto(recuperadoDe)}). Revisala y
          guardala cuando esté completa.{' '}
          <button className="boton-chico" onClick={() => void empezarDeNuevo()}>
            Empezar de nuevo
          </button>
        </div>
      )}

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
              <option value="nuevo">+ Producto nuevo…</option>
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
        <button onClick={() => void cancelar()}>Cancelar</button>
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
  const [cuenta, setCuenta] = useState<CuentaDePago>('cajaGrande')
  useCambiosSinGuardar('el pago', [fecha, monto, medioPago, notas, cuenta])

  /**
   * El turno abierto, si hay. Sin esto, un pago hecho con la plata del
   * cajon se registraba igual como salido de la caja grande, y el turno
   * cerraba con un faltante por el monto del pago: la plata ya no
   * estaba en el cajon y nada lo explicaba.
   */
  const turnoAbierto = useLiveQuery(
    async () => (await db.jornadas.where('estado').equals('abierto').first()) ?? null,
    [],
  )

  async function guardar() {
    const numero = leerNumero(monto)
    if (!numero || numero <= 0) {
      setError('Cargá un monto válido.')
      return
    }

    const delCajon = cuenta === 'cajon' && turnoAbierto
    if (cuenta === 'cajon' && !turnoAbierto) {
      setError('No hay ningún turno abierto, así que la plata no puede salir del cajón.')
      return
    }
    // Al reves que en Caja: el egreso ya se cargo a mano y ahora se
    // registra el pago con plata del cajon (ver lib/egresoRepetido.ts).
    if (delCajon) {
      const delDia = await db.movimientos.where('fecha').equals(fecha).toArray()
      const igual = egresoIgual(numero, fecha, delDia)
      if (igual && !confirm(preguntaPagoRepetido(igual))) return
    }

    const idGasto = nuevoId()
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
        movimientoGastoId: idGasto,
        creadoPor: sesion.email,
      }
      await db.movimientosProveedor.add(registro)
      // Un solo movimiento, siempre: lo que cambia es de que caja
      // sale. Contra el turno, el cierre lo descuenta solo del efectivo
      // esperado; contra la caja grande, no toca el arqueo. En los dos
      // casos el gasto aparece una vez en Gastos, no dos.
      await db.movimientos.add({
        id: idGasto,
        fecha,
        // El tipo sale de la cuenta: el cajon es lo unico que toca el
        // turno. Banco y Mercado Pago no tocan ninguna caja, pero el
        // gasto se registra igual --una sola vez-- con su cuenta, para
        // poder conciliar cada una con su resumen.
        tipo: tipoSegunCuenta(cuenta),
        cuenta,
        concepto: `Pago a ${proveedor.nombre}${notas.trim() ? ` (${notas.trim()})` : ''}`,
        monto: numero,
        categoria: 'PROVEEDORES',
        jornadaId: delCajon ? turnoAbierto.id : null,
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
          <label htmlFor="p-origen">¿De dónde sale la plata?</label>
          <select
            id="p-origen"
            value={cuenta}
            onChange={(e) => setCuenta(e.target.value as CuentaDePago)}
          >
            <option value="cajon" disabled={!turnoAbierto}>
              {ETIQUETA_CUENTA.cajon}
              {turnoAbierto ? '' : ' (no hay turno abierto)'}
            </option>
            <option value="cajaGrande">{ETIQUETA_CUENTA.cajaGrande}</option>
            <option value="banco">{ETIQUETA_CUENTA.banco}</option>
            <option value="mercadoPago">{ETIQUETA_CUENTA.mercadoPago}</option>
          </select>
          <p className="silencio" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
            {cuenta === 'cajon'
              ? 'Se descuenta del efectivo esperado del turno abierto, así el cierre da bien.'
              : cuenta === 'cajaGrande'
                ? 'No toca la caja del turno. Si pagaste con plata del cajón, elegí esa opción o el turno va a cerrar con faltante.'
                : `No toca ninguna caja: el gasto queda registrado con la cuenta de ${ETIQUETA_CUENTA[cuenta]}, para poder conciliarla después.`}
          </p>
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
