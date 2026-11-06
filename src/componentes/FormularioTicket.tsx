import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, MEDIOS_PAGO, type Jornada, type MedioPago, type Producto } from '../db/db'
import {
  problemaDelTicket,
  registrarCobro,
  totalDelRenglon,
  totalesDelTicket,
  type PagoTicket,
  type RenglonTicket,
} from '../db/ticket'
import { sinStock } from '../lib/calculos'
import { horaAhora, leerNumero, plata } from '../lib/formato'
import { useSinGuardar } from '../lib/sinGuardar'
import { nombreDelPlan, planAlElegirMedio, planesDe, planPorId, recargoDe } from '../lib/tarjetas'
import {
  descripcionesAnteriores,
  descripcionParaVender,
  pideDescripcionAlVender,
} from '../lib/ventaSinCodigo'
import BuscadorProducto from './BuscadorProducto'
import MasVendidos from './MasVendidos'

/**
 * Cargar un ticket en Caja: un cliente que se lleva varios productos y
 * paga con uno o mas medios (puntos 7 y 8 del pedido del 06/11). La
 * logica esta en db/ticket.ts; aca solo se arma lo que se ve.
 */

interface Linea {
  clave: number
  producto: Producto
  /** Lo que salio, si el producto es generico. */
  queSalio: string
  cantidad: string
  precio: string
}

interface LineaPago {
  clave: number
  medio: MedioPago
  planId: string | null
  monto: string
  /**
   * Una sola linea a la vez se completa sola con lo que falta: la ultima
   * que se agrego, hasta que alguien escribe un monto en ella.
   */
  auto: boolean
}

let siguienteClave = 1
const clave = () => siguienteClave++

/** Lo que ya estaba elegido en la venta simple, cuando el cliente suma otro producto. */
export interface InicioTicket {
  producto: Producto
  queSalio: string
  cantidad: string
  precio: string
  medio: MedioPago
  planId: string | null
}

/**
 * Lo que quedo registrado: un ticket, o una venta comun si era un solo
 * producto con un solo medio y sin recargo (ver comoVentaSola en ticket.ts).
 */
export interface Registrado {
  ticketId: string | null
  ventaId: string | null
  texto: string
}

