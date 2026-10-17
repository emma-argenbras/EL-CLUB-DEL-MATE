import { describe, expect, it } from 'vitest'
import { armarPlanProveedores } from './planProveedores'
import { idDeProveedor } from './idProveedor'
import type { Producto, Proveedor } from '../db/db'
import { normalizar } from './formato'

function prov(
  id: string,
  nombre: string,
  activo = true,
  creadoEn = 1,
  extra: Partial<Proveedor> = {},
): Proveedor {
  return { id, nombre, contacto: null, notas: null, activo, creadoEn, ...extra }
}

function prod(
  codigo: string,
  proveedorId: string | null,
  nombre: string | null,
  extra: Partial<Producto> = {},
): Producto {
  return {
    codigo,
    descripcion: codigo,
    proveedor: nombre,
    proveedorId,
    fechaCompra: null,
    precioCompra: null,
    rentabilidad: null,
    precioVenta: null,
    fechaPrecioVenta: null,
    busqueda: normalizar(codigo),
    stock: null,
    activo: true,
    ...extra,
  }
}

/** Varios productos iguales de un mismo proveedor, para no repetir. */
function varios(cuantos: number, prefijo: string, proveedorId: string, nombre: string, extra: Partial<Producto> = {}) {
  return Array.from({ length: cuantos }, (_, i) => prod(`${prefijo}${i}`, proveedorId, nombre, extra))
}

describe('paso 1: unificar y ponerle a cada ficha el id de su nombre', () => {
  it('junta las copias del mismo nombre en una sola ficha', () => {
    const plan = armarPlanProveedores(
      [prov('a', 'ABEL'), prov('b', 'ABEL'), prov('c', 'MOHICANO')],
      [prod('1', 'a', 'ABEL'), prod('2', 'a', 'ABEL'), prod('3', 'b', 'ABEL')],
    )
    const abel = plan.unificar.find((d) => d.id === idDeProveedor('ABEL'))!
    expect(abel.fichas).toHaveLength(2)
    expect(abel.sobrevive!.proveedor.id).toBe('a')
    expect(abel.productosFinales).toBe(3)
  })

  it('la ficha final se llama con el id derivado del nombre', () => {
    const plan = armarPlanProveedores([prov('id-aleatorio', 'MOHICANO')], [])
    expect(plan.unificar[0].id).toBe('prov-mohicano')
  })

  it('tambien entra la que no esta repetida pero tiene id aleatorio', () => {
    // Si se le dejara el id viejo, el dia que otro dispositivo (o la
    // importacion del Excel) derive el id del nombre, aparece una
    // segunda ficha y el lio vuelve a empezar.
    const plan = armarPlanProveedores([prov('uuid-suelto', 'GOMECITO')], [])
    expect(plan.unificar.map((d) => d.nombre)).toEqual(['GOMECITO'])
  })

  it('la que ya tiene el id correcto no se toca', () => {
    const plan = armarPlanProveedores([prov(idDeProveedor('GOMECITO'), 'GOMECITO')], [])
    expect(plan.unificar).toEqual([])
  })

  it('sobrevive el que mas productos tiene, no el primero', () => {
    const plan = armarPlanProveedores(
      [prov('pocos', 'ABEL'), prov('muchos', 'ABEL')],
      [...varios(2, 'm', 'muchos', 'ABEL'), prod('p1', 'pocos', 'ABEL')],
    )
    expect(plan.unificar[0].sobrevive!.proveedor.id).toBe('muchos')
  })

  it('a igualdad de productos sobrevive el mas viejo', () => {
    const plan = armarPlanProveedores(
      [prov('nuevo', 'ABEL', true, 2000), prov('viejo', 'ABEL', true, 1000)],
      [],
    )
    expect(plan.unificar[0].sobrevive!.proveedor.id).toBe('viejo')
  })

  it('junta aunque el nombre este escrito distinto', () => {
    const plan = armarPlanProveedores(
      [prov('a', 'ANGEL MALAGUEÑO'), prov('b', 'Angel  Malagueno ')],
      [],
    )
    expect(plan.unificar).toHaveLength(1)
    expect(plan.unificar[0].fichas).toHaveLength(2)
  })
})

