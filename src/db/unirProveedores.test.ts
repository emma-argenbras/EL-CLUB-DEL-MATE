import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  asegurarProveedor,
  db,
  engancharAutor,
  historialAlDia,
  type MovimientoProveedor,
  type Producto,
  type Proveedor,
} from './db'
import {
  armarUnion,
  MOTIVO_FICHAS_VACIAS,
  MOTIVO_UNION,
  textoDeConfirmacionUnion,
  textoDeConfirmacionVacias,
  unirFichasVacias,
  unirProveedores,
} from './unirProveedores'

function prov(id: string, nombre: string, extra: Partial<Proveedor> = {}): Proveedor {
  return { id, nombre, contacto: null, notas: null, activo: true, ...extra }
}

function prod(codigo: string, proveedorId: string | null, nombre: string | null): Producto {
  return {
    codigo, descripcion: `Producto ${codigo}`, proveedor: nombre, proveedorId,
    fechaCompra: null, precioCompra: 100, rentabilidad: 1.3, precioVenta: 230,
    fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: null, activo: true,
  }
}

function mov(id: string, proveedorId: string, tipo: 'compra' | 'pago', monto: number): MovimientoProveedor {
  return {
    id, proveedorId, tipo, fecha: '2026-10-01', monto, medioPago: null, items: null, notas: null,
  } as MovimientoProveedor
}

beforeEach(async () => {
  await Promise.all([
    db.proveedores.clear(),
    db.productos.clear(),
    db.movimientosProveedor.clear(),
    db.borrados.clear(),
  ])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'ventas@elclubdelmate.com', nombre: 'Sandra', rol: 'encargado' }))
})

describe('armarUnion (la vista previa, que no toca nada)', () => {
  it('cuenta productos, compras, pagos y el saldo que pasa', () => {
    const v = armarUnion(
      prov('saldo', 'SALDO'),
      prov('saldos', 'SALDOS'),
      [prod('A', 'saldos', 'SALDOS'), prod('B', 'saldos', 'SALDOS'), prod('C', 'saldo', 'SALDO')],
      [mov('1', 'saldos', 'compra', 50000), mov('2', 'saldos', 'pago', 20000), mov('3', 'saldo', 'compra', 999)],
    )
    expect(v.productos).toBe(2)
    expect(v.compras).toBe(1)
    expect(v.pagos).toBe(1)
    expect(v.saldoQuePasa).toBe(30000)
  })

  it('el nombre absorbido queda como otro nombre', () => {
    const v = armarUnion(prov('a', 'VICTOR ESTEVANEZ'), prov('b', 'VICTOR ESTEBANEZ'), [], [])
    expect(v.aliasNuevos).toEqual(['VICTOR ESTEBANEZ'])
  })

  it('tambien se lleva los otros nombres que la absorbida ya tenia', () => {
    const v = armarUnion(
      prov('a', 'ARANDU'),
      prov('b', 'ARANDUPO', { alias: ['ARANDU PO'] }),
      [], [],
    )
    expect(v.aliasNuevos).toEqual(['ARANDUPO', 'ARANDU PO'])
  })

  it('no repite un nombre que la que queda ya tiene', () => {
    const v = armarUnion(
      prov('a', 'SALDO', { alias: ['SALDOS'] }),
      prov('b', 'SALDOS'),
      [], [],
    )
    expect(v.aliasNuevos).toEqual([])
  })

  it('dice que datos vacios se completan con los de la absorbida', () => {
    const v = armarUnion(
      prov('a', 'A', { contacto: '3454123456' }),
      prov('b', 'B', { contacto: '3454999999', notas: 'paga a 30 dias', ciudad: 'Concordia' }),
      [], [],
    )
    // el telefono NO, porque la que queda ya tiene uno
    expect(v.datosQueSeRescatan).toEqual(['las notas', 'la ciudad'])
  })
})

describe('textoDeConfirmacionUnion', () => {
  it('dice cuantos registros toca antes de hacerlo', () => {
    const v = armarUnion(
      prov('a', 'SALDO'), prov('b', 'SALDOS'),
      [prod('A', 'b', 'SALDOS')],
      [mov('1', 'b', 'compra', 100), mov('2', 'b', 'pago', 50)],
    )
    const t = textoDeConfirmacionUnion(v)
    expect(t).toContain('1 producto pasa')
    expect(t).toContain('1 compras y 1 pagos')
    expect(t).toContain('SALDOS')
    expect(t).toContain(MOTIVO_UNION)
  })
})

