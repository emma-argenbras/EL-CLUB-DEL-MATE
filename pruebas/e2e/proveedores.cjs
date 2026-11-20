// La limpieza de fichas de proveedor repetidas y vacías, de una vez (20/11).
// Armado como el servidor real del 13/11: muchas fichas con el mismo nombre,
// la mayoría vacías al lado de su gemela con productos, algunos nombres con
// todas sus fichas vacías y un par con datos de los dos lados. Emmanuel une
// todo de una desde su compu mientras el aparato de Sandra está abierto.
// Nombres inventados.
const { chromium } = require('playwright')
const A = require('./ayudas.cjs')
const CAP = A.CAPTURAS

const prov = (id, nombre, extra = {}) => ({ id, nombre, contacto: null, notas: null, activo: true, creadoEn: 1755500000000, ...extra })
const prod = (codigo, proveedorId, proveedor) => ({ id: codigo, codigo, descripcion: `Producto ${codigo}`, proveedor, proveedorId, fechaCompra: null, precioCompra: 100, rentabilidad: 1.3, precioVenta: 230, fechaPrecioVenta: null, busqueda: codigo.toLowerCase(), stock: null, activo: true })

;(async () => {
  const emma = await A.crearUsuario('emma@prueba.test')
  const sandra = await A.crearUsuario('sandra@prueba.test')
  await A.poner(`usuarios/${emma}`, { id: emma, email: 'emma@prueba.test', nombre: 'Emmanuel', rol: 'owner', activo: true })
  await A.poner(`usuarios/${sandra}`, { id: sandra, email: 'sandra@prueba.test', nombre: 'Sandra', rol: 'encargado', activo: true })
  const fichas = [], productos = []
  // 40 nombres con su gemela con productos y 1 o 2 vacías: 60 vacías.
  for (let i = 1; i <= 40; i++) {
    const nombre = `PROVEEDOR ${String(i).padStart(2, '0')}`
    fichas.push(prov(`g-${i}`, nombre))
    productos.push(prod(`P${i}A`, `g-${i}`, nombre), prod(`P${i}B`, `g-${i}`, nombre))
    fichas.push(prov(`v-${i}-1`, nombre, i % 7 === 0 ? { contacto: `3456 00${i}`, ciudad: 'Paraná' } : {}))
    if (i % 2 === 0) fichas.push(prov(`v-${i}-2`, `${nombre} `))
  }
  // 3 nombres con todas sus fichas vacías (2, 3 y 2 copias): 4 más.
  fichas.push(prov('tv-a1', 'TODAS VACIAS A'), prov('tv-a2', 'TODAS VACIAS A', { aliasCbu: 'a.mp' }))
  fichas.push(prov('tv-b1', 'TODAS VACIAS B'), prov('tv-b2', 'TODAS VACIAS B'), prov('tv-b3', 'TODAS VACIAS B', { activo: false }))
  fichas.push(prov('tv-c1', 'TODAS VACIAS C'), prov('tv-c2', 'TODAS VACIAS C'))
  // Un par con datos de los dos lados: va a mano.
  fichas.push(prov('d-1', 'CON DATOS LOS DOS'), prov('d-2', 'CON DATOS LOS DOS'))
  productos.push(prod('D1', 'd-1', 'CON DATOS LOS DOS'), prod('D2', 'd-2', 'CON DATOS LOS DOS'))
  // Uno que no se repite.
  fichas.push(prov('solo', 'UNICO'))
  await A.sembrar('proveedores', fichas)
  await A.sembrar('productos', productos)
  console.log('FICHAS en el servidor antes:', (await A.listar('proveedores')).length, '| vacías repetidas armadas: 60 + 4')

  const b = await chromium.launch()
  const opciones = { timezoneId: 'America/Argentina/Cordoba', locale: 'es-AR', viewport: { width: 1280, height: 900 } }
  const ps = await A.entrar(await b.newContext(opciones), 'sandra@prueba.test')
  console.log('SANDRA abrió la app; fichas en su aparato:', await ps.evaluate(() => new Promise((r) => { const q = indexedDB.open('el-club-del-mate'); q.onsuccess = () => { const c = q.result.transaction('proveedores').objectStore('proveedores').count(); c.onsuccess = () => r(c.result) } })))

  const p = await A.entrar(await b.newContext(opciones), 'emma@prueba.test')
  const preguntas = []
  p.on('dialog', async (d) => { preguntas.push(d.message()); await d.accept() })
  await p.goto(A.URL + '#/unir-proveedores'); await p.waitForTimeout(3000)
  const tarjeta = p.locator('.tarjeta', { hasText: 'Fichas repetidas vacías' })
  console.log('\nTÍTULO:', await tarjeta.locator('.tarjeta-titulo').innerText())
  const filas = tarjeta.locator('tbody tr')
  console.log('RENGLONES en la lista antes del botón:', await filas.count())
  for (const nombre of ['PROVEEDOR 07', 'TODAS VACIAS A', 'TODAS VACIAS B']) {
    for (const f of await filas.filter({ hasText: nombre }).all()) console.log('  ', (await f.innerText()).replace(/\s+/g, ' '))
  }
  console.log('BOTÓN:', await tarjeta.locator('button').innerText())
  console.log('A MANO:', await A.texto(p.locator('.tarjeta', { hasText: 'Mismo nombre, con datos en más de una' }).first()))
  await p.screenshot({ path: `${CAP}/proveedores-antes.png`, fullPage: true })

  await tarjeta.locator('button').click()
  await p.waitForTimeout(8000)
  console.log('\nPREGUNTA:\n' + preguntas.join('\n---\n'))
  console.log('\nLISTO:', await A.texto(p.locator('.aviso-ok').first()))
  // El aviso de la unión: primero «Confirmando…», después lo que contestó el servidor.
  const t0 = Date.now()
  for (let i = 0; i < 30; i++) {
    const t = await p.locator('.aviso', { hasText: /constancia/i }).allInnerTexts()
    const final = t.find((x) => /ya está|ya están|no llegó|Faltan|Falta 1|No se pudo confirmar/.test(x))
    if (final) { console.log(`CONSTANCIAS (a los ${Math.round((Date.now() - t0) / 1000) + 8} s de tocar):`, final); break }
    await p.waitForTimeout(2000)
  }
  console.log('RENGLÓN FIJO:', (await p.locator('.tarjeta', { hasText: 'Constancias en el servidor' }).innerText()).replace(/\s+/g, ' ').slice(0, 300))
  await p.screenshot({ path: `${CAP}/proveedores-despues.png`, fullPage: true })

  const enServidor = await A.listar('proveedores')
  const nombres = enServidor.map((x) => x.nombre.trim())
  console.log('\nSERVIDOR: fichas', enServidor.length, '| nombres repetidos', nombres.length - new Set(nombres).size)
  console.log('SERVIDOR constancias de proveedores:', (await A.listar('borrados')).filter((x) => x.id.startsWith('proveedores/')).length)
  const g7 = enServidor.find((x) => x.id === 'g-7'), ta = enServidor.filter((x) => x.nombre === 'TODAS VACIAS A')
  console.log('SERVIDOR g-7 rescató:', JSON.stringify({ contacto: g7?.contacto, ciudad: g7?.ciudad }), '| TODAS VACIAS A quedó:', ta.map((x) => `${x.id} ${x.aliasCbu ?? ''}`).join(', '))
  console.log('SERVIDOR productos que cambiaron de ficha:', (await A.listar('productos')).filter((x) => !productos.find((y) => y.codigo === x.codigo && y.proveedorId === x.proveedorId)).length)

  console.log('\n===== El aparato de Sandra, que estuvo abierto todo el tiempo =====')
  await ps.waitForTimeout(5000)
  await ps.reload(); await ps.waitForTimeout(12000)
  const enSandra = await ps.evaluate(() => new Promise((r) => { const q = indexedDB.open('el-club-del-mate'); q.onsuccess = () => { const c = q.result.transaction('proveedores').objectStore('proveedores').count(); c.onsuccess = () => r(c.result) } }))
  console.log('fichas en su aparato:', enSandra, '| en el servidor después de que volvió:', (await A.listar('proveedores')).length)
  await ps.goto(A.URL + '#/unir-proveedores'); await ps.waitForTimeout(3000)
  console.log('¿Le aparece la lista de vacías?', await ps.locator('.tarjeta', { hasText: 'Fichas repetidas vacías' }).count() ? 'sí' : 'no')
  const sinSubir = ps.locator('text=/sin subir/')
  console.log('«sin subir» en su aparato:', (await sinSubir.count()) ? await sinSubir.first().innerText() : 'nada')
  console.log('\nRECHAZOS anotados en el servidor:', (await A.listar('rechazos')).length)
  await b.close()
})().catch((e) => { console.error('FALLO:', e); process.exit(1) })
