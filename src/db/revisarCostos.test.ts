import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Producto } from './db'
import {
  confirmarCosto,
  guardarCosto,
  MOTIVO_COSTO_CONFIRMADO,
  MOTIVO_REVISION_COSTOS,
  planillaDelProveedor,
  preciosParaPoner,
  preguntaAntesDePonerPrecios,
  problemaDeLaFecha,
  productosParaRevisar,
  proveedoresConCostos,
} from './revisarCostos'

function prod(codigo: string, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion: `Producto ${codigo}`, proveedor: null, proveedorId: null,
    fechaCompra: null, precioCompra: null, rentabilidad: null, precioVenta: 20000,
    fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: null, activo: true, ...extra,
  }
}

/** Una fecha de hace tantos meses, para que la prueba no caduque. */
function haceMeses(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().slice(0, 10)
}

beforeEach(async () => {
  await db.productos.clear()
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('productosParaRevisar', () => {
  it('trae los sin costo y los vencidos, y deja afuera los que estan bien', () => {
    const lista = productosParaRevisar(
      [
        prod('A'),
        prod('B', { precioCompra: 100, fechaCompra: haceMeses(14) }),
        prod('C', { precioCompra: 100, fechaCompra: haceMeses(1) }),
      ],
      null,
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['A', 'B'])
    expect(lista.map((x) => x.motivo)).toEqual(['sin-costo', 'vencido'])
  })

  it('los sin costo van primero, y los vencidos del mas viejo al mas nuevo', () => {
    const lista = productosParaRevisar(
      [
        prod('V1', { precioCompra: 100, fechaCompra: haceMeses(10) }),
        prod('V2', { precioCompra: 100, fechaCompra: haceMeses(30) }),
        prod('S1'),
      ],
      null,
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['S1', 'V2', 'V1'])
  })

  it('filtra por proveedor', () => {
    const lista = productosParaRevisar(
      [prod('A', { proveedorId: 'mohicano' }), prod('B', { proveedorId: 'paisa' })],
      'mohicano',
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['A'])
  })

  it('no mira archivados ni descontinuados', () => {
    const lista = productosParaRevisar(
      [prod('A', { archivado: true }), prod('B', { descontinuado: true }), prod('C')],
      null,
    )
    expect(lista.map((x) => x.producto.codigo)).toEqual(['C'])
  })
})

describe('guardarCosto', () => {
  it('guarda el costo y le pone la fecha de hoy', async () => {
    await db.productos.put(prod('A'))
    expect(await guardarCosto('A', 31000, null)).toEqual({ estado: 'guardado' })
    const a = await db.productos.get('A')
    expect(a!.precioCompra).toBe(31000)
    expect(a!.fechaCompra).toBe(new Date().toISOString().slice(0, 10))
  })

  it('NO toca nada mas que el costo y su fecha', async () => {
    await db.productos.put(
      prod('A', { precioVenta: 71900, rentabilidad: 1.3, stock: 5, proveedorId: 'mohicano', proveedor: 'MOHICANO' }),
    )
    await guardarCosto('A', 31000, null)
    const a = await db.productos.get('A')
    expect(a!.precioVenta).toBe(71900)
    expect(a!.rentabilidad).toBe(1.3)
    expect(a!.stock).toBe(5)
    expect(a!.proveedorId).toBe('mohicano')
    expect(a!.proveedor).toBe('MOHICANO')
  })

  it('no pisa lo que alguien cambio entre la lista y el guardado', async () => {
    await db.productos.put(prod('A', { precioCompra: 1000 }))
    // la lista se dibujo cuando el costo era 1000, pero ya es 2000
    await db.productos.update('A', { precioCompra: 2000 })
    const r = await guardarCosto('A', 31000, 1000)
    expect(r).toEqual({ estado: 'cambio-mientras-tanto', costoAhora: 2000 })
    expect((await db.productos.get('A'))!.precioCompra).toBe(2000)
  })

  it('si el producto ya no esta, no lo crea', async () => {
    expect(await guardarCosto('FANTASMA', 100, null)).toEqual({ estado: 'no-existe' })
    expect(await db.productos.get('FANTASMA')).toBeUndefined()
  })

  it('queda en el historial, con su motivo y con quien lo hizo', async () => {
    await db.productos.put(prod('A'))
    await guardarCosto('A', 31000, null)
    await historialAlDia()
    const renglones = await db.historial.where('tabla').equals('productos').toArray()
    const costo = renglones.find((r) => r.campo === 'precioCompra')
    expect(costo).toBeDefined()
    expect(costo!.motivo).toBe(MOTIVO_REVISION_COSTOS)
    expect(costo!.valorNuevo).toBe(31000)
    expect(costo!.quienNombre).toBe('Sandra')
  })
})

describe('confirmarCosto: "sigue valiendo lo mismo"', () => {
  it('renueva la fecha y el producto sale de la lista de vencidos', async () => {
    await db.productos.put(prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8) }))
    expect(productosParaRevisar(await db.productos.toArray(), null)).toHaveLength(1)
    expect(await confirmarCosto('A', 9500)).toEqual({ estado: 'guardado' })
    const a = await db.productos.get('A')
    expect(a!.fechaCompra).toBe(new Date().toISOString().slice(0, 10))
    expect(productosParaRevisar(await db.productos.toArray(), null)).toHaveLength(0)
  })

  it('NO toca el costo ni nada mas', async () => {
    await db.productos.put(
      prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8), precioVenta: 21000, rentabilidad: 1.3, stock: 2 }),
    )
    await confirmarCosto('A', 9500)
    const a = await db.productos.get('A')
    expect(a!.precioCompra).toBe(9500)
    expect(a!.precioVenta).toBe(21000)
    expect(a!.rentabilidad).toBe(1.3)
    expect(a!.stock).toBe(2)
  })

  it('si el costo cambio mientras tanto, no confirma un numero que nadie vio', async () => {
    await db.productos.put(prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8) }))
    await db.productos.update('A', { precioCompra: 12000 })
    expect(await confirmarCosto('A', 9500)).toEqual({ estado: 'cambio-mientras-tanto', costoAhora: 12000 })
    expect((await db.productos.get('A'))!.fechaCompra).toBe(haceMeses(8))
  })

  it('si el producto ya no esta, no lo crea', async () => {
    expect(await confirmarCosto('FANTASMA', 100)).toEqual({ estado: 'no-existe' })
    expect(await db.productos.get('FANTASMA')).toBeUndefined()
  })

  it('queda en el historial con su propio motivo, distinto de una correccion', async () => {
    await db.productos.put(prod('A', { precioCompra: 9500, fechaCompra: haceMeses(8) }))
    await confirmarCosto('A', 9500)
    await historialAlDia()
    const renglones = await db.historial.where('tabla').equals('productos').toArray()
    const fecha = renglones.find((r) => r.campo === 'fechaCompra')
    expect(fecha?.motivo).toBe(MOTIVO_COSTO_CONFIRMADO)
    expect(fecha?.quienNombre).toBe('Sandra')
    expect(renglones.some((r) => r.campo === 'precioCompra')).toBe(false)
  })
})

