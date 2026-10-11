import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  conMotivo,
  db,
  engancharAutor,
  historialAlDia,
  ID_ARRANQUE_HISTORIAL,
  marcarArranqueDelHistorial,
  nuevoId,
  type EntradaHistorial,
  type Producto,
} from './db'

/**
 * El historial de modificaciones, probado contra una IndexedDB de verdad
 * (fake-indexeddb) y no contra una maqueta.
 *
 * Por que no alcanza con probar funciones puras: los ganchos de Dexie
 * dependen de correr dentro de una transaccion, y ahi estaba el bug que
 * dejo la tabla dos meses con cero registros sin que nadie se enterara.
 */

function producto(parcial: Partial<Producto> = {}): Producto {
  return {
    codigo: 'TM015',
    descripcion: 'MATE IMPERIAL VIROLA ALPACA',
    proveedor: null,
    proveedorId: null,
    fechaCompra: null,
    precioCompra: 20000,
    rentabilidad: 1.3,
    precioVenta: 45000,
    fechaPrecioVenta: null,
    busqueda: 'tm015 mate imperial virola alpaca',
    stock: 3,
    activo: true,
    ...parcial,
  }
}

function jornada(parcial: Record<string, unknown> = {}) {
  return {
    id: 'j1',
    fecha: '2026-10-11',
    turno: 'M' as const,
    estado: 'abierto' as const,
    vendedor: 'Gabriela',
    cajaInicial: 10000,
    horaApertura: '09:00',
    horaCierre: null,
    arqueoApertura: null,
    arqueoCierre: null,
    notas: null,
    ...parcial,
  }
}

/**
 * Espera a que terminen de aterrizar los renglones pendientes.
 *
 * El historial se escribe a proposito DESPUES de que la transaccion que
 * lo genero haya commiteado (ver anotarEnHistorial), asi que entre la
 * edicion y el renglon hay un salto de cola de tareas. Sin esperarlo,
 * las pruebas se leen la tabla antes de que llegue el renglon --y lo
 * peor, el renglon de una prueba aterriza despues del clear() de la
 * siguiente y la ensucia--. Las primeras corridas fallaban distinto
 * cada vez por esto.
 */
async function esperarRenglones(): Promise<void> {
  await historialAlDia()
}

/**
 * Deja la tabla vacia de verdad.
 *
 * Un clear() solo no alcanza: el renglon que quedo en el aire de la
 * prueba anterior aterriza DESPUES, y la prueba siguiente arranca con
 * basura. Y esperar un rato tampoco alcanza, porque el bulkAdd en si es
 * asincrono. Se limpia y se vuelve a mirar hasta que quede vacia.
 */
async function limpiarHistorial(): Promise<void> {
  for (let intento = 0; intento < 10; intento++) {
    await db.historial.clear()
    await esperarRenglones()
    if ((await db.historial.count()) === 0) return
  }
  throw new Error('el historial no se deja limpiar: algo sigue escribiendo')
}

/** Los renglones de una accion, para no mezclar el 'creo' con el 'edito'. */
async function renglones(accion?: EntradaHistorial['accion']): Promise<EntradaHistorial[]> {
  await esperarRenglones()
  const todos = await db.historial.orderBy('cuando').toArray()
  return accion ? todos.filter((h) => h.accion === accion) : todos
}

beforeEach(async () => {
  // Primero se deja aterrizar lo que quedo en el aire de la prueba
  // anterior, y recien despues se limpia. Al reves, se limpia y despues
  // cae el renglon viejo encima.
  await esperarRenglones()
  await Promise.all([
    db.productos.clear(),
    db.proveedores.clear(),
    db.jornadas.clear(),
    db.ventas.clear(),
  ])
  await limpiarHistorial()
  engancharAutor(() => ({
    email: 'ventas@elclubdelmate.com',
    nombre: 'Sandra',
    rol: 'encargado',
  }))
})

describe('ediciones', () => {
  it('anota el cambio con quien, con que rol, cuando, y los dos valores', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000 })

    const edits = await renglones('edito')
    expect(edits).toHaveLength(1)
    expect(edits[0]).toMatchObject({
      tabla: 'productos',
      clave: 'TM015',
      accion: 'edito',
      campo: 'precioVenta',
      valorAnterior: 45000,
      valorNuevo: 52000,
      quien: 'ventas@elclubdelmate.com',
      quienNombre: 'Sandra',
      quienRol: 'encargado',
    })
    expect(edits[0].cuando).toBeGreaterThan(0)
  })

  it('un renglon por cada campo que cambio, no uno por edicion', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000, precioCompra: 24000, stock: 7 })

    const campos = (await renglones('edito')).map((h) => h.campo).sort()
    expect(campos).toEqual(['precioCompra', 'precioVenta', 'stock'])
  })

  it('no anota si el valor no cambio de verdad', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 45000 })
    expect(await renglones('edito')).toHaveLength(0)
  })

  it('tampoco anota si un objeto cambio de instancia pero no de contenido', async () => {
    // El arqueo y el visto bueno son objetos. Comparandolos con === daria
    // "cambio" cada vez que la pantalla los vuelve a armar, y el
    // historial se llenaria de renglones que no dicen nada.
    await db.jornadas.add(jornada({ arqueoApertura: { billetes: { '1000': 10 }, monedas: 0 } }))
    await db.jornadas.update('j1', { arqueoApertura: { billetes: { '1000': 10 }, monedas: 0 } })
    expect(await renglones('edito')).toHaveLength(0)
  })

  it('guarda que ES el documento, para que el renglon se lea solo', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000 })
    expect((await renglones('edito'))[0].queEs).toBe('MATE IMPERIAL VIROLA ALPACA')
  })
})

