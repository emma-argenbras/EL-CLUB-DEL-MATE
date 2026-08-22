import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  nuevoId,
  CATEGORIAS_GASTO,
  MEDIOS_PAGO,
  type CategoriaGasto,
  type Arqueo,
  type Jornada,
  type MedioPago,
  type Producto,
  type Turno,
} from '../db/db'
import { arqueoVacio, esCierreTardio, resumirJornada, sinStock, totalArqueo } from '../lib/calculos'
import { fechaLinda, haceCuanto, hoyISO, horaAhora, leerNumero, plata } from '../lib/formato'
import ArqueoCaja from '../componentes/ArqueoCaja'
import BuscadorProducto from '../componentes/BuscadorProducto'
import CierresPendientes from '../componentes/CierresPendientes'
import CierresTardios from '../componentes/CierresTardios'
import { useSesion } from '../sync/useSesion'

export default function Caja() {
  const [fecha, setFecha] = useState(hoyISO())
  const [turno, setTurno] = useState<Turno>(
    new Date().getHours() < 14 ? 'M' : 'T',
  )

  // useLiveQuery devuelve undefined mientras consulta, y .first() tambien
  // devuelve undefined cuando no hay turno. Convertimos "no hay" en null
  // para poder distinguir un caso del otro.
  const jornada = useLiveQuery(
    async () =>
      (await db.jornadas.where('[fecha+turno]').equals([fecha, turno]).first()) ?? null,
    [fecha, turno],
  )

  return (
    <>
      <h2>Caja</h2>

      <CierresTardios />
      <CierresPendientes />

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="fecha">Fecha</label>
          <input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label>Turno</label>
          <div className="botonera">
            <button
              className={turno === 'M' ? 'pestana activa' : 'pestana'}
              onClick={() => setTurno('M')}
            >
              Mañana
            </button>
            <button
              className={turno === 'T' ? 'pestana activa' : 'pestana'}
              onClick={() => setTurno('T')}
            >
              Tarde
            </button>
          </div>
        </div>
      </div>

      {jornada === undefined ? (
        <p className="vacio">Cargando…</p>
      ) : jornada === null ? (
        <AbrirTurno fecha={fecha} turno={turno} />
      ) : (
        <TurnoAbierto jornada={jornada} />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function AbrirTurno({ fecha, turno }: { fecha: string; turno: Turno }) {
  const [arqueo, setArqueo] = useState<Arqueo>(arqueoVacio())
  const [vendedor, setVendedor] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cajaInicial = totalArqueo(arqueo)

  async function abrir() {
    setGuardando(true)
    try {
      await db.jornadas.add({
        id: nuevoId(),
        fecha,
        turno,
        estado: 'abierto',
        vendedor: vendedor.trim() || null,
        cajaInicial,
        horaApertura: horaAhora(),
        horaCierre: null,
        arqueoApertura: arqueo,
        arqueoCierre: null,
        notas: null,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="aviso aviso-ojo">
        No hay turno abierto para el {fechaLinda(fecha)} ({turno === 'M' ? 'mañana' : 'tarde'}).
        Contá la caja para arrancar.
      </div>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="vendedor">Vendedor / a cargo</label>
          <input
            id="vendedor"
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            placeholder="Nombre de quien atiende"
          />
        </div>
      </div>

      <ArqueoCaja arqueo={arqueo} onCambiar={setArqueo} titulo="Arqueo de apertura" />

      <button className="boton-principal" onClick={abrir} disabled={guardando}>
        Abrir turno con {plata(cajaInicial)}
      </button>
    </>
  )
}

/* ------------------------------------------------------------------ */

function TurnoAbierto({ jornada }: { jornada: Jornada }) {
  const [pestana, setPestana] = useState<'ventas' | 'egresos' | 'cierre'>('ventas')

  const ventas = useLiveQuery(
    () => db.ventas.where('jornadaId').equals(jornada.id).toArray(),
    [jornada.id],
  )
  const movimientos = useLiveQuery(
    () => db.movimientos.where('jornadaId').equals(jornada.id).toArray(),
    [jornada.id],
  )

  const resumen = useMemo(
    () => resumirJornada(jornada.cajaInicial, ventas ?? [], movimientos ?? []),
    [jornada.cajaInicial, ventas, movimientos],
  )

  const cerrado = jornada.estado === 'cerrado'

  return (
    <>
      <div className="tarjeta">
        <div className="grilla grilla-3">
          <div className="cifra">
            <div className="cifra-valor">{plata(resumen.totalVentas)}</div>
            <div className="cifra-etiqueta">Vendido</div>
          </div>
          <div className="cifra">
            <div className="cifra-valor">{plata(resumen.efectivo)}</div>
            <div className="cifra-etiqueta">Efectivo</div>
          </div>
          <div className="cifra">
            <div className="cifra-valor">{plata(resumen.banco)}</div>
            <div className="cifra-etiqueta">Banco</div>
          </div>
        </div>
        <div className="fila" style={{ marginTop: 8 }}>
          <span className="fila-etiqueta">
            Caja inicial · {jornada.horaApertura ?? '—'}
            {jornada.vendedor ? ` · ${jornada.vendedor}` : ''}
          </span>
          <span className="fila-valor">{plata(jornada.cajaInicial)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Efectivo esperado en caja</span>
          <span className="fila-valor">{plata(resumen.cierreEsperado)}</span>
        </div>
        {cerrado && (
          <div className="aviso aviso-ok" style={{ marginTop: 10, marginBottom: 0 }}>
            Turno cerrado{jornada.horaCierre ? ` a las ${jornada.horaCierre}` : ''}.
          </div>
        )}
      </div>

      <div className="pestanas">
        <button
          className={pestana === 'ventas' ? 'pestana activa' : 'pestana'}
          onClick={() => setPestana('ventas')}
        >
          Ventas ({ventas?.length ?? 0})
        </button>
        <button
          className={pestana === 'egresos' ? 'pestana activa' : 'pestana'}
          onClick={() => setPestana('egresos')}
        >
          Egresos ({movimientos?.length ?? 0})
        </button>
        <button
          className={pestana === 'cierre' ? 'pestana activa' : 'pestana'}
          onClick={() => setPestana('cierre')}
        >
          Cierre
        </button>
      </div>

      {pestana === 'ventas' && (
        <PanelVentas jornada={jornada} ventas={ventas ?? []} bloqueado={cerrado} />
      )}
      {pestana === 'egresos' && (
        <PanelEgresos jornada={jornada} movimientos={movimientos ?? []} bloqueado={cerrado} />
      )}
      {pestana === 'cierre' && <PanelCierre jornada={jornada} esperado={resumen.cierreEsperado} />}
    </>
  )
}

/* ------------------------------------------------------------------ */

function PanelVentas({
  jornada,
  ventas,
  bloqueado,
}: {
  jornada: Jornada
  ventas: import('../db/db').Venta[]
  bloqueado: boolean
}) {
  const [elegido, setElegido] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago>('EFECTIVO')

  function seleccionar(producto: Producto) {
    setElegido(producto)
    setPrecio(producto.precioVenta ? String(producto.precioVenta) : '')
    setCantidad('1')
  }

  const cant = Number(cantidad) || 0
  const pre = leerNumero(precio) ?? 0
  const total = Math.round(cant * pre * 100) / 100

  async function registrar() {
    if (!elegido || cant <= 0 || pre <= 0) return
    await db.transaction('rw', db.ventas, db.productos, async () => {
      await db.ventas.add({
        id: nuevoId(),
        jornadaId: jornada.id,
        fecha: jornada.fecha,
        hora: horaAhora(),
        codigo: elegido.codigo,
        descripcion: elegido.descripcion,
        cantidad: cant,
        precioUnitario: pre,
        // Congelamos el costo del momento: asi el margen historico no
        // se mueve cuando mas adelante se actualice el precio de compra.
        costoUnitario: elegido.precioCompra ?? null,
        medioPago,
        total,
        vendedor: jornada.vendedor,
      })
      // Descontamos stock solo si el producto lo lleva.
      if (elegido.stock !== null && elegido.stock !== undefined) {
        await db.productos.update(elegido.codigo, { stock: elegido.stock - cant })
      }
    })
    setElegido(null)
    setPrecio('')
    setCantidad('1')
  }

  async function borrar(venta: import('../db/db').Venta) {
    if (!confirm(`¿Borrar la venta de ${venta.descripcion}?`)) return
    await db.transaction('rw', db.ventas, db.productos, async () => {
      await db.ventas.delete(venta.id)
      const producto = await db.productos.get(venta.codigo)
      if (producto && producto.stock !== null && producto.stock !== undefined) {
        await db.productos.update(venta.codigo, { stock: producto.stock + venta.cantidad })
      }
    })
  }

  return (
    <>
      {!bloqueado && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Cargar venta</p>

          {!elegido ? (
            <BuscadorProducto onElegir={seleccionar} autoFoco />
          ) : (
            <>
              <div className="item" style={{ borderBottom: 'none', paddingTop: 0 }}>
                <div>
                  <div className="item-titulo">{elegido.descripcion}</div>
                  <div className="item-sub">{elegido.codigo}</div>
                </div>
                <button className="boton-chico" onClick={() => setElegido(null)}>
                  Cambiar
                </button>
              </div>

              <div className="grilla grilla-2">
                <div className="campo">
                  <label htmlFor="cant">Cantidad</label>
                  <input
                    id="cant"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="precio">Precio unitario</label>
                  <input
                    id="precio"
                    inputMode="decimal"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="campo">
                <label htmlFor="medio">Medio de pago</label>
                <select
                  id="medio"
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                >
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {sinStock(elegido) && (
                <div className="aviso aviso-ojo">
                  Según la app este producto está sin stock (queda {elegido.stock}). Si igual lo
                  tenés en el mostrador, vendelo tranquila: el stock queda en negativo y se
                  acomoda cuando registres la próxima compra al proveedor.
                </div>
              )}

              {!elegido.precioCompra && (
                <div className="aviso aviso-ojo">
                  Este producto no tiene precio de compra cargado, así que esta venta no va a
                  sumar al margen de contribución.
                </div>
              )}

              <button className="boton-principal" onClick={registrar} disabled={total <= 0}>
                Agregar {plata(total)}
              </button>
            </>
          )}
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Ventas del turno</p>
        {ventas.length === 0 ? (
          <p className="vacio">Todavía no hay ventas cargadas.</p>
        ) : (
          <ul className="lista">
            {[...ventas].reverse().map((v) => (
              <li className="item" key={v.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{v.descripcion}</div>
                  <div className="item-sub">
                    {v.hora} · {v.codigo} · {v.cantidad} × {plata(v.precioUnitario)}{' '}
                    <span
                      className={v.medioPago === 'EFECTIVO' ? 'chip' : 'chip chip-banco'}
                    >
                      {v.medioPago}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="item-monto">{plata(v.total)}</div>
                  {!bloqueado && (
                    <button
                      className="boton-chico"
                      style={{ marginTop: 4 }}
                      onClick={() => borrar(v)}
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

/** Categorias que se pagan igual se venda mucho o poco. */
const CATEGORIAS_FIJAS: CategoriaGasto[] = [
  'ALQUILER',
  'SERVICIOS',
  'SUELDOS',
  'CONTADOR',
  'IMPUESTOS',
  'MANTENIMIENTO',
]

function PanelEgresos({
  jornada,
  movimientos,
  bloqueado,
}: {
  jornada: Jornada
  movimientos: import('../db/db').Movimiento[]
  bloqueado: boolean
}) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [tipo, setTipo] = useState<'EGRESO_CAJA' | 'A_CAJA_GRANDE'>('EGRESO_CAJA')
  const [categoria, setCategoria] = useState<CategoriaGasto>('OTROS')

  async function agregar() {
    const valor = leerNumero(monto)
    if (!valor || valor <= 0) return
    await db.movimientos.add({
      id: nuevoId(),
      fecha: jornada.fecha,
      tipo,
      concepto: concepto.trim() || (tipo === 'A_CAJA_GRANDE' ? 'Pase a caja grande' : 'Egreso'),
      monto: valor,
      categoria: tipo === 'EGRESO_CAJA' ? categoria : null,
      jornadaId: jornada.id,
      // Un pase a caja grande no es un gasto: es plata que cambia de lugar.
      // Y que un gasto sea fijo o variable depende de QUE se pago, no de
      // con que caja: un sueldo pagado de la caja del turno es fijo igual.
      esVariable: tipo === 'EGRESO_CAJA' && !CATEGORIAS_FIJAS.includes(categoria),
    })
    setConcepto('')
    setMonto('')
    setCategoria('OTROS')
  }

  return (
    <>
      {!bloqueado && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Sacar plata de la caja</p>

          <div className="campo">
            <label htmlFor="tipo-egreso">Motivo</label>
            <select
              id="tipo-egreso"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
            >
              <option value="EGRESO_CAJA">Gasto pagado con la caja</option>
              <option value="A_CAJA_GRANDE">Pase a caja grande</option>
            </select>
          </div>

          <div className="campo">
            <label htmlFor="concepto">Concepto</label>
            <input
              id="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={tipo === 'A_CAJA_GRANDE' ? 'Pase a caja grande' : 'Ej: flete, café'}
            />
          </div>

          <div className="campo">
            <label htmlFor="monto-egreso">Monto</label>
            <input
              id="monto-egreso"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </div>

          {tipo === 'EGRESO_CAJA' && (
            <div className="campo">
              <label htmlFor="cat-egreso">Categoría</label>
              <select
                id="cat-egreso"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
              >
                {CATEGORIAS_GASTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="silencio" style={{ marginTop: 4 }}>
                {CATEGORIAS_FIJAS.includes(categoria)
                  ? 'Se cuenta como gasto fijo: se paga igual se venda mucho o poco.'
                  : 'Se cuenta como gasto variable: sube cuando se vende más.'}
              </p>
            </div>
          )}

          <button className="boton-principal" onClick={agregar}>
            Registrar egreso
          </button>
        </div>
      )}

      <div className="tarjeta">
        <p className="tarjeta-titulo">Egresos del turno</p>
        {movimientos.length === 0 ? (
          <p className="vacio">Sin egresos en este turno.</p>
        ) : (
          <ul className="lista">
            {movimientos.map((m) => (
              <li className="item" key={m.id}>
                <div>
                  <div className="item-titulo">{m.concepto}</div>
                  <div className="item-sub">
                    {m.tipo === 'A_CAJA_GRANDE' ? 'Pase a caja grande' : 'Gasto de caja'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="item-monto">{plata(m.monto)}</div>
                  {!bloqueado && (
                    <button
                      className="boton-chico"
                      style={{ marginTop: 4 }}
                      onClick={() => {
                        if (confirm(`¿Borrar "${m.concepto}" de ${plata(m.monto)}?`)) {
                          db.movimientos.delete(m.id)
                        }
                      }}
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

function PanelCierre({ jornada, esperado }: { jornada: Jornada; esperado: number }) {
  const sesion = useSesion()
  const [arqueo, setArqueo] = useState<Arqueo>(
    jornada.arqueoCierre ?? jornada.solicitudCierre?.arqueo ?? arqueoVacio(),
  )
  const contado = totalArqueo(arqueo)
  const diferencia = contado - esperado
  const cerrado = jornada.estado === 'cerrado'

  // Los turnos que ya existen ese mismo dia: si la tarde ya arranco,
  // cerrar la mañana es una correccion sobre algo que ya paso.
  const turnosDelDia = useLiveQuery(
    () => db.jornadas.where('fecha').equals(jornada.fecha).toArray(),
    [jornada.fecha],
  )

  // Un dueño no se pide permiso a si mismo. Sin nube tampoco hay perfil
  // ni empleados: la app corre en el dispositivo del dueño.
  const necesitaPermiso =
    sesion.perfil?.rol === 'empleado' &&
    !!turnosDelDia &&
    esCierreTardio(jornada, turnosDelDia)

  const pedido = jornada.solicitudCierre ?? null
  const esperandoPermiso = pedido?.estado === 'pendiente'

  /**
   * Deja pedido el cierre en vez de cerrar. El conteo queda congelado
   * tal cual se hizo: cuando el dueño autoriza, el turno cierra con
   * estos billetes y no con los de ese momento.
   */
  async function pedirCierre() {
    const motivo = prompt(
      `Este turno es del ${fechaLinda(jornada.fecha)} y se está cerrando después. Contale al dueño qué pasó para que pueda autorizarlo.`,
      pedido?.motivo ?? '',
    )
    if (motivo === null) return
    if (!motivo.trim()) {
      alert('Hace falta escribir el motivo: es lo que el dueño lee para autorizar.')
      return
    }
    await db.jornadas.update(jornada.id, {
      solicitudCierre: {
        arqueo,
        motivo: motivo.trim(),
        por: sesion.email ?? 'local',
        porNombre: sesion.perfil?.nombre ?? 'Vendedor',
        cuando: Date.now(),
        estado: 'pendiente',
      },
    })
  }

  async function cancelarPedido() {
    if (!confirm('¿Dar de baja el pedido? Vas a poder volver a pedirlo con otro conteo.')) return
    await db.jornadas.update(jornada.id, { solicitudCierre: null })
  }

  async function cerrar() {
    if (
      !confirm(
        diferencia === 0
          ? '¿Cerrar el turno? La caja cierra justa.'
          : `La caja da una diferencia de ${plata(diferencia)}. ¿Cerrar igual?`,
      )
    )
      return

    // Cuando la caja no da justa se pide una explicacion, pero NO se
    // frena el cierre: la persona tiene que poder terminar su turno e
    // irse. Lo que queda pendiente es el visto bueno del dueño.
    let nota: string | null = jornada.notaCierre ?? null
    if (diferencia !== 0) {
      const escrito = prompt(
        `¿Sabés a qué se debe la diferencia de ${plata(diferencia)}? Contale al dueño lo que te acordás (podés dejarlo vacío).`,
        nota ?? '',
      )
      // Cancelar el cartel no cancela el cierre: solo deja la nota como estaba.
      if (escrito !== null) nota = escrito.trim() || null
    }

    await db.jornadas.update(jornada.id, {
      estado: 'cerrado',
      arqueoCierre: arqueo,
      horaCierre: horaAhora(),
      notaCierre: nota,
      // Una diferencia nueva vuelve a necesitar visto bueno: si se
      // reabre el turno y se cierra distinto, el de antes ya no vale.
      cierreAutorizado: null,
      // Si habia un pedido rechazado dando vueltas, ya no aplica.
      solicitudCierre: null,
    })
  }

  async function reabrir() {
    if (!confirm('¿Reabrir el turno para seguir cargando?')) return
    await db.jornadas.update(jornada.id, { estado: 'abierto', horaCierre: null })
  }

  return (
    <>
      <ArqueoCaja arqueo={arqueo} onCambiar={setArqueo} titulo="Arqueo de cierre" />

      <div className="tarjeta">
        <div className="fila">
          <span className="fila-etiqueta">Debería haber</span>
          <span className="fila-valor">{plata(esperado)}</span>
        </div>
        <div className="fila">
          <span className="fila-etiqueta">Contado</span>
          <span className="fila-valor">{plata(contado)}</span>
        </div>
        <div className="fila destacada">
          <span className="fila-etiqueta">Diferencia de caja</span>
          <span
            className={
              diferencia === 0
                ? 'fila-valor'
                : diferencia > 0
                  ? 'fila-valor positivo'
                  : 'fila-valor negativo'
            }
          >
            {diferencia > 0 ? '+' : ''}
            {plata(diferencia)}
          </span>
        </div>
        {diferencia !== 0 && (
          <p className="silencio" style={{ marginTop: 8 }}>
            {diferencia > 0
              ? 'Sobra plata en la caja: puede haber una venta sin cargar.'
              : 'Falta plata en la caja: puede haber un egreso sin registrar.'}
          </p>
        )}
        {/* Que pasa con la diferencia despues de cerrar. Sin esto, quien
            cierra deja la caja descuadrada y no se entera nunca de si
            alguien la miro: el visto bueno se veia solo del lado del
            dueño. */}
        {cerrado && diferencia !== 0 && (
          <div className="fila" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="fila-etiqueta">
              {jornada.cierreAutorizado ? (
                <>
                  Visto bueno de {jornada.cierreAutorizado.porNombre} ·{' '}
                  {haceCuanto(jornada.cierreAutorizado.cuando)}
                  {jornada.cierreAutorizado.comentario
                    ? ` · «${jornada.cierreAutorizado.comentario}»`
                    : ''}
                </>
              ) : (
                'Queda esperando el visto bueno del dueño. El turno igual está cerrado.'
              )}
            </span>
          </div>
        )}
        {cerrado && jornada.notaCierre && (
          <p className="silencio" style={{ marginTop: 4 }}>
            Lo que se anotó al cerrar: «{jornada.notaCierre}»
          </p>
        )}
      </div>

      {esperandoPermiso && pedido && (
        <div className="aviso aviso-ojo">
          <strong>Esperando que el dueño autorice el cierre.</strong>
          <br />
          Pediste cerrar con {plata(totalArqueo(pedido.arqueo))} {haceCuanto(pedido.cuando)}: «
          {pedido.motivo}». Cuando lo autorice, el turno se cierra solo con ese conteo. Mientras
          tanto podés seguir trabajando normalmente.
        </div>
      )}

      {pedido?.estado === 'rechazada' && (
        <div className="aviso aviso-error">
          <strong>El dueño no autorizó este cierre.</strong>
          {pedido.respuestaComentario ? <> «{pedido.respuestaComentario}»</> : null}
          <br />
          Revisá el conteo y volvé a pedirlo.
        </div>
      )}

      {cerrado ? (
        <button onClick={reabrir} style={{ width: '100%' }}>
          Reabrir turno
        </button>
      ) : esperandoPermiso ? (
        <button onClick={cancelarPedido} style={{ width: '100%' }}>
          Dar de baja el pedido
        </button>
      ) : necesitaPermiso ? (
        <button className="boton-principal" onClick={pedirCierre}>
          Pedir autorización para cerrar
        </button>
      ) : (
        <button className="boton-principal" onClick={cerrar}>
          Cerrar turno
        </button>
      )}
    </>
  )
}
