/**
 * Pruebas de la regla de `sueldos` contra el emulador de Firestore.
 *
 * Cuanto cobra cada persona lo ven los dueños y quien esta de encargado,
 * y cada persona lo suyo; lo define solo un dueño (19/11). Esa promesa la
 * cumple la regla, no la pantalla: la pantalla se puede esquivar
 * pidiendole el dato directo al servidor. Lo que se prueba aca es
 * justamente eso.
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
  acuerdos: [{ desde: '2026-11-07', monto: 123456, cada: 'semana', anotadoEl: 1, por: 'emmanuel@elclubdelmate.com' }],
  actualizadoEn: 1,
  // La versión del formato: la manda la app al guardar y la regla la exige.
  forma: 2,
}

/** Como la guarda una versión de la app anterior al acuerdo por semana: sin `forma`. */
const FICHA_DE_ANTES = {
  id: 'uid-gabi',
  nombre: 'Gabriela',
  acuerdos: [{ desde: '2026-11', monto: 654321, anotadoEl: 2, por: 'emmanuel@elclubdelmate.com' }],
  actualizadoEn: 2,
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
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-baja`), { nombre: 'Ex empleada', rol: 'empleado', activo: false })
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-exenc`), { nombre: 'Ex encargada', rol: 'encargado', activo: false })
    await setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), FICHA)
    await setDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`), { ...FICHA, id: 'uid-sandra', nombre: 'Sandra' })
    await setDoc(doc(db, `${NEGOCIO}/sueldos/uid-baja`), { ...FICHA, id: 'uid-baja', nombre: 'Ex empleada' })
  })
})

const como = (uid: string, email: string) => entorno.authenticatedContext(uid, { email }).firestore()
const comoEmma = () => como('uid-emma', 'emmanuel@elclubdelmate.com')
const comoSandra = () => como('uid-sandra', 'ventas@elclubdelmate.com')
const comoGabi = () => como('uid-gabi', 'sucursalconcordia@elclubdelmate.com')

describe('sueldos: los ven los dueños y la encargada, cada uno lo suyo, y los define solo un dueño', () => {
  it('el dueño lee una ficha, las lista todas, las crea, las cambia y las borra', async () => {
    const db = comoEmma()
    const ficha = await assertSucceeds(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
    expect(ficha.data()?.acuerdos[0].monto).toBe(123456)
    const todas = await assertSucceeds(getDocs(collection(db, `${NEGOCIO}/sueldos`)))
    expect(todas.size).toBe(3)
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-nueva`), { ...FICHA, id: 'uid-nueva', nombre: 'Nueva' }))
    await assertSucceeds(updateDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { actualizadoEn: 2 }))
    await assertSucceeds(deleteDoc(doc(db, `${NEGOCIO}/sueldos/uid-nueva`)))
  })

  it('UNA VERSIÓN VIEJA DE LA APP NO PISA LA FICHA: sin la versión del formato, ni el dueño la guarda', async () => {
    const db = comoEmma()
    // La app de antes no entiende los acuerdos por semana: al leer los
    // saltea y al guardar manda la ficha entera sin ellos. Si el servidor
    // la dejara, borraría lo acordado.
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), FICHA_DE_ANTES))
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-nueva`), { ...FICHA_DE_ANTES, id: 'uid-nueva' }))
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { ...FICHA, forma: 1 }))
    const sigue = await assertSucceeds(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
    expect(sigue.data()?.acuerdos).toEqual(FICHA.acuerdos)
    // Con la versión de ahora, sí.
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { ...FICHA, actualizadoEn: 3 }))
  })

  it('LA ENCARGADA LAS VE: la de otra persona, la suya y la lista entera', async () => {
    const db = comoSandra()
    const deGabi = await assertSucceeds(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
    expect(deGabi.data()?.acuerdos[0].monto).toBe(123456)
    await assertSucceeds(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`)))
    const todas = await assertSucceeds(getDocs(collection(db, `${NEGOCIO}/sueldos`)))
    expect(todas.size).toBe(3)
  })

  it('la encargada NO las escribe: ni la suya ni la de otra persona. Nadie se cambia el propio sueldo', async () => {
    const db = comoSandra()
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`), { ...FICHA, id: 'uid-sandra', acuerdos: [] }))
    await assertFails(updateDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`), { actualizadoEn: 2 }))
    await assertFails(updateDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { actualizadoEn: 2 }))
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-otra`), { ...FICHA, id: 'uid-otra' }))
    await assertFails(deleteDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
  })

  it('«MI SUELDO»: una empleada lee SU ficha, y nada más que la suya', async () => {
    const db = comoGabi()
    const mia = await assertSucceeds(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
    expect(mia.data()?.acuerdos[0].monto).toBe(123456)
    await assertFails(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-sandra`)))
    await assertFails(getDoc(doc(db, `${NEGOCIO}/sueldos/uid-baja`)))
    // Listar es pedirlas todas: no se puede, aunque una sea la suya.
    await assertFails(getDocs(collection(db, `${NEGOCIO}/sueldos`)))
  })

  it('una empleada no escribe ni la suya', async () => {
    const db = comoGabi()
    await assertFails(setDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { ...FICHA, acuerdos: [] }))
    await assertFails(updateDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`), { actualizadoEn: 2 }))
    await assertFails(deleteDoc(doc(db, `${NEGOCIO}/sueldos/uid-gabi`)))
  })

  it('quien todavía no tiene ficha puede preguntar por la suya: le contesta que no hay, no que no puede', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), `${NEGOCIO}/sueldos/uid-gabi`))
    })
    const mia = await assertSucceeds(getDoc(doc(comoGabi(), `${NEGOCIO}/sueldos/uid-gabi`)))
    expect(mia.exists()).toBe(false)
  })

  it('con la cuenta desactivada no se lee nada: ni la propia, ni siendo dueño o encargada', async () => {
    await assertFails(getDoc(doc(como('uid-baja', 'baja@elclubdelmate.com'), `${NEGOCIO}/sueldos/uid-baja`)))
    await assertFails(getDoc(doc(como('uid-ex', 'ex@elclubdelmate.com'), `${NEGOCIO}/sueldos/uid-gabi`)))
    await assertFails(getDocs(collection(como('uid-exenc', 'exenc@elclubdelmate.com'), `${NEGOCIO}/sueldos`)))
  })

  it('sin sesión, o con una cuenta sin perfil, tampoco', async () => {
    await assertFails(getDoc(doc(entorno.unauthenticatedContext().firestore(), `${NEGOCIO}/sueldos/uid-gabi`)))
    // Alguien con cuenta pero sin perfil en el negocio: ni siquiera «la suya».
    await assertFails(getDoc(doc(como('uid-nadie', 'nadie@ejemplo.com'), `${NEGOCIO}/sueldos/uid-nadie`)))
    await assertFails(getDoc(doc(como('uid-nadie', 'nadie@ejemplo.com'), `${NEGOCIO}/sueldos/uid-gabi`)))
  })

  it('lo demás sigue como estaba: un gasto de sueldos lo carga y lo lee cualquiera activo', async () => {
    const pago = { id: 'm1', fecha: '2026-11-19', tipo: 'EGRESO_CAJA', concepto: 'Sueldo', monto: 50000, categoria: 'SUELDOS', persona: 'uid-gabi' }
    await assertSucceeds(setDoc(doc(comoGabi(), `${NEGOCIO}/movimientos/m1`), pago))
    await assertSucceeds(getDoc(doc(comoSandra(), `${NEGOCIO}/movimientos/m1`)))
    await assertSucceeds(updateDoc(doc(comoEmma(), `${NEGOCIO}/movimientos/m1`), { persona: 'uid-sandra' }))
  })

  it('el apodo de alguien lo cambia quien está al mando, no la empleada', async () => {
    await assertSucceeds(updateDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-gabi`), { apodos: 'Gabi' }))
    await assertSucceeds(updateDoc(doc(comoEmma(), `${NEGOCIO}/usuarios/uid-emma`), { apodos: 'Emma' }))
    await assertFails(updateDoc(doc(comoGabi(), `${NEGOCIO}/usuarios/uid-gabi`), { apodos: 'Jefa' }))
    // Una encargada no toca a un dueño, tampoco para esto.
    await assertFails(updateDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-emma`), { apodos: 'Emma' }))
  })
})