describe('creaciones, cierres y borrados', () => {
  it('anota la creacion de cualquier entidad', async () => {
    await db.productos.add(producto())
    const creados = await renglones('creo')
    expect(creados).toHaveLength(1)
    expect(creados[0]).toMatchObject({ tabla: 'productos', clave: 'TM015', campo: null })
  })

  it('la apertura de un turno queda como creacion, y se lee en palabras', async () => {
    await db.jornadas.add(jornada({ turno: 'T', horaApertura: '14:00' }))
    expect((await renglones('creo'))[0].queEs).toBe('Turno del 2026-10-11 a la tarde')
  })

  it('el cierre de un turno queda como el estado cambiando', async () => {
    await db.jornadas.add(jornada())
    await db.jornadas.update('j1', { estado: 'cerrado' })

    const cierre = (await renglones('edito')).find((h) => h.campo === 'estado')
    expect(cierre).toBeDefined()
    expect(cierre!.valorAnterior).toBe('abierto')
    expect(cierre!.valorNuevo).toBe('cerrado')
  })

  it('la autorizacion de un cierre queda con el rol de quien firmo', async () => {
    await db.jornadas.add(jornada({ estado: 'cerrado', horaCierre: '14:00', cierreAutorizado: null }))
    await db.jornadas.update('j1', {
      cierreAutorizado: {
        por: 'ventas@elclubdelmate.com',
        porNombre: 'Sandra',
        porRol: 'encargado' as const,
        cuando: Date.now(),
        comentario: null,
      },
    })
    const firma = (await renglones('edito')).find((h) => h.campo === 'cierreAutorizado')
    expect(firma).toBeDefined()
    expect(firma!.quienRol).toBe('encargado')
  })

  it('archivar se marca distinto de una edicion cualquiera', async () => {
    await db.productos.add(producto())
    await db.productos.update('TM015', { archivado: true })
    const archivados = await renglones('archivo')
    expect(archivados).toHaveLength(1)
    expect(archivados[0].campo).toBe('archivado')
  })

  it('al borrar guarda el documento entero, que despues no se recupera', async () => {
    await db.ventas.add({
      id: 'v1',
      jornadaId: 'j1',
      fecha: '2026-10-11',
      hora: '10:00',
      codigo: 'TM015',
      descripcion: 'MATE IMPERIAL',
      cantidad: 1,
      precioUnitario: 45000,
      total: 45000,
      medioPago: 'EFECTIVO',
      costoUnitario: 20000,
      vendedor: 'Gabriela',
    })
    await db.ventas.delete('v1')

    const borrados = await renglones('borro')
    expect(borrados).toHaveLength(1)
    expect(borrados[0].queEs).toBe('Venta de MATE IMPERIAL')
    expect((borrados[0].valorAnterior as { total: number }).total).toBe(45000)
  })
})

describe('las otras entidades', () => {
  it('proveedores quedan cubiertos', async () => {
    await db.proveedores.add({
      id: 'p1',
      nombre: 'MOHICANO',
      contacto: null,
      notas: null,
      activo: true,
    })
    await db.proveedores.update('p1', { nombre: 'MOHICANO SRL' })

    const h = await renglones()
    expect(h.map((x) => x.tabla)).toEqual(['proveedores', 'proveedores'])
    expect(h[1].queEs).toBe('MOHICANO')
  })

  it('el historial no se registra a si mismo', async () => {
    // Un registro del registro no agrega nada y crece sin freno.
    await db.productos.add(producto())
    const antes = (await renglones()).length
    await db.historial.add({
      id: nuevoId(),
      tabla: 'productos',
      clave: 'X',
      accion: 'edito',
      queEs: 'X',
      campo: 'precioVenta',
      valorAnterior: 1,
      valorNuevo: 2,
      quien: 'a@b.com',
      quienNombre: 'A',
      quienRol: null,
      cuando: Date.now(),
      motivo: null,
    })
    expect((await renglones()).length).toBe(antes + 1)
  })
})