describe('paso 3: crear uno solo por nombre', () => {
  it('tres ids perdidos del mismo nombre crean UNA ficha', () => {
    // Este era el error: agrupaba por id perdido y proponia crear
    // MOHICANO tres veces.
    const plan = armarPlanProveedores(
      [],
      [
        ...varios(5, 'a', 'id-celu-1', 'MOHICANO'),
        ...varios(3, 'b', 'id-celu-2', 'MOHICANO'),
        ...varios(2, 'c', 'id-celu-3', 'MOHICANO'),
      ],
    )
    expect(plan.crear).toHaveLength(1)
    expect(plan.crear[0].nombre).toBe('MOHICANO')
    expect(plan.crear[0].id).toBe('prov-mohicano')
    expect(plan.crear[0].productosFinales).toBe(10)
  })

  it('agrupa aunque el nombre venga con mayusculas y espacios distintos', () => {
    const plan = armarPlanProveedores(
      [],
      [prod('1', 'x', 'SALDOS'), prod('2', 'y', 'saldos '), prod('3', 'z', ' Saldos')],
    )
    expect(plan.crear).toHaveLength(1)
    expect(plan.crear[0].productosFinales).toBe(3)
  })

  it('las fichas nuevas nacen activas, asi que no van al paso 4', () => {
    const plan = armarPlanProveedores([], [prod('1', 'perdido', 'IRUPE BOMBILLAS')])
    expect(plan.crear[0].activo).toBe(true)
    expect(plan.reactivar).toEqual([])
  })

  it('si el nombre ya tiene ficha, no se crea: se reengancha', () => {
    const plan = armarPlanProveedores(
      [prov(idDeProveedor('MOHICANO'), 'MOHICANO')],
      [prod('1', 'id-de-otro-celular', 'MOHICANO')],
    )
    expect(plan.crear).toEqual([])
    expect(plan.reenganchar).toHaveLength(1)
    expect(plan.reenganchar[0].productosRecuperados).toBe(1)
  })

  it('un id perdido sin nombre no se puede resolver solo', () => {
    const plan = armarPlanProveedores([], [prod('1', 'huerfano-mudo', null)])
    expect(plan.crear).toEqual([])
    expect(plan.sinNombre).toHaveLength(1)
    expect(plan.sinNombre[0].productos).toBe(1)
  })
})

describe('paso 4: se calcula despues de simular los pasos 1 a 3', () => {
  it('reactiva al inactivo que recibe productos vigentes en el paso 2', () => {
    // El caso de ARIEL GARCIA: hoy su ficha figura sin productos
    // porque todos apuntan al id de otro celular. Mirando la foto de
    // hoy no haria falta reactivarlo; despues de reenganchar, si.
    const plan = armarPlanProveedores(
      [prov('ficha-vieja', 'ARIEL GARCIA', false)],
      varios(18, 'g', 'id-perdido-de-otro-celu', 'ARIEL GARCIA'),
    )
    expect(plan.reenganchar[0].productosRecuperados).toBe(18)
    expect(plan.reactivar.map((d) => d.nombre)).toEqual(['ARIEL GARCIA'])
    expect(plan.reactivar[0].vigentesFinales).toBe(18)
  })

  it('reactiva al inactivo que recibe productos al unificarse', () => {
    const plan = armarPlanProveedores(
      [prov('vacia', 'BARNECHE', false, 1), prov('llena', 'BARNECHE', false, 2)],
      varios(11, 'b', 'llena', 'BARNECHE'),
    )
    expect(plan.reactivar.map((d) => d.nombre)).toEqual(['BARNECHE'])
    expect(plan.reactivar[0].vigentesFinales).toBe(11)
  })

  it('no reactiva al que termina con todo descontinuado', () => {
    const plan = armarPlanProveedores(
      [prov('a', 'ABEL', false)],
      varios(5, 'a', 'a', 'ABEL', { descontinuado: true }),
    )
    expect(plan.reactivar).toEqual([])
  })

  it('no reactiva al que termina sin ningun producto', () => {
    const plan = armarPlanProveedores([prov('a', 'ABEL', false)], [])
    expect(plan.reactivar).toEqual([])
  })

  it('no propone reactivar al que ya esta activo', () => {
    const plan = armarPlanProveedores([prov('a', 'ABEL', true)], [prod('1', 'a', 'ABEL')])
    expect(plan.reactivar).toEqual([])
  })

  it('si de dos copias la que sobrevive esta activa, no hay que reactivar nada', () => {
    const plan = armarPlanProveedores(
      [prov('grande', 'ABEL', true), prov('chica', 'ABEL', false)],
      [...varios(5, 'g', 'grande', 'ABEL'), prod('c1', 'chica', 'ABEL')],
    )
    expect(plan.reactivar).toEqual([])
    expect(plan.unificar[0].activo).toBe(true)
  })
})

