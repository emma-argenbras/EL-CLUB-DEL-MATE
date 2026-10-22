import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { comoRemoto, db, type Producto } from '../db/db'
import { aplicarCambiosRemotos, type CambioRemoto } from './aplicarRemotos'

function prod(codigo: string, extra: Partial<Producto> = {}): Record<string, unknown> {
  return {
    codigo, descripcion: `Producto ${codigo}`, proveedor: 'MOHICANO', proveedorId: 'mohicano',
    fechaCompra: '2026-10-01', precioCompra: 2000, rentabilidad: 1, precioVenta: 4000,
    fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: null, activo: true, ...extra,
  }
}

const llega = (datos: Record<string, unknown>, id = String(datos.codigo)): CambioRemoto => ({
  tipo: 'modified', id, datos, pendiente: false,
})

const nunca = () => false
const nada = () => {}

beforeEach(async () => {
  await db.productos.clear()
})

describe('aplicarCambiosRemotos', () => {
  it('UNO MALO NO FRENA A LOS DEMAS: lo que viene despues se guarda igual', async () => {
    // Asi estaba la copia de Sandra: vacios que el servidor ya tenia.
    await db.productos.bulkPut([
      prod('AAA001', { proveedor: null }) as unknown as Producto,
      prod('ZZZ001', { proveedor: null }) as unknown as Producto,
    ])
    // Un documento sin codigo en el medio, que IndexedDB no puede guardar.
    const { codigo: _sinCodigo, ...malo } = prod('MMM001')
    const fallos = await comoRemoto(() =>
      aplicarCambiosRemotos(
        'productos',
        [llega(prod('AAA001')), llega(malo, 'MMM001'), llega(prod('ZZZ001'))],
        nunca,
        nada,
      ),
    )
    expect((await db.productos.get('AAA001'))?.proveedor).toBe('MOHICANO')
    expect((await db.productos.get('ZZZ001'))?.proveedor).toBe('MOHICANO')
    expect(fallos).toHaveLength(1)
    expect(fallos[0].id).toBe('MMM001')
    expect(fallos[0].error).toMatch(/DataError|key/i)
  })

  it('un borrado de verdad borra, con la clave desescapada', async () => {
    await db.productos.put(prod('TM/01') as unknown as Producto)
    await comoRemoto(() =>
      aplicarCambiosRemotos('productos', [{ tipo: 'removed', id: 'TM%2F01', datos: null, pendiente: false }], nunca, nada),
    )
    expect(await db.productos.get('TM/01')).toBeUndefined()
  })

  it('la reversion de un rechazo propio NO borra lo que se acaba de cargar', async () => {
    await db.productos.put(prod('A') as unknown as Producto)
    await comoRemoto(() =>
      aplicarCambiosRemotos('productos', [{ tipo: 'removed', id: 'A', datos: null, pendiente: false }], () => true, nada),
    )
    expect(await db.productos.get('A')).toBeDefined()
  })

  it('el eco pendiente de una escritura propia no se reescribe', async () => {
    await db.productos.put(prod('A', { precioVenta: 5000 }) as unknown as Producto)
    await comoRemoto(() =>
      aplicarCambiosRemotos('productos', [{ ...llega(prod('A', { precioVenta: 4000 })), pendiente: true }], nunca, nada),
    )
    expect((await db.productos.get('A'))?.precioVenta).toBe(5000)
  })

  it('avisa que llego el dato bueno, para olvidar el rechazo', async () => {
    const recibidos: string[] = []
    await comoRemoto(() =>
      aplicarCambiosRemotos('productos', [llega(prod('A'))], nunca, (id) => recibidos.push(id)),
    )
    expect(recibidos).toEqual(['A'])
  })
})
