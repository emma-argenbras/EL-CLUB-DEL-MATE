/**
 * Pruebas de la regla de `sueldos` contra el emulador de Firestore.
 *
 * Cuanto cobra cada persona lo ve solo el dueño. Esa promesa la cumple
 * la regla, no la pantalla: la pantalla se puede esquivar pidiendole el
 * dato directo al servidor. Lo que se prueba aca es justamente eso.
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
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const NEGOCIO = 'negocios/el-club-del-mate'
let entorno: RulesTestEnvironment

const FICHA = {
  id: 'uid-gabi',
  nombre: 'Gabriela',
  acuerdos: [{ desde: '2026-11', monto: 123456, anotadoEl: 1, por: 'emmanuel@elclubdelmate.com' }],
  actualizadoEn: 1,
}

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'club-del-mate-sueldos',
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
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-ex`), { nombre: 'Ex dueño', rol: 'owner', activo: false })
    await setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), FICHA)
  })
})

const como = (uid: string, email: string) => entorno.authenticatedContext(uid, { email }).firestore()
const comoEmma = () => como('uid-emma', 'emmanuel@elclubdelmate.com')
const comoSandra = () => como('uid-sandra', 'ventas@elclubdelmate.com')
const comoGabi = () => como('uid-gabi', 'sucursalconcordia@elclubdelmate.com')

describe('sueldos: lo ve y lo cambia solo el dueño', () => {
  it('el dueño lee una ficha, las lista todas, las crea, las cambia y las borra', async () => {
    const db = comoEmma()
    const ficha = await assertSucceeds(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
    expect(ficha.data()?.acuerdos[0].monto).toBe(123456)
    const todas = await assertSucceeds(getDocs(collection(db, `${NEGOCIO}/sueldos`)))
    expect(todas.size).toBe(1)
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`), { ...FICHA, id: 'uid-sandra', nombre: 'Sandra' }))
    await assertSucceeds(updateDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { actualizadoEn: 2 }))
    await assertSucceeds(deleteDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`)))
  })

  it('la encargada no las lee ni las lista, aunque esté al mando', async () => {
    const db = comoSandra()
    await assertFails(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
    await assertFails(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`)))
    await assertFails(getDocs(collection(db, `${NEGOCIO}/sueldos`)))
  })

  it('la encargada no las escribe: ni la suya ni la de otra persona', async () => {
    const db = comoSandra()
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`), { ...FICHA, id: 'uid-sandra' }))
    await assertFails(updateDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { actualizadoEn: 2 }))
    await assertFails(deleteDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
  })

  it('una empleada no lee ni la suya, y no puede escribirla', async () => {
    const db = comoGabi()
    await assertFails(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
    await assertFails(getDocs(collection(db, `${NEGOCIO}/sueldos`)))
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { ...FICHA, acuerdos: [] }))
    await assertFails(deleteDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
  })

  it('un dueño desactivado tampoco, y sin sesión menos', async () => {
    await assertFails(getDoc(doc(como('uid-ex', 'ex@elclubdelmate.com'), `${NEGOCIO}/sueldos/uid-gabi`)))
    await assertFails(getDoc(doc(entorno.unauthenticatedContext().firestore(), `${NEGOCIO}/sueldos/uid-gabi`)))
  })

  it('lo demás sigue como estaba: un gasto de sueldos lo carga y lo lee cualquiera activo', async () => {
    const pago = { id: 'm1', fecha: '2026-11-19', tipo: 'EGRESO_CAJA', concepto: 'Sueldo', monto: 50000, categoria: 'SUELDOS', persona: 'uid-gabi' }
    await assertSucceeds(setDoc(doc(comoGabi(), `${NEGOCIO}/movimientos/m1`), pago))
    await assertSucceeds(getDoc(doc(comoSandra(), `${NEGOCIO}/movimientos/m1`)))
    await assertSucceeds(updateDoc(doc(comoEmma(), `${NEGOCIO}/movimientos/m1`), { persona: 'uid-sandra' }))
  })
})