export default function FormularioTicket({
  jornada,
  inicial,
  onListo,
  onCancelar,
  enColumnas = false,
  onCambio,
}: {
  jornada: Jornada
  inicial?: InicioTicket | null
  onListo: (registrado: Registrado) => void
  onCancelar: () => void
  /**
   * La caja de la compu (opcion B, 06/11): buscar, el ticket y el cobro en
   * tres columnas, con lo mas vendido a un toque. En el celular, una
   * columna, como siempre.
   */
  enColumnas?: boolean
  /** En la compu, el boton para pasar a un cambio de producto. */
  onCambio?: () => void
}) {
  const [lineas, setLineas] = useState<Linea[]>(() =>
    inicial
      ? [
          {
            clave: clave(),
            producto: inicial.producto,
            queSalio: inicial.queSalio,
            cantidad: inicial.cantidad,
            precio: inicial.precio,
          },
        ]
      : [],
  )
  const [pagos, setPagos] = useState<LineaPago[]>(() => [
    {
      clave: clave(),
      medio: inicial?.medio ?? 'EFECTIVO',
      planId: inicial?.planId ?? null,
      monto: '',
      auto: true,
    },
  ])
  const [pagaCon, setPagaCon] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  useSinGuardar('un ticket', lineas.length > 0)

  // Lo de cada renglon, ya leido.
  const descripciones = lineas.map((l) => descripcionParaVender(l.producto, l.queSalio))
  const renglones: RenglonTicket[] = lineas.map((l, i) => {
    const d = descripciones[i]
    return {
      producto: l.producto,
      descripcion: 'problema' in d ? '' : d.descripcion,
      cantidad: leerNumero(l.cantidad) ?? 0,
      precioUnitario: leerNumero(l.precio) ?? 0,
    }
  })
  const subtotal = totalesDelTicket(renglones, []).subtotal

  const fijos = pagos.filter((p) => !p.auto).reduce((s, p) => s + (leerNumero(p.monto) ?? 0), 0)
  const montoAuto = Math.max(0, Math.round((subtotal - fijos) * 100) / 100)
  const montoDe = (p: LineaPago) => (p.auto ? montoAuto : (leerNumero(p.monto) ?? 0))
  const pagosTicket: PagoTicket[] = pagos.map((p) => ({ medio: p.medio, monto: montoDe(p), planId: p.planId }))
  const totales = totalesDelTicket(renglones, pagosTicket)

  const sinDescribir = descripciones.find((d) => 'problema' in d)
  const problema =
    sinDescribir && 'problema' in sinDescribir
      ? sinDescribir.problema
      : problemaDelTicket(renglones, pagosTicket)

  const efectivo = pagosTicket.filter((p) => p.medio === 'EFECTIVO').reduce((s, p) => s + p.monto, 0)
  const conCuanto = leerNumero(pagaCon) ?? 0
  const vuelto = Math.round((conCuanto - efectivo) * 100) / 100

  function agregar(p: Producto) {
    setError('')
    // El mismo producto otra vez suma uno, salvo los genericos: cada uno
    // es una cosa distinta y lleva su propia descripcion.
    const igual = !pideDescripcionAlVender(p) && lineas.find((l) => l.producto.codigo === p.codigo)
    if (igual) {
      cambiarLinea(igual.clave, { cantidad: String((leerNumero(igual.cantidad) ?? 0) + 1) })
      return
    }
    setLineas((ls) => [
      ...ls,
      {
        clave: clave(),
        producto: p,
        queSalio: '',
        cantidad: '1',
        precio: p.precioVenta ? String(p.precioVenta) : '',
      },
    ])
  }

  function cambiarLinea(k: number, cambios: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.clave === k ? { ...l, ...cambios } : l)))
  }

  function cambiarPago(k: number, cambios: Partial<LineaPago>) {
    setError('')
    setPagos((ps) => ps.map((p) => (p.clave === k ? { ...p, ...cambios } : p)))
  }

  function otroMedio() {
    // La que se completaba sola queda fija con lo que tenia, y la nueva
    // pasa a completarse sola con lo que falte.
    setPagos((ps) => [
      ...ps.map((p) => (p.auto ? { ...p, auto: false, monto: String(montoAuto) } : p)),
      { clave: clave(), medio: 'EFECTIVO', planId: null, monto: '', auto: true },
    ])
  }

  function sacarPago(k: number) {
    setPagos((ps) => {
      const quedan = ps.filter((p) => p.clave !== k)
      // Si no queda ninguna que se complete sola, la ultima pasa a serlo.
      if (quedan.length > 0 && !quedan.some((p) => p.auto)) {
        quedan[quedan.length - 1] = { ...quedan[quedan.length - 1], auto: true, monto: '' }
      }
      return quedan
    })
  }

  async function registrar() {
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    try {
      const r = await registrarCobro(jornada, renglones, pagosTicket, horaAhora())
      const n = renglones.length
      const [primero] = renglones
      onListo({
        ticketId: r.ticketId,
        ventaId: r.ventaId,
        texto: r.ventaId
          ? `${primero.descripcion} · ${primero.cantidad} × ${plata(primero.precioUnitario)}`
          : `Ticket cargado: ${n} ${n === 1 ? 'producto' : 'productos'} · ${plata(totales.total)}`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const listaRenglones = (
    <ul className="lista ticket-lista">
      {lineas.map((l, i) => (
        <RenglonDelTicket
          key={l.clave}
          linea={l}
          total={totalDelRenglon(renglones[i])}
          problema={(() => {
            const d = descripciones[i]
            return 'problema' in d && l.queSalio.trim() !== '' ? d.problema : null
          })()}
          onCambiar={(c) => cambiarLinea(l.clave, c)}
          onSacar={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
          conPasos={enColumnas}
        />
      ))}
    </ul>
  )

  const cobro = (
        <>
          {pagos.map((p, i) => {
            const planes = planesDe(p.medio)
            const plan = planPorId(p.planId)
            const monto = montoDe(p)
            const recargo = recargoDe(monto, plan)
            return (
              <div className="ticket-pago" key={p.clave}>
                <div className="grilla grilla-2">
                  <div className="campo">
                    <label htmlFor={`pago-medio-${p.clave}`}>
                      {pagos.length > 1 ? `Medio ${i + 1}` : 'Medio de pago'}
                    </label>
                    <select
                      id={`pago-medio-${p.clave}`}
                      value={p.medio}
                      onChange={(e) => {
                        const medio = e.target.value as MedioPago
                        cambiarPago(p.clave, { medio, planId: planAlElegirMedio(medio) })
                      }}
                    >
                      {MEDIOS_PAGO.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo">
                    <label htmlFor={`pago-monto-${p.clave}`}>
                      {p.auto && pagos.length > 1 ? 'Monto (lo que falta)' : 'Monto'}
                    </label>
                    <input
                      id={`pago-monto-${p.clave}`}
                      inputMode="decimal"
                      value={p.auto ? String(montoAuto) : p.monto}
                      onChange={(e) => cambiarPago(p.clave, { monto: e.target.value, auto: false })}
                      placeholder="0"
                    />
                  </div>
                </div>
                {planes.length > 1 && (
                  <div className="campo">
                    <label htmlFor={`pago-plan-${p.clave}`}>Tarjeta y plan</label>
                    <select
                      id={`pago-plan-${p.clave}`}
                      value={p.planId ?? ''}
                      onChange={(e) => cambiarPago(p.clave, { planId: e.target.value || null })}
                    >
                      <option value="">Elegí la tarjeta…</option>
                      {planes.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {nombreDelPlan(pl)}
                          {pl.recargoPct > 0 ? ` · recargo ${pl.recargoPct} %` : ' · sin recargo'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {plan && recargo > 0 && (
                  <p className="silencio" style={{ margin: '0 0 8px' }}>
                    Recargo {plan.recargoPct} %: {plata(recargo)}. En el posnet cobrá{' '}
                    <strong>{plata(monto + recargo)}</strong>.
                  </p>
                )}
                <div className="botonera" style={{ marginTop: 0, marginBottom: 8 }}>
                  {!p.auto && totales.falta !== 0 && i === pagos.length - 1 && (
                    <button
                      className="boton-chico"
                      onClick={() =>
                        cambiarPago(p.clave, { monto: String(Math.max(0, monto + totales.falta)) })
                      }
                    >
                      Poner lo que falta
                    </button>
                  )}
                  {pagos.length > 1 && (
                    <button className="boton-chico" onClick={() => sacarPago(p.clave)}>
                      Sacar este medio
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <button className="boton-chico" onClick={otroMedio}>
            + Otro medio de pago
          </button>

          {efectivo > 0 && (
            <div className="campo" style={{ marginTop: 12 }}>
              <label htmlFor="paga-con">Paga con (para el vuelto)</label>
              <input
                id="paga-con"
                inputMode="decimal"
                value={pagaCon}
                onChange={(e) => setPagaCon(e.target.value)}
                placeholder={String(efectivo)}
              />
              {conCuanto > 0 && (
                <div className={vuelto < 0 ? 'item-sub negativo' : 'item-sub'}>
                  {vuelto >= 0 ? (
                    <>
                      Vuelto: <strong style={{ fontSize: '1rem' }}>{plata(vuelto)}</strong>
                    </>
                  ) : (
                    `Le faltan ${plata(-vuelto)} para el efectivo.`
                  )}
                </div>
              )}
            </div>
          )}

          <div className="ticket-totales">
            <div>
              <span>Productos</span>
              <span>{plata(totales.subtotal)}</span>
            </div>
            {totales.recargo > 0 && (
              <div>
                <span>Recargo de tarjeta</span>
                <span>{plata(totales.recargo)}</span>
              </div>
            )}
            <div className="ticket-total">
              <span>Total a cobrar</span>
              <span>{plata(totales.total)}</span>
            </div>
          </div>
          {problema && <p className="item-sub negativo">{problema}</p>}
        </>
  )

  if (enColumnas) {
    const unidades = renglones.reduce((s, r) => s + (r.cantidad > 0 ? r.cantidad : 0), 0)
    return (
      <>
        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="caja-columnas">
          <section className="tarjeta caja-columna" aria-label="Buscar producto">
            <div className="caja-columna-cabecera">
              <p className="tarjeta-titulo">Buscar producto</p>
              {onCambio && (
                <button className="boton-chico" onClick={onCambio}>
                  ↔ Cambio de producto
                </button>
              )}
            </div>
            <BuscadorProducto onElegir={agregar} autoFoco />
            <MasVendidos onElegir={agregar} />
          </section>

          <section className="tarjeta caja-columna" aria-label="Ticket">
            <div className="caja-columna-cabecera">
              <p className="tarjeta-titulo">Ticket</p>
              {lineas.length > 0 && (
                <span className="silencio">
                  {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
                </span>
              )}
            </div>
            {lineas.length === 0 ? (
              <p className="silencio">Elegí los productos a la izquierda: cada uno se suma acá.</p>
            ) : (
              listaRenglones
            )}
            <div className="ticket-pie">
              <span>Productos</span>
              <strong>{plata(totales.subtotal)}</strong>
            </div>
          </section>

          <section className="tarjeta caja-columna caja-cobro" aria-label="Cobro">
            <p className="tarjeta-titulo">Cobro</p>
            {lineas.length === 0 ? <p className="silencio">Primero, los productos.</p> : cobro}
            <button
              className="boton-principal"
              onClick={() => void registrar()}
              disabled={guardando || lineas.length === 0 || problema !== null}
            >
              {guardando ? 'Guardando…' : `Registrar ${plata(totales.total)}`}
            </button>
            {lineas.length > 0 && (
              <button className="boton-chico" onClick={onCancelar}>
                Vaciar el ticket
              </button>
            )}
          </section>
        </div>
      </>
    )
  }

  return (
    <>
      {error && <div className="aviso aviso-error">{error}</div>}

      <BuscadorProducto onElegir={agregar} autoFoco />

      {lineas.length === 0 ? (
        <p className="silencio" style={{ marginTop: 8 }}>
          Buscá los productos que se lleva el cliente. Cada uno que elijas se suma al ticket.
        </p>
      ) : (
        listaRenglones
      )}

      {lineas.length > 0 && (
        <>
          <p className="silencio" style={{ margin: '14px 0 6px', fontWeight: 600 }}>
            Cómo paga
          </p>
          {cobro}
        </>
      )}

      <div className="botonera">
        <button onClick={onCancelar}>Cancelar</button>
        <button
          className="boton-principal"
          onClick={() => void registrar()}
          disabled={guardando || problema !== null}
        >
          {guardando ? 'Guardando…' : `Registrar ticket ${plata(totales.total)}`}
        </button>
      </div>
    </>
  )
}

function RenglonDelTicket({
  linea,
  total,
  problema,
  onCambiar,
  onSacar,
  conPasos = false,
}: {
  linea: Linea
  total: number
  problema: string | null
  onCambiar: (c: Partial<Linea>) => void
  onSacar: () => void
  /** En la compu: la cantidad con − y +, y todo en menos lugar. */
  conPasos?: boolean
}) {
  const { producto } = linea
  const generico = pideDescripcionAlVender(producto)
  const anteriores = useLiveQuery(
    async () =>
      generico
        ? descripcionesAnteriores(producto.codigo, await db.ventas.where('codigo').equals(producto.codigo).toArray())
        : [],
    [producto.codigo, generico],
  )
  const idLista = `que-salio-${linea.clave}`
  return (
    <li className="ticket-renglon">
      <div className="item" style={{ borderBottom: 'none', padding: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="item-titulo">{producto.descripcion}</div>
          <div className="item-sub">
            {producto.codigo || 'sin código'}
            {sinStock(producto) && ' · sin stock según la app'}
            {!producto.precioCompra && ' · sin precio de compra: no suma al margen'}
          </div>
        </div>
        <button className="boton-chico" onClick={onSacar} aria-label={`Sacar ${producto.descripcion}`}>
          Sacar
        </button>
      </div>
      {generico && (
        <div className="campo" style={{ marginTop: 6 }}>
          <label htmlFor={`${idLista}-campo`}>¿Qué salió?</label>
          <input
            id={`${idLista}-campo`}
            list={idLista}
            value={linea.queSalio}
            onChange={(e) => onCambiar({ queSalio: e.target.value })}
            placeholder="Por ejemplo: bombilla de alpaca"
            autoFocus
          />
          <datalist id={idLista}>
            {(anteriores ?? []).map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          {problema && <div className="item-sub negativo">{problema}</div>}
        </div>
      )}
      {conPasos ? (
        <div className="ticket-pasos">
          <div className="pasos">
            <button
              type="button"
              className="paso"
              aria-label={`Uno menos de ${producto.descripcion}`}
              disabled={(leerNumero(linea.cantidad) ?? 0) <= 1}
              onClick={() => onCambiar({ cantidad: String(Math.max(1, (leerNumero(linea.cantidad) ?? 1) - 1)) })}
            >
              −
            </button>
            <input
              aria-label={`Cantidad de ${producto.descripcion}`}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={linea.cantidad}
              onChange={(e) => onCambiar({ cantidad: e.target.value })}
            />
            <button
              type="button"
              className="paso"
              aria-label={`Uno más de ${producto.descripcion}`}
              onClick={() => onCambiar({ cantidad: String((leerNumero(linea.cantidad) ?? 0) + 1) })}
            >
              +
            </button>
          </div>
          <label className="ticket-precio">
            <span className="silencio">c/u $</span>
            <input
              aria-label={`Precio unitario de ${producto.descripcion}`}
              inputMode="decimal"
              value={linea.precio}
              onChange={(e) => onCambiar({ precio: e.target.value })}
              placeholder="0"
            />
          </label>
          <strong className="ticket-subtotal">{plata(total)}</strong>
        </div>
      ) : (
      <div className="grilla grilla-3" style={{ marginTop: 6 }}>
        <div className="campo">
          <label htmlFor={`cant-${linea.clave}`}>Cantidad</label>
          <input
            id={`cant-${linea.clave}`}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={linea.cantidad}
            onChange={(e) => onCambiar({ cantidad: e.target.value })}
          />
        </div>
        <div className="campo">
          <label htmlFor={`precio-${linea.clave}`}>Precio unitario</label>
          <input
            id={`precio-${linea.clave}`}
            inputMode="decimal"
            value={linea.precio}
            onChange={(e) => onCambiar({ precio: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="campo">
          <label>Total</label>
          <div className="ticket-subtotal">{plata(total)}</div>
        </div>
      </div>
      )}
    </li>
  )
}