describe('unirProveedores', () => {
  async function sembrar() {
    await db.proveedores.bulkPut([prov('saldo', 'SALDO'), prov('saldos', 'SALDOS')])
    await db.productos.bulkPut([
      prod('A', 'saldos', 'SALDOS'),
      prod('B', 'saldos', 'SALDOS'),
      prod('C', 'saldo', 'SALDO'),
    ])
    await db.movimientosProveedor.bulkPut([
      mov('m1', 'saldos', 'compra', 50000),
      mov('m2', 'saldos', 'pago', 20000),
      mov('m3', 'saldo', 'compra', 999),
    ])
  }

  it('pasa los productos, con el nombre escrito tambien', async () => {
    await sembrar()
    expect(await unirProveedores('saldo', 'saldos')).toEqual({
      productosTocados: 2,
      movimientosTocados: 2,
    })
    const a = await db.productos.get('A')
    expect(a!.proveedorId).toBe('saldo')
    expect(a!.proveedor).toBe('SALDO')
  })

  it('PASA LAS COMPRAS Y LOS PAGOS: la plata no puede quedar colgada', async () => {
    await sembrar()
    await unirProveedores('saldo', 'saldos')
    const suyos = await db.movimientosProveedor.where('proveedorId').equals('saldo').toArray()
    expect(suyos.map((m) => m.id).sort()).toEqual(['m1', 'm2', 'm3'])
    expect(await db.movimientosProveedor.where('proveedorId').equals('saldos').count()).toBe(0)
  })

  it('borra la ficha absorbida y deja su nombre como otro nombre', async () => {
    await sembrar()
    await unirProveedores('saldo', 'saldos')
    expect(await db.proveedores.get('saldos')).toBeUndefined()
    expect((await db.proveedores.get('saldo'))!.alias).toEqual(['SALDOS'])
  })

  it('no toca los productos del que queda', async () => {
    await sembrar()
    await unirProveedores('saldo', 'saldos')
    const c = await db.productos.get('C')
    expect(c!.proveedorId).toBe('saldo')
    expect(c!.precioCompra).toBe(100)
  })

  it('rescata los datos que la que queda tenia vacios', async () => {
    await db.proveedores.bulkPut([
      prov('a', 'A MATEAR ALEJO'),
      prov('b', 'A MATEAR ALEJO', { contacto: '3454123456', ciudad: 'Concordia' }),
    ])
    await unirProveedores('a', 'b')
    const a = await db.proveedores.get('a')
    expect(a!.contacto).toBe('3454123456')
    expect(a!.ciudad).toBe('Concordia')
  })

  it('no pisa los datos que la que queda ya tenia', async () => {
    await db.proveedores.bulkPut([
      prov('a', 'A', { contacto: 'el bueno' }),
      prov('b', 'B', { contacto: 'el viejo' }),
    ])
    await unirProveedores('a', 'b')
    expect((await db.proveedores.get('a'))!.contacto).toBe('el bueno')
  })

  it('reactiva la ficha que queda si estaba inactiva y recibe productos', async () => {
    await db.proveedores.bulkPut([prov('a', 'A', { activo: false }), prov('b', 'B')])
    await db.productos.put(prod('A', 'b', 'B'))
    await unirProveedores('a', 'b')
    expect((await db.proveedores.get('a'))!.activo).toBe(true)
  })

  it('no se une consigo misma', async () => {
    await sembrar()
    expect(await unirProveedores('saldo', 'saldo')).toBe('es-la-misma')
    expect(await db.proveedores.count()).toBe(2)
  })

  it('si una ficha ya no esta, no hace nada a medias', async () => {
    await sembrar()
    expect(await unirProveedores('saldo', 'fantasma')).toBe('no-existe')
    expect(await db.productos.get('A')).toMatchObject({ proveedorId: 'saldos' })
    expect(await db.proveedores.count()).toBe(2)
  })

  it('queda en el historial con su motivo y con quien lo hizo', async () => {
    await sembrar()
    await unirProveedores('saldo', 'saldos')
    await historialAlDia()
    const renglones = await db.historial.toArray()
    const borrado = renglones.find((r) => r.tabla === 'proveedores' && r.accion === 'borro')
    expect(borrado).toBeDefined()
    expect(borrado!.motivo).toBe(MOTIVO_UNION)
    expect(borrado!.quienNombre).toBe('Sandra')
    expect(renglones.some((r) => r.tabla === 'productos' && r.motivo === MOTIVO_UNION)).toBe(true)
    expect(
      renglones.some((r) => r.tabla === 'movimientosProveedor' && r.motivo === MOTIVO_UNION),
    ).toBe(true)
  })
})

describe('la constancia de lo que se borra al unir (10/11)', () => {
  it('unir de a una deja la constancia de la ficha absorbida, con quién y el motivo', async () => {
    await db.proveedores.bulkPut([prov('saldo', 'SALDO'), prov('saldos', 'SALDOS')])
    await unirProveedores('saldo', 'saldos', 'ventas@elclubdelmate.com')
    expect(await db.borrados.get('proveedores/saldos')).toMatchObject({
      tabla: 'proveedores',
      clave: 'saldos',
      quien: 'ventas@elclubdelmate.com',
      motivo: MOTIVO_UNION,
    })
    expect(await db.borrados.get('proveedores/saldo')).toBeUndefined()
  })

  it('si se vuelve a crear un proveedor con ese id, la constancia se olvida', async () => {
    await db.proveedores.bulkPut([prov('prov-hugo', 'HUGO'), prov('hugo-viejo', 'HUGO VIEJO')])
    await unirProveedores('hugo-viejo', 'prov-hugo', null)
    expect(await db.borrados.get('proveedores/prov-hugo')).toBeDefined()
    // La que quedó se renombra, y alguien vuelve a escribir HUGO.
    await db.proveedores.update('hugo-viejo', { nombre: 'OTRO', alias: [] })
    expect(await asegurarProveedor('HUGO')).toBe('prov-hugo')
    expect(await db.borrados.get('proveedores/prov-hugo')).toBeUndefined()
  })
})

