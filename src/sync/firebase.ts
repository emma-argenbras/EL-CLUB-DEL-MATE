import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

/**
 * Este archivo solo se carga si "sync/config.ts" dice que la nube esta
 * configurada (ver el import() dinamico en sync/motor.ts / App.tsx), asi
 * que ya sabemos que las claves estan presentes cuando se ejecuta.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null

function iniciar() {
  if (app) return
  app = initializeApp(config)
  auth = getAuth(app)
  setPersistence(auth, browserLocalPersistence).catch(() => {
    /* Si el navegador no lo permite, sigue andando: solo hay que loguearse mas seguido. */
  })
  // Cache local propio de Firestore: permite seguir leyendo y escribiendo
  // sin internet, y sincroniza solo cuando vuelve la conexion.
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
}

export function obtenerAuth(): Auth {
  iniciar()
  return auth!
}

export function obtenerFirestore(): Firestore {
  iniciar()
  return firestore!
}

/**
 * Crea un usuario nuevo requiere llamar a createUserWithEmailAndPassword,
 * pero eso deja logueado como ESE usuario nuevo en vez del que lo esta
 * creando (es como funciona el SDK de Firebase Auth). Para que un dueño
 * pueda dar de alta a un empleado sin perder su propia sesion, se usa una
 * instancia secundaria y desechable de la app, solo para ese momento.
 */
export function crearAuthSecundario(): { auth: Auth; limpiar: () => Promise<void> } {
  const appSecundaria = initializeApp(config, `alta-${Date.now()}`)
  const authSecundaria = getAuth(appSecundaria)
  return {
    auth: authSecundaria,
    limpiar: () => deleteApp(appSecundaria),
  }
}
