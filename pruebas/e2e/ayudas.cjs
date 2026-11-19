// Lo comun de los guiones de punta a punta: hablarle a los emuladores por
// REST (como dueño, salteando las reglas) y manejar el navegador.
//
// Todo lo que hay aca es de mentira: los mails, los nombres y los montos.
// Ningun dato del negocio entra en estos guiones.
const os = require('os')
const path = require('path')
/** Donde quedan las capturas de pantalla. */
const CAPTURAS = process.env.CAPTURAS || path.join(os.tmpdir(), 'ecdm-e2e', 'capturas')
require('fs').mkdirSync(CAPTURAS, { recursive: true })
const P = 'demo-ecdm', FS = 'http://127.0.0.1:8080', AU = 'http://127.0.0.1:9099'
const RAIZ = `projects/${P}/databases/(default)/documents/negocios/el-club-del-mate`
const BASE = `${FS}/v1/${RAIZ}`
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
const URL = 'http://localhost:4174/'

function v(x) {
  if (x === null || x === undefined) return { nullValue: null }
  if (typeof x === 'boolean') return { booleanValue: x }
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }
  if (typeof x === 'string') return { stringValue: x }
  if (Array.isArray(x)) return { arrayValue: { values: x.map(v) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } }
}
function d(f) {
  if ('nullValue' in f) return null
  if ('booleanValue' in f) return f.booleanValue
  if ('integerValue' in f) return Number(f.integerValue)
  if ('doubleValue' in f) return f.doubleValue
  if ('stringValue' in f) return f.stringValue
  if ('arrayValue' in f) return (f.arrayValue.values ?? []).map(d)
  if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields ?? {}).map(([k, y]) => [k, d(y)]))
}
const doc_ = (j) => Object.fromEntries(Object.entries(j.fields ?? {}).map(([k, y]) => [k, d(y)]))

async function poner(ruta, datos, cabeceras = H) {
  const r = await fetch(`${BASE}/${ruta}`, { method: 'PATCH', headers: cabeceras, body: JSON.stringify({ fields: v(datos).mapValue.fields }) })
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${(await r.text()).slice(0, 200)}`)
}
async function leer(ruta, cabeceras = H) {
  const r = await fetch(`${BASE}/${ruta}`, { headers: cabeceras })
  return r.ok ? doc_(await r.json()) : null
}
/** El codigo de respuesta, para probar permisos con el token de alguien. */
async function estado(ruta, cabeceras, metodo = 'GET', datos) {
  const r = await fetch(`${BASE}/${ruta}`, { method: metodo, headers: cabeceras, body: datos ? JSON.stringify({ fields: v(datos).mapValue.fields }) : undefined })
  return r.status
}
async function listar(col) {
  const todos = []
  let pagina = ''
  do {
    const r = await fetch(`${BASE}/${col}?pageSize=300${pagina ? `&pageToken=${pagina}` : ''}`, { headers: H })
    const j = await r.json()
    for (const x of j.documents ?? []) todos.push({ id: x.name.split('/').pop(), ...doc_(x) })
    pagina = j.nextPageToken ?? ''
  } while (pagina)
  return todos
}
async function sembrar(col, docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const writes = docs.slice(i, i + 400).map((x) => ({ update: { name: `${RAIZ}/${col}/${x.id}`, fields: v(x).mapValue.fields } }))
    const r = await fetch(`${FS}/v1/projects/${P}/databases/(default)/documents:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes }) })
    if (!r.ok) throw new Error(`sembrar ${col}: ${await r.text()}`)
  }
}
async function crearUsuario(email, password = 'clave123') {
  const r = await fetch(`${AU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })
  return (await r.json()).localId
}
/** El token de alguien, para hablarle al servidor como esa persona (con las reglas). */
async function tokenDe(email, password = 'clave123') {
  const r = await fetch(`${AU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })
  return { Authorization: 'Bearer ' + (await r.json()).idToken, 'Content-Type': 'application/json' }
}
async function ponerReglas(texto) {
  const r = await fetch(`${FS}/emulator/v1/projects/${P}:securityRules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: texto }] } }) })
  return r.status
}

/**
 * Abre la app en un aparato nuevo y entra con esa cuenta. Antes vacia lo
 * que la app siembra al abrirse (el catalogo): contra un servidor vacio
 * lo subiria entero, que en el servidor real no pasa porque ya esta.
 */
async function entrar(ctx, email, password = 'clave123') {
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log(`ERROR DE PAGINA (${email}):`, e.message))
  await p.goto(URL)
  await p.locator('input[placeholder="tu-mail@elclubdelmate.com"]').waitFor({ timeout: 60000 })
  await p.waitForTimeout(1500)
  await p.evaluate(async () => {
    const req = indexedDB.open('el-club-del-mate')
    const dbx = await new Promise((r) => { req.onsuccess = () => r(req.result) })
    const tablas = ['productos', 'ventas', 'jornadas', 'movimientos', 'historial', 'historialProductos', 'proveedores', 'movimientosProveedor'].filter((t) => dbx.objectStoreNames.contains(t))
    const tx = dbx.transaction(tablas, 'readwrite')
    for (const t of tablas) tx.objectStore(t).clear()
    await new Promise((r) => { tx.oncomplete = r })
    dbx.close()
  })
  await p.reload()
  await p.locator('input[placeholder="tu-mail@elclubdelmate.com"]').fill(email)
  await p.locator('input[placeholder="Mínimo 6 caracteres"]').fill(password)
  await p.locator('button', { hasText: 'Entrar' }).click()
  await p.locator('main.contenido').waitFor({ timeout: 60000 })
  await p.waitForTimeout(6000)
  return p
}

/**
 * Busca esos textos en TODO lo que el navegador guarda de la app: cada
 * base de IndexedDB (la de la app y las de Firebase), localStorage y
 * sessionStorage. Devuelve donde aparecio cada uno.
 */
async function rastros(p, textos) {
  return p.evaluate(async (textos) => {
    const hallados = []
    let filas = 0
    const bases = await indexedDB.databases()
    for (const { name } of bases) {
      const req = indexedDB.open(name)
      const dbx = await new Promise((r) => { req.onsuccess = () => r(req.result); req.onerror = () => r(null) })
      if (!dbx) continue
      for (const tabla of [...dbx.objectStoreNames]) {
        const todo = await new Promise((r) => { const q = dbx.transaction(tabla).objectStore(tabla).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => r([]) })
        filas += todo.length
        const comoTexto = JSON.stringify(todo, (k, x) => (x instanceof Uint8Array ? new TextDecoder().decode(x) : typeof x === 'bigint' ? String(x) : x))
        for (const t of textos) if (comoTexto.includes(t)) hallados.push(`${t} en ${name}/${tabla}`)
      }
      dbx.close()
    }
    for (const [nombre, almacen] of [['localStorage', localStorage], ['sessionStorage', sessionStorage]]) {
      const comoTexto = JSON.stringify(Object.entries(almacen))
      for (const t of textos) if (comoTexto.includes(t)) hallados.push(`${t} en ${nombre}`)
    }
    return { bases: bases.length, filas, hallados }
  }, textos)
}

const dia = (n) => new Date(Date.now() - 3 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10)
const texto = async (loc) => (await loc.innerText()).replace(/\s*\n\s*/g, ' | ')

module.exports = { CAPTURAS, P, FS, AU, BASE, H, URL, v, d, poner, leer, estado, listar, sembrar, crearUsuario, tokenDe, ponerReglas, entrar, rastros, dia, texto }
