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
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { camposParaConservar, motivosDelRechazo } from '../src/sync/motivoRechazo'

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

/**
 * El historial tiene que ser inborrable, y eso incluye al dueño.
 *
 * Es la parte del punto 2 que no se puede verificar mirando la pantalla:
 * la app no ofrece ningun boton para borrarlo, pero eso no es lo mismo
 * que no se pueda. Lo unico que lo garantiza es la regla.
 */
describe('el historial no se puede retocar', () => {
  const RENGLON = {
    tabla: 'productos',
    clave: 'TM015',
    accion: 'edito',
    queEs: 'MATE IMPERIAL',
    campo: 'precioVenta',
    valorAnterior: 45000,
    valorNuevo: 52000,
    quienNombre: 'Sandra',
    quienRol: 'encargado',
    cuando: Date.now(),
    motivo: null,
  }

  async function sembrarRenglon() {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${NEGOCIO}/historial/h1`), {
        ...RENGLON,
        quien: 'ventas@elclubdelmate.com',
      })
    })
  }

  it('cualquiera activo puede agregar un renglon a su nombre', async () => {
    await assertSucceeds(
      setDoc(doc(comoSandra(), `${NEGOCIO}/historial/h-nuevo`), {
        ...RENGLON,
        quien: 'ventas@elclubdelmate.com',
      }),
    )
  })

  it('nadie puede firmar un cambio en nombre de otra persona', async () => {
    await assertFails(
      setDoc(doc(comoSandra(), `${NEGOCIO}/historial/h-nuevo`), {
        ...RENGLON,
        quien: 'emmanuel@elclubdelmate.com',
      }),
    )
  })

  it('un empleado NO puede editar un renglon', async () => {
    await sembrarRenglon()
    await assertFails(updateDoc(doc(comoGabi(), `${NEGOCIO}/historial/h1`), { valorNuevo: 1 }))
  })

  it('un encargado NO puede editar un renglon, ni el propio', async () => {
    await sembrarRenglon()
    await assertFails(updateDoc(doc(comoSandra(), `${NEGOCIO}/historial/h1`), { valorNuevo: 1 }))
  })

  it('un DUEÑO tampoco puede editarlo', async () => {
    await sembrarRenglon()
    await assertFails(updateDoc(doc(comoEmma(), `${NEGOCIO}/historial/h1`), { valorNuevo: 1 }))
  })

  it('un DUEÑO tampoco puede borrarlo', async () => {
    // El unico que tendria motivo para retocar el historial es quien
    // tiene algo que esconder, asi que la puerta esta cerrada para
    // todos. Si manana hace falta depurarlo, se hace desde la consola de
    // Firebase a mano y queda constancia de eso en Firebase.
    await sembrarRenglon()
    await assertFails(deleteDoc(doc(comoEmma(), `${NEGOCIO}/historial/h1`)))
  })

  it('todos pueden leerlo', async () => {
    await sembrarRenglon()
    await assertSucceeds(getDoc(doc(comoGabi(), `${NEGOCIO}/historial/h1`)))
    await assertSucceeds(getDoc(doc(comoSandra(), `${NEGOCIO}/historial/h1`)))
  })
})

/**
 * La primera compra de verdad.
 *
 * Sandra arranca hoy con Compras y pagos, que hasta ahora tenia cero
 * registros: es la primera vez que esas reglas se usan en serio. Lo que
 * se prueba es lo que la pantalla hace de verdad, no la coleccion
 * suelta: una compra escribe en movimientosProveedor Y en productos
 * (stock y costo), y un pago escribe en movimientosProveedor Y en
 * movimientos (el gasto que aparece en Gastos).
 *
 * Si falla cualquiera de las dos mitades, la transaccion entera se cae
 * y la compra no se guarda.
 */
describe('compras y pagos a proveedores', () => {
  const COMPRA = {
    id: 'mp1',
    proveedorId: 'prov-mohicano',
    tipo: 'compra',
    fecha: '2026-10-21',
    monto: 120000,
    medioPago: null,
    items: [{ codigo: 'TM015', cantidad: 6, costoUnitario: 20000 }],
    notas: null,
    creadoPor: 'ventas@elclubdelmate.com',
  }

  const PAGO = {
    id: 'mp2',
    proveedorId: 'prov-mohicano',
    tipo: 'pago',
    fecha: '2026-10-21',
    monto: 120000,
    medioPago: 'TRANSFERENCIA',
    items: null,
    notas: null,
    movimientoGastoId: 'g1',
    creadoPor: 'ventas@elclubdelmate.com',
  }

  const GASTO = {
    id: 'g1',
    fecha: '2026-10-21',
    tipo: 'GASTO_CAJA_GRANDE',
    concepto: 'Pago a MOHICANO',
    monto: 120000,
    categoria: 'PROVEEDORES',
    jornadaId: null,
    esVariable: true,
  }

  it('la encargada puede registrar una compra', async () => {
    const db = comoSandra()
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp1`), COMPRA))
  })

  it('la encargada puede actualizar stock y costo, que es la otra mitad de la compra', async () => {
    await sembrarProducto()
    const db = comoSandra()
    await assertSucceeds(
      updateDoc(doc(db, `${NEGOCIO}/productos/TM015`), {
        stock: 9,
        precioCompra: 20000,
        fechaCompra: '2026-10-21',
      }),
    )
  })

  it('la encargada puede registrar un pago', async () => {
    const db = comoSandra()
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp2`), PAGO))
  })

  it('la encargada puede dejar el gasto que genera el pago', async () => {
    const db = comoSandra()
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/movimientos/g1`), GASTO))
  })

  it('la encargada puede crear el proveedor si todavia no esta', async () => {
    const db = comoSandra()
    await assertSucceeds(
      setDoc(doc(db, `${NEGOCIO}/proveedores/prov-mohicano`), {
        id: 'prov-mohicano',
        nombre: 'MOHICANO',
        contacto: null,
        notas: null,
        activo: true,
      }),
    )
  })

  it('la encargada puede corregir una compra y borrarla', async () => {
    const db = comoSandra()
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp1`), COMPRA))
    await assertSucceeds(
      updateDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp1`), { monto: 130000 }),
    )
    await assertSucceeds(deleteDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp1`)))
  })

  it('el renglon de historial que deja la compra tambien entra', async () => {
    // Cada escritura deja historial, y el historial tiene su propia
    // regla. Si rechazara, la compra se guardaria pero sin constancia.
    const db = comoSandra()
    await assertSucceeds(
      setDoc(doc(db, `${NEGOCIO}/historial/h1`), {
        id: 'h1',
        tabla: 'movimientosProveedor',
        clave: 'mp1',
        accion: 'creo',
        queEs: 'Compra a MOHICANO',
        campo: null,
        valorAnterior: null,
        valorNuevo: null,
        quien: 'ventas@elclubdelmate.com',
        quienNombre: 'Sandra',
        quienRol: 'encargado',
        cuando: Date.now(),
        motivo: null,
      }),
    )
  })

  it('Gabriela tambien puede: cargar una compra no es una decision de mando', async () => {
    const db = comoGabi()
    await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp3`), COMPRA))
  })

  it('pero alguien desactivado no puede', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${NEGOCIO}/usuarios/uid-sandra`), {
        nombre: 'Sandra',
        rol: 'encargado',
        activo: false,
      })
    })
    const db = comoSandra()
    await assertFails(setDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp1`), COMPRA))
  })

  it('y alguien sin sesion tampoco', async () => {
    const db = entorno.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, `${NEGOCIO}/movimientosProveedor/mp1`), COMPRA))
  })
})