describe('la planilla del proveedor: todos sus productos, como en el Excel', () => {
  const HOY = new Date().toISOString().slice(0, 10)

  it('trae todos los del proveedor, en el orden de sus códigos, con cómo está cada costo', () => {
    const { filas, descontinuados } = planillaDelProveedor(
      [
        prod('MN10', { proveedorId: 'norte', precioCompra: 1000, fechaCompra: HOY }),
        prod('MN2', { proveedorId: 'norte' }),
        prod('MN1', { proveedorId: 'norte', precioCompra: 900, fechaCompra: haceMeses(9) }),
        prod('MS1', { proveedorId: 'sur', precioCompra: 500, fechaCompra: HOY }),
        prod('SUELTO', { precioCompra: 1 }),
      ],
      'norte',
    )
    // MN2 antes que MN10: como los lee una persona, no como texto.
    expect(filas.map((f) => `${f.producto.codigo}:${f.estado}`)).toEqual(['MN1:vencido', 'MN2:sin-costo', 'MN10:al-dia'])
    expect(descontinuados).toBe(0)
  })

  it('los archivados no están; los descontinuados tampoco, pero se cuentan', () => {
    const { filas, descontinuados } = planillaDelProveedor(
      [
        prod('A', { proveedorId: 'norte', precioCompra: 1, fechaCompra: HOY }),
        prod('B', { proveedorId: 'norte', archivado: true }),
        prod('C', { proveedorId: 'norte', descontinuado: true }),
        prod('D', { proveedorId: 'norte', descontinuado: true, archivado: true }),
      ],
      'norte',
    )
    expect(filas.map((f) => f.producto.codigo)).toEqual(['A'])
    expect(descontinuados).toBe(1)
  })

  it('los proveedores para elegir: primero los que tienen costos para revisar, después por nombre', () => {
    const lista = proveedoresConCostos(
      [
        prod('Z1', { proveedorId: 'zeta', precioCompra: 1, fechaCompra: HOY }),
        prod('A1', { proveedorId: 'alfa', precioCompra: 1, fechaCompra: HOY }),
        prod('T1', { proveedorId: 'norte' }),
        prod('T2', { proveedorId: 'norte', precioCompra: 1, fechaCompra: haceMeses(9) }),
        prod('T3', { proveedorId: 'norte', precioCompra: 1, fechaCompra: HOY }),
        prod('P1', { proveedorId: 'sur' }),
        prod('P2', { proveedorId: 'sur', descontinuado: true }),
        prod('P3', { proveedorId: 'sur', archivado: true }),
        prod('S1', {}),
        prod('F1', { proveedorId: 'fantasma', precioCompra: 1, fechaCompra: HOY }),
      ],
      [
        { id: 'zeta', nombre: 'ZETA' },
        { id: 'alfa', nombre: 'ALFA' },
        { id: 'norte', nombre: 'NORTE' },
        { id: 'sur', nombre: 'SUR' },
      ],
    )
    expect(lista.map((p) => `${p.nombre} ${p.paraRevisar}/${p.productos}`)).toEqual([
      'NORTE 2/3',
      '(sin proveedor) 1/1',
      'SUR 1/1',
      '(ficha que no existe: fantasma) 0/1',
      'ALFA 0/1',
      'ZETA 0/1',
    ])
  })

  it('el costo se puede guardar con la fecha de la factura, no solo con la de hoy', async () => {
    await db.productos.put(prod('A', { precioCompra: 1000, fechaCompra: haceMeses(9) }))
    const factura = haceMeses(0).slice(0, 8) + '01'
    expect(await guardarCosto('A', 1200, 1000, factura)).toEqual({ estado: 'guardado' })
    expect(await db.productos.get('A')).toMatchObject({ precioCompra: 1200, fechaCompra: factura })
    // Y «sigue igual» también.
    await db.productos.put(prod('B', { precioCompra: 500, fechaCompra: haceMeses(9) }))
    expect(await confirmarCosto('B', 500, factura)).toEqual({ estado: 'guardado' })
    expect(await db.productos.get('B')).toMatchObject({ precioCompra: 500, fechaCompra: factura })
  })

  it('una fecha futura o que no es una fecha no se guarda', async () => {
    expect(problemaDeLaFecha('2026-11-18', '2026-11-19')).toBeNull()
    expect(problemaDeLaFecha('2026-11-19', '2026-11-19')).toBeNull()
    expect(problemaDeLaFecha('2026-11-20', '2026-11-19')).toMatch(/futura/)
    expect(problemaDeLaFecha('', '2026-11-19')).toMatch(/fecha/)
    expect(problemaDeLaFecha('18/11/2026', '2026-11-19')).toMatch(/fecha/)
    expect(problemaDeLaFecha('2026-13-45', '2026-12-31')).toMatch(/fecha/)
    // Un día de verdad, pero escrito de otra forma: las fechas se comparan
    // como texto, así que tiene que ser año-mes-día y nada más.
    expect(problemaDeLaFecha('+002026-11-19', '2026-12-31')).toMatch(/fecha/)

    await db.productos.put(prod('A', { precioCompra: 1000, fechaCompra: '2026-01-01' }))
    const manana = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    await expect(guardarCosto('A', 1200, 1000, manana)).rejects.toThrow(/futura/)
    await expect(confirmarCosto('A', 1000, manana)).rejects.toThrow(/futura/)
    expect(await db.productos.get('A')).toMatchObject({ precioCompra: 1000, fechaCompra: '2026-01-01' })
  })

  it('ofrece poner el precio solo donde el costo está al día y el precio quedó atrás', () => {
    const { filas } = planillaDelProveedor(
      [
        // Al día y atrasado: 10.000 con markup 1,3 pide 23.000 y se vende a 20.000.
        prod('A', { proveedorId: 'norte', precioCompra: 10000, rentabilidad: 1.3, fechaCompra: HOY }),
        // Mismo atraso, pero con el costo vencido: ese costo nadie lo confirmó.
        prod('B', { proveedorId: 'norte', precioCompra: 10000, rentabilidad: 1.3, fechaCompra: haceMeses(9) }),
        // Al día y en precio.
        prod('C', { proveedorId: 'norte', precioCompra: 8000, rentabilidad: 1.3, fechaCompra: HOY, precioVenta: 18400 }),
        // Apenas por debajo (menos del 5 %): es redondeo o una decisión, no un olvido.
        prod('D', { proveedorId: 'norte', precioCompra: 9000, rentabilidad: 1.3, fechaCompra: HOY }),
        // Sin costo y sin markup: no hay cuenta que hacer.
        prod('E', { proveedorId: 'norte' }),
        prod('F', { proveedorId: 'norte', precioCompra: 10000, fechaCompra: HOY }),
      ],
      'norte',
    )
    expect(preciosParaPoner(filas)).toEqual([
      { codigo: 'A', descripcion: 'Producto A', actual: 20000, sugerido: 23000 },
    ])
  })

  it('antes de poner varios precios dice cuántos son, de quién, y muestra un ejemplo', () => {
    const lista = [
      { codigo: 'A', descripcion: 'MATE IMPERIAL', actual: 20000, sugerido: 23000 },
      { codigo: 'B', descripcion: 'BOMBILLA', actual: 5000, sugerido: 6000 },
      { codigo: 'C', descripcion: 'TERMO', actual: 40000, sugerido: 46000 },
    ]
    const texto = preguntaAntesDePonerPrecios(lista, 'MATES DEL NORTE')
    expect(texto).toContain('3 productos de MATES DEL NORTE')
    expect(texto).toMatch(/MATE IMPERIAL: de \$\s?20\.000 a \$\s?23\.000/)
    expect(texto).toContain('historial')
    expect(preguntaAntesDePonerPrecios(lista.slice(0, 1), 'MATES DEL NORTE')).toContain('1 producto de MATES DEL NORTE')
  })
})
