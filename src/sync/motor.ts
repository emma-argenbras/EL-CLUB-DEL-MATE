import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  comoRemoto,
  db,
  engancharSync,
  type AccionCambio,
  type NombreTabla,
} from '../db/db'
import { ID_NEGOCIO } from './config'
import { fijarEstadoNube } from './estado'
import { obtenerAuth, obtenerFirestore } from './firebase'

const TABLAS: NombreTabla[] = ['productos', 'jornadas', 'ventas', 'movimientos']

let desuscribirColecciones: Unsubscribe[] = []
let motorIniciado = false

/** Convierte undefined en null: Firestore no acepta valores undefined. */
function limpiar(obj: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(obj)) {
    limpio[clave] = valor === undefined ? null : valor
  }
  return limpio
}

function pushCambio(tabla: NombreTabla, accion: AccionCambio, clave: string, doc_: unknown) {
  const auth = obtenerAuth()
  if (!auth.currentUser) return
  const firestore = obtenerFirestore()

  const referencia = doc(firestore, 'negocios', ID_NEGOCIO, tabla, clave)
  if (accion === 'borrar') {
    deleteDoc(referencia).catch((e) => console.warn(`No se pudo sincronizar el borrado en ${tabla}:`, e))
  } else {
    setDoc(referencia, limpiar(doc_ as Record<string, unknown>)).catch((e) =>
      console.warn(`No se pudo sincronizar ${tabla}:`, e),
    )
  }
}

/** Sube todo lo que ya hay en el dispositivo. Se usa una vez, al vincular la cuenta. */
async function empujarTodoLocal() {
  for (const tabla of TABLAS) {
    const filas = await db.table(tabla).toArray()
    for (const fila of filas) {
      const clave =
        tabla === 'productos' ? (fila as { codigo: string }).codigo : (fila as { id: string }).id
      pushCambio(tabla, 'guardar', clave, fila)
    }
  }
}

function escucharColecciones() {
  const firestore = obtenerFirestore()

  desuscribirColecciones.forEach((f) => f())
  desuscribirColecciones = TABLAS.map((tabla) => {
    const referencia = collection(firestore, 'negocios', ID_NEGOCIO, tabla)
    return onSnapshot(
      referencia,
      (instantanea) => {
        comoRemoto(async () => {
          for (const cambio of instantanea.docChanges()) {
            if (cambio.type === 'removed') {
              await db.table(tabla).delete(cambio.doc.id)
            } else {
              await db.table(tabla).put({ ...cambio.doc.data() })
            }
          }
        }).catch((e) => console.warn(`Error aplicando cambios remotos de ${tabla}:`, e))
        fijarEstadoNube({ estado: 'sincronizado', error: null, ultimaRecepcion: Date.now() })
      },
      (error) => {
        console.warn(`Error escuchando ${tabla}:`, error)
        fijarEstadoNube({ estado: 'error', error: error.message })
      },
    )
  })
}

function dejarDeEscuchar() {
  desuscribirColecciones.forEach((f) => f())
  desuscribirColecciones = []
}

/**
 * Arranca el motor de sincronizacion. Se llama solo despues de confirmar
 * que la nube esta configurada (ver App.tsx), asi que aca ya se puede
 * usar Firebase sin chequear de nuevo.
 */
export function iniciarMotor(): void {
  if (motorIniciado) return
  motorIniciado = true

  engancharSync(pushCambio)

  onAuthStateChanged(obtenerAuth(), (usuario: User | null) => {
    if (usuario) {
      fijarEstadoNube({ estado: 'conectando', email: usuario.email, error: null })
      escucharColecciones()
      empujarTodoLocal().catch((e) => console.warn('No se pudo subir el estado inicial:', e))
    } else {
      dejarDeEscuchar()
      fijarEstadoNube({ estado: 'desconectado', email: null })
    }
  })
}

export async function vincularDispositivo(email: string, contrasena: string): Promise<void> {
  const auth = obtenerAuth()
  try {
    await signInWithEmailAndPassword(auth, email, contrasena)
  } catch (e) {
    const codigo = (e as { code?: string }).code
    if (codigo === 'auth/user-not-found' || codigo === 'auth/invalid-credential') {
      // El primer dispositivo en vincularse crea la cuenta compartida del negocio.
      await createUserWithEmailAndPassword(auth, email, contrasena)
    } else {
      throw e
    }
  }
}

export async function desvincularDispositivo(): Promise<void> {
  await signOut(obtenerAuth())
}