/**
 * Un dato cargado no se pisa con vacio.
 *
 * El 20/10/2026 un celular rearmado desde el catalogo publico subio
 * productos sin costo ni proveedor encima de los del servidor:
 * quedaron ~280 sin proveedor y 120 sin costo, sin un renglon en el
 * historial. La app ya no lo intenta; esto es lo que lo hace
 * imposible, incluso desde una version vieja.
 */
describe('no se pisa un dato cargado con vacio', () => {
  const COMPLETO = {
    codigo: 'MR001',
    descripcion: 'MATE RAFAEL',
    proveedor: 'MATES RAFAEL MISIONES SARAPICO SHOPPING',
    proveedorId: 'prov-mates-rafael',
    fechaCompra: '2026-08-12',
    precioCompra: 9500,
    rentabilidad: 1.3,
    precioVenta: 21000,
    fechaPrecioVenta: '2026-08-12',
    busqueda: 'mr001 mate rafael',
    stock: null,
    activo: true,
  }

  async function sembrarCompleto() {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${NEGOCIO}/productos/MR001`), COMPLETO)
    })
  }

  it('el caso exacto del 20/10: el catalogo publico encima del producto cargado', async () => {
    await sembrarCompleto()
    const db = comoSandra()
    // Tal cual lo arma sembrarCatalogo: solo codigo, descripcion y
    // precio de venta; todo lo demas en null.
    await assertFails(
      setDoc(doc(db, `${NEGOCIO}/productos/MR001`), {
        ...COMPLETO,
        proveedor: null,
        proveedorId: null,
        fechaCompra: null,
        precioCompra: null,
        rentabilidad: null,
      }),
    )
  })

  it('no se puede vaciar el costo', async () => {
    await sembrarCompleto()
    await assertFails(updateDoc(doc(comoSandra(), `${NEGOCIO}/productos/MR001`), { precioCompra: null }))
  })

  it('no se puede vaciar el proveedor', async () => {
    await sembrarCompleto()
    await assertFails(updateDoc(doc(comoSandra(), `${NEGOCIO}/productos/MR001`), { proveedorId: null }))
  })

  it('no se puede vaciar la rentabilidad', async () => {
    await sembrarCompleto()
    await assertFails(updateDoc(doc(comoSandra(), `${NEGOCIO}/productos/MR001`), { rentabilidad: null }))
  })

  it('tampoco puede un dueño: no es cuestion de permisos', async () => {
    // El que pisa no es alguien sin permiso: es un dispositivo que cree
    // tener la version buena del producto.
    await sembrarCompleto()
    await assertFails(updateDoc(doc(comoEmma(), `${NEGOCIO}/productos/MR001`), { precioCompra: null }))
  })

  it('pero SI se puede cambiar un costo por otro', async () => {
    await sembrarCompleto()
    await assertSucceeds(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/productos/MR001`), { precioCompra: 11000 }),
    )
  })

  it('y SI se puede completar un costo que estaba vacio', async () => {
    // Lo que importa recuperar: llenar lo que quedo en null.
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${NEGOCIO}/productos/MR001`), {
        ...COMPLETO,
        precioCompra: null,
        proveedorId: null,
        proveedor: null,
        rentabilidad: null,
      })
    })
    await assertSucceeds(
      updateDoc(doc(comoSandra(), `${NEGOCIO}/productos/MR001`), {
        precioCompra: 9500,
        proveedorId: 'prov-mates-rafael',
        proveedor: 'MATES RAFAEL MISIONES SARAPICO SHOPPING',
        rentabilidad: 1.3,
      }),
    )
  })

  it('y un producto nuevo se puede crear sin costo, como siempre', async () => {
    await assertSucceeds(
      setDoc(doc(comoSandra(), `${NEGOCIO}/productos/NUEVO1`), {
        ...COMPLETO,
        codigo: 'NUEVO1',
        precioCompra: null,
        proveedorId: null,
        proveedor: null,
        rentabilidad: null,
      }),
    )
  })
})

describe('borrar un producto (lo que hace "Cambiar el codigo")', () => {
  it('la encargada puede', async () => {
    await sembrarProducto()
    await assertSucceeds(deleteDoc(doc(comoSandra(), `${NEGOCIO}/productos/TM015`)))
  })

  it('el dueño puede', async () => {
    await sembrarProducto()
    await assertSucceeds(deleteDoc(doc(comoEmma(), `${NEGOCIO}/productos/TM015`)))
  })

  it('una empleada NO puede', async () => {
    await sembrarProducto()
    await assertFails(deleteDoc(doc(comoGabi(), `${NEGOCIO}/productos/TM015`)))
  })

  it('sin sesion NO se puede', async () => {
    await sembrarProducto()
    await assertFails(
      deleteDoc(doc(entorno.unauthenticatedContext().firestore(), `${NEGOCIO}/productos/TM015`)),
    )
  })
})

describe('motivoRechazo dice lo mismo que la regla de productos', () => {
  // motivoRechazo.ts repite del lado de la app las preguntas de la
  // regla, para poder decirle a la persona POR QUE no entro su cambio.
  // Si alguien toca la regla y no toca eso, esta prueba lo agarra:
  // cada caso se manda de verdad al emulador y se compara.
  const SERVIDOR = {
    codigo: 'DLB001',
    descripcion: 'MATE DE CALABAZA',
    proveedor: 'MOHICANO',
    proveedorId: 'mohicano',
    fechaCompra: '2026-10-01',
    precioCompra: 2000,
    rentabilidad: 1,
    precioVenta: 4000,
    fechaPrecioVenta: '2026-10-01',
    busqueda: 'dlb001 mate de calabaza',
    stock: null,
    activo: true,
    archivado: true,
  }

  const PERFILES: Record<string, { rol: string; activo: boolean }> = {
    'uid-emma': { rol: 'owner', activo: true },
    'uid-sandra': { rol: 'encargado', activo: true },
    'uid-gabi': { rol: 'empleado', activo: true },
    'uid-mayuscula': { rol: 'Encargado', activo: true },
  }

  const CASOS: {
    nombre: string
    uid: string
    enviado: Record<string, unknown>
    sinArchivado?: boolean
  }[] = [
    { nombre: 'encargada cambia costo y precio', uid: 'uid-sandra', enviado: { ...SERVIDOR, precioCompra: 2500, precioVenta: 5000 } },
    { nombre: 'encargada desarchiva', uid: 'uid-sandra', enviado: { ...SERVIDOR, archivado: false } },
    { nombre: 'encargada desarchiva sin proveedor', uid: 'uid-sandra', enviado: { ...SERVIDOR, archivado: false, proveedor: null } },
    { nombre: 'encargada sin rentabilidad', uid: 'uid-sandra', enviado: { ...SERVIDOR, rentabilidad: null, precioVenta: 5000 } },
    { nombre: 'empleada cambia precio', uid: 'uid-gabi', enviado: { ...SERVIDOR, precioVenta: 5000 } },
    { nombre: 'empleada cambia costo', uid: 'uid-gabi', enviado: { ...SERVIDOR, precioCompra: 2500 } },
    { nombre: 'rol con mayuscula desarchiva', uid: 'uid-mayuscula', enviado: { ...SERVIDOR, archivado: false } },
    { nombre: 'dueño deja vacia la ficha', uid: 'uid-emma', enviado: { ...SERVIDOR, proveedorId: null } },
    // Un producto de la semilla no tiene «archivado» en el servidor, y
    // el formulario lo mandaba en false: para la regla, Gabriela
    // estaba archivando.
    { nombre: 'empleada edita el costo de un producto sin «archivado»', uid: 'uid-gabi', enviado: { ...SERVIDOR, archivado: false, precioCompra: 2500 }, sinArchivado: true },
    { nombre: 'empleada archiva un producto sin «archivado»', uid: 'uid-gabi', enviado: { ...SERVIDOR, archivado: true }, sinArchivado: true },
  ]

  for (const caso of CASOS) {
    it(caso.nombre, async () => {
      const { archivado: _archivado, ...sinArchivado } = SERVIDOR
      const servidor: Record<string, unknown> = caso.sinArchivado ? sinArchivado : SERVIDOR
      await entorno.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `${NEGOCIO}/usuarios/uid-mayuscula`), {
          nombre: 'Prueba',
          ...PERFILES['uid-mayuscula'],
        })
        await setDoc(doc(ctx.firestore(), `${NEGOCIO}/productos/DLB001`), servidor)
      })
      const motivos = motivosDelRechazo('guardar', caso.enviado, servidor, PERFILES[caso.uid])
      const diceQuePasa = motivos.length === 1 && motivos[0].tipo === 'no-se-sabe'

      const db = entorno.authenticatedContext(caso.uid, { email: `${caso.uid}@prueba.com` }).firestore()
      const intento = setDoc(doc(db, `${NEGOCIO}/productos/DLB001`), caso.enviado)
      if (diceQuePasa) await assertSucceeds(intento)
      else await assertFails(intento)

      // Y si dice que se puede reintentar sin lo vacio, ese reintento
      // tiene que entrar de verdad.
      const conservar = camposParaConservar(motivos)
      if (conservar) {
        const sinVacios = Object.fromEntries(
          Object.entries(caso.enviado).filter(([c]) => !conservar.includes(c)),
        )
        await assertSucceeds(setDoc(doc(db, `${NEGOCIO}/productos/DLB001`), sinVacios, { merge: true }))
        const quedo = await getDoc(doc(db, `${NEGOCIO}/productos/DLB001`))
        for (const campo of conservar) {
          expect(quedo.data()?.[campo]).toEqual(servidor[campo])
        }
      }
    })
  }
})