describe('unirFichasVacias (las repetidas de la importación)', () => {
  async function sembrar() {
    await db.proveedores.bulkPut([
      prov('hugo', 'HUGO'),
      prov('hugo-copia', 'HUGO', { contacto: '3456 123456', ciudad: 'Concordia', alias: ['HUGO MATES'] }),
      prov('ana', 'ANA', { contacto: '111' }),
      prov('ana-copia', 'ANA', { contacto: '999' }),
    ])
    await db.productos.bulkPut([prod('A', 'hugo', 'HUGO'), prod('B', 'ana', 'ANA')])
    await db.movimientosProveedor.bulkPut([mov('m1', 'ana', 'compra', 5000)])
  }
  const pares = [
    { idVacia: 'hugo-copia', idGemela: 'hugo' },
    { idVacia: 'ana-copia', idGemela: 'ana' },
  ]

  it('borra las vacías y deja todo lo demás donde estaba', async () => {
    await sembrar()
    const r = await unirFichasVacias(pares, 'emmanuelclubdelmate@gmail.com')
    expect(r).toEqual({ unidas: 2, salteadas: [] })
    expect((await db.proveedores.toArray()).map((p) => p.id).sort()).toEqual(['ana', 'hugo'])
    expect(await db.productos.get('A')).toMatchObject({ proveedorId: 'hugo' })
    expect(await db.movimientosProveedor.get('m1')).toMatchObject({ proveedorId: 'ana' })
  })

  it('la gemela se queda con los datos que tenía vacíos y con los otros nombres, sin pisar los suyos', async () => {
    await sembrar()
    await unirFichasVacias(pares, null)
    expect(await db.proveedores.get('hugo')).toMatchObject({
      contacto: '3456 123456',
      ciudad: 'Concordia',
      alias: ['HUGO MATES'],
    })
    expect((await db.proveedores.get('ana'))?.contacto).toBe('111')
  })

  it('deja la constancia de cada una y el motivo en el historial', async () => {
    await sembrar()
    await unirFichasVacias(pares, 'emmanuelclubdelmate@gmail.com')
    expect((await db.borrados.toArray()).map((b) => `${b.id}:${b.motivo}`).sort()).toEqual([
      `proveedores/ana-copia:${MOTIVO_FICHAS_VACIAS}`,
      `proveedores/hugo-copia:${MOTIVO_FICHAS_VACIAS}`,
    ])
    await historialAlDia()
    const borradas = (await db.historial.toArray()).filter((h) => h.tabla === 'proveedores' && h.accion === 'borro')
    expect(borradas.map((h) => h.motivo)).toEqual([MOTIVO_FICHAS_VACIAS, MOTIVO_FICHAS_VACIAS])
  })

  it('saltea la que cambió desde que se armó la lista, y dice por qué', async () => {
    await sembrar()
    await db.productos.put(prod('C', 'hugo-copia', 'HUGO')) // le cargaron un producto
    await db.proveedores.update('ana-copia', { nombre: 'ANA BELEN' }) // la renombraron
    const r = await unirFichasVacias([...pares, { idVacia: 'no-existe', idGemela: 'hugo' }], null)
    expect(r.unidas).toBe(0)
    expect(r.salteadas.map((x) => `${x.id}: ${x.porque}`)).toEqual([
      'hugo-copia: ahora tiene productos, compras o pagos',
      'ana-copia: ya no se llama igual que su gemela',
      'no-existe: ya no está',
    ])
    expect(await db.proveedores.count()).toBe(4)
    expect(await db.borrados.count()).toBe(0)
  })

  it('la pregunta dice cuántas, con un ejemplo, antes de tocar nada', () => {
    const texto = textoDeConfirmacionVacias([
      { vacia: prov('hugo-copia', 'HUGO'), gemela: { proveedor: prov('hugo', 'HUGO'), productos: 12 } },
      { vacia: prov('ana-copia', 'ANA'), gemela: { proveedor: prov('ana', 'ANA'), productos: 3 } },
    ])
    expect(texto).toContain('Vas a unir 2 fichas repetidas vacías')
    expect(texto).toContain('"HUGO" (sin productos, ni compras, ni pagos) dentro de "HUGO" (12 productos)')
    expect(texto).toContain(MOTIVO_FICHAS_VACIAS)
  })
})
