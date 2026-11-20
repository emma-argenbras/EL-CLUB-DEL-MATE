/**
 * Pruebas de las reglas para un dueño que entra solo a mirar (20/11), y
 * del fundador.
 *
 * La promesa es que mira el Panel y los Reportes sin cargar, editar ni
 * borrar nada, ni desde la app ni pidiéndoselo directo al servidor. La
 * pantalla se puede esquivar; la regla no. Lo que se prueba acá es que
 * el servidor le diga que no a cada escritura, en cada colección, y que
 * a los demás no les cambió nada.
 *
 * Van en un archivo aparte de reglas.test.ts, con el mismo `npm run
 * test:reglas`.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const NEGOCIO = 'negocios/el-club-del-mate'
let entorno: RulesTestEnvironment

const PRODUCTO = {
  codigo: 'TM015', descripcion: 'MATE', proveedor: null, proveedorId: null, fechaCompra: null,
  precioCompra: 100, rentabilidad: 1.3, precioVenta: 230, fechaPrecioVenta: null, busqueda: 'tm015 mate',
  stock: 3, activo: true,
}
const JORNADA = {
  id: 'j1', fecha: '2026-11-03', turno: 'M', estado: 'cerrado', vendedor: 'Gabriela', cajaInicial: 1000,
  horaApertura: '09:00', horaCierre: '13:00', arqueoApertura: null, arqueoCierre: null, cierreAutorizado: null,
  solicitudCierre: null, notas: null,
}
const VENTA = {
  id: 'v1', jornadaId: 'j1', fecha: '2026-11-03', hora: '10:00', codigo: 'TM015', descripcion: 'MATE',
  cantidad: 1, precioUnitario: 230, costoUnitario: 100, medioPago: 'EFECTIVO', total: 230, vendedor: 'Gabriela',
}
const RETIRO = {
  id: 'm1', fecha: '2026-11-03', tipo: 'GASTO_CAJA_GRANDE', concepto: 'Retiro', monto: 10, categoria: 'RETIRO SOCIOS',
  jornadaId: null, esVariable: false, persona: 'uid-elena',
}

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'club-del-mate-socio',
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
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-elena`), { nombre: 'Elena', rol: 'socio', activo: true })
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-raro`), { nombre: 'Rol raro', rol: 'duenio', activo: true })
    await setDoc(doc(db, `${NEGOCIO}/productos/TM015`), PRODUCTO)
    await setDoc(doc(db, `${NEGOCIO}/jornadas/j1`), JORNADA)
    await setDoc(doc(db, `${NEGOCIO}/ventas/v1`), VENTA)
    await setDoc(doc(db, `${NEGOCIO}/movimientos/m1`), RETIRO)
    await setDoc(doc(db, `${NEGOCIO}/proveedores/p1`), { id: 'p1', nombre: 'PROVEEDOR', activo: true })
    await setDoc(doc(db, `${NEGOCIO}/historial/h1`), { id: 'h1', quien: 'emmanuel@elclubdelmate.com' })
    await setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { id: 'uid-gabi', acuerdos: [], forma: 2 })
  })
})

const como = (uid: string, email: string) => entorno.authenticatedContext(uid, { email }).firestore()
const comoElena = () => como('uid-elena', 'elena@prueba.test')
const comoEmma = () => como('uid-emma', 'emmanuel@elclubdelmate.com')
const comoSandra = () => como('uid-sandra', 'ventas@elclubdelmate.com')
const comoGabi = () => como('uid-gabi', 'sucursalconcordia@elclubdelmate.com')
const ref = (db: ReturnType<typeof comoElena>, ruta: string) => doc(db, `${NEGOCIO}/${ruta}`)

describe('un dueño que solo mira: lee lo del Panel y los Reportes', () => {
  it('lee turnos, ventas, gastos, productos, proveedores, usuarios y el historial', async () => {
    const db = comoElena()
    for (const ruta of ['jornadas/j1', 'ventas/v1', 'movimientos/m1', 'productos/TM015', 'proveedores/p1', 'usuarios/uid-gabi', 'historial/h1']) {
      await assertSucceeds(getDoc(ref(db, ruta)))
    }
  })

  it('no lee lo acordado con nadie: los sueldos no son del Panel ni de los Reportes', async () => {
    await assertFails(getDoc(ref(comoElena(), 'sueldos/uid-gabi')))
  })
})

describe('un dueño que solo mira: el servidor no le deja escribir nada', () => {
  it('ni una venta, ni un turno, ni un gasto', async () => {
    const db = comoElena()
    await assertFails(setDoc(ref(db, 'ventas/v2'), { ...VENTA, id: 'v2' }))
    await assertFails(updateDoc(ref(db, 'ventas/v1'), { cantidad: 2 }))
    await assertFails(deleteDoc(ref(db, 'ventas/v1')))
    await assertFails(setDoc(ref(db, 'jornadas/j2'), { ...JORNADA, id: 'j2', fecha: '2026-11-04' }))
    await assertFails(updateDoc(ref(db, 'jornadas/j1'), { notas: 'x' }))
    await assertFails(deleteDoc(ref(db, 'jornadas/j1')))
    await assertFails(setDoc(ref(db, 'movimientos/m2'), { ...RETIRO, id: 'm2' }))
    await assertFails(updateDoc(ref(db, 'movimientos/m1'), { monto: 1 }))
    await assertFails(deleteDoc(ref(db, 'movimientos/m1')))
  })

  it('ni un producto, ni un proveedor, ni el historial, ni las constancias', async () => {
    const db = comoElena()
    await assertFails(setDoc(ref(db, 'productos/NUEVO'), { ...PRODUCTO, codigo: 'NUEVO' }))
    await assertFails(updateDoc(ref(db, 'productos/TM015'), { stock: 2 }))
    await assertFails(deleteDoc(ref(db, 'productos/TM015')))
    await assertFails(setDoc(ref(db, 'proveedores/p2'), { id: 'p2', nombre: 'OTRO', activo: true }))
    await assertFails(updateDoc(ref(db, 'proveedores/p1'), { contacto: '1' }))
    await assertFails(setDoc(ref(db, 'historial/h2'), { id: 'h2', quien: 'elena@prueba.test' }))
    await assertFails(setDoc(ref(db, 'historialProductos/h2'), { id: 'h2', quien: 'elena@prueba.test' }))
    await assertFails(setDoc(ref(db, 'borrados/ventas%2Fv1'), { id: 'ventas/v1' }))
    await assertFails(setDoc(ref(db, 'rechazos/r1'), { id: 'r1' }))
    await assertFails(setDoc(ref(db, 'vencimientos/x'), { id: 'x' }))
  })

  it('ni su propio perfil: no se hace dueño completo ni toca a nadie', async () => {
    const db = comoElena()
    await assertFails(updateDoc(ref(db, 'usuarios/uid-elena'), { rol: 'owner' }))
    await assertFails(updateDoc(ref(db, 'usuarios/uid-gabi'), { activo: false }))
    await assertFails(setDoc(ref(db, 'usuarios/uid-nuevo'), { nombre: 'X', rol: 'empleado', activo: true }))
    await assertFails(setDoc(ref(db, 'sueldos/uid-gabi'), { id: 'uid-gabi', acuerdos: [], forma: 2 }))
  })

  it('un rol que no está en la lista tampoco escribe: va por lista, no por excepción', async () => {
    const db = como('uid-raro', 'raro@prueba.test')
    await assertSucceeds(getDoc(ref(db, 'ventas/v1')))
    await assertFails(setDoc(ref(db, 'ventas/v2'), { ...VENTA, id: 'v2' }))
    await assertFails(updateDoc(ref(db, 'productos/TM015'), { stock: 2 }))
  })
})

describe('a los demás no les cambió nada', () => {
  it('la empleada vende, abre su turno y carga un egreso', async () => {
    const db = comoGabi()
    await assertSucceeds(setDoc(ref(db, 'ventas/v2'), { ...VENTA, id: 'v2' }))
    await assertSucceeds(setDoc(ref(db, 'jornadas/j2'), { ...JORNADA, id: 'j2', fecha: '2026-11-04', estado: 'abierto' }))
    await assertSucceeds(setDoc(ref(db, 'movimientos/m2'), { ...RETIRO, id: 'm2', tipo: 'EGRESO_CAJA', categoria: 'OTROS' }))
    await assertSucceeds(updateDoc(ref(db, 'productos/TM015'), { stock: 2 }))
    await assertSucceeds(setDoc(ref(db, 'historial/h2'), { id: 'h2', quien: 'sucursalconcordia@elclubdelmate.com' }))
  })

  it('la encargada y el dueño cargan y corrigen', async () => {
    await assertSucceeds(updateDoc(ref(comoSandra(), 'movimientos/m1'), { categoria: 'EQUIPAMIENTO' }))
    await assertSucceeds(setDoc(ref(comoSandra(), 'proveedores/p2'), { id: 'p2', nombre: 'OTRO', activo: true }))
    await assertSucceeds(updateDoc(ref(comoEmma(), 'productos/TM015'), { precioVenta: 250 }))
    await assertSucceeds(deleteDoc(ref(comoEmma(), 'ventas/v1')))
  })
})

describe('quién da de alta a un dueño que solo mira', () => {
  it('un dueño lo crea, lo cambia y lo da de baja', async () => {
    const db = comoEmma()
    await assertSucceeds(setDoc(ref(db, 'usuarios/uid-seba'), { nombre: 'Sebastián', rol: 'socio', activo: true, email: 'seba@prueba.test' }))
    await assertSucceeds(updateDoc(ref(db, 'usuarios/uid-elena'), { activo: false }))
  })

  it('la encargada no: ni lo crea, ni lo toca, ni pasa a alguien del equipo a dueño que mira', async () => {
    const db = comoSandra()
    await assertFails(setDoc(ref(db, 'usuarios/uid-seba'), { nombre: 'Sebastián', rol: 'socio', activo: true }))
    await assertFails(updateDoc(ref(db, 'usuarios/uid-elena'), { activo: false }))
    await assertFails(deleteDoc(ref(db, 'usuarios/uid-elena')))
    await assertFails(updateDoc(ref(db, 'usuarios/uid-gabi'), { rol: 'socio' }))
    // A la empleada la sigue manejando.
    await assertSucceeds(updateDoc(ref(db, 'usuarios/uid-gabi'), { activo: false }))
  })
})

describe('el fundador (20/11)', () => {
  it('el mail de Sebastián ya no se hace dueño completo solo en su primer login', async () => {
    const db = como('uid-seba', 'sebastian@elclubdelmate.com')
    await assertFails(setDoc(ref(db, 'usuarios/uid-seba'), { nombre: 'sebastian', rol: 'owner', activo: true }))
    await assertFails(setDoc(ref(db, 'usuarios/uid-seba'), { nombre: 'sebastian', rol: 'socio', activo: true }))
  })

  it('el de Emmanuel sí, para poder arrancar la cuenta si hiciera falta', async () => {
    const db = como('uid-emma-nuevo', 'emmanuel@elclubdelmate.com')
    await assertSucceeds(setDoc(ref(db, 'usuarios/uid-emma-nuevo'), { nombre: 'emmanuel', rol: 'owner', activo: true }))
  })
})