describe('el motivo, para que una importacion no parezca 800 ediciones sueltas', () => {
  it('queda pegado a cada renglon de la operacion', async () => {
    await db.productos.add(producto())
    await conMotivo('Importación Excel 11/10', async () => {
      await db.productos.update('TM015', { precioVenta: 52000, precioCompra: 24000 })
    })
    const edits = await renglones('edito')
    expect(edits).toHaveLength(2)
    expect(edits.every((h) => h.motivo === 'Importación Excel 11/10')).toBe(true)
  })

  it('una edicion a mano despues no se queda con el motivo pegado', async () => {
    await db.productos.add(producto())
    await conMotivo('Importación Excel 11/10', async () => {
      await db.productos.update('TM015', { precioVenta: 52000 })
    })
    await db.productos.update('TM015', { stock: 9 })

    const suelta = (await renglones('edito')).find((h) => h.campo === 'stock')
    expect(suelta!.motivo).toBeNull()
  })

  it('si la operacion falla, el motivo igual se despega', async () => {
    await db.productos.add(producto())
    await expect(
      conMotivo('Importación que explota', async () => {
        throw new Error('se cayo')
      }),
    ).rejects.toThrow('se cayo')

    await db.productos.update('TM015', { stock: 9 })
    const suelta = (await renglones('edito')).find((h) => h.campo === 'stock')
    expect(suelta!.motivo).toBeNull()
  })
})

describe('sin autor no se registra', () => {
  it('no se puede firmar un cambio sin saber quien lo hizo', async () => {
    engancharAutor(() => null)
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000 })
    expect(await renglones()).toHaveLength(0)
  })
})

describe('el renglon que dice desde cuando el historial registra', () => {
  it('queda con la fecha del arranque y se explica solo', async () => {
    await marcarArranqueDelHistorial()
    const marca = await db.historial.get(ID_ARRANQUE_HISTORIAL)
    expect(marca).toBeDefined()
    expect(marca!.valorAnterior).toContain('no hay registro')
    expect(new Date(marca!.cuando).toISOString().slice(0, 10)).toBe('2026-10-11')
  })

  it('no se duplica aunque lo escriban varios dispositivos', async () => {
    await marcarArranqueDelHistorial()
    await marcarArranqueDelHistorial()
    await marcarArranqueDelHistorial()
    expect(await db.historial.count()).toBe(1)
  })

  it('queda ordenado antes que cualquier cambio real', async () => {
    await marcarArranqueDelHistorial()
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 52000 })
    expect((await renglones())[0].id).toBe(ID_ARRANQUE_HISTORIAL)
  })
})

describe('aguante', () => {
  it('no pierde ninguna de varias ediciones seguidas', async () => {
    await db.productos.add(producto())
    for (const precio of [46000, 47000, 48000, 49000, 50000]) {
      await db.productos.update('TM015', { precioVenta: precio })
    }
    const edits = await renglones('edito')
    expect(edits).toHaveLength(5)
    // Se comparan los valores SIN exigir orden, a proposito. Cinco
    // ediciones seguidas caen en el mismo milisegundo y empatan en
    // `cuando`, asi que entre ellas el orden es arbitrario: exigirlo
    // hacia que la prueba fallara una de cada tres veces sin que nada
    // estuviera mal. Lo que importa es que no se pierda ninguna.
    expect(
      edits.map((h) => h.valorNuevo as number).sort((a, b) => a - b),
    ).toEqual([46000, 47000, 48000, 49000, 50000])
  })

  it('las ediciones separadas en el tiempo si quedan en orden', async () => {
    // Que es el caso que de verdad se mira en pantalla: como vino
    // cambiando el precio de un producto a lo largo de los meses.
    await db.productos.add(producto())
    await db.productos.update('TM015', { precioVenta: 46000 })
    await new Promise((listo) => setTimeout(listo, 5))
    await db.productos.update('TM015', { precioVenta: 47000 })

    const edits = await renglones('edito')
    expect(edits.map((h) => h.valorNuevo)).toEqual([46000, 47000])
  })

  it('registra igual dentro de una transaccion propia, como la importacion', async () => {
    await db.productos.bulkAdd([
      producto(),
      producto({ codigo: 'TM016', descripcion: 'OTRO MATE', precioVenta: 30000 }),
    ])
    await db.transaction('rw', db.productos, db.historial, async () => {
      await db.productos.update('TM015', { precioVenta: 52000 })
      await db.productos.update('TM016', { precioVenta: 33000 })
    })
    expect((await renglones('edito')).map((h) => h.clave).sort()).toEqual(['TM015', 'TM016'])
  })

  it('un id nuevo nunca repite el de otra entrada', () => {
    expect(new Set(Array.from({ length: 500 }, () => nuevoId())).size).toBe(500)
  })
})
