import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, nuevoId, type EntradaHistorial, type Producto } from './db'
import {
  aplicarPlanRecuperacion,
  armarPlanRecuperacion,
  MOTIVO_RECUPERACION,
  textoDeConfirmacionRecuperacion,
  valoresDelHistorial,
  type Fuente,
} from './recuperarProductos'

function prod(codigo: string, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion: `Producto ${codigo}`, proveedor: null, proveedorId: null,
    fechaCompra: null, precioCompra: null, rentabilidad: null, precioVenta: 20000,
    fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: null, activo: true, ...extra,
  }
}

function renglon(clave: string, campo: string, valorNuevo: unknown, cuando: number): EntradaHistorial {
  return {
    id: nuevoId(), tabla: 'productos', clave, accion: 'edito', queEs: clave, campo,
    valorAnterior: null, valorNuevo, quien: 'x@y.z', quienNombre: 'X', quienRol: null,
    cuando, motivo: null,
  } as EntradaHistorial
}

function fuente(nombre: string, fecha: string | null, valores: Record<string, Record<string, unknown>>): Fuente {
  return { nombre, fecha, valores: new Map(Object.entries(valores)) }
}

beforeEach(async () => {
  await db.productos.clear()
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'emmanuel@elclubdelmate.com', nombre: 'Emmanuel', rol: 'owner' }))
})

describe('valoresDelHistorial', () => {
  it('toma el valor mas nuevo de cada campo', () => {
    const valores = valoresDelHistorial([
      renglon('MR001', 'precioCompra', 8000, 100),
      renglon('MR001', 'precioCompra', 9500, 200),
    ])
    expect(valores.get('MR001')?.precioCompra).toBe(9500)
  })

  it('ignora el renglon que justamente lo vacio', () => {
    // Si el ultimo cambio fue el que borro el dato, sirve el anterior.
    const valores = valoresDelHistorial([
      renglon('MR001', 'precioCompra', 9500, 100),
      renglon('MR001', 'precioCompra', null, 200),
    ])
    expect(valores.get('MR001')?.precioCompra).toBe(9500)
  })

  it('no mira renglones de otras tablas', () => {
    const otro = { ...renglon('j1', 'cajaInicial', 5000, 100), tabla: 'jornadas' as const }
    expect(valoresDelHistorial([otro]).size).toBe(0)
  })

  it('junta varios campos del mismo producto', () => {
    const valores = valoresDelHistorial([
      renglon('MR001', 'precioCompra', 9500, 100),
      renglon('MR001', 'proveedor', 'MATES RAFAEL', 120),
      renglon('MR001', 'fechaCompra', '2026-08-12', 130),
    ])
    expect(valores.get('MR001')).toEqual({
      precioCompra: 9500, proveedor: 'MATES RAFAEL', fechaCompra: '2026-08-12',
    })
  })
})