describe('los archivados no cuentan', () => {
  it('un producto archivado no suma', () => {
    const plan = armarPlanProveedores(
      [prov('a', 'ABEL')],
      [prod('1', 'a', 'ABEL', { archivado: true }), prod('2', 'a', 'ABEL')],
    )
    expect(plan.conUso[0].productos).toBe(1)
  })
})

describe('el panorama del 17/10', () => {
  it('no crea tres MOHICANO ni tres SALDOS, y reactiva lo que recibe productos', () => {
    const proveedores = [
      prov('moh-1', 'MOHICANO', false, 1),
      prov('moh-2', 'MOHICANO', false, 2),
      prov('ariel', 'ARIEL GARCIA', false, 3),
      prov('gom', 'GOMECITO', true, 4),
    ]
    const productos = [
      ...varios(40, 'm', 'moh-1', 'MOHICANO'),
      ...varios(1, 'm2', 'moh-2', 'MOHICANO'),
      // Tres ids perdidos del mismo nombre: una sola ficha nueva.
      ...varios(5, 's1', 'perdido-a', 'SALDOS'),
      ...varios(4, 's2', 'perdido-b', 'SALDOS'),
      ...varios(2, 's3', 'perdido-c', 'saldos'),
      // Inactivo que recibe productos vigentes recien en el paso 2.
      ...varios(18, 'ag', 'perdido-ariel', 'ARIEL GARCIA'),
      ...varios(3, 'g', 'gom', 'GOMECITO'),
      prod('sin', null, null),
    ]
    const plan = armarPlanProveedores(proveedores, productos)

    expect(plan.crear.map((d) => d.nombre)).toEqual(['SALDOS'])
    expect(plan.crear[0].productosFinales).toBe(11)
    // Ordenados por cuantos productos vigentes quedan, no alfabetico:
    // en la pantalla interesa primero el que mas pesa.
    expect(plan.reactivar.map((d) => d.nombre)).toEqual(['MOHICANO', 'ARIEL GARCIA'])
    expect(plan.reactivar.map((d) => d.vigentesFinales)).toEqual([41, 18])
    expect(plan.unificar.find((d) => d.nombre === 'MOHICANO')!.fichas).toHaveLength(2)
    expect(plan.sinProveedor).toBe(1)
    // Cuatro fichas hoy, cuatro al final: MOHICANO, ARIEL GARCIA,
    // GOMECITO y la de SALDOS que se crea.
    expect(plan.fichasFinales).toBe(4)
  })
})

