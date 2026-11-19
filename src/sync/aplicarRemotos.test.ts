import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, engancharAutor, engancharSync, historialAlDia, type Producto } from '../db/db'
import { aplicarCambiosRemotos, TANDA, type CambioRemoto } from './aplicarRemotos'

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
  // Primero se apagan la subida y el autor: vaciar las tablas con ellos
  // prendidos deja un borrado por fila en el historial.
  engancharSync(() => {})
  engancharAutor(() => null)
  await db.productos.clear()
  await db.jornadas.clear()
  await historialAlDia()
  await db.historial.clear()
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
    const fallos = await aplicarCambiosRemotos(
      'productos',
      [llega(prod('AAA001')), llega(malo, 'MMM001'), llega(prod('ZZZ001'))],
      nunca,
      nada,
    )
    expect((await db.productos.get('AAA001'))?.proveedor).toBe('MOHICANO')
    expect((await db.productos.get('ZZZ001'))?.proveedor).toBe('MOHICANO')
    expect(fallos).toHaveLength(1)
    expect(fallos[0].id).toBe('MMM001')
    expect(fallos[0].error).toMatch(/DataError|key/i)
  })

  it('un borrado de verdad borra, con la clave desescapada', async () => {
    await db.productos.put(prod('TM/01') as unknown as Producto)
    await aplicarCambiosRemotos('productos', [{ tipo: 'removed', id: 'TM%2F01', datos: null, pendiente: false }], nunca, nada)
    expect(await db.productos.get('TM/01')).toBeUndefined()
  })

  it('la reversion de un rechazo propio NO borra lo que se acaba de cargar', async () => {
    await db.productos.put(prod('A') as unknown as Producto)
    await aplicarCambiosRemotos('productos', [{ tipo: 'removed', id: 'A', datos: null, pendiente: false }], () => true, nada)
    expect(await db.productos.get('A')).toBeDefined()
  })

  it('el eco pendiente de un alta propia no se reescribe', async () => {
    await db.productos.put(prod('A', { precioVenta: 5000 }) as unknown as Producto)
    await aplicarCambiosRemotos(
      'productos',
      [{ ...llega(prod('A', { precioVenta: 4000 })), tipo: 'added', pendiente: true }],
      nunca,
      nada,
    )
    expect((await db.productos.get('A'))?.precioVenta).toBe(5000)
  })

  it('EL ECO PENDIENTE DE UNA EDICION SI: trae lo que otro cambio mientras este celular no tenia señal', async () => {
    // El celular de Gabriela: precio 45000 y la venta ya descontada.
    await db.productos.put(prod('A', { precioVenta: 45000, stock: 2 }) as unknown as Producto)
    // Firestore muestra el servidor (precio 50000) con lo nuestro encima
    // (stock 2), todavia sin confirmar.
    await aplicarCambiosRemotos(
      'productos',
      [{ ...llega(prod('A', { precioVenta: 50000, stock: 2 })), tipo: 'modified', pendiente: true }],
      nunca,
      nada,
    )
    const a = await db.productos.get('A')
    expect(a?.precioVenta).toBe(50000)
    expect(a?.stock).toBe(2)
  })

  it('avisa que llego el dato bueno, para olvidar el rechazo', async () => {
    const recibidos: string[] = []
    await aplicarCambiosRemotos('productos', [llega(prod('A'))], nunca, (id) => recibidos.push(id))
    expect(recibidos).toEqual(['A'])
  })

  /**
   * En tandas (19/11). Al abrir la app llega cada tabla entera; de a un
   * documento por transaccion eran miles de transacciones y varios
   * segundos. Ahora van de a TANDA documentos por transaccion.
   */
  describe('lo que baja se guarda en tandas', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    const muchos = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...llega(prod(`P${String(i).padStart(4, '0')}`)), tipo: 'added' as const }))

    it('una transacción por tanda, no una por documento', async () => {
      const transacciones = vi.spyOn(db, 'transaction')
      const fallos = await aplicarCambiosRemotos('productos', muchos(TANDA * 2 + 1), nunca, nada)
      expect(fallos).toEqual([])
      expect(transacciones).toHaveBeenCalledTimes(3)
      expect(await db.productos.count()).toBe(TANDA * 2 + 1)
    })

    it('uno malo en el medio de una tanda no la tira abajo: se anota y el resto de la tanda queda', async () => {
      const transacciones = vi.spyOn(db, 'transaction')
      const { codigo: _sinCodigo, ...malo } = prod('MALO')
      const cambios = [...muchos(5), llega(malo, 'MALO'), ...muchos(10).slice(5)]
      const fallos = await aplicarCambiosRemotos('productos', cambios, nunca, nada)
      expect(fallos.map((f) => f.id)).toEqual(['MALO'])
      expect(await db.productos.count()).toBe(10)
      // Sin volver a intentar de a uno: la tanda cerró bien.
      expect(transacciones).toHaveBeenCalledTimes(1)
    })

    it('si la tanda entera no se puede guardar, se guarda de a uno como siempre', async () => {
      // La transaccion de la tanda se cae (lo corta el navegador, o uno
      // malo la tira abajo): no puede perderse la tanda.
      const original = db.transaction.bind(db) as (...a: unknown[]) => Promise<unknown>
      let primera = true
      vi.spyOn(db, 'transaction').mockImplementation(((...a: unknown[]) => {
        if (primera) {
          primera = false
          return Promise.reject(new Error('se cortó la transacción'))
        }
        return original(...a)
      }) as never)
      const { codigo: _sinCodigo, ...malo } = prod('MALO')
      const fallos = await aplicarCambiosRemotos('productos', [...muchos(3), llega(malo, 'MALO')], nunca, nada)
      expect(fallos.map((f) => f.id)).toEqual(['MALO'])
      expect((await db.productos.toArray()).map((p) => p.codigo)).toEqual(['P0000', 'P0001', 'P0002'])
    })

    it('dentro de una tanda se respeta el orden: lo último que llegó de una fila es lo que queda', async () => {
      await aplicarCambiosRemotos(
        'productos',
        [
          { ...llega(prod('A', { precioVenta: 1000 })), tipo: 'added' },
          llega(prod('A', { precioVenta: 2000 })),
          { ...llega(prod('B')), tipo: 'added' },
          { tipo: 'removed', id: 'B', datos: null, pendiente: false },
          llega(prod('A', { precioVenta: 3000 })),
        ],
        nunca,
        nada,
      )
      expect((await db.productos.get('A'))?.precioVenta).toBe(3000)
      expect(await db.productos.get('B')).toBeUndefined()
    })
  })

  /**
   * El hueco del 19/11.
   *
   * Hasta ese dia todo el recorrido iba adentro de una marca global de
   * "esto es remoto", y mientras duraba --al abrir la app, la tabla
   * entera, documento por documento-- lo que la persona cargaba se
   * tomaba por remoto: no subia y no dejaba historial. Abrir la app y
   * abrir el turno enseguida dejaba el turno sin subir.
   */
  describe('lo que baja y lo que la persona carga MIENTRAS baja', () => {
    const MUCHOS = 1000

    function escuchar() {
      const subidos: string[] = []
      engancharSync((tabla, accion, clave) => {
        // El historial tambien sube; aca interesa lo demas.
        if (tabla !== 'historial') subidos.push(`${accion} ${tabla}/${clave}`)
      })
      engancharAutor(() => ({ email: 'sucursal@elclubdelmate.com', nombre: 'Gabriela', rol: 'empleado' }))
      return subidos
    }

    const turno = {
      id: 'j1', fecha: '2026-11-19', turno: 'M' as const, estado: 'abierto' as const, vendedor: 'Gabriela',
      cajaInicial: 10000, horaApertura: '09:00', horaCierre: null, arqueoApertura: null, arqueoCierre: null, notas: null,
    }

    it('lo que baja no vuelve a subir ni queda a nombre de nadie', async () => {
      const subidos = escuchar()
      await db.productos.put(prod('VIEJO') as unknown as Producto)
      await historialAlDia()
      await db.historial.clear()
      subidos.length = 0

      const fallos = await aplicarCambiosRemotos(
        'productos',
        [
          { ...llega(prod('NUEVO')), tipo: 'added' },
          llega(prod('VIEJO', { precioVenta: 9000 })),
          { tipo: 'removed', id: 'VIEJO', datos: null, pendiente: false },
        ],
        nunca,
        nada,
      )
      await historialAlDia()
      expect(fallos).toEqual([])
      expect(await db.productos.get('NUEVO')).toBeDefined()
      expect(await db.productos.get('VIEJO')).toBeUndefined()
      expect(subidos).toEqual([])
      expect(await db.historial.count()).toBe(0)
      // Y lo que bajo no queda firmado por quien tenia la app abierta.
      expect((await db.productos.get('NUEVO'))?.creadoPor).toBeUndefined()
    })

    it('ABRIR EL TURNO Y EDITAR MIENTRAS BAJA LA TABLA ENTERA: eso sí sube y queda a su nombre', async () => {
      const subidos = escuchar()
      await db.productos.put(prod('TM015', { precioVenta: 45000 }) as unknown as Producto)
      await historialAlDia()
      await db.historial.clear()
      subidos.length = 0

      // El primer snapshot al abrir la app: la tabla entera, de a uno.
      let termino = false
      const bajando = aplicarCambiosRemotos(
        'productos',
        Array.from({ length: MUCHOS }, (_, i) => ({ ...llega(prod(`P${String(i).padStart(4, '0')}`)), tipo: 'added' as const })),
        nunca,
        nada,
      ).then((fallos) => {
        termino = true
        return fallos
      })

      // Mientras tanto la persona no espera: abre el turno, cambia un
      // precio y borra un producto.
      await db.productos.put(prod('BORRAME') as unknown as Producto)
      await db.jornadas.add(turno)
      await db.productos.update('TM015', { precioVenta: 52000 })
      await db.productos.delete('BORRAME')
      // Si la bajada ya hubiera terminado, la prueba no probaria nada.
      expect(termino).toBe(false)

      expect(await bajando).toEqual([])
      await historialAlDia()

      // Lo suyo subio: las cuatro cosas, y nada mas.
      expect(subidos.sort()).toEqual([
        'actualizar productos/TM015',
        'borrar productos/BORRAME',
        'guardar jornadas/j1',
        'guardar productos/BORRAME',
      ])
      // Y quedo en el historial, a su nombre: ni un renglon de lo que bajo.
      const renglones = await db.historial.toArray()
      expect(renglones.map((r) => `${r.accion} ${r.tabla}/${r.clave}`).sort()).toEqual([
        'borro productos/BORRAME',
        'creo jornadas/j1',
        'creo productos/BORRAME',
        'edito productos/TM015',
      ])
      expect(new Set(renglones.map((r) => r.quienNombre))).toEqual(new Set(['Gabriela']))
      // Lo que bajo esta todo.
      expect(await db.productos.where('codigo').startsWith('P').count()).toBe(MUCHOS)
    })

    it('UN TICKET DE MUCHOS PRODUCTOS: el eco de lo primero que sube no tapa lo que viene atrás', async () => {
      // Cada escritura propia vuelve enseguida como eco por la escucha
      // (Firestore la muestra antes de que el servidor confirme). Con la
      // marca global, guardar ese eco dejaba "hay algo remoto en curso"
      // prendido hasta que terminara la operacion de la persona --el eco
      // espera a que se libere la tabla--, y lo que quedaba de la
      // operacion no se subia: un ticket, una limpieza, un cierre.
      const codigos = Array.from({ length: 30 }, (_, i) => `T${String(i).padStart(2, '0')}`)
      await db.productos.bulkPut(codigos.map((c) => prod(c, { stock: 5 }) as unknown as Producto))
      await historialAlDia()
      await db.historial.clear()

      const subidos: string[] = []
      const ecos: Promise<unknown>[] = []
      engancharAutor(() => ({ email: 'sucursal@elclubdelmate.com', nombre: 'Gabriela', rol: 'empleado' }))
      engancharSync((tabla, accion, clave, doc) => {
        if (tabla !== 'productos') return
        subidos.push(`${accion} ${clave}`)
        // El eco: lo mismo que se acaba de mandar, todavia sin confirmar.
        // Firestore lo entrega en otra vuelta (con un setTimeout), suelto
        // de la operacion que lo causo: aca se hace igual.
        ecos.push(
          new Promise((listo) => {
            setTimeout(() => {
              listo(
                aplicarCambiosRemotos(
                  'productos',
                  [{ tipo: 'modified', id: clave, datos: { ...prod(clave, { stock: 4 }), ...(doc as object) }, pendiente: true }],
                  nunca,
                  nada,
                ),
              )
            }, 0)
          }),
        )
      })

      // El ticket: se descuenta el stock de los treinta, en una sola operacion.
      await db.transaction('rw', db.productos, async () => {
        for (const c of codigos) await db.productos.update(c, { stock: 4 })
      })
      expect((await Promise.all(ecos)).flat()).toEqual([])
      await historialAlDia()

      expect(subidos).toEqual(codigos.map((c) => `actualizar ${c}`))
      expect((await db.historial.toArray()).filter((h) => h.accion === 'edito')).toHaveLength(30)
    })

    it('editar el MISMO producto que está bajando tampoco se pierde', async () => {
      const subidos = escuchar()
      await db.productos.put(prod('TM015', { precioVenta: 45000, stock: 3 }) as unknown as Producto)
      await historialAlDia()
      subidos.length = 0

      const bajando = aplicarCambiosRemotos(
        'productos',
        Array.from({ length: 50 }, (_, i) => llega(prod('TM015', { precioVenta: 45000, stock: 3, descripcion: `vuelta ${i}` }))),
        nunca,
        nada,
      )
      await db.productos.update('TM015', { stock: 2 })
      await bajando
      expect(subidos).toEqual(['actualizar productos/TM015'])
    })
  })
})
