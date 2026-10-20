import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Jornada, type Movimiento, type Venta } from './db'
import { borrarJornada, resumenJornada } from './borrarJornada'

function jornada(id: string, parcial: Partial<Jornada> = {}): Jornada {
  return {
    id,
    fecha: '2026-10-19',
    turno: 'T',
    estado: 'cerrado',
    vendedor: 'Gabriela',
    cajaInicial: 74750,
    horaApertura: '13:00',
    horaCierre: '16:47',
    arqueoApertura: null,
    arqueoCierre: null,
    notas: null,
    ...parcial,
  }
}

function venta(id: string, jornadaId: string, total = 1000): Venta {
  return {
    id,
    jornadaId,
    fecha: '2026-10-19',
    hora: '14:00',
    codigo: 'TM015',
    descripcion: 'MATE',
    cantidad: 1,
    precioUnitario: total,
    costoUnitario: null,
    medioPago: 'EFECTIVO',
    total,
    vendedor: 'Gabriela',
  }
}

function movimiento(id: string, jornadaId: string): Movimiento {
  return {
    id,
    fecha: '2026-10-19',
    tipo: 'EGRESO_CAJA',
    concepto: 'cambio',
    monto: 500,
    categoria: null,
    jornadaId,
    esVariable: false,
  }
}

beforeEach(async () => {
  await Promise.all([
    db.jornadas.clear(),
    db.ventas.clear(),
    db.movimientos.clear(),
    db.borrados.clear(),
    db.historial.clear(),
  ])
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('borrarJornada', () => {
  it('borra el turno con sus ventas y sus movimientos', async () => {
    await db.jornadas.add(jornada('j1'))
    await db.ventas.bulkAdd([venta('v1', 'j1'), venta('v2', 'j1'), venta('v3', 'j1'), venta('v4', 'j1')])
    await db.movimientos.add(movimiento('m1', 'j1'))

    const r = await borrarJornada('j1', 'Turno duplicado del celular de Gabi', 'ventas@elclubdelmate.com')

    expect(r).toEqual({ ventas: 4, movimientos: 1 })
    expect(await db.jornadas.get('j1')).toBeUndefined()
    expect(await db.ventas.count()).toBe(0)
    expect(await db.movimientos.count()).toBe(0)
  })

  it('no toca las ventas de OTRO turno', async () => {
    // Lo mas importante del borrado: el turno bueno del mismo dia
    // tiene que quedar intacto.
    await db.jornadas.bulkAdd([jornada('malo'), jornada('bueno')])
    await db.ventas.bulkAdd([venta('v1', 'malo'), venta('v2', 'bueno'), venta('v3', 'bueno')])

    await borrarJornada('malo', 'duplicado', 'ventas@elclubdelmate.com')

    expect(await db.jornadas.get('bueno')).toBeDefined()
    expect((await db.ventas.toArray()).map((v) => v.id).sort()).toEqual(['v2', 'v3'])
  })

  it('deja constancia en borrados de cada cosa', async () => {
    await db.jornadas.add(jornada('j1'))
    await db.ventas.bulkAdd([venta('v1', 'j1'), venta('v2', 'j1')])

    await borrarJornada('j1', 'duplicado', 'ventas@elclubdelmate.com')

    const constancias = await db.borrados.toArray()
    expect(constancias.map((b) => b.id).sort()).toEqual([
      'jornadas/j1',
      'ventas/v1',
      'ventas/v2',
    ])
    expect(constancias.every((b) => b.motivo === 'duplicado')).toBe(true)
    expect(constancias.every((b) => b.quien === 'ventas@elclubdelmate.com')).toBe(true)
  })

  it('queda en el historial con el motivo', async () => {
    await db.jornadas.add(jornada('j1'))
    await db.ventas.add(venta('v1', 'j1'))
    // El alta de arriba tambien deja historial ('creo'). Se deja
    // aterrizar y se limpia, para mirar solo lo que deja el borrado.
    await historialAlDia()
    await db.historial.clear()

    await borrarJornada('j1', 'Turno duplicado del celular', 'ventas@elclubdelmate.com')
    await historialAlDia()

    const renglones = await db.historial.toArray()
    const delTurno = renglones.filter((r) => r.tabla === 'jornadas')
    expect(delTurno).toHaveLength(1)
    expect(delTurno[0].accion).toBe('borro')
    expect(delTurno[0].motivo).toBe('Turno duplicado del celular')
    expect(delTurno[0].quienNombre).toBe('Sandra')
    expect(renglones.some((r) => r.tabla === 'ventas' && r.accion === 'borro')).toBe(true)
  })

  it('sin motivo no borra nada', async () => {
    await db.jornadas.add(jornada('j1'))
    await expect(borrarJornada('j1', '   ', null)).rejects.toThrow('motivo')
    expect(await db.jornadas.get('j1')).toBeDefined()
  })

  it('un turno que ya no esta avisa en vez de romper', async () => {
    await expect(borrarJornada('no-existe', 'lo que sea', null)).rejects.toThrow('ya no está')
  })

  it('no devuelve el stock', async () => {
    // A proposito: el stock se descuenta en el dispositivo donde se
    // carga la venta, no en los demas. Devolverlo al borrar inflaria el
    // stock de quien borra.
    await db.productos.put({
      codigo: 'TM015',
      descripcion: 'MATE',
      proveedor: null,
      proveedorId: null,
      fechaCompra: null,
      precioCompra: null,
      rentabilidad: null,
      precioVenta: 1000,
      fechaPrecioVenta: null,
      busqueda: 'tm015',
      stock: 3,
      activo: true,
    })
    await db.jornadas.add(jornada('j1'))
    await db.ventas.add(venta('v1', 'j1'))

    await borrarJornada('j1', 'duplicado', null)

    expect((await db.productos.get('TM015'))?.stock).toBe(3)
  })
})

describe('resumenJornada', () => {
  it('cuenta lo que hay adentro antes de borrar', async () => {
    await db.jornadas.add(jornada('j1'))
    await db.ventas.bulkAdd([venta('v1', 'j1', 2000), venta('v2', 'j1', 3000)])

    const r = await resumenJornada('j1')
    expect(r?.ventas).toHaveLength(2)
    expect(r?.totalVendido).toBe(5000)
    expect(r?.jornada.cajaInicial).toBe(74750)
  })

  it('devuelve null si el turno no existe', async () => {
    expect(await resumenJornada('fantasma')).toBeNull()
  })
})