describe('armarPlanRecuperacion', () => {
  it('rellena solo lo que esta vacio', () => {
    const plan = armarPlanRecuperacion(
      [prod('A', { precioCompra: 5000 })],
      [fuente('historial', null, { A: { precioCompra: 9999, proveedor: 'OTRO' } })],
    )
    // El costo ya estaba: no se toca. El proveedor faltaba: se rellena.
    expect(plan.cambios[0].precioCompra).toBeUndefined()
    expect(plan.cambios[0].proveedor).toBe('OTRO')
  })

  it('no propone nada para un producto completo', () => {
    const plan = armarPlanRecuperacion(
      [prod('A', { precioCompra: 5000, proveedor: 'MOHICANO' })],
      [fuente('historial', null, { A: { precioCompra: 9999 } })],
    )
    expect(plan.cambios).toEqual([])
  })

  it('respeta el orden de las fuentes: gana la primera', () => {
    const plan = armarPlanRecuperacion(
      [prod('A')],
      [
        fuente('historial', null, { A: { precioCompra: 9500 } }),
        fuente('Excel', '2026-10-11', { A: { precioCompra: 7000 } }),
      ],
    )
    expect(plan.cambios[0].precioCompra).toBe(9500)
    expect(plan.cambios[0].fuenteCosto).toBe('historial')
  })

  it('pasa a la siguiente fuente si la primera no lo tiene', () => {
    const plan = armarPlanRecuperacion(
      [prod('A')],
      [fuente('historial', null, {}), fuente('foto 12/08', '2026-08-12', { A: { precioCompra: 7000 } })],
    )
    expect(plan.cambios[0].precioCompra).toBe(7000)
    expect(plan.cambios[0].fuenteCosto).toBe('foto 12/08')
  })

  it('el costo trae su fecha, para que quede como costo vencido', () => {
    // Un costo de agosto con la fecha de hoy pasaria por actual y nadie
    // lo volveria a mirar.
    const plan = armarPlanRecuperacion(
      [prod('A')],
      [fuente('foto 12/08', '2026-08-12', { A: { precioCompra: 7000 } })],
    )
    expect(plan.cambios[0].fechaCompra).toBe('2026-08-12')
  })

  it('si el dato trae su propia fecha, esa manda', () => {
    const plan = armarPlanRecuperacion(
      [prod('A')],
      [fuente('foto', '2026-08-12', { A: { precioCompra: 7000, fechaCompra: '2026-03-01' } })],
    )
    expect(plan.cambios[0].fechaCompra).toBe('2026-03-01')
  })

  it('el proveedor vuelve con su id derivado, para que el boton lo agrupe', () => {
    const plan = armarPlanRecuperacion(
      [prod('A')],
      [fuente('historial', null, { A: { proveedor: 'MATES RAFAEL' } })],
    )
    expect(plan.cambios[0].proveedor).toBe('MATES RAFAEL')
    expect(plan.cambios[0].proveedorId).toBe('prov-mates-rafael')
  })

  it('cuenta los que ninguna fuente puede recuperar', () => {
    const plan = armarPlanRecuperacion([prod('A'), prod('B')], [fuente('historial', null, { A: { precioCompra: 1 } })])
    expect(plan.sinFuente).toBe(1)
  })

  it('cuenta cuanto aporta cada fuente', () => {
    const plan = armarPlanRecuperacion(
      [prod('A'), prod('B')],
      [
        fuente('historial', null, { A: { precioCompra: 9500, proveedor: 'UNO' } }),
        fuente('Excel', '2026-10-11', { B: { precioCompra: 7000 } }),
      ],
    )
    expect(plan.porFuente).toEqual([
      { nombre: 'historial', costos: 1, proveedores: 1 },
      { nombre: 'Excel', costos: 1, proveedores: 0 },
    ])
  })

  it('no mira los archivados', () => {
    const plan = armarPlanRecuperacion([prod('A', { archivado: true })], [fuente('h', null, { A: { precioCompra: 1 } })])
    expect(plan.cambios).toEqual([])
  })
})

