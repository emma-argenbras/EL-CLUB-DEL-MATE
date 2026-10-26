import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, type Producto, type Venta } from '../db/db'
import { asignarVentaSinCodigo } from '../db/asignarVentaSinCodigo'
import { fechaLinda, plata } from '../lib/formato'
import {
  comodinesConVentas,
  VENTAS_SIN_CODIGO_DESDE,
  ventasSinCodigo,
} from '../lib/ventaSinCodigo'
import BuscadorProducto from '../componentes/BuscadorProducto'

/**
 * Las ventas que se cargaron sin código, para resolverlas de a una:
 * decir qué producto era cada una (ver lib/ventaSinCodigo.ts).
 *
 * Abajo, los productos comodín con ventas («SALDOS», «DIF»): se
 * muestran, no se tocan. Qué hacer con esas ventas lo decide Emmanuel.
 */
export default function VentasSinCodigo() {
  const datos = useLiveQuery(async () => {
    const [ventas, productos] = await Promise.all([
      db.ventas.where('fecha').aboveOrEqual(VENTAS_SIN_CODIGO_DESDE).toArray(),
      db.productos.toArray(),
    ])
    return { ventas, productos }
  }, [])

  if (!datos) return <p className="vacio">Buscando las ventas sin código…</p>

  const lista = ventasSinCodigo(datos.ventas)
  const comodines = comodinesConVentas(datos.productos, datos.ventas)
  const monto = lista.reduce((s, v) => s + v.total, 0)

  return (
    <>
      <h2>Ventas sin código</h2>

      <div className="aviso aviso-ojo">
        Lo que se vendió con «Vender igual, sin código» desde el {fechaLinda(VENTAS_SIN_CODIGO_DESDE)}.
        Esas ventas no tienen costo ni mueven stock. Asignándole a cada una su producto, el
        margen y el stock se corrigen solos. Si el producto no existe, dalo de alta en{' '}
        <Link to="/productos">Productos</Link> y después asignalo acá.
      </div>

      {lista.length === 0 ? (
        <p className="vacio">No hay ventas sin código para resolver.</p>
      ) : (
        <div className="tarjeta">
          <p className="tarjeta-titulo">
            {lista.length} {lista.length === 1 ? 'venta' : 'ventas'} · {plata(monto)}
          </p>
          <ul className="lista">
            {lista.map((v) => (
              <RenglonVenta key={v.id} venta={v} />
            ))}
          </ul>
        </div>
      )}

      {comodines.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Productos comodín con ventas</p>
          <p className="silencio" style={{ marginTop: 0 }}>
            No tienen proveedor, costo ni precio, así que sus ventas no dicen qué salió, no tienen
            margen y no mueven stock. Esas ventas no se tocan desde acá: qué hacer con ellas lo
            decide Emmanuel. De acá en adelante, para algo que no está en el catálogo usá «Vender
            igual, sin código» con el nombre de lo que salió, y para un cambio, «↔ Cambio» en Caja.
          </p>
          <ul className="lista">
            {comodines.map((c) => (
              <li className="item" key={c.producto.codigo}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{c.producto.descripcion}</div>
                  <div className="item-sub">
                    {c.producto.codigo} · {c.ventas} {c.ventas === 1 ? 'venta' : 'ventas'}
                  </div>
                </div>
                <div className="item-monto">{plata(c.monto)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function RenglonVenta({ venta }: { venta: Venta }) {
  const [eligiendo, setEligiendo] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function asignar(producto: Producto) {
    if (!producto.codigo) {
      setMensaje({ tipo: 'error', texto: 'Elegí un producto del catálogo.' })
      return
    }
    const stock =
      producto.stock !== null && producto.stock !== undefined
        ? ` y ${venta.cantidad === 1 ? 'se descuenta 1' : `se descuentan ${venta.cantidad}`} del stock (queda en ${producto.stock - venta.cantidad})`
        : ''
    const costo =
      producto.precioCompra != null
        ? `pasa a contar con su costo de hoy, ${plata(producto.precioCompra)} c/u`
        : 'sigue sin costo, porque el producto tampoco lo tiene cargado'
    if (
      !confirm(
        `¿Esta venta era ${producto.codigo} «${producto.descripcion}»?\n\n` +
          `La venta ${costo}${stock}. Lo cobrado no cambia. Queda en el historial.`,
      )
    ) {
      return
    }
    const r = await asignarVentaSinCodigo(venta.id, producto.codigo)
    if (r.estado === 'asignada') setEligiendo(false)
    else if (r.estado === 'ya-tiene-codigo') {
      setMensaje({ tipo: 'error', texto: `Alguien ya la asignó a ${r.codigo}.` })
    } else if (r.estado === 'producto-no-existe') {
      setMensaje({ tipo: 'error', texto: 'Ese producto ya no está.' })
    } else setMensaje({ tipo: 'error', texto: 'Esa venta ya no está.' })
  }

  return (
    <li className="item" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="item-titulo">{venta.descripcion}</div>
          <div className="item-sub">
            {fechaLinda(venta.fecha)} · {venta.hora} · {Math.abs(venta.cantidad)} ×{' '}
            {plata(venta.precioUnitario)} · {venta.medioPago}
            {venta.cambioId ? ' · parte de un cambio' : ''}
          </div>
        </div>
        <div className="item-monto">{plata(venta.total)}</div>
      </div>
      {!eligiendo ? (
        <button className="boton-chico" style={{ marginTop: 6 }} onClick={() => setEligiendo(true)}>
          Asignar a un producto
        </button>
      ) : (
        <div style={{ marginTop: 6 }}>
          <BuscadorProducto onElegir={(p) => void asignar(p)} autoFoco />
          <button className="boton-chico" style={{ marginTop: 6 }} onClick={() => setEligiendo(false)}>
            Dejarla como está
          </button>
        </div>
      )}
      {mensaje && (
        <div className={mensaje.tipo === 'ok' ? 'item-sub positivo' : 'item-sub negativo'}>
          {mensaje.texto}
        </div>
      )}
    </li>
  )
}
