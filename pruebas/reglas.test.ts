/**
 * Pruebas de firestore.rules contra el emulador de Firestore.
 *
 * Por que existen: estas reglas son lo unico que separa "el bloqueo es
 * real" de "el bloqueo es un cartel en la pantalla". Y se publican a
 * mano en la consola de Firebase, sin pasar por el deploy, asi que si
 * estan mal nadie se entera hasta que alguien no puede trabajar.
 *
 * Como se corren:
 *     npm run test:reglas
 *
 * Necesitan Java (el emulador de Firestore corre en la JVM). No van en
 * el CI de GitHub por eso mismo; el resto de los tests si.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const NEGOCIO = 'negocios/el-club-del-mate'
let entorno: RulesTestEnvironment

/** Fecha de hoy en Argentina, igual que la calcula la regla. */
function hoyArgentina(): string {
  const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return ahora.toISOString().slice(0, 10)
}

function ayerArgentina(): string {
  const ahora = new Date(Date.now() - 27 * 60 * 60 * 1000)
  return ahora.toISOString().slice(0, 10)
}

/** Una jornada abierta, lista para cerrar. */
function jornadaAbierta(fecha: string) {
  return {
    id: 'j1',
    fecha,
    turno: 'M',
    estado: 'abierto',
    vendedor: 'Gabriela',
    cajaInicial: 10000,
    horaApertura: '09:00',
    horaCierre: null,
    arqueoApertura: { billetes: { '1000': 10 }, monedas: 0 },
    arqueoCierre: null,
    cierreAutorizado: null,
    solicitudCierre: null,
    notas: null,
  }
}

const CIERRE = {
  estado: 'cerrado',
  horaCierre: '14:00',
  arqueoCierre: { billetes: { '1000': 12 }, monedas: 0 },
}

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'club-del-mate-pruebas',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await entorno?.cleanup()
})

beforeEach(async () => {
  await entorno.clearFirestore()
  // Los perfiles se siembran sin reglas: no es lo que se esta probando.
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-emma`), {
      nombre: 'Emmanuel',
      rol: 'owner',
      activo: true,
    })
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-gabi`), {
      nombre: 'Gabriela',
      rol: 'empleado',
      activo: true,
    })
  })
})

function comoGabi() {
  return entorno.authenticatedContext('uid-gabi', {
    email: 'sucursalconcordia@elclubdelmate.com',
  }).firestore()
}

function comoEmma() {
  return entorno.authenticatedContext('uid-emma', {
    email: 'emmanuel@elclubdelmate.com',
  }).firestore()
}

async function sembrarJornada(fecha: string, extra: Record<string, unknown> = {}) {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `${NEGOCIO}/jornadas/j1`), {
      ...jornadaAbierta(fecha),
      ...extra,
    })
  })
}

describe('jornadas: cerrar el turno del dia', () => {
  it('un empleado cierra normalmente el turno de hoy', async () => {
    await sembrarJornada(hoyArgentina())
    await assertSucceeds(updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), CIERRE))
  })

  it('un empleado puede seguir cargando el turno de ayer sin cerrarlo', async () => {
    // Corregir una venta vieja o anotar algo no es cerrar: no se toca.
    await sembrarJornada(ayerArgentina())
    await assertSucceeds(
      updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), { vendedor: 'Gabriela C.' }),
    )
  })
})

describe('jornadas: cerrar tarde necesita al dueño', () => {
  it('un empleado NO puede cerrar el turno de ayer', async () => {
    await sembrarJornada(ayerArgentina())
    await assertFails(updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), CIERRE))
  })

  it('un empleado NO se saltea el bloqueo borrando antes su pedido', async () => {
    await sembrarJornada(ayerArgentina(), {
      solicitudCierre: {
        arqueo: { billetes: { '1000': 12 }, monedas: 0 },
        motivo: 'me olvide',
        por: 'sucursalconcordia@elclubdelmate.com',
        porNombre: 'Gabriela',
        cuando: Date.now(),
        estado: 'pendiente',
      },
    })
    await assertFails(
      updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), {
        ...CIERRE,
        solicitudCierre: null,
      }),
    )
  })

  it('un empleado SI puede dejar el pedido de cierre tardio', async () => {
    await sembrarJornada(ayerArgentina())
    await assertSucceeds(
      updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), {
        solicitudCierre: {
          arqueo: { billetes: { '1000': 12 }, monedas: 0 },
          motivo: 'me olvide de cerrar anoche',
          por: 'sucursalconcordia@elclubdelmate.com',
          porNombre: 'Gabriela',
          cuando: Date.now(),
          estado: 'pendiente',
        },
      }),
    )
  })

  it('el dueño SI puede cerrar el turno de ayer', async () => {
    await sembrarJornada(ayerArgentina())
    await assertSucceeds(updateDoc(doc(comoEmma(), `${NEGOCIO}/jornadas/j1`), CIERRE))
  })
})

describe('jornadas: el visto bueno lo firma el dueño', () => {
  const VISTO_BUENO = {
    cierreAutorizado: {
      por: 'quien-sea@elclubdelmate.com',
      porNombre: 'Quien sea',
      cuando: Date.now(),
      comentario: null,
    },
  }

  it('un empleado NO puede firmar su propia diferencia', async () => {
    await sembrarJornada(hoyArgentina(), { estado: 'cerrado', ...CIERRE })
    await assertFails(updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), VISTO_BUENO))
  })

  it('el dueño SI puede firmarla', async () => {
    await sembrarJornada(hoyArgentina(), { estado: 'cerrado', ...CIERRE })
    await assertSucceeds(updateDoc(doc(comoEmma(), `${NEGOCIO}/jornadas/j1`), VISTO_BUENO))
  })
})

describe('la fecha de hoy que calcula la regla', () => {
  it('coincide con la fecha de Argentina', async () => {
    // Si esto falla, la regla esta usando otro dia que la app y algun
    // cierre normal se va a rechazar sin motivo aparente.
    await sembrarJornada(hoyArgentina())
    await assertSucceeds(updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), CIERRE))
    expect(hoyArgentina()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
