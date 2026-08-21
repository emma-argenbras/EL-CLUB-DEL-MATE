import { describe, expect, it } from 'vitest'
import type { Jornada, Movimiento, MovimientoProveedor, Producto, Venta } from '../db/db'
import {
  auditar,
  hallazgosVisibles,
  puntajeSalud,
  type DatosAuditoria,
  type Hallazgo,
} from './auditoria'

function producto(parcial: Partial<Producto>): Producto {
  return {
    codigo: 'COD1',
    descripcion: 'Producto',
    proveedor: null,
    proveedorId: 'prov1',
    fechaCompra: new Date().toISOString().slice(0, 10),
    precioCompra: 1000,
    rentabilidad: 1.3,
    precioVenta: 2300,
    fechaPrecioVenta: null,
    busqueda: 'producto',
    stock: null,
    activo: true,
    ...parcial,
  }
}

function jornada(parcial: Partial<Jornada>): Jornada {
  return {
    id: 'j1',
    fecha: '2026-08-01',
    turno: 'M',
    estado: 'cerrado',
    vendedor: null,
    cajaInicial: 0,
    horaApertura: null,
    horaCierre: null,
    arqueoApertura: null,
    arqueoCierre: null,
    notas: null,
    ...parcial,
  }
}

function venta(parcial: Partial<Venta>): Venta {
  return {
    id: 'v1',
    jornadaId: 'j1',
    fecha: '2026-08-01',
    hora: '10:00',
    codigo: 'COD1',
    descripcion: 'Producto',
    cantidad: 1,
    precioUnitario: 2300,
    costoUnitario: 1000,
    medioPago: 'EFECTIVO',
    total: 2300,
    vendedor: null,
    ...parcial,
  }
}

function movimiento(parcial: Partial<Movimiento>): Movimiento {
  return {
    id: 'm1',
    fecha: '2026-08-01',
    tipo: 'GASTO_CAJA_GRANDE',
    concepto: 'Gasto',
    monto: 1000,
    categoria: 'OTROS',
    jornadaId: null,
    esVariable: true,
    ...parcial,
  }
}

/** Un negocio sano: todos los dias del mes cargados y sin nada pendiente. */
function datos(parcial: Partial<DatosAuditoria> = {}): DatosAuditoria {
  const jornadas: Jornada[] = []
  for (let dia = 1; dia <= 10; dia++) {
    jornadas.push(
      jornada({ id: `j${dia}`, fecha: `2026-08-${String(dia).padStart(2, '0')}` }),
    )
  }
  return {
    productos: [producto({})],
    proveedores: [{ id: 'prov1', nombre: 'MOHICANO', contacto: null, notas: null, activo: true }],
    jornadas,
    ventas: [venta({})],
    movimientos: [],
    movimientosMesAnterior: [],
    ventasPorJornada: new Map(),
    movimientosPorJornada: new Map(),
    cuentaCorriente: [],
    estadoNube: 'sincronizado',
    errorNube: null,
    hoy: '2026-08-11',
    mes: '2026-08',
    ...parcial,
  }
}

function buscar(hallazgos: Hallazgo[], id: string): Hallazgo | undefined {
  return hallazgos.find((h) => h.id === id)
}

describe('auditar: un negocio al dia', () => {
  it('no encuentra nada para reportar', () => {
    expect(auditar(datos())).toEqual([])
  })
})

describe('auditar: caja', () => {
  it('avisa de los turnos que quedaron abiertos de dias anteriores', () => {
    const h = buscar(
      auditar(datos({ jornadas: [jornada({ fecha: '2026-08-05', estado: 'abierto' })] })),
      'caja-turnos-abiertos',
    )
    expect(h?.nivel).toBe('critico')
    expect(h?.cantidad).toBe(1)
  })

  it('el turno de hoy todavia abierto no es un problema', () => {
    const hallazgos = auditar(
      datos({ jornadas: [jornada({ fecha: '2026-08-11', estado: 'abierto' })] }),
    )
    expect(buscar(hallazgos, 'caja-turnos-abiertos')).toBeUndefined()
  })

  it('marca los dias del mes que quedaron sin caja cargada', () => {
    const h = buscar(
      auditar(datos({ jornadas: [jornada({ fecha: '2026-08-01' })] })),
      'caja-dias-sin-cargar',
    )
    // Del 2 al 10: el dia de hoy (11) no cuenta, todavia puede cargarse.
    expect(h?.cantidad).toBe(9)
  })

  it('detecta las diferencias de caja de los cierres del mes', () => {
    const cerrada = jornada({
      id: 'jx',
      fecha: '2026-08-02',
      cajaInicial: 10000,
      arqueoCierre: { billetes: { '1000': 12 }, monedas: 0 },
    })
    const hallazgos = auditar(
      datos({
        jornadas: [cerrada],
        // Vendio 1000 en efectivo: deberia cerrar con 11000, y conto 12000.
        ventasPorJornada: new Map([['jx', [venta({ total: 1000, medioPago: 'EFECTIVO' })]]]),
      }),
    )
    const h = buscar(hallazgos, 'caja-diferencias')
    expect(h?.cantidad).toBe(1)
    expect(h?.monto).toBe(1000)
  })
})

