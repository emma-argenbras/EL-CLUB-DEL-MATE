import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Producto } from '../db/db'
import { comprasDeProducto, remarcar } from '../db/ingresoMercaderia'
import { margenPorcentual, precioAtrasado } from '../lib/calculos'
import { alcanzaPara, variacionDelCosto, ventasDelProducto } from '../lib/fichaProducto'
import { fechaLinda, hoyISO, mesLindo, plata, porcentaje } from '../lib/formato'
import { cambiosDelProducto, comoSeLee, etiquetaCampo } from '../lib/historialLegible'
import { CompartirProducto } from './BotonWhatsApp'
import Icono from './Icono'

export const MOTIVO_REMARCAR_FICHA = 'Remarcado desde la ficha del producto'

/**
 * La ficha de un producto en la compu (opcion B, 06/11): todo lo que se
 * sabe de el en una pantalla, para leer. Para cambiar algo, «Editar» abre el
 * formulario de siempre. En el celular, tocar un producto sigue abriendo el
 * formulario directo.
 */
export default function FichaProducto({
  codigo,
  alMando,
  onVolver,
  onEditar,
}: {
  codigo: string
  /** Quien puede cambiar el precio de venta (como en el formulario). */
  alMando: boolean
  onVolver: () => void
  onEditar: (p: Producto) => void
}) {
  const hoy = hoyISO()
  const datos = useLiveQuery(async () => {
    const producto = await db.productos.get(codigo)
    if (!producto) return { producto: null }
    const [ventas, compras, cambios, proveedores] = await Promise.all([
      db.ventas.where('codigo').equals(codigo).toArray(),
      db.movimientosProveedor.where('tipo').equals('compra').toArray(),
      db.historial.where('[tabla+clave]').equals(['productos', codigo]).toArray(),
      db.proveedores.toArray(),
    ])
    return {
      producto,
      ventas: ventasDelProducto(ventas, hoy),
      compras: comprasDeProducto(codigo, compras),
      cambios: cambiosDelProducto(cambios),
      nombreProveedor: new Map(proveedores.map((p) => [p.id, p.nombre])),
    }
  }, [codigo, hoy])
  const [mensaje, setMensaje] = useState('')

  if (!datos) return <p className="vacio">Cargando…</p>
  if (!datos.producto) {
    return (
      <>
        <p className="vacio">Ese producto ya no está.</p>
        <button onClick={onVolver}>Volver a Productos</button>
      </>
    )
  }
  const { producto: p, ventas, compras, cambios, nombreProveedor } = datos
  const atrasado = precioAtrasado(p)
  const llevaStock = p.stock !== null && p.stock !== undefined
  const margen = p.precioVenta && p.precioCompra ? p.precioVenta - p.precioCompra : null
  const variacion = variacionDelCosto(compras)
  const proveedor = (p.proveedorId && nombreProveedor.get(p.proveedorId)) || p.proveedor

  async function ponerSugerido() {
    if (!atrasado) return
    if (
      !confirm(
        `¿Poner el precio de ${p.descripcion} en ${plata(atrasado.sugerido)}?\n\nHoy está en ${plata(atrasado.actual)}. Queda en el historial con el motivo.`,
      )
    ) {
      return
    }
    const n = await remarcar([{ codigo: p.codigo, precioNuevo: atrasado.sugerido }], MOTIVO_REMARCAR_FICHA)
    setMensaje(n === 1 ? `Listo: el precio quedó en ${plata(atrasado.sugerido)}.` : 'No hizo falta: el precio ya estaba así.')
  }

  return (
    <>
      <div className="silencio" style={{ marginBottom: 12 }}>
        <button className="boton-enlace" onClick={onVolver}>
          Productos
        </button>
        {proveedor ? ` / ${proveedor}` : ''}
      </div>

      {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

      <section className="tarjeta ficha-cabecera" aria-label="Producto">
        <div className="ficha-nombre">
          <span className="ficha-icono" aria-hidden="true">
            <Icono nombre="productos" tamano={34} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{p.descripcion}</h2>
            <p className="silencio" style={{ margin: '6px 0 0' }}>
              {p.codigo}
              {proveedor ? ` · ${proveedor}` : ' · sin proveedor'}
            </p>
            <div className="ficha-chips">
              {llevaStock &&
                (p.stock! > 0 ? (
                  <span className="chip">{p.stock} EN STOCK</span>
                ) : (
                  <span className="chip chip-peligro">SIN STOCK</span>
                ))}
              {atrasado && <span className="chip chip-alerta">CONVIENE REMARCAR</span>}
              {p.descontinuado && <span className="chip chip-ticket">DESCONTINUADO</span>}
              {p.generico && <span className="chip chip-banco">GENÉRICO</span>}
            </div>
          </div>
        </div>
        <div className="ficha-precio">
          <p className="tarjeta-titulo" style={{ margin: 0 }}>
            Precio de venta
          </p>
          <div className="ficha-precio-valor">{p.precioVenta ? plata(p.precioVenta) : 'Sin precio'}</div>
          <div className="botonera" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <CompartirProducto producto={p} />
            <button className="boton-chico boton-verde" onClick={() => onEditar(p)}>
              Editar
            </button>
          </div>
        </div>
      </section>

      <div className="ficha-grilla">
        <section className="tarjeta" aria-label="Precio y margen">
          <p className="tarjeta-titulo">Precio y margen</p>
          <div className="dato">
            <span>Costo</span>
            <strong>{p.precioCompra ? plata(p.precioCompra) : 'Sin cargar'}</strong>
          </div>
          <div className="dato">
            <span>Rentabilidad buscada</span>
            <strong>{p.rentabilidad ? `${Math.round(p.rentabilidad * 100)} %` : 'Sin cargar'}</strong>
          </div>
          <div className="dato">
            <span>Margen hoy</span>
            <strong>
              {margen !== null && p.precioVenta
                ? `${plata(margen)} · ${porcentaje(margenPorcentual(p.precioVenta, p.precioCompra))}`
                : '—'}
            </strong>
          </div>
          {p.fechaCompra && <p className="silencio">Costo del {fechaLinda(p.fechaCompra)}.</p>}
          {atrasado && (
            <div className="ficha-remarcar">
              <strong>Su rentabilidad pide {plata(atrasado.sugerido)}</strong>
              <div className="silencio">Se dejan de cobrar {plata(atrasado.falta)} por unidad.</div>
              {alMando ? (
                <button className="boton-principal" style={{ marginTop: 10 }} onClick={() => void ponerSugerido()}>
                  Poner {plata(atrasado.sugerido)}
                </button>
              ) : (
                <div className="silencio" style={{ marginTop: 6 }}>
                  El precio lo cambia el dueño o la encargada.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="tarjeta" aria-label="Stock y ventas">
          <p className="tarjeta-titulo">Stock y ventas</p>
          <div className="dato">
            <span>En stock</span>
            <strong>{llevaStock ? p.stock : 'No lleva stock'}</strong>
          </div>
          <div className="dato">
            <span>Vendidos en 30 días</span>
            <strong>{ventas.vendidos30}</strong>
          </div>
          {llevaStock && (
            <div className="dato">
              <span>Alcanza para</span>
              <strong>{alcanzaPara(p.stock, ventas.vendidos30)}</strong>
            </div>
          )}
          <div className="dato" style={{ borderBottom: 'none' }}>
            <span>Última venta</span>
            <strong>
              {ventas.ultima
                ? `${ventas.ultima.fecha === hoy ? 'hoy' : fechaLinda(ventas.ultima.fecha)}, ${ventas.ultima.hora}`
                : 'Nunca'}
            </strong>
          </div>
        </section>

        <section className="tarjeta" aria-label="Historial">
          <p className="tarjeta-titulo">Historial</p>
          {cambios.length === 0 ? (
            <p className="vacio" style={{ padding: '8px 0' }}>
              Sin cambios anotados.
            </p>
          ) : (
            cambios.slice(0, 4).map((h) => (
              <div key={h.id} className="ficha-cambio">
                <div style={{ fontWeight: 600 }}>
                  {h.quienNombre} cambió {etiquetaCampo(h.campo)}
                </div>
                <div className="silencio">
                  {comoSeLee(h.valorAnterior, h.campo)} → {comoSeLee(h.valorNuevo, h.campo)} ·{' '}
                  {fechaLinda(new Date(h.cuando).toISOString().slice(0, 10))}
                  {h.motivo ? ` · ${h.motivo}` : ''}
                </div>
              </div>
            ))
          )}
          {cambios.length > 4 && (
            <button className="boton-chico" onClick={() => onEditar(p)}>
              Ver los {cambios.length} cambios
            </button>
          )}
        </section>
      </div>

      <section className="tarjeta" aria-label="Compras">
        <div className="caja-columna-cabecera">
          <p className="tarjeta-titulo" style={{ margin: 0 }}>
            Compras
          </p>
          {variacion && variacion.pct !== 0 && (
            <span className="silencio">
              El costo {variacion.pct > 0 ? 'subió' : 'bajó'} {Math.abs(variacion.pct)} % desde{' '}
              {mesLindo(variacion.desde.slice(0, 7)).toLowerCase()}
            </span>
          )}
        </div>
        {compras.length === 0 ? (
          <p className="vacio" style={{ padding: '12px 0 0' }}>
            Todavía no hay compras cargadas de este producto. Se cargan desde Proveedores → Ingreso de
            mercadería.
          </p>
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla-turno">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th className="numero">Cantidad</th>
                  <th className="numero">Costo</th>
                  <th className="numero">Con flete</th>
                  <th>Remito</th>
                </tr>
              </thead>
              <tbody>
                {compras.slice(0, 12).map((c, i) => (
                  <tr key={`${c.fecha}-${i}`}>
                    <td>{fechaLinda(c.fecha)}</td>
                    <td>{nombreProveedor.get(c.proveedorId) ?? c.proveedorId}</td>
                    <td className="numero">{c.cantidad}</td>
                    <td className="numero">{plata(c.costoUnitario)}</td>
                    <td className="numero">{c.costoConFlete != null ? plata(c.costoConFlete) : '—'}</td>
                    <td>{c.comprobante ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
