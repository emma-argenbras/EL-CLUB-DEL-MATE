import { describe, expect, it } from 'vitest'
import type { Jornada, Movimiento, MovimientoProveedor, Producto, Venta } from '../db/db'
import {
  auditar,
  CONTROLES,
  hallazgosVisibles,
  revisionCompleta,
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
    fechaPrecioVenta: new Date().toISOString().slice(0, 10),
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
    // Sincronizo hoy mismo: un negocio sano no tiene el aviso de atraso.
    ultimaSync: Date.parse('2026-08-11T12:00:00'),
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

describe('las dos fechas de la planilla dan avisos distintos', () => {
  const haceDosAnios = new Date()
  haceDosAnios.setFullYear(haceDosAnios.getFullYear() - 2)
  const viejo = haceDosAnios.toISOString().slice(0, 10)

  it('costo viejo con precio remarcado: avisa del reporte, no del precio', () => {
    const hallazgos = auditar(datos({ productos: [producto({ fechaCompra: viejo })] }))
    const ids = hallazgos.map((h) => h.id)
    expect(ids).toContain('productos-costo-vencido')
    expect(ids).not.toContain('productos-precio-vencido')
  })

  it('precio sin remarcar con costo al dia: avisa del precio, no del reporte', () => {
    const hallazgos = auditar(datos({ productos: [producto({ fechaPrecioVenta: viejo })] }))
    const ids = hallazgos.map((h) => h.id)
    expect(ids).toContain('productos-precio-vencido')
    expect(ids).not.toContain('productos-costo-vencido')
  })

  it('el precio por debajo de su rentabilidad aparece aunque las dos fechas sean de hoy', () => {
    // Costo 1.000 con 130 % -> deberia venderse a 2.300, y esta a 1.500.
    const h = buscar(
      auditar(datos({ productos: [producto({ precioVenta: 1500 })] })),
      'productos-precio-atrasado',
    )
    expect(h?.cantidad).toBe(1)
    expect(h?.monto).toBe(800)
  })

  it('un producto bien puesto no dispara ninguno de los tres', () => {
    const ids = auditar(datos()).map((h) => h.id)
    expect(ids).not.toContain('productos-precio-atrasado')
    expect(ids).not.toContain('productos-precio-vencido')
    expect(ids).not.toContain('productos-costo-vencido')
  })
})

describe('controles nuevos', () => {
  it('un producto sin precio de venta no se puede vender: avisa', () => {
    const h = buscar(
      auditar(datos({ productos: [producto({ precioVenta: null })] })),
      'productos-sin-precio',
    )
    expect(h?.cantidad).toBe(1)
  })

  it('un descontinuado sin precio no molesta: ya no se vende', () => {
    const hallazgos = auditar(
      datos({ productos: [producto({ precioVenta: null, descontinuado: true })] }),
    )
    expect(hallazgos.map((h) => h.id)).not.toContain('productos-sin-precio')
  })

  it('stock en negativo: se vendio mas de lo que habia', () => {
    const h = buscar(auditar(datos({ productos: [producto({ stock: -3 })] })), 'productos-stock-negativo')
    expect(h?.cantidad).toBe(1)
    // Y no se confunde con "sin stock", que es stock exactamente en cero.
    expect(buscar(auditar(datos({ productos: [producto({ stock: 0 })] })), 'productos-sin-stock')).toBeTruthy()
  })

  it('un producto que figura solo con su codigo', () => {
    const h = buscar(
      auditar(datos({ productos: [producto({ codigo: 'AB12', descripcion: 'AB12' })] })),
      'productos-sin-nombre',
    )
    expect(h?.cantidad).toBe(1)
  })
})

describe('la plata se engancha entre turnos', () => {
  const arqueo = (total: number) => ({ billetes: { '1000': total / 1000 }, monedas: 0 })

  const turno = (fecha: string, t: 'M' | 'T', abre: number, cierra: number): Jornada => ({
    id: `${fecha}-${t}`,
    fecha,
    turno: t,
    estado: 'cerrado',
    cajaInicial: abre,
    arqueoApertura: arqueo(abre),
    arqueoCierre: arqueo(cierra),
    notas: null,
    vendedor: null,
    horaApertura: null,
    horaCierre: null,
  })

  it('si la tarde abre con lo que cerro la mañana, no dice nada', () => {
    const hallazgos = auditar(
      datos({
        jornadas: [turno('2026-08-03', 'M', 10000, 25000), turno('2026-08-03', 'T', 25000, 40000)],
      }),
    )
    expect(hallazgos.map((h) => h.id)).not.toContain('caja-no-engancha')
  })

  it('si falta plata entre un turno y el otro, avisa cuanta', () => {
    const h = buscar(
      auditar(
        datos({
          jornadas: [turno('2026-08-03', 'M', 10000, 25000), turno('2026-08-03', 'T', 5000, 40000)],
        }),
      ),
      'caja-no-engancha',
    )
    expect(h?.cantidad).toBe(1)
    expect(h?.monto).toBe(20000)
  })

  it('entre dos turnos que no son seguidos no se compara: la plata pudo ir a caja grande', () => {
    const hallazgos = auditar(
      datos({
        jornadas: [turno('2026-08-03', 'M', 10000, 25000), turno('2026-08-20', 'T', 5000, 40000)],
      }),
    )
    expect(hallazgos.map((h) => h.id)).not.toContain('caja-no-engancha')
  })
})

describe('revisionCompleta', () => {
  it('lista todos los controles, tambien los que pasaron', () => {
    const hallazgos = auditar(datos())
    const revision = revisionCompleta(hallazgos)
    expect(revision.length).toBe(CONTROLES.length)
    expect(revision.every((c) => c.estado === 'bien')).toBe(true)
  })

  it('el control que fallo queda marcado con su nivel y su titulo', () => {
    const hallazgos = auditar(datos({ productos: [producto({ precioVenta: null })] }))
    const control = revisionCompleta(hallazgos).find((c) => c.id === 'productos-sin-precio')
    expect(control?.estado).toBe('importante')
    expect(control?.resultado).toContain('no tiene precio de venta')
    expect(control?.hallazgo).toBeTruthy()
  })

  it('a un empleado no se le muestran los controles de ganancia del negocio', () => {
    const revision = revisionCompleta(auditar(datos()), false)
    expect(revision.map((c) => c.id)).not.toContain('ventas-sin-costo')
    expect(revision.map((c) => c.id)).not.toContain('gastos-habituales-faltantes')
  })

  it('sin una seccion habilitada, sus controles no aparecen', () => {
    const revision = revisionCompleta(auditar(datos()), true, ['caja'])
    expect(revision.every((c) => c.modulo === 'caja' || c.modulo === 'sistema')).toBe(true)
  })

  it('cada hallazgo que produce el motor tiene su control declarado', () => {
    // Si alguien agrega un aviso nuevo y se olvida de sumarlo al
    // catalogo, la revision completa lo dejaria afuera sin avisar.
    const todos = auditar(
      datos({
        productos: [producto({ precioVenta: null, stock: -1, descripcion: 'COD1', proveedorId: null })],
      }),
    )
    const declarados = new Set(CONTROLES.map((c) => c.id))
    for (const h of todos) expect(declarados.has(h.id)).toBe(true)
  })
})

describe('un control que no se pudo correr no cuenta como aprobado', () => {
  it('sin la nube configurada, los controles de respaldo quedan sin revisar', () => {
    const entrada = datos({ estadoNube: 'sin-configurar' })
    const revision = revisionCompleta(auditar(entrada), true, undefined, entrada)
    const sync = revision.filter((c) => c.modulo === 'sistema')
    expect(sync.length).toBe(3)
    expect(sync.every((c) => c.estado === 'no-corrio')).toBe(true)
    // Ninguno se puede revisar y todos dicen el mismo motivo real.
    expect(sync.every((c) => c.resultado.includes('todavía no está activado'))).toBe(true)
  })

  it('con la nube andando, esos mismos controles dan bien', () => {
    const entrada = datos({ estadoNube: 'sincronizado' })
    const revision = revisionCompleta(auditar(entrada), true, undefined, entrada)
    const sync = revision.filter((c) => c.modulo === 'sistema')
    expect(sync.every((c) => c.estado === 'bien')).toBe(true)
  })

  it('sin pasarle los datos no inventa: los da por buenos, como antes', () => {
    const revision = revisionCompleta(auditar(datos({ estadoNube: 'sin-configurar' })))
    expect(revision.filter((c) => c.estado === 'no-corrio').length).toBe(0)
  })
})

describe('visto bueno del dueño sobre las diferencias de caja', () => {
  const arqueo = (total: number) => ({ billetes: { '1000': total / 1000 }, monedas: 0 })

  const cierre = (fecha: string, sobra: number, autorizado = false): Jornada => ({
    id: fecha,
    fecha,
    turno: 'M',
    estado: 'cerrado',
    cajaInicial: 10000,
    arqueoApertura: arqueo(10000),
    // Sin ventas ni movimientos, lo esperado es la caja inicial.
    arqueoCierre: arqueo(10000 + sobra),
    notas: null,
    vendedor: null,
    horaApertura: null,
    horaCierre: null,
    cierreAutorizado: autorizado
      ? { por: 'e@x.com', porNombre: 'Emma', cuando: Date.now(), comentario: null }
      : null,
  })

  it('una diferencia sin revisar se reclama, con su monto', () => {
    const h = buscar(
      auditar(datos({ jornadas: [cierre('2026-08-05', 3000)] })),
      'caja-cierres-sin-visto-bueno',
    )
    expect(h?.cantidad).toBe(1)
    expect(h?.monto).toBe(3000)
  })

  it('con el visto bueno dado deja de reclamarse', () => {
    const hallazgos = auditar(datos({ jornadas: [cierre('2026-08-05', 3000, true)] }))
    expect(hallazgos.map((h) => h.id)).not.toContain('caja-cierres-sin-visto-bueno')
  })

  it('la diferencia autorizada sigue figurando en el resumen del mes', () => {
    // El visto bueno no borra la diferencia: la deja con dueño.
    const h = buscar(
      auditar(datos({ jornadas: [cierre('2026-08-05', 3000, true)] })),
      'caja-diferencias',
    )
    expect(h?.cantidad).toBe(1)
  })

  it('un cierre que dio justo no necesita visto bueno de nadie', () => {
    const hallazgos = auditar(datos({ jornadas: [cierre('2026-08-05', 0)] }))
    expect(hallazgos.map((h) => h.id)).not.toContain('caja-cierres-sin-visto-bueno')
    expect(hallazgos.map((h) => h.id)).not.toContain('caja-diferencias')
  })

  it('solo lo ve un dueño: no es algo que el empleado pueda resolver', () => {
    const todos = auditar(datos({ jornadas: [cierre('2026-08-05', 3000)] }))
    const deEmpleado = hallazgosVisibles(todos, false, ['caja'])
    expect(deEmpleado.map((h) => h.id)).not.toContain('caja-cierres-sin-visto-bueno')
  })
})

describe('sistema: un dispositivo que se quedo atras', () => {
  it('no avisa nada si sincronizo hoy', () => {
    expect(buscar(auditar(datos()), 'sistema-sync-atrasado')).toBeUndefined()
  })

  it('no avisa a los dos dias: puede ser un franco', () => {
    const hallazgos = auditar(datos({ ultimaSync: Date.parse('2026-08-09T12:00:00') }))
    expect(buscar(hallazgos, 'sistema-sync-atrasado')).toBeUndefined()
  })

  it('avisa a los tres dias, con cuantos son', () => {
    const hallazgos = auditar(datos({ ultimaSync: Date.parse('2026-08-08T12:00:00') }))
    const aviso = buscar(hallazgos, 'sistema-sync-atrasado')
    expect(aviso?.titulo).toContain('3 días')
  })

  it('aclara que los datos no se pierden', () => {
    const hallazgos = auditar(datos({ ultimaSync: Date.parse('2026-07-20T12:00:00') }))
    expect(buscar(hallazgos, 'sistema-sync-atrasado')?.detalle).toContain('no se pierden')
  })

  it('no avisa si el dispositivo nunca sincronizo: no hay con que comparar', () => {
    const hallazgos = auditar(datos({ ultimaSync: null }))
    expect(buscar(hallazgos, 'sistema-sync-atrasado')).toBeUndefined()
  })

  it('no avisa si la nube ni siquiera esta configurada', () => {
    const hallazgos = auditar(
      datos({ estadoNube: 'sin-configurar', ultimaSync: Date.parse('2026-01-01T12:00:00') }),
    )
    expect(buscar(hallazgos, 'sistema-sync-atrasado')).toBeUndefined()
  })

  it('el aviso lo ve tambien un empleado: el celular es el suyo', () => {
    const hallazgos = auditar(datos({ ultimaSync: Date.parse('2026-08-01T12:00:00') }))
    const aviso = buscar(hallazgos, 'sistema-sync-atrasado')
    expect(aviso?.soloOwner).toBeFalsy()
  })
})
