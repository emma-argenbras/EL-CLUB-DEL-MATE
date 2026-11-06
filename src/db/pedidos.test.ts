import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type PedidoInsumo } from './db'
import { anotarPedido, cambiarEstadoPedido } from './pedidos'
import { ordenarPedidos, problemaDelPedido, yaAnotado } from '../lib/pedidos'

const GABI = { email: 'sucursalconcordia@elclubdelmate.com', nombre: 'Gabriela' }
const SANDRA = { email: 'ventas@elclubdelmate.com', nombre: 'Sandra' }

beforeEach(async () => {
  await db.pedidos.clear()
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: GABI.email, nombre: GABI.nombre, rol: 'empleado' }))
})

const pedido = (id: string, estado: PedidoInsumo['estado'], cuando: number, resueltoEn: number | null = null): PedidoInsumo => ({
  id, que: id, cantidad: null, nota: null, estado, pidio: null, pidioNombre: null, cuando,
  resolvio: null, resolvioNombre: null, resueltoEn,
})

describe('anotar lo que falta', () => {
  it('queda pendiente, con quién lo anotó', async () => {
    const id = await anotarPedido({ que: ' Bolsas medianas ', cantidad: '2 paquetes', nota: '' }, GABI)
    const p = (await db.pedidos.get(id))!
    expect([p.que, p.cantidad, p.nota, p.estado, p.pidioNombre]).toEqual(['Bolsas medianas', '2 paquetes', null, 'pendiente', 'Gabriela'])
  })

  it('vacío no; lo que ya está anotado y abierto tampoco, aunque cambie una mayúscula o un acento', async () => {
    expect(problemaDelPedido('  ')).toMatch(/qué falta/)
    await anotarPedido({ que: 'Papel higiénico', cantidad: '', nota: '' }, GABI)
    await expect(anotarPedido({ que: 'papel higienico', cantidad: '', nota: '' }, GABI)).rejects.toThrow(/ya está anotado/)
    expect(await db.pedidos.count()).toBe(1)
  })

  it('lo recibido se puede volver a anotar', async () => {
    const id = await anotarPedido({ que: 'Lavandina', cantidad: '', nota: '' }, GABI)
    await cambiarEstadoPedido(id, 'recibido', SANDRA)
    expect(yaAnotado('lavandina', await db.pedidos.toArray())).toBeNull()
    await anotarPedido({ que: 'Lavandina', cantidad: '', nota: '' }, GABI)
    expect(await db.pedidos.count()).toBe(2)
  })
})

describe('pasarlo de estado', () => {
  it('queda quién lo pasó y cuándo, y en el historial', async () => {
    const id = await anotarPedido({ que: 'Rollos de ticket', cantidad: '', nota: '' }, GABI)
    engancharAutor(() => ({ email: SANDRA.email, nombre: SANDRA.nombre, rol: 'encargado' }))
    await cambiarEstadoPedido(id, 'pedido', SANDRA)
    const p = (await db.pedidos.get(id))!
    expect([p.estado, p.resolvioNombre, typeof p.resueltoEn]).toEqual(['pedido', 'Sandra', 'number'])
    await historialAlDia()
    const h = (await db.historial.toArray()).find((x) => x.tabla === 'pedidos' && x.campo === 'estado')
    expect([h?.valorAnterior, h?.valorNuevo, h?.quienNombre]).toEqual(['pendiente', 'pedido', 'Sandra'])
  })
})

describe('el orden de la lista', () => {
  it('primero lo que falta (lo más viejo arriba), después lo pedido, y lo resuelto al final, lo más nuevo primero', () => {
    const lista = ordenarPedidos([
      pedido('recibido-viejo', 'recibido', 1, 10),
      pedido('falta-nuevo', 'pendiente', 5),
      pedido('pedido', 'pedido', 3),
      pedido('falta-viejo', 'pendiente', 2),
      pedido('descartado-nuevo', 'descartado', 4, 20),
    ])
    expect(lista.map((p) => p.id)).toEqual(['falta-viejo', 'falta-nuevo', 'pedido', 'descartado-nuevo', 'recibido-viejo'])
  })
})