describe('alias: el mismo proveedor escrito distinto', () => {
  it('ARANDU se queda con los productos de ARANDUPO', () => {
    // El caso real: dos fichas que el nombre normalizado no junta
    // --la "O" con acento no es la misma letra-- y que son el mismo
    // proveedor. Se resuelve cargando el alias, no tocando codigo.
    const plan = armarPlanProveedores(
      [
        prov('uuid-arandu', 'ARANDU', true, 1, { alias: ['ARANDUPÒ'] }),
        prov('uuid-arandupo', 'ARANDUPÒ', true, 2),
      ],
      [
        ...varios(10, 'a', 'uuid-arandu', 'ARANDU'),
        ...varios(3, 'p', 'uuid-arandupo', 'ARANDUPÒ'),
      ],
    )
    expect(plan.fichasFinales).toBe(1)
    const arandu = plan.unificar[0]
    expect(arandu.id).toBe('prov-arandu')
    expect(arandu.nombre).toBe('ARANDU')
    expect(arandu.productosFinales).toBe(13)
    expect(arandu.activo).toBe(true)
  })

  it('sin el alias quedan dos fichas', () => {
    // La contraparte: esto es lo que pasa hoy, y es por lo que la
    // pantalla mostraba 67 en vez de 66.
    const plan = armarPlanProveedores(
      [prov('uuid-arandu', 'ARANDU'), prov('uuid-arandupo', 'ARANDUPÒ')],
      [],
    )
    expect(plan.fichasFinales).toBe(2)
  })

  it('el nombre de la absorbida queda como alias de la que sobrevive', () => {
    // Para que la importacion del Excel no la vuelva a crear cuando
    // lea "ARANDUPO" en la planilla.
    const plan = armarPlanProveedores(
      [
        prov('uuid-arandu', 'ARANDU', true, 1, { alias: ['ARANDUPÒ'] }),
        prov('uuid-arandupo', 'ARANDUPÒ', true, 2),
      ],
      [],
    )
    expect(plan.unificar[0].alias).toContain('ARANDUPÒ')
  })

  it('un id perdido con el nombre del alias tambien cae en la ficha buena', () => {
    const plan = armarPlanProveedores(
      [prov('uuid-arandu', 'ARANDU', true, 1, { alias: ['ARANDUPÒ'] })],
      varios(3, 'p', 'id-perdido', 'ARANDUPÒ'),
    )
    expect(plan.crear).toEqual([])
    expect(plan.reenganchar[0].id).toBe('prov-arandu')
    expect(plan.reenganchar[0].productosRecuperados).toBe(3)
  })

  it('un alias que apunta a si mismo no hace nada raro', () => {
    const plan = armarPlanProveedores([prov('uuid-x', 'ARANDU', true, 1, { alias: ['arandu'] })], [])
    expect(plan.fichasFinales).toBe(1)
    expect(plan.unificar[0].id).toBe('prov-arandu')
  })
})

describe('el contacto y las notas no se pierden al unificar', () => {
  it('rescata el contacto de la absorbida cuando la que queda no tiene', () => {
    const plan = armarPlanProveedores(
      [
        prov('grande', 'ABEL', true, 1),
        prov('chica', 'ABEL', true, 2, { contacto: '345 4123456', notas: 'Entrega los martes' }),
      ],
      varios(5, 'g', 'grande', 'ABEL'),
    )
    expect(plan.unificar[0].contacto).toBe('345 4123456')
    expect(plan.unificar[0].notas).toBe('Entrega los martes')
    expect(plan.unificar[0].rescataDatos).toBe(true)
  })

  it('si la que queda ya tiene contacto, ese manda', () => {
    const plan = armarPlanProveedores(
      [
        prov('grande', 'ABEL', true, 1, { contacto: 'el bueno' }),
        prov('chica', 'ABEL', true, 2, { contacto: 'el viejo' }),
      ],
      varios(5, 'g', 'grande', 'ABEL'),
    )
    expect(plan.unificar[0].contacto).toBe('el bueno')
    expect(plan.unificar[0].rescataDatos).toBe(false)
  })

  it('un contacto en blanco no cuenta como contacto', () => {
    const plan = armarPlanProveedores(
      [
        prov('grande', 'ABEL', true, 1, { contacto: '   ' }),
        prov('chica', 'ABEL', true, 2, { contacto: '345 4123456' }),
      ],
      varios(5, 'g', 'grande', 'ABEL'),
    )
    expect(plan.unificar[0].contacto).toBe('345 4123456')
  })
})
