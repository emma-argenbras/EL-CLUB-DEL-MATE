import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EstadoPedido, type PedidoInsumo } from '../db/db'
import { anotarPedido, cambiarEstadoPedido } from '../db/pedidos'
import { abierto, ETIQUETA_ESTADO, ordenarPedidos, problemaDelPedido, yaAnotado } from '../lib/pedidos'
import { fechaLinda, haceCuanto } from '../lib/formato'
import { estaAlMando } from '../sync/permisos'
import { useSesion } from '../sync/useSesion'

/**
 * Los pedidos de insumos del local (punto 14 del pedido del 06/11). La
 * logica esta en lib/pedidos.ts y db/pedidos.ts.
 */
export default function Pedidos() {
  const sesion = useSesion()
  const alMando = estaAlMando(sesion.perfil)
  const yo = { email: sesion.email ?? null, nombre: sesion.perfil?.nombre ?? null }
  const pedidos = useLiveQuery(() => db.pedidos.toArray(), [])
  const [que, setQue] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  if (!pedidos) return <p className="vacio">Cargando los pedidos…</p>

  const lista = ordenarPedidos(pedidos)
  const abiertos = lista.filter(abierto)
  const resueltos = lista.filter((p) => !abierto(p)).slice(0, 10)
  const repetido = que.trim() ? yaAnotado(que, pedidos) : null

  async function anotar() {
    setError('')
    try {
      await anotarPedido({ que, cantidad, nota }, yo)
      setMensaje(`Anotado: ${que.trim()}.`)
      setQue('')
      setCantidad('')
      setNota('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function pasar(p: PedidoInsumo, estado: EstadoPedido) {
    try {
      await cambiarEstadoPedido(p.id, estado, yo)
      setMensaje(`${p.que}: ${ETIQUETA_ESTADO[estado].toLowerCase()}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <h2>Pedidos de insumos</h2>
      <p className="silencio" style={{ marginTop: 0 }}>
        Lo que falta en el local: bolsas, papel, rollos de ticket, limpieza. Anotalo acá y Emmanuel o
        Sandra lo compran. Para mercadería, el pedido va al proveedor.
      </p>

      <div className="tarjeta">
        {error && <div className="aviso aviso-error">{error}</div>}
        {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}
        <div className="campo">
          <label htmlFor="pi-que">¿Qué falta?</label>
          <input
            id="pi-que"
            value={que}
            onChange={(e) => {
              setQue(e.target.value)
              setMensaje('')
            }}
            placeholder="Por ejemplo: bolsas medianas"
          />
          {repetido && (
            <div className="item-sub negativo">
              Ya está anotado{repetido.estado === 'pedido' ? ' y pedido' : ''}
              {repetido.pidioNombre ? ` (lo anotó ${repetido.pidioNombre})` : ''}.
            </div>
          )}
        </div>
        <div className="grilla grilla-2">
          <div className="campo">
            <label htmlFor="pi-cantidad">Cantidad</label>
            <input id="pi-cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="campo">
            <label htmlFor="pi-nota">Nota</label>
            <input id="pi-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Marca, medida…" />
          </div>
        </div>
        <button
          className="boton-principal"
          disabled={problemaDelPedido(que) !== null || repetido !== null}
          onClick={() => void anotar()}
        >
          Anotar
        </button>
      </div>

      <div className="tarjeta">
        <p className="tarjeta-titulo">Lo que falta ({abiertos.length})</p>
        {abiertos.length === 0 ? (
          <p className="vacio">No hay nada anotado.</p>
        ) : (
          <ul className="lista">
            {abiertos.map((p) => (
              <li className="item" key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">
                    {p.que}
                    {p.cantidad ? ` · ${p.cantidad}` : ''}{' '}
                    <span className={p.estado === 'pedido' ? 'chip chip-banco' : 'chip chip-alerta'} style={{ marginLeft: 4 }}>
                      {ETIQUETA_ESTADO[p.estado]}
                    </span>
                  </div>
                  <div className="item-sub">
                    {p.pidioNombre ? `Lo anotó ${p.pidioNombre}` : 'Anotado'} {haceCuanto(p.cuando)}
                    {p.estado === 'pedido' && p.resolvioNombre ? ` · lo pidió ${p.resolvioNombre}` : ''}
                    {p.nota ? ` · ${p.nota}` : ''}
                  </div>
                </div>
                <div className="botonera" style={{ marginTop: 0, flexDirection: 'column', flex: 'none' }}>
                  {alMando && p.estado === 'pendiente' && (
                    <button className="boton-chico" onClick={() => void pasar(p, 'pedido')}>
                      Pedido
                    </button>
                  )}
                  {alMando && (
                    <button className="boton-chico" onClick={() => void pasar(p, 'recibido')}>
                      Recibido
                    </button>
                  )}
                  {(alMando || (p.estado === 'pendiente' && p.pidio && p.pidio === yo.email)) && (
                    <button className="boton-chico" onClick={() => void pasar(p, 'descartado')}>
                      {alMando ? 'Descartar' : 'Ya no hace falta'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {resueltos.length > 0 && (
        <div className="tarjeta">
          <p className="tarjeta-titulo">Lo último resuelto</p>
          <ul className="lista">
            {resueltos.map((p) => (
              <li className="item" key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="item-titulo">{p.que}</div>
                  <div className="item-sub">
                    {ETIQUETA_ESTADO[p.estado]}
                    {p.resueltoEn ? ` el ${fechaLinda(new Date(p.resueltoEn).toISOString().slice(0, 10))}` : ''}
                    {p.resolvioNombre ? ` (${p.resolvioNombre})` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
