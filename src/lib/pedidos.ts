import type { EstadoPedido, PedidoInsumo } from '../db/db'
import { normalizar } from './formato'

/**
 * Los pedidos de insumos del local (punto 14 del pedido del 06/11): una
 * lista compartida. Cualquiera anota lo que falta; quien esta al mando lo
 * marca pedido, recibido o descartado.
 */

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  pendiente: 'Falta',
  pedido: 'Pedido',
  recibido: 'Recibido',
  descartado: 'Descartado',
}

/** Lo que sigue abierto: falta comprarlo o ya se pidio y no llego. */
export function abierto(p: Pick<PedidoInsumo, 'estado'>): boolean {
  return p.estado === 'pendiente' || p.estado === 'pedido'
}

export function problemaDelPedido(que: string): string | null {
  const t = que.trim()
  if (!t) return 'Escribí qué falta.'
  if (t.length > 80) return 'Que sea corto: qué falta, y la cantidad va aparte.'
  return null
}

/** Si eso ya esta anotado y sigue abierto: para no anotarlo dos veces. */
export function yaAnotado(que: string, pedidos: PedidoInsumo[]): PedidoInsumo | null {
  const buscado = normalizar(que.trim())
  if (!buscado) return null
  return pedidos.find((p) => abierto(p) && normalizar(p.que) === buscado) ?? null
}

const ORDEN: Record<EstadoPedido, number> = { pendiente: 0, pedido: 1, recibido: 2, descartado: 2 }

/** Primero lo que falta (lo mas viejo arriba), despues lo pedido, y lo resuelto al final, lo mas nuevo primero. */
export function ordenarPedidos(pedidos: PedidoInsumo[]): PedidoInsumo[] {
  return [...pedidos].sort((a, b) => {
    const porEstado = ORDEN[a.estado] - ORDEN[b.estado]
    if (porEstado !== 0) return porEstado
    if (abierto(a)) return a.cuando - b.cuando
    return (b.resueltoEn ?? b.cuando) - (a.resueltoEn ?? a.cuando)
  })
}
