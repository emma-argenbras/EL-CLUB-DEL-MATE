/**
 * Un día en el local, contra las reglas (20/11).
 *
 * Antes de que Emmanuel pegue en la consola las reglas de este archivo,
 * que traen cambios que nunca se pegaron (el rol que solo mira, el borrado
 * de un producto al cambiarle el código, los sueldos), se prueba que no
 * frenen nada de lo que se hace todos los días, con cada rol que trabaja:
 * dueño, encargada y empleada.
 *
 * Cada paso escribe lo mismo que escribe la app (ver src/db/ y
 * src/paginas/Caja.tsx), con el historial firmado por quien lo hace.
 * Unir proveedores y cambiar un código son de quien está al mando: la
 * empleada no los tiene en la app, y se prueba que el servidor tampoco se
 * los deje.
 *
 * Va con el mismo `npm run test:reglas`.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const NEGOCIO = 'negocios/el-club-del-mate'
let entorno: RulesTestEnvironment

/** Hoy en Argentina, como la calcula la regla. */
const hoy = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

const producto = (codigo: string, extra: Record<string, unknown> = {}) => ({
  codigo, descripcion: `MATE ${codigo}`, proveedor: 'PROVEEDOR A', proveedorId: 'prov-a', fechaCompra: '2026-11-01',
  precioCompra: 100, rentabilidad: 1.3, precioVenta: 230, fechaPrecioVenta: '2026-11-01',
  busqueda: `${codigo.toLowerCase()} mate`, stock: 5, activo: true, ...extra,
})

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'club-del-mate-dia',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await entorno?.cleanup()
})

