/**
 * Baja todo Firestore a archivos JSON, para tener de donde volver.
 *
 * POR QUE EXISTE
 *
 * El plan Spark no tiene recuperacion a un momento determinado ni el
 * export administrado de Google: los dos piden Blaze. El 20/10/2026 se
 * perdieron los costos y los proveedores de cientos de productos, y lo
 * unico que hubo para recuperarlos fue el historial de la app y una
 * foto vieja de git. Si ese dia no hubiera estado el Excel, no se
 * recuperaba.
 *
 * Esto corre de noche, deja un JSON por coleccion y los commitea en un
 * repositorio PRIVADO. Cada commit es una foto completa, asi que se
 * puede volver a cualquier noche, y el diff de la mañana muestra
 * exactamente que cambio en el dia.
 *
 * Ademas frena: si una coleccion pierde documentos de golpe, o si
 * muchos productos se quedan sin costo o sin proveedor de un dia para
 * el otro, termina con error y GitHub manda el aviso. Ver
 * src/lib/respaldoAlarma.ts, que es donde esta esa logica y donde se
 * prueba.
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT='{...}' npx tsx scripts/respaldar-firestore.ts <carpeta>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  alarmasDelRespaldo,
  cargados,
  ordenarColeccion,
  type Coleccion,
} from '../src/lib/respaldoAlarma.ts'

const ID_NEGOCIO = 'el-club-del-mate'

/** Todo lo que la app sincroniza. Si se agrega una tabla, va aca. */
const COLECCIONES = [
  'productos',
  'proveedores',
  'usuarios',
  'jornadas',
  'ventas',
  'movimientos',
  'movimientosProveedor',
  'historial',
  'historialProductos',
  'borrados',
]

const carpeta = process.argv[2]
if (!carpeta) {
  console.error('Falta la carpeta de destino.')
  process.exit(2)
}
mkdirSync(carpeta, { recursive: true })

const credencial = process.env.FIREBASE_SERVICE_ACCOUNT
if (!credencial) {
  console.error('Falta FIREBASE_SERVICE_ACCOUNT.')
  process.exit(2)
}

initializeApp({ credential: cert(JSON.parse(credencial)) })
const db = getFirestore()

/** Lo que habia en el respaldo de anoche, para poder comparar. */
function respaldoAnterior(nombre: string): Coleccion | null {
  const ruta = join(carpeta, `${nombre}.json`)
  if (!existsSync(ruta)) return null
  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as Coleccion
  } catch {
    return null
  }
}

const alarmas: string[] = []
const documentosPorColeccion: Record<string, number> = {}
let lecturas = 0
let productosDeHoy: Coleccion = {}

for (const nombre of COLECCIONES) {
  const snap = await db.collection(`negocios/${ID_NEGOCIO}/${nombre}`).get()
  // Una coleccion vacia igual cuesta una lectura.
  lecturas += snap.size || 1

  const crudos: Coleccion = {}
  for (const doc of snap.docs) crudos[doc.id] = doc.data()
  const ordenados = ordenarColeccion(crudos)
  if (nombre === 'productos') productosDeHoy = ordenados

  alarmas.push(...alarmasDelRespaldo(nombre, respaldoAnterior(nombre), ordenados))

  writeFileSync(join(carpeta, `${nombre}.json`), JSON.stringify(ordenados, null, 1) + '\n')
  documentosPorColeccion[nombre] = snap.size
  console.log(`${nombre.padEnd(22)} ${String(snap.size).padStart(6)} documentos`)
}

const conDato = cargados(productosDeHoy)
writeFileSync(
  join(carpeta, 'resumen.json'),
  JSON.stringify(
    {
      cuando: new Date().toISOString(),
      documentos: documentosPorColeccion,
      total: Object.values(documentosPorColeccion).reduce((a, b) => a + b, 0),
      lecturas,
      productosConCosto: conDato.precioCompra,
      productosConProveedor: conDato.proveedor,
    },
    null,
    2,
  ) + '\n',
)

console.log(`\n${lecturas} lecturas. El plan Spark da 50.000 por dia.`)

if (alarmas.length > 0) {
  console.error('\nALARMA. El respaldo quedo guardado igual, pero esto no parece normal:\n')
  for (const a of alarmas) console.error(`  - ${a}`)
  console.error('\nMirá el diff del commit de hoy antes de que alguien siga cargando encima.')
  process.exit(1)
}