describe('auditar: productos', () => {
  it('lo mas grave es vender por debajo del costo', () => {
    const hallazgos = auditar(
      datos({ productos: [producto({ precioCompra: 12500, precioVenta: 8750 })] }),
    )
    const h = buscar(hallazgos, 'productos-bajo-costo')
    expect(h?.nivel).toBe('critico')
    expect(h?.monto).toBe(3750)
    // Y por ser lo mas grave, encabeza la lista.
    expect(hallazgos[0].id).toBe('productos-bajo-costo')
  })

  it('avisa de los productos agotados', () => {
    const h = buscar(auditar(datos({ productos: [producto({ stock: 0 })] })), 'productos-sin-stock')
    expect(h?.cantidad).toBe(1)
  })

  it('avisa de los costos vencidos', () => {
    const vieja = new Date()
    vieja.setMonth(vieja.getMonth() - 8)
    const h = buscar(
      auditar(datos({ productos: [producto({ fechaCompra: vieja.toISOString().slice(0, 10) })] })),
      'productos-costo-vencido',
    )
    expect(h?.cantidad).toBe(1)
  })

  it('un producto archivado no ensucia ninguna cuenta', () => {
    const hallazgos = auditar(
      datos({
        productos: [producto({ archivado: true, precioCompra: 12500, precioVenta: 100, stock: 0 })],
      }),
    )
    expect(hallazgos).toEqual([])
  })

  it('avisa de las ventas del mes sin costo cargado, con el monto', () => {
    const h = buscar(
      auditar(datos({ ventas: [venta({ costoUnitario: null, total: 5000 })] })),
      'ventas-sin-costo',
    )
    expect(h?.monto).toBe(5000)
    expect(h?.soloOwner).toBe(true)
  })
})

describe('auditar: proveedores y gastos', () => {
  function movProv(parcial: Partial<MovimientoProveedor>): MovimientoProveedor {
    return {
      id: 'mp1',
      proveedorId: 'prov1',
      tipo: 'compra',
      fecha: '2026-08-01',
      monto: 5000,
      medioPago: null,
      items: null,
      notas: null,
      ...parcial,
    }
  }

  it('suma lo que se le debe a cada proveedor', () => {
    const h = buscar(
      auditar(
        datos({
          cuentaCorriente: [
            movProv({ monto: 5000 }),
            movProv({ id: 'mp2', tipo: 'pago', monto: 2000 }),
          ],
        }),
      ),
      'proveedores-saldo',
    )
    expect(h?.monto).toBe(3000)
    expect(h?.detalle).toContain('MOHICANO')
  })

  it('un proveedor ya pagado no aparece', () => {
    const hallazgos = auditar(
      datos({
        cuentaCorriente: [movProv({ monto: 5000 }), movProv({ id: 'mp2', tipo: 'pago', monto: 5000 })],
      }),
    )
    expect(buscar(hallazgos, 'proveedores-saldo')).toBeUndefined()
  })

  it('avisa si falta cargar un gasto que se pago el mes pasado', () => {
    const h = buscar(
      auditar(
        datos({
          movimientosMesAnterior: [movimiento({ categoria: 'ALQUILER', esVariable: false })],
        }),
      ),
      'gastos-habituales-faltantes',
    )
    expect(h?.detalle).toContain('ALQUILER')
  })

  it('no reclama un gasto que este negocio nunca tuvo', () => {
    const hallazgos = auditar(datos({ movimientosMesAnterior: [] }))
    expect(buscar(hallazgos, 'gastos-habituales-faltantes')).toBeUndefined()
  })

  it('si ya se cargo este mes, no molesta', () => {
    const hallazgos = auditar(
      datos({
        movimientos: [movimiento({ categoria: 'ALQUILER' })],
        movimientosMesAnterior: [movimiento({ categoria: 'ALQUILER' })],
      }),
    )
    expect(buscar(hallazgos, 'gastos-habituales-faltantes')).toBeUndefined()
  })
})

describe('hallazgosVisibles', () => {
  const todos = auditar(
    datos({
      productos: [producto({ stock: 0 })],
      ventas: [venta({ costoUnitario: null })],
    }),
  )

  it('un dueño ve todo', () => {
    expect(hallazgosVisibles(todos, true, []).length).toBe(todos.length)
  })

  it('un empleado no ve los numeros de ganancia del negocio', () => {
    const suyos = hallazgosVisibles(todos, false, ['caja', 'productos'])
    expect(suyos.some((h) => h.soloOwner)).toBe(false)
    expect(suyos.some((h) => h.id === 'productos-sin-stock')).toBe(true)
  })

  it('un empleado no ve lo de una seccion que tiene apagada', () => {
    const suyos = hallazgosVisibles(todos, false, ['caja'])
    expect(suyos.some((h) => h.id === 'productos-sin-stock')).toBe(false)
  })
})

describe('puntajeSalud', () => {
  it('sin hallazgos da 100', () => {
    expect(puntajeSalud([])).toBe(100)
  })

  it('baja segun la gravedad y nunca es negativo', () => {
    const critico = auditar(datos({ productos: [producto({ precioVenta: 500 })] }))
    expect(puntajeSalud(critico)).toBeLessThan(100)
    expect(puntajeSalud(Array(20).fill(critico[0]))).toBe(0)
  })
})
