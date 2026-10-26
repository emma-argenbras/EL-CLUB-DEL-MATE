import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Producto } from './db'
import { resumirJornada, resumirMes } from '../lib/calculos'
import {
  armarCambio,
  borrarCambio,
  diferenciaCambio,
  MOTIVO_CAMBIO,
  MOTIVO_DESHACER_CAMBIO,
  problemaDelCambio,
  registrarCambio,
  type LadoCambio,
} from './cambioProducto'

function prod(codigo: string, precioVenta: number, precioCompra: number | null, stock: number | null): Producto {
  return {
    codigo, descripcion: `MATE ${codigo}`, proveedor: null, proveedorId: null, fechaCompra: null,
    precioCompra, rentabilidad: null, precioVenta, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock, activo: true,
  }
}

const JORNADA = { id: 'j1', fecha: '2026-10-26', vendedor: 'Sandra' }
const lado = (p: Producto, cantidad = 1, precio = p.precioVenta ?? 0): LadoCambio => ({
  producto: p, cantidad, precioUnitario: precio,
})

beforeEach(async () => {
  await Promise.all([db.ventas.clear(), db.productos.clear(), db.borrados.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('la diferencia', () => {
  it('positiva paga el cliente, negativa se le devuelve, cero no se mueve plata', () => {
    expect(diferenciaCambio(lado(prod('A', 40000, 18000, 1)), lado(prod('B', 45000, 20000, 1)))).toBe(5000)
    expect(diferenciaCambio(lado(prod('A', 45000, 20000, 1)), lado(prod('B', 39700, 17000, 1)))).toBe(-5300)
    expect(diferenciaCambio(lado(prod('A', 40000, 18000, 1)), lado(prod('B', 40000, 18000, 1)))).toBe(0)
  })

  it('cuenta las cantidades', () => {
    expect(diferenciaCambio(lado(prod('A', 10000, null, 1), 2), lado(prod('B', 25000, null, 1)))).toBe(5000)
  })
})

describe('problemaDelCambio', () => {
  it('pide los dos productos, cantidades y precios', () => {
    const a = lado(prod('A', 40000, null, null))
    expect(problemaDelCambio(null, a)).toMatch(/trae el cliente/)
    expect(problemaDelCambio(a, null)).toMatch(/se lleva/)
    expect(problemaDelCambio({ ...a, cantidad: 0 }, a)).toMatch(/cuántos trae/)
    expect(problemaDelCambio(a, a)).toBeNull()
  })
})

describe('armarCambio: dos renglones que suman lo que de verdad paso', () => {
  const vuelve = lado(prod('A', 40000, 18000, 1))
  const lleva = lado(prod('B', 45000, 20000, 1))
  const ids = { cambioId: 'c1', vuelve: 'v1', lleva: 'v2' }

  it('el que vuelve va en negativo y el que se lleva en positivo, unidos por el cambio', () => {
    const [v, l] = armarCambio(JORNADA, vuelve, lleva, 'TRANSFERENCIA', '10:00', ids)
    expect(v).toMatchObject({ codigo: 'A', cantidad: -1, total: -40000, costoUnitario: 18000, cambioId: 'c1', cambio: 'vuelve' })
    expect(l).toMatchObject({ codigo: 'B', cantidad: 1, total: 45000, costoUnitario: 20000, cambioId: 'c1', cambio: 'lleva' })
    expect(v.medioPago).toBe('TRANSFERENCIA')
    expect(l.medioPago).toBe('TRANSFERENCIA')
  })

  it('EN LA CAJA DEL TURNO solo se mueve la diferencia, en su medio de pago', () => {
    const efectivo = resumirJornada(10000, armarCambio(JORNADA, vuelve, lleva, 'EFECTIVO', '10:00', ids), [])
    expect(efectivo.efectivo).toBe(5000)
    expect(efectivo.cierreEsperado).toBe(15000)
    expect(efectivo.unidades).toBe(0)
    expect(efectivo.costoMercaderia).toBe(2000)
    const banco = resumirJornada(10000, armarCambio(JORNADA, vuelve, lleva, 'TRANSFERENCIA', '10:00', ids), [])
    expect(banco.efectivo).toBe(0)
    expect(banco.banco).toBe(5000)
    expect(banco.cierreEsperado).toBe(10000)
  })

  it('si se le devuelve plata en efectivo, sale del cajon: el esperado baja', () => {
    const renglones = armarCambio(JORNADA, lleva, vuelve, 'EFECTIVO', '10:00', ids)
    expect(resumirJornada(10000, renglones, []).cierreEsperado).toBe(5000)
  })

  it('sin diferencia, efectivo aunque se haya elegido otro medio: no se mueve plata', () => {
    const iguales = armarCambio(JORNADA, vuelve, lado(prod('C', 40000, 18000, 1)), 'CREDITO', '10:00', ids)
    expect(iguales.every((r) => r.medioPago === 'EFECTIVO')).toBe(true)
    expect(resumirJornada(0, iguales, []).cierreEsperado).toBe(0)
  })

  it('EN EL MES un cambio es una operacion, y se ve aparte con su diferencia', () => {
    const venta = { ...armarCambio(JORNADA, vuelve, lleva, 'EFECTIVO', '09:00', { cambioId: 'x', vuelve: 'a', lleva: 'b' })[1], id: 'suelta', cambioId: null, cambio: null }
    const mes = resumirMes([venta, ...armarCambio(JORNADA, vuelve, lleva, 'EFECTIVO', '10:00', ids)], [])
    expect(mes.operaciones).toBe(2)
    expect(mes.cambios).toBe(1)
    expect(mes.diferenciaCambios).toBe(5000)
    expect(mes.ventasTotales).toBe(50000)
  })
})

describe('registrarCambio', () => {
  it('guarda los dos renglones y mueve el stock: lo que vuelve suma, lo que se lleva resta', async () => {
    await db.productos.bulkPut([prod('A', 40000, 18000, 2), prod('B', 45000, 20000, 5)])
    const r = await registrarCambio(JORNADA, lado(prod('A', 40000, 18000, 2)), lado(prod('B', 45000, 20000, 5)), 'EFECTIVO', '10:00')
    expect(r.diferencia).toBe(5000)
    expect(await db.ventas.where('jornadaId').equals('j1').count()).toBe(2)
    expect((await db.productos.get('A'))?.stock).toBe(3)
    expect((await db.productos.get('B'))?.stock).toBe(4)
  })

  it('un producto sin control de stock no gana uno', async () => {
    await db.productos.bulkPut([prod('A', 40000, 18000, null), prod('B', 45000, 20000, 5)])
    await registrarCambio(JORNADA, lado(prod('A', 40000, 18000, null)), lado(prod('B', 45000, 20000, 5)), 'EFECTIVO', '10:00')
    expect((await db.productos.get('A'))?.stock).toBeNull()
  })

  it('el mismo codigo de los dos lados (otro talle) deja el stock como estaba', async () => {
    await db.productos.put(prod('A', 40000, 18000, 2))
    await registrarCambio(JORNADA, lado(prod('A', 40000, 18000, 2)), lado(prod('A', 40000, 18000, 2)), 'EFECTIVO', '10:00')
    expect((await db.productos.get('A'))?.stock).toBe(2)
  })

  it('queda en el historial como cambio de producto', async () => {
    await db.productos.bulkPut([prod('A', 40000, 18000, 2), prod('B', 45000, 20000, 5)])
    await registrarCambio(JORNADA, lado(prod('A', 40000, 18000, 2)), lado(prod('B', 45000, 20000, 5)), 'EFECTIVO', '10:00')
    await historialAlDia()
    const creados = (await db.historial.toArray()).filter((r) => r.tabla === 'ventas' && r.accion === 'creo')
    expect(creados).toHaveLength(2)
    expect(creados.every((r) => r.motivo === MOTIVO_CAMBIO)).toBe(true)
  })

  it('incompleto no guarda nada', async () => {
    await expect(
      registrarCambio(JORNADA, lado(prod('A', 40000, 18000, 2), 0), lado(prod('B', 45000, 20000, 5)), 'EFECTIVO', '10:00'),
    ).rejects.toThrow(/cuántos trae/)
    expect(await db.ventas.count()).toBe(0)
  })
})

describe('borrarCambio', () => {
  it('borra los dos renglones, devuelve el stock como estaba y deja constancia de los dos', async () => {
    await db.productos.bulkPut([prod('A', 40000, 18000, 2), prod('B', 45000, 20000, 5)])
    const { cambioId } = await registrarCambio(JORNADA, lado(prod('A', 40000, 18000, 2)), lado(prod('B', 45000, 20000, 5)), 'EFECTIVO', '10:00')
    expect(await borrarCambio({ jornadaId: 'j1', cambioId }, MOTIVO_DESHACER_CAMBIO, null)).toBe(2)
    expect(await db.ventas.count()).toBe(0)
    expect((await db.productos.get('A'))?.stock).toBe(2)
    expect((await db.productos.get('B'))?.stock).toBe(5)
    expect(await db.borrados.count()).toBe(2)
  })

  it('no toca las otras ventas del turno', async () => {
    await db.productos.bulkPut([prod('A', 40000, 18000, 2), prod('B', 45000, 20000, 5)])
    const otro = await registrarCambio(JORNADA, lado(prod('A', 40000, 18000, 2)), lado(prod('B', 45000, 20000, 5)), 'EFECTIVO', '10:00')
    const { cambioId } = await registrarCambio(JORNADA, lado(prod('A', 40000, 18000, 2)), lado(prod('B', 45000, 20000, 5)), 'EFECTIVO', '11:00')
    await borrarCambio({ jornadaId: 'j1', cambioId }, MOTIVO_DESHACER_CAMBIO, null)
    const quedan = await db.ventas.toArray()
    expect(quedan).toHaveLength(2)
    expect(quedan.every((v) => v.cambioId === otro.cambioId)).toBe(true)
  })
})
