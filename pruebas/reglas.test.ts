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
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
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
    await setDoc(doc(db, `${NEGOCIO}/usuarios/uid-sandra`), {
      nombre: 'Sandra',
      rol: 'encargado',
      activo: true,
    })
  })
})

function comoGabi() {
  return entorno.authenticatedContext('uid-gabi', {
    email: 'sucursalconcordia@elclubdelmate.com',
  }).firestore()
}

function comoSandra() {
  return entorno.authenticatedContext('uid-sandra', {
    email: 'ventas@elclubdelmate.com',
  }).firestore()
}

function comoEmma() {
  return entorno.authenticatedContext('uid-emma', {
    email: 'emmanuel@elclubdelmate.com',
  }).firestore()
}

async function sembrarProducto(extra: Record<string, unknown> = {}) {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `${NEGOCIO}/productos/TM015`), {
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
      ...extra,
    })
  })
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

/**
 * El turno que Gabriela abria y se le borraba.
 *
 * La app crea la jornada SIN el campo cierreAutorizado --no lo pone,
 * directamente no esta en el objeto-- y limpiar() en motor.ts solo
 * recorre las claves que existen, asi que el documento que sale para
 * Firestore tampoco lo tiene.
 *
 * La regla decia: request.resource.data.cierreAutorizado == null.
 * En las reglas de Firestore, leer un campo que no existe es un error de
 * evaluacion, y un error deniega. O sea que abrir un turno quedaba
 * rechazado por el servidor.
 *
 * Y el sintoma es peor que un cartel de error: Firestore guarda la
 * escritura optimista en su cache local, el servidor la rechaza, y al
 * revertirla emite un cambio 'removed'. El motor lo aplica borrando la
 * fila de la base local. Por eso la caja se cargaba y desaparecia.
 */
describe('abrir un turno (el caso de la caja que se borraba)', () => {
  const SIN_CAMPO = {
    id: 'j-nueva',
    fecha: hoyArgentina(),
    turno: 'M',
    estado: 'abierto',
    vendedor: 'Gabriela',
    cajaInicial: 15000,
    horaApertura: '09:00',
    horaCierre: null,
    arqueoApertura: { billetes: { '1000': 15 }, monedas: 0 },
    arqueoCierre: null,
    notas: null,
    // Ojo: no hay cierreAutorizado. Es exactamente lo que manda la app.
  }

  it('un empleado puede abrir un turno como lo crea la app, sin el campo', async () => {
    await assertSucceeds(setDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j-nueva`), SIN_CAMPO))
  })

  it('un dueño tambien', async () => {
    await assertSucceeds(setDoc(doc(comoEmma(), `${NEGOCIO}/jornadas/j-nueva`), SIN_CAMPO))
  })

  it('con el campo en null explicito sigue andando', async () => {
    await assertSucceeds(
      setDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j-nueva`), {
        ...SIN_CAMPO,
        cierreAutorizado: null,
      }),
    )
  })

  it('pero nadie puede crear un turno ya firmado', async () => {
    await assertFails(
      setDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j-nueva`), {
        ...SIN_CAMPO,
        cierreAutorizado: { por: 'x', porNombre: 'X', cuando: Date.now(), comentario: null },
      }),
    )
  })
})

/**
 * El rol de encargado: puede manejar la operacion completa, pero no
 * destruir el negocio ni repartirlo.
 *
 * Las dos mitades importan por igual. Si lo que PUEDE no funciona,
 * Sandra no puede trabajar; si lo que NO PUEDE no esta bloqueado, el
 * rol no sirve para nada y el limite es un cartel en la pantalla.
 */
describe('encargado: lo que SI puede', () => {
  it('cierra un turno de otro dia, como un dueño', async () => {
    await sembrarJornada(ayerArgentina())
    await assertSucceeds(updateDoc(doc(comoSandra(), `${NEGOCIO}/jornadas/j1`), CIERRE))
  })

  it('firma el visto bueno de una diferencia', async () => {
    await sembrarJornada(hoyArgentina(), { estado: 'cerrado', ...CIERRE })
    await assertSucceeds(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/jornadas/j1`), {
        cierreAutorizado: {
          por: 'ventas@elclubdelmate.com',
          porNombre: 'Sandra',
          porRol: 'encargado',
          cuando: Date.now(),
          comentario: null,
        },
      }),
    )
  })

  it('cambia el precio de venta de un producto', async () => {
    await sembrarProducto()
    await assertSucceeds(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/productos/TM015`), { precioVenta: 48000 }),
    )
  })

  it('archiva un producto sin pedir permiso', async () => {
    await sembrarProducto()
    await assertSucceeds(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/productos/TM015`), { archivado: true }),
    )
  })

  it('da de alta a un empleado', async () => {
    await assertSucceeds(
      setDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-nuevo`), {
        nombre: 'Alguien',
        rol: 'empleado',
        activo: true,
      }),
    )
  })

  it('desactiva a un empleado', async () => {
    await assertSucceeds(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-gabi`), { activo: false }),
    )
  })
})

describe('encargado: lo que NO puede', () => {
  it('NO puede crear un dueño', async () => {
    await assertFails(
      setDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-nuevo`), {
        nombre: 'Otro dueño',
        rol: 'owner',
        activo: true,
      }),
    )
  })

  it('NO puede ascenderse a dueña', async () => {
    await assertFails(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-sandra`), { rol: 'owner' }),
    )
  })

  it('NO puede ascender a un empleado a dueño', async () => {
    await assertFails(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-gabi`), { rol: 'owner' }),
    )
  })

  it('NO puede desactivar a un dueño', async () => {
    await assertFails(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-emma`), { activo: false }),
    )
  })

  it('NO puede degradar a un dueño para despues tocarlo', async () => {
    // El atajo obvio: si solo se mirara el rol que QUEDA, bajar al dueño
    // a empleado pasaria, y con eso queda a merced del encargado.
    await assertFails(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-emma`), { rol: 'empleado' }),
    )
  })

  it('NO puede borrar a un dueño', async () => {
    await assertFails(deleteDoc(doc(comoSandra(), `${NEGOCIO}/usuarios/uid-emma`)))
  })
})

describe('empleado: el rol nuevo no le aflojo nada', () => {
  it('sigue sin poder firmar su propia diferencia', async () => {
    await sembrarJornada(hoyArgentina(), { estado: 'cerrado', ...CIERRE })
    await assertFails(
      updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), {
        cierreAutorizado: {
          por: 'x',
          porNombre: 'X',
          porRol: 'empleado',
          cuando: Date.now(),
          comentario: null,
        },
      }),
    )
  })

  it('sigue sin poder cerrar el turno de ayer', async () => {
    await sembrarJornada(ayerArgentina())
    await assertFails(updateDoc(doc(comoGabi(), `${NEGOCIO}/jornadas/j1`), CIERRE))
  })

  it('sigue sin poder tocar el precio de venta', async () => {
    await sembrarProducto()
    await assertFails(
      updateDoc(doc(comoGabi(), `${NEGOCIO}/productos/TM015`), { precioVenta: 48000 }),
    )
  })

  it('NO puede crear un encargado para darse permisos por la ventana', async () => {
    await assertFails(
      setDoc(doc(comoGabi(), `${NEGOCIO}/usuarios/uid-nuevo`), {
        nombre: 'Yo mismo',
        rol: 'encargado',
        activo: true,
      }),
    )
  })
})