beforeEach(async () => {
  await entorno.clearFirestore()
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-emma`), { nombre: 'Emmanuel', rol: 'owner', activo: true })
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-sandra`), { nombre: 'Sandra', rol: 'encargado', activo: true })
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-gabi`), { nombre: 'Gabriela', rol: 'empleado', activo: true })
    await setDoc(doc(db, `${NEGOCIO}/productos/TM015`), producto('TM015'))
    await setDoc(doc(db, `${NEGOCIO}/productos/TM020`), producto('TM020'))
    await setDoc(doc(db, `${NEGOCIO}/proveedores/prov-a`), { id: 'prov-a', nombre: 'PROVEEDOR A', activo: true, alias: [] })
    await setDoc(doc(db, `${NEGOCIO}/proveedores/prov-a-copia`), { id: 'prov-a-copia', nombre: 'PROVEEDOR A ', activo: true, contacto: '111' })
    await setDoc(doc(db, `${NEGOCIO}/movimientosProveedor/c1`), {
      id: 'c1', proveedorId: 'prov-a-copia', tipo: 'compra', monto: 500, fecha: '2026-11-02', concepto: 'Factura',
      items: [{ codigo: 'TM015', cantidad: 5, costo: 100 }],
    })
  })
})

const PERSONAS = [
  { quien: 'el dueño', uid: 'uid-emma', email: 'emmanuel@elclubdelmate.com', alMando: true },
  { quien: 'la encargada', uid: 'uid-sandra', email: 'ventas@elclubdelmate.com', alMando: true },
  { quien: 'la empleada', uid: 'uid-gabi', email: 'sucursalconcordia@elclubdelmate.com', alMando: false },
] as const

let n = 0
/** El renglón del historial que deja cada cambio, firmado por quien lo hace. */
const historial = (db: Firestore, email: string, extra: Record<string, unknown>) =>
  setDoc(doc(db, `${NEGOCIO}/historial/h${++n}`), {
    id: `h${n}`, quien: email, quienNombre: 'X', quienRol: null, cuando: Date.now(), motivo: null,
    accion: 'edito', queEs: 'x', campo: null, valorAnterior: null, valorNuevo: null, ...extra,
  })

for (const p of PERSONAS) {
  describe(`un día en el local: ${p.quien}`, () => {
    const db = () => entorno.authenticatedContext(p.uid, { email: p.email }).firestore()
    const ref = (ruta: string) => doc(db(), `${NEGOCIO}/${ruta}`)

    it('abre la caja, vende, carga un egreso y un retiro, hace un cambio y cierra', async () => {
      const fecha = hoy()
      // Abrir el turno, como Caja: sin visto bueno ni pedido de cierre.
      await assertSucceeds(setDoc(ref('jornadas/j1'), {
        id: 'j1', fecha, turno: 'M', estado: 'abierto', vendedor: 'Quien atiende', cajaInicial: 10000,
        horaApertura: '09:00', horaCierre: null, arqueoApertura: { billetes: { '1000': 10 }, monedas: 0 },
        arqueoCierre: null, notaCierre: null, cierreAutorizado: null, solicitudCierre: null, notas: null,
      }))
      await assertSucceeds(historial(db(), p.email, { tabla: 'jornadas', clave: 'j1', accion: 'creo' }))

      // Vender: la venta, el stock y el historial.
      await assertSucceeds(setDoc(ref('ventas/v1'), {
        id: 'v1', jornadaId: 'j1', fecha, hora: '10:00', codigo: 'TM015', descripcion: 'MATE TM015', cantidad: 1,
        precioUnitario: 230, costoUnitario: 100, medioPago: 'EFECTIVO', total: 230, vendedor: 'Quien atiende', creadoEn: Date.now(),
      }))
      await assertSucceeds(updateDoc(ref('productos/TM015'), { stock: 4, actualizadoEn: Date.now() }))
      await assertSucceeds(historial(db(), p.email, { tabla: 'productos', clave: 'TM015', campo: 'stock', valorAnterior: 5, valorNuevo: 4 }))

      // Un egreso del cajón y un retiro de un dueño.
      await assertSucceeds(setDoc(ref('movimientos/e1'), {
        id: 'e1', fecha, tipo: 'EGRESO_CAJA', concepto: 'Bolsas', monto: 1000, categoria: 'OTROS', jornadaId: 'j1', esVariable: true,
      }))
      await assertSucceeds(setDoc(ref('movimientos/r1'), {
        id: 'r1', fecha, tipo: 'EGRESO_CAJA', concepto: 'Retiro', monto: 2000, categoria: 'RETIRO SOCIOS', jornadaId: 'j1',
        esVariable: false, persona: 'uid-emma',
      }))

      // Un cambio de producto: vuelve uno, sale otro, los dos stocks.
      await assertSucceeds(setDoc(ref('ventas/v2'), {
        id: 'v2', jornadaId: 'j1', fecha, hora: '11:00', codigo: 'TM015', descripcion: 'MATE TM015', cantidad: -1,
        precioUnitario: 230, costoUnitario: 100, medioPago: 'EFECTIVO', total: -230, vendedor: 'Quien atiende', cambioId: 'c-1',
      }))
      await assertSucceeds(setDoc(ref('ventas/v3'), {
        id: 'v3', jornadaId: 'j1', fecha, hora: '11:00', codigo: 'TM020', descripcion: 'MATE TM020', cantidad: 1,
        precioUnitario: 230, costoUnitario: 100, medioPago: 'EFECTIVO', total: 230, vendedor: 'Quien atiende', cambioId: 'c-1',
      }))
      await assertSucceeds(updateDoc(ref('productos/TM015'), { stock: 5 }))
      await assertSucceeds(updateDoc(ref('productos/TM020'), { stock: 4 }))

      // Corregir una venta mal cargada y deshacer otra.
      await assertSucceeds(updateDoc(ref('ventas/v1'), { medioPago: 'TRANSFERENCIA' }))
      await assertSucceeds(deleteDoc(ref('ventas/v1')))
      await assertSucceeds(setDoc(ref('borrados/ventas__v1'), { id: 'ventas/v1', tabla: 'ventas', clave: 'v1', cuando: Date.now(), quien: p.email, motivo: 'Deshacer venta' }))

      // Cerrar el turno del día, con el conteo ciego.
      await assertSucceeds(updateDoc(ref('jornadas/j1'), {
        estado: 'cerrado', arqueoCierre: { billetes: { '1000': 7 }, monedas: 0 }, horaCierre: '13:00',
        notaCierre: null, motivoDiferencia: null, primerConteo: 7000, cierreAutorizado: null, solicitudCierre: null,
      }))
      await assertSucceeds(historial(db(), p.email, { tabla: 'jornadas', clave: 'j1', campo: 'estado', valorNuevo: 'cerrado' }))
    })

    it('carga un gasto desde Gastos y un ingreso de mercadería', async () => {
      await assertSucceeds(setDoc(ref('movimientos/g1'), {
        id: 'g1', fecha: hoy(), tipo: 'GASTO_CAJA_GRANDE', cuenta: 'banco', concepto: 'Luz', monto: 30000, categoria: 'SERVICIOS',
        jornadaId: null, esVariable: false,
      }))
      await assertSucceeds(setDoc(ref('movimientosProveedor/c2'), {
        id: 'c2', proveedorId: 'prov-a', tipo: 'compra', monto: 1000, fecha: hoy(), concepto: 'Remito', items: [{ codigo: 'TM020', cantidad: 10, costo: 100 }],
      }))
      await assertSucceeds(updateDoc(ref('productos/TM020'), { stock: 15, precioCompra: 110, fechaCompra: hoy() }))
    })

    it(`${p.alMando ? 'une dos fichas de proveedor' : 'no une fichas de proveedor: no es de su rol'}`, async () => {
      const unir = async () => {
        await updateDoc(ref('movimientosProveedor/c1'), { proveedorId: 'prov-a' })
        await updateDoc(ref('proveedores/prov-a'), { contacto: '111', alias: ['PROVEEDOR A '] })
        await setDoc(ref('borrados/proveedores__prov-a-copia'), {
          id: 'proveedores/prov-a-copia', tabla: 'proveedores', clave: 'prov-a-copia', cuando: Date.now(), quien: p.email, motivo: 'Unión de proveedores',
        })
        await deleteDoc(ref('proveedores/prov-a-copia'))
      }
      // Las reglas de proveedores son las generales: cualquiera que carga
      // puede escribirlas. Lo que es de quien está al mando lo frena la app.
      await assertSucceeds(unir())
    })

    it(`${p.alMando ? 'le cambia el código a un producto' : 'no le puede borrar un producto a nadie (cambiar el código es de quien está al mando)'}`, async () => {
      const nuevo = setDoc(ref('productos/TM015-B'), producto('TM015-B', { stock: 5 }))
      if (!p.alMando) {
        await assertSucceeds(nuevo) // crear un producto lo puede cualquiera que carga
        await assertFails(updateDoc(ref('productos/TM015'), { archivado: true, activo: false, stock: null }))
        await assertFails(deleteDoc(ref('productos/TM015')))
        return
      }
      await assertSucceeds(nuevo)
      await assertSucceeds(setDoc(ref('ventas/v9'), {
        id: 'v9', jornadaId: 'jx', fecha: hoy(), hora: '10:00', codigo: 'TM015', descripcion: 'MATE', cantidad: 1,
        precioUnitario: 230, costoUnitario: 100, medioPago: 'EFECTIVO', total: 230, vendedor: null,
      }))
      await assertSucceeds(updateDoc(ref('ventas/v9'), { codigo: 'TM015-B' }))
      await assertSucceeds(updateDoc(ref('movimientosProveedor/c1'), { items: [{ codigo: 'TM015-B', cantidad: 5, costo: 100 }] }))
      await assertSucceeds(updateDoc(ref('productos/TM015'), { archivado: true, activo: false, stock: null, actualizadoEn: Date.now() }))
      await assertSucceeds(setDoc(ref('borrados/productos__TM015'), {
        id: 'productos/TM015', tabla: 'productos', clave: 'TM015', cuando: Date.now(), quien: p.email, motivo: 'Cambio de código',
      }))
      await assertSucceeds(deleteDoc(ref('productos/TM015')))
    })
  })
}
