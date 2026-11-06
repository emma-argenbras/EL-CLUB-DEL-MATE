import { db, nuevoId, type EstadoPedido } from './db'
import { problemaDelPedido, yaAnotado } from '../lib/pedidos'

/** Las escrituras de los pedidos de insumos (ver lib/pedidos.ts). */

export interface Quien {
  email: string | null
  nombre: string | null
}

export async function anotarPedido(
  datos: { que: string; cantidad: string; nota: string },
  quien: Quien,
): Promise<string> {
  const problema = problemaDelPedido(datos.que)
  if (problema) throw new Error(problema)
  const igual = yaAnotado(datos.que, await db.pedidos.toArray())
  if (igual) throw new Error(`«${igual.que}» ya está anotado${igual.estado === 'pedido' ? ' y pedido' : ''}.`)
  const id = nuevoId()
  await db.pedidos.add({
    id,
    que: datos.que.trim(),
    cantidad: datos.cantidad.trim() || null,
    nota: datos.nota.trim() || null,
    estado: 'pendiente',
    pidio: quien.email,
    pidioNombre: quien.nombre,
    cuando: Date.now(),
    resolvio: null,
    resolvioNombre: null,
    resueltoEn: null,
  })
  return id
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido, quien: Quien): Promise<void> {
  const p = await db.pedidos.get(id)
  if (!p) throw new Error('Ese pedido ya no está.')
  if (p.estado === estado) return
  await db.pedidos.update(id, {
    estado,
    resolvio: quien.email,
    resolvioNombre: quien.nombre,
    resueltoEn: Date.now(),
  })
}