describe('aplicarPlanRecuperacion', () => {
  it('rellena los vacios y deja el resto como estaba', async () => {
    await db.productos.bulkAdd([prod('A'), prod('B', { precioCompra: 5000 })])
    const productos = await db.productos.toArray()
    const plan = armarPlanRecuperacion(productos, [
      fuente('foto 12/08', '2026-08-12', {
        A: { precioCompra: 9500, proveedor: 'MATES RAFAEL', rentabilidad: 1.3 },
        B: { precioCompra: 1, proveedor: 'OTRO' },
      }),
    ])

    const tocados = await aplicarPlanRecuperacion(plan)

    const a = await db.productos.get('A')
    expect(a?.precioCompra).toBe(9500)
    expect(a?.fechaCompra).toBe('2026-08-12')
    expect(a?.proveedor).toBe('MATES RAFAEL')
    expect(a?.proveedorId).toBe('prov-mates-rafael')
    // A B no le tocó el costo, que ya tenía.
    const b = await db.productos.get('B')
    expect(b?.precioCompra).toBe(5000)
    expect(b?.proveedor).toBe('OTRO')
    expect(tocados).toBe(2)
  })

  it('no pisa un valor que se cargo entre la vista previa y el aplicar', async () => {
    await db.productos.add(prod('A'))
    const plan = armarPlanRecuperacion(await db.productos.toArray(), [
      fuente('foto', '2026-08-12', { A: { precioCompra: 9500 } }),
    ])
    // Alguien lo carga mientras tanto.
    await db.productos.update('A', { precioCompra: 12000 })

    await aplicarPlanRecuperacion(plan)

    expect((await db.productos.get('A'))?.precioCompra).toBe(12000)
  })

  it('no toca el precio de venta', async () => {
    await db.productos.add(prod('A'))
    const plan = armarPlanRecuperacion(await db.productos.toArray(), [
      fuente('foto', '2026-08-12', { A: { precioCompra: 9500 } }),
    ])
    await aplicarPlanRecuperacion(plan)
    expect((await db.productos.get('A'))?.precioVenta).toBe(20000)
  })

  it('queda en el historial con su motivo', async () => {
    await db.productos.add(prod('A'))
    await historialAlDia()
    await db.historial.clear()

    const plan = armarPlanRecuperacion(await db.productos.toArray(), [
      fuente('foto', '2026-08-12', { A: { precioCompra: 9500 } }),
    ])
    await aplicarPlanRecuperacion(plan)
    await historialAlDia()

    const renglones = await db.historial.toArray()
    expect(renglones.some((r) => r.campo === 'precioCompra' && r.motivo === MOTIVO_RECUPERACION)).toBe(true)
  })
})

/** Una fecha de hace tantos meses, en ISO. Asi la prueba no caduca. */
function haceMeses(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().slice(0, 10)
}

describe('costos vencidos', () => {
  it('cuenta los costos que entran con fecha vieja', () => {
    const plan = armarPlanRecuperacion(
      [prod('A'), prod('B')],
      [
        fuente('foto', null, {
          A: { precioCompra: 100, fechaCompra: haceMeses(14) },
          B: { precioCompra: 200, fechaCompra: haceMeses(1) },
        }),
      ],
    )
    expect(plan.costosVencidos).toBe(1)
  })

  it('un costo sin fecha cuenta como vencido', () => {
    const plan = armarPlanRecuperacion([prod('A')], [fuente('x', null, { A: { precioCompra: 100 } })])
    expect(plan.costosVencidos).toBe(1)
  })

  it('no cuenta como vencido al producto descontinuado', () => {
    const plan = armarPlanRecuperacion(
      [prod('A', { descontinuado: true })],
      [fuente('foto', haceMeses(14), { A: { precioCompra: 100 } })],
    )
    expect(plan.cambios).toHaveLength(1)
    expect(plan.costosVencidos).toBe(0)
  })

  it('un proveedor recuperado sin costo no cuenta', () => {
    const plan = armarPlanRecuperacion([prod('A')], [fuente('x', null, { A: { proveedor: 'MOHICANO' } })])
    expect(plan.costosVencidos).toBe(0)
  })
})

describe('textoDeConfirmacionRecuperacion', () => {
  it('dice cuantos registros toca y cuantos campos de cada tipo', () => {
    const plan = armarPlanRecuperacion(
      [prod('A'), prod('B')],
      [fuente('x', null, { A: { precioCompra: 100, proveedor: 'MOHICANO' }, B: { proveedor: 'PAISA' } })],
    )
    const texto = textoDeConfirmacionRecuperacion(plan)
    expect(texto).toContain('1 costos')
    expect(texto).toContain('2 proveedores')
    expect(texto).toContain('2 productos')
    expect(texto).toContain(MOTIVO_RECUPERACION)
  })

  it('avisa que no se pisa nada', () => {
    const plan = armarPlanRecuperacion([prod('A')], [fuente('x', null, { A: { precioCompra: 100 } })])
    expect(textoDeConfirmacionRecuperacion(plan)).toContain('ningun dato cargado se pisa')
  })
})
