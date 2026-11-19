// Sueldos y retiros, de punta a punta (19/11): el dueño, la encargada y una
// empleada, cada una en su aparato, contra los emuladores con las reglas.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const A = require('./ayudas.cjs')
const CAP = A.CAPTURAS
// Los montos acordados son numeros que no aparecen en ningun otro lado:
// asi se pueden buscar en todo lo que guarda cada aparato.
// Son montos POR SEMANA: se cobra cada sabado (decision de Emmanuel, 19/11).
const DE_SANDRA = '912345', DE_GABI = '654321'
const hoy = A.dia(0), mes = hoy.slice(0, 7)
/** Cuantos sabados tiene este mes desde ese dia: es por lo que se multiplica el monto de la semana. */
const sabadosDesde = (desde) => {
  const [a, m] = mes.split('-').map(Number)
  let n = 0
  for (let dd = 1; dd <= 31; dd++) {
    const f = new Date(Date.UTC(a, m - 1, dd))
    if (f.getUTCMonth() !== m - 1) break
    if (f.toISOString().slice(0, 10) >= desde && f.getUTCDay() === 6) n++
  }
  return n
}
// A Sandra se le define desde el dia 2 y a Gabriela desde el 1.
const MES_SANDRA = String(Number(DE_SANDRA) * sabadosDesde(`${mes}-02`)), MES_GABI = String(Number(DE_GABI) * sabadosDesde(`${mes}-01`))
const ACORDADO = [DE_SANDRA, DE_GABI, MES_SANDRA, MES_GABI]
const gasto = (id, dia, concepto, monto, extra = {}) => ({ id, fecha: `${mes}-${dia}`, tipo: 'EGRESO_CAJA', concepto, monto, categoria: 'OTROS', cuenta: 'cajon', jornadaId: null, esVariable: true, ...extra })
const delServidor = async (id) => { const m = await A.leer(`movimientos/${id}`); return m ? `${m.categoria}/${m.persona ?? 'sin persona'}` : '(no está)' }

;(async () => {
  const uidE = await A.crearUsuario('emma@prueba.test')
  const uidS = await A.crearUsuario('sandra@prueba.test')
  const uidG = await A.crearUsuario('gabi@prueba.test')
  await A.poner(`usuarios/${uidE}`, { id: uidE, email: 'emma@prueba.test', nombre: 'Emmanuel', rol: 'owner', activo: true })
  // Elena es dueña y no usa la app: no tiene cuenta. La agrega el dueño desde Ajustes, mas abajo.
  await A.poner(`usuarios/${uidS}`, { id: uidS, email: 'sandra@prueba.test', nombre: 'Sandra', rol: 'encargado', activo: true })
  await A.poner(`usuarios/${uidG}`, { id: uidG, email: 'gabi@prueba.test', nombre: 'Gabriela Pérez', rol: 'empleado', activo: true, secciones: null })
  const nombres = { [uidE]: 'Emmanuel', [uidS]: 'Sandra', [uidG]: 'Gabriela' }
  // Como estaba cargado: los pagos por semana con apodo y en OTROS, y los retiros de Elena igual.
  await A.sembrar('movimientos', [
    gasto('g1', '01', 'SEMANA GABI', 100001),
    gasto('g2', '02', 'GABI SEMANA', 100002),
    gasto('g3', '03', 'SEMANA GABI', 100003),
    gasto('s1', '04', 'Sueldos de la semana', 100004, { categoria: 'SUELDOS', esVariable: false }),
    gasto('e1', '05', 'ELENA', 200001),
    gasto('e2', '06', 'RETIRO MAMA', 200002),
    gasto('r1', '07', 'retiro', 200003, { categoria: 'RETIRO SOCIOS' }),
    gasto('f1', '08', 'FLETE', 5000),
  ])
  for (const turno of ['M', 'T']) {
    await A.poner(`jornadas/j-${turno}`, { id: `j-${turno}`, fecha: hoy, turno, estado: 'abierto', vendedor: 'Gabriela', cajaInicial: 10000, horaApertura: '09:00', horaCierre: null, arqueoApertura: { billetes: { 1000: 10 }, monedas: 0 }, arqueoCierre: null, notaCierre: null, cierreAutorizado: null, solicitudCierre: null, notas: null })
  }
  const quien = (m) => `${m.categoria}/${nombres[m.persona] ?? m.persona ?? 'sin persona'}`
  const b = await chromium.launch()
  const opciones = { timezoneId: 'America/Argentina/Cordoba', locale: 'es-AR' }

  // ───────────────────────── EL DUEÑO ─────────────────────────
  console.log('\n===== EMMANUEL (dueño), en su compu =====')
  const ctxE = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opciones })
  const pE = await A.entrar(ctxE, 'emma@prueba.test')
  const preguntas = []
  pE.on('dialog', async (dl) => { preguntas.push(dl.message().replace(/\n+/g, ' / ')); await dl.accept() })
  // Elena, dueña sin cuenta: para anotarle los retiros sin darle acceso.
  await pE.goto(A.URL + '#/ajustes'); await pE.waitForTimeout(2500)
  await pE.locator('button', { hasText: '+ Dueño que no usa la app' }).click()
  await pE.locator('#dueno-sin-cuenta').fill('Elena')
  await pE.locator('button', { hasText: /^Agregar$/ }).click(); await pE.waitForTimeout(2000)
  console.log('DUEÑO SIN CUENTA, pregunta:', preguntas.shift())
  console.log('   aviso:', await A.texto(pE.locator('.aviso-ok').first()))
  console.log('   en la lista:', await A.texto(pE.locator('li.item', { hasText: 'Elena' })))
  const elena = (await A.listar('usuarios')).find((u) => u.nombre === 'Elena')
  console.log('   SERVIDOR:', elena ? `id ${elena.id.startsWith('sin-cuenta-') ? 'sin-cuenta-…' : elena.id} · rol ${elena.rol} · activo ${elena.activo} · sinCuenta ${elena.sinCuenta} · mail «${elena.email}»` : '(NO LLEGÓ)')
  const uidElena = elena.id
  nombres[uidElena] = 'Elena'
  const lasCuentas = await A.cuentas()
  console.log('   cuentas en el servidor de cuentas:', lasCuentas.length, `(${lasCuentas.map((c) => c.email).sort().join(', ')})`, '| ¿alguna de Elena?', lasCuentas.some((c) => (c.email ?? '').includes('elena')))
  await pE.locator('button', { hasText: '+ Dueño que no usa la app' }).click()
  await pE.locator('#dueno-sin-cuenta').fill('  elena ')
  await pE.locator('button', { hasText: /^Agregar$/ }).click(); await pE.waitForTimeout(800)
  console.log('   otra «elena»:', (await pE.locator('.aviso-error').count()) ? await A.texto(pE.locator('.aviso-error').first()) : '(LA DEJÓ)')
  await pE.locator('.tarjeta', { hasText: 'Usuarios del equipo' }).first().screenshot({ path: `${CAP}/ajustes-dueno-sin-cuenta.png` })
  await pE.locator('button', { hasText: 'Cancelar' }).last().click()
  await pE.goto(A.URL + '#/sueldos'); await pE.waitForTimeout(3500)
  console.log('TÍTULO:', await pE.locator('h2').innerText(), '|', (await A.texto(pE.locator('.aviso-ojo').first())).slice(0, 150))
  console.log('EN SUELDOS FIGURAN:', (await pE.locator('section[aria-label^="Sueldo de "]').evaluateAll((l) => l.map((x) => x.getAttribute('aria-label')))).join(', '))
  // Por semana, que es como se cobra en el local. A Sandra se le mira antes
  // la opcion «por mes», que tiene que seguir estando.
  const pide = async (t) => `${await t.locator('label[for^="sueldo-"]').innerText()} + ${await t.locator('label[for^="desde-"]').innerText()} (${await t.locator('input[id^="desde-"]').getAttribute('type')}, ${await t.locator('input[id^="desde-"]').inputValue()})`
  const tS0 = pE.locator('section[aria-label="Sueldo de Sandra"]')
  await tS0.locator('button', { hasText: 'Definir sueldo' }).click()
  const cadaS = tS0.locator('select[id^="cada-"]')
  console.log('DEFINIR, cómo cobra (viene elegido):', await cadaS.inputValue(), '| opciones:', (await cadaS.locator('option').allInnerTexts()).join(' / '))
  console.log('   por semana pide:', await pide(tS0))
  await cadaS.selectOption('mes')
  console.log('   por mes pide:', await pide(tS0))
  await cadaS.selectOption('semana')
  await tS0.locator('input[id^="sueldo-"]').fill(DE_SANDRA)
  await tS0.locator('input[id^="desde-"]').fill(`${mes}-02`)
  await tS0.screenshot({ path: `${CAP}/definir-por-semana.png` })
  await tS0.locator('button', { hasText: 'Guardar' }).click(); await pE.waitForTimeout(2500)
  const tG0 = pE.locator('section[aria-label="Sueldo de Gabriela Pérez"]')
  await tG0.locator('button', { hasText: 'Definir sueldo' }).click()
  await tG0.locator('input[id^="sueldo-"]').fill(DE_GABI)
  await tG0.locator('button', { hasText: 'Guardar' }).click(); await pE.waitForTimeout(2500)
  console.log('PREGUNTA al definir el de Sandra (desde el 2):', preguntas[0])
  console.log('PREGUNTA al definir el de Gabriela (desde el 1.º):', preguntas[1])
  console.log('AVISO:', await A.texto(pE.locator('.aviso-ok').first()))
  console.log('SERVIDOR fichas:', (await A.listar('sueldos')).map((f) => `${f.nombre}=${f.acuerdos.map((a) => `${a.monto} por ${a.cada} desde ${a.desde}`).join(' + ')} (forma ${f.forma})`).join(' ; '))
  console.log(`ESPERADO en el mes: Sandra ${DE_SANDRA} × ${sabadosDesde(`${mes}-02`)} = ${MES_SANDRA} · Gabriela ${DE_GABI} × ${sabadosDesde(`${mes}-01`)} = ${MES_GABI}`)
  for (const nombre of ['Sandra', 'Gabriela Pérez']) {
    const t = pE.locator(`section[aria-label="Sueldo de ${nombre}"]`)
    console.log(`TARJETA de ${nombre}:`, await A.texto(t.locator('.fila').first()), '|', (await t.locator('.cuenta-del-sueldo').count()) ? await t.locator('.cuenta-del-sueldo').innerText() : '(SIN LA CUENTA)')
  }
  // Volver a «por mes» desde este mes, con uno por semana que empezó el 2: avisa y no guarda.
  await tS0.locator('button', { hasText: 'Cambiar el sueldo' }).click()
  console.log('CAMBIAR, viene con:', await tS0.locator('select[id^="cada-"]').inputValue(), await tS0.locator('input[id^="sueldo-"]').inputValue())
  await tS0.locator('select[id^="cada-"]').selectOption('mes')
  await tS0.locator('input[id^="sueldo-"]').fill('777777')
  const antesDeIntentar = preguntas.length
  await tS0.locator('button', { hasText: 'Guardar' }).click(); await pE.waitForTimeout(2500)
  console.log('POR MES desde este mes:', (await pE.locator('.aviso-error').count()) ? (await A.texto(pE.locator('.aviso-error').first())).slice(0, 240) : '(SIN AVISO)', '| ¿preguntó?', preguntas.length > antesDeIntentar, '| ¿llegó al servidor?', JSON.stringify(await A.leer(`sueldos/${uidS}`)).includes('777777'))
  await tS0.locator('button', { hasText: 'Cancelar' }).click()

  const sug = pE.locator('section[aria-label="Gastos que parecen un sueldo"]')
  console.log('¿ESTO ES UN SUELDO? (antes):', (await sug.locator('li.item').evaluateAll((l) => l.map((x) => x.querySelector('.item-titulo').textContent + ' → ' + (x.querySelectorAll('.item-sub')[0].textContent.includes('parece de') ? 'sabe de quién' : 'no sabe de quién')))).join(' ; '))
  await sug.locator('li.item').first().locator('select').selectOption({ label: 'Gabriela Pérez' }); await pE.waitForTimeout(1500)
  const oferta = pE.locator('[role="status"]', { hasText: 'le dicen' })
  console.log('OFRECE RECORDAR EL APODO:', (await oferta.count()) ? (await A.texto(oferta)).slice(0, 110) : '(NO OFRECIÓ)')
  await oferta.locator('button', { hasText: 'Sí, recordarlo' }).click(); await pE.waitForTimeout(1500)
  console.log('AVISO:', await A.texto(pE.locator('.aviso-ok').first()))
  console.log('¿ESTO ES UN SUELDO? (con el apodo):', (await sug.locator('li.item').evaluateAll((l) => l.map((x) => x.querySelector('.item-titulo').textContent + ' → ' + (x.querySelector('button') ? x.querySelector('button').textContent : 'sin botón')))).join(' ; '))
  await sug.locator('li.item').first().locator('button', { hasText: 'Sí, es de Gabriela' }).click(); await pE.waitForTimeout(1200)
  await pE.locator('section[aria-label="Pagos sin asignar"] select').first().selectOption({ label: 'Gabriela Pérez' }); await pE.waitForTimeout(1200)
  if (await pE.locator('[role="status"]', { hasText: 'le dicen' }).count()) await pE.locator('[role="status"] button', { hasText: /^No$/ }).click()

  const ret = pE.locator('section[aria-label="Gastos que parecen un retiro"]')
  console.log('¿ES UN RETIRO? (antes):', (await ret.locator('li.item').evaluateAll((l) => l.map((x) => x.querySelector('.item-titulo').textContent + ' → ' + (x.querySelector('button') ? x.querySelector('button').textContent : 'sin botón')))).join(' ; '))
  await ret.locator('li.item', { hasText: 'ELENA' }).locator('button', { hasText: 'Sí, es de Elena' }).click(); await pE.waitForTimeout(1200)
  await ret.locator('li.item', { hasText: 'RETIRO MAMA' }).locator('select').selectOption({ label: 'Elena' }); await pE.waitForTimeout(1500)
  const oferta2 = pE.locator('[role="status"]', { hasText: 'le dicen' })
  console.log('OFRECE RECORDAR EL APODO:', (await oferta2.count()) ? (await A.texto(oferta2)).slice(0, 90) : '(NO OFRECIÓ)')
  if (await oferta2.count()) { await oferta2.locator('button', { hasText: 'Sí, recordarlo' }).click(); await pE.waitForTimeout(1200) }
  await pE.locator('section[aria-label="Retiros sin asignar"] select').first().selectOption({ label: 'Emmanuel' }); await pE.waitForTimeout(1500)
  if (await pE.locator('[role="status"]', { hasText: 'le dicen' }).count()) await pE.locator('[role="status"] button', { hasText: /^No$/ }).click()
  await pE.waitForTimeout(2500)
  console.log('GABRIELA:', (await A.texto(pE.locator('section[aria-label="Sueldo de Gabriela Pérez"]'))).slice(0, 210))
  console.log('RETIROS:', await A.texto(pE.locator('section[aria-label="Retiros de los dueños"] .fila.destacada')))
  for (const n of ['Elena', 'Emmanuel']) console.log(`  ${n}:`, await A.texto(pE.locator(`section[aria-label="Retiros de ${n}"] .fila.destacada`)))
  await pE.screenshot({ path: `${CAP}/sueldos-dueno.png`, fullPage: true })
  const movs = Object.fromEntries((await A.listar('movimientos')).map((m) => [m.id, m]))
  console.log('SERVIDOR movimientos:', ['g1', 'g2', 'g3', 's1', 'e1', 'e2', 'r1', 'f1'].map((id) => `${id}=${quien(movs[id])}`).join(' ; '))
  console.log('SERVIDOR apodos:', (await A.listar('usuarios')).filter((u) => u.apodos).map((u) => `${u.nombre}: ${u.apodos}`).join(' ; ') || '(ninguno)')
  const hist = (await A.listar('historial')).filter((h) => h.motivo === 'Ordenado desde Sueldos')
  console.log('SERVIDOR historial «Ordenado desde Sueldos»:', hist.length, 'renglones ·', [...new Set(hist.map((h) => `${h.tabla}.${h.campo}`))].sort().join(', '))
  console.log('  ¿el historial nombra los montos acordados?', hist.some((h) => ACORDADO.some((x) => JSON.stringify(h).includes(x))), '| ¿y la colección sueldos?', (await A.listar('historial')).some((h) => h.tabla === 'sueldos'))
  let r = await A.rastros(pE, ACORDADO)
  console.log(`APARATO DEL DUEÑO: ${r.bases} bases, ${r.filas} filas y ${r.guardadas} archivos de la caché revisados | rastros de lo acordado: ${r.hallados.join(', ') || 'ninguno'}`)
  // Control: un pago, que SI se guarda en el aparato, tiene que aparecer. Si no, la busqueda no sirve.
  const control = await A.rastros(pE, ['100001'])
  console.log('   control (un pago, que sí se guarda): aparece en', control.hallados.map((h) => h.split(' en ')[1].split('/')[0]).filter((x, i, l) => l.indexOf(x) === i).join(' y ') || 'NINGÚN LADO: LA BÚSQUEDA NO SIRVE')
  // Y el de la cache: un texto de la propia app tiene que estar entre lo que guardo el service worker.
  const controlCache = await A.rastros(pE, ['Mi sueldo'])
  console.log('   control de la caché (un texto de la app):', controlCache.hallados.some((h) => h.includes(' en la cache ')) ? 'aparece' : 'NO APARECE: LA CACHÉ NO SE ESTÁ REVISANDO')
  // En el celular.
  const ctxEc = await b.newContext({ viewport: { width: 390, height: 844 }, ...opciones, storageState: await ctxE.storageState({ indexedDB: true }) })
  const pEc = await ctxEc.newPage()
  await pEc.goto(A.URL + '#/sueldos'); await pEc.waitForTimeout(6000)
  console.log('CELULAR del dueño, desborde horizontal:', await pEc.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
  await pEc.screenshot({ path: `${CAP}/sueldos-dueno-celular.png`, fullPage: true })
  await ctxEc.close()

  // ───────────────────────── LA ENCARGADA ─────────────────────────
  console.log('\n===== SANDRA (encargada), en la compu del local =====')
  const ctxS = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opciones })
  const pS = await A.entrar(ctxS, 'sandra@prueba.test')
  pS.on('dialog', async (dl) => { await dl.accept() })
  await pS.goto(A.URL + '#/gastos'); await pS.waitForTimeout(2500)
  console.log('GASTOS, tarjeta Sueldos:', await pS.locator('a', { hasText: 'Ver sueldos' }).count())
  await pS.goto(A.URL + '#/sueldos'); await pS.waitForTimeout(3500)
  console.log('AVISO:', (await A.texto(pS.locator('.aviso-ojo').first())).slice(0, 260))
  console.log('VE lo acordado:', (await A.texto(pS.locator('section[aria-label="Total del mes"]'))).slice(0, 140))
  console.log('  Sandra:', (await A.texto(pS.locator('section[aria-label="Sueldo de Sandra"] .fila').first())), '| Gabriela:', await A.texto(pS.locator('section[aria-label="Sueldo de Gabriela Pérez"] .fila').first()))
  console.log('BOTONES para definir o cambiar un sueldo:', await pS.locator('button', { hasText: /Definir sueldo|Cambiar el sueldo/ }).count())
  const sugS = pS.locator('section[aria-label="Gastos que parecen un sueldo"]')
  console.log('¿ESTO ES UN SUELDO?:', (await sugS.locator('li.item').evaluateAll((l) => l.map((x) => x.querySelector('.item-titulo').textContent + ' → ' + (x.querySelector('button') ? x.querySelector('button').textContent : 'sin botón')))).join(' ; '))
  await sugS.locator('li.item').first().locator('button', { hasText: 'Sí, es de Gabriela' }).click(); await pS.waitForTimeout(2000)
  console.log('SERVIDOR g3 (lo asignó la encargada):', await delServidor('g3'))
  await pS.screenshot({ path: `${CAP}/sueldos-encargada.png`, fullPage: true })
  // Cargar un gasto: la app ofrece cargarlo como lo que parece.
  await pS.goto(A.URL + '#/gastos'); await pS.waitForTimeout(1500)
  for (const [concepto, monto, id] of [['gabi semana', '100005', 'sueldo'], ['Elena', '200004', 'retiro']]) {
    await pS.locator('button', { hasText: '+ Cargar gasto' }).click()
    await pS.locator('#g-concepto').fill(concepto); await pS.locator('#g-monto').fill(monto)
    const pista = pS.locator('[role="status"]', { hasText: '¿Es ' })
    console.log(`AL CARGAR «${concepto}» ofrece:`, (await pista.count()) ? (await A.texto(pista)).slice(0, 80) : '(NADA)')
    if (id === 'sueldo') await pS.screenshot({ path: `${CAP}/gasto-sugerencia.png` })
    await pista.locator('button', { hasText: 'Sí, cargarlo así' }).click(); await pS.waitForTimeout(400)
    console.log('   queda:', await pS.locator('#g-cat').inputValue(), '·', nombres[await pS.locator('#g-persona').inputValue()] ?? '(sin persona)', '| ¿sigue ofreciendo?', await pista.count())
    await pS.locator('.botonera button', { hasText: 'Guardar' }).click(); await pS.waitForTimeout(1500)
  }
  const cargados = (await A.listar('movimientos')).filter((m) => [100005, 200004].includes(m.monto))
  console.log('SERVIDOR lo cargado:', cargados.map((m) => `${m.concepto}=${quien(m)}`).sort().join(' ; '))
  await pS.goto(A.URL + '#/mi-sueldo'); await pS.waitForTimeout(3000)
  console.log('MI SUELDO de Sandra:', (await A.texto(pS.locator('section[aria-label="Mi sueldo del mes"]'))).slice(0, 260))
  await pS.goto(A.URL + '#/ajustes'); await pS.waitForTimeout(2500)
  console.log('AJUSTES, botón para agregar un dueño sin cuenta:', await pS.locator('button', { hasText: '+ Dueño que no usa la app' }).count(), '| botones en la fila de Elena:', await pS.locator('li.item', { hasText: 'Elena' }).locator('button').count())
  const filaG = pS.locator('li.item', { hasText: 'Gabriela Pérez' })
  console.log('AJUSTES, Gabriela:', (await A.texto(filaG)).slice(0, 150))
  await filaG.locator('button', { hasText: 'Apodos' }).click(); await pS.waitForTimeout(400)
  await filaG.locator('input[id^="apodos-"]').fill('Gabi, Gaby')
  await filaG.screenshot({ path: `${CAP}/ajustes-apodos.png` })
  await filaG.locator('button', { hasText: 'Guardar' }).click(); await pS.waitForTimeout(1500)
  console.log('SERVIDOR apodos de Gabriela:', (await A.leer(`usuarios/${uidG}`)).apodos)
  r = await A.rastros(pS, ACORDADO)
  console.log(`COMPU DEL LOCAL, después de que la encargada vio Sueldos: ${r.bases} bases, ${r.filas} filas y ${r.guardadas} archivos de la caché | rastros de lo acordado: ${r.hallados.join(', ') || 'ninguno'}`)

  // ───────────────────────── LA EMPLEADA ─────────────────────────
  console.log('\n===== GABRIELA (empleada), en su celular =====')
  const ctxG = await b.newContext({ viewport: { width: 390, height: 844 }, ...opciones })
  const pG = await A.entrar(ctxG, 'gabi@prueba.test')
  pG.on('dialog', async (dl) => { console.log('   PREGUNTA:', dl.message().slice(0, 120)); await dl.accept() })
  await pG.locator('nav.menu .menu-item', { hasText: 'Mi día' }).click(); await pG.waitForTimeout(2500)
  const tarjeta = pG.locator('.tarjeta', { hasText: 'Mi sueldo' })
  console.log('MI DÍA, tarjeta «Mi sueldo»:', await tarjeta.count())
  await tarjeta.locator('a', { hasText: 'Ver' }).click(); await pG.waitForTimeout(3000)
  console.log('MI SUELDO de Gabriela:', (await A.texto(pG.locator('section[aria-label="Mi sueldo del mes"]'))).slice(0, 420))
  console.log('  desborde horizontal:', await pG.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
  await pG.screenshot({ path: `${CAP}/mi-sueldo-celular.png`, fullPage: true })
  await pG.goto(A.URL + '#/sueldos'); await pG.waitForTimeout(1500)
  console.log('AL IR A /sueldos queda en:', new URL(pG.url()).hash)
  // Retira su semana desde la Caja, como lo viene anotando.
  await pG.goto(A.URL + '#/caja'); await pG.waitForTimeout(3000)
  await pG.locator('button.pestana', { hasText: /^Egresos/ }).click(); await pG.waitForTimeout(600)
  // Un retiro de Elena tambien se reconoce, aunque no tenga cuenta.
  await pG.locator('#concepto').fill('ELENA'); await pG.waitForTimeout(400)
  const pistaE = pG.locator('[role="status"]', { hasText: '¿Es ' })
  console.log('EN CAJA, al escribir «ELENA» ofrece:', (await pistaE.count()) ? (await A.texto(pistaE)).slice(0, 70) : '(NADA)')
  await pistaE.locator('button', { hasText: 'Sí, cargarlo así' }).click(); await pG.waitForTimeout(400)
  console.log('   queda:', await pG.locator('#cat-egreso').inputValue(), '·', nombres[await pG.locator('#persona-egreso').inputValue()] ?? '(sin persona)', '(no se guarda)')
  await pG.locator('#cat-egreso').selectOption('OTROS')
  await pG.locator('#concepto').fill('SEMANA GABI'); await pG.locator('#monto-egreso').fill('100006')
  const pistaG = pG.locator('[role="status"]', { hasText: '¿Es ' })
  console.log('EN CAJA, al escribir «SEMANA GABI» ofrece:', (await pistaG.count()) ? (await A.texto(pistaG)).slice(0, 80) : '(NADA)')
  await pG.screenshot({ path: `${CAP}/caja-sugerencia-celular.png` })
  await pistaG.locator('button', { hasText: 'Sí, cargarlo así' }).click(); await pG.waitForTimeout(400)
  console.log('   queda:', await pG.locator('#cat-egreso').inputValue(), '·', nombres[await pG.locator('#persona-egreso').inputValue()] ?? '(sin persona)')
  await pG.locator('button', { hasText: 'Registrar egreso' }).click(); await pG.waitForTimeout(2500)
  const retiro = (await A.listar('movimientos')).find((m) => m.monto === 100006)
  console.log('SERVIDOR su retiro:', retiro ? `${quien(retiro)} · ${retiro.tipo} · turno ${retiro.jornadaId} · ${retiro.esVariable ? 'variable' : 'fijo'}` : '(NO LLEGÓ)')
  await pG.goto(A.URL + '#/mi-sueldo'); await pG.waitForTimeout(3000)
  console.log('MI SUELDO después:', (await A.texto(pG.locator('section[aria-label="Mi sueldo del mes"] .fila').nth(1))), '|', await A.texto(pG.locator('section[aria-label="Mi sueldo del mes"] .fila.destacada')))
  r = await A.rastros(pG, ACORDADO)
  console.log(`CELULAR DE GABRIELA: ${r.bases} bases, ${r.filas} filas y ${r.guardadas} archivos de la caché | rastros de lo acordado (ni el suyo): ${r.hallados.join(', ') || 'ninguno'}`)

  // ───────────────────────── EL SERVIDOR, PEDIDO DIRECTO ─────────────────────────
  console.log('\n===== Pidiéndole al servidor directo, con la sesión de cada una =====')
  const tG = await A.tokenDe('gabi@prueba.test'), tS = await A.tokenDe('sandra@prueba.test'), tE = await A.tokenDe('emma@prueba.test')
  // Una version vieja de la app guarda la ficha sin la version del formato: ni al dueño se lo acepta.
  const prueba = { id: 'uid-prueba', nombre: 'Prueba', acuerdos: [], actualizadoEn: 1 }
  console.log('EMMANUEL: guardar como una versión vieja de la app (sin la versión del formato)', await A.estado('sueldos/uid-prueba', tE, 'PATCH', prueba), '| con la versión de ahora', await A.estado('sueldos/uid-prueba', tE, 'PATCH', { ...prueba, forma: 2 }))
  console.log('GABRIELA: su ficha', await A.estado(`sueldos/${uidG}`, tG), '| la de Sandra', await A.estado(`sueldos/${uidS}`, tG), '| todas', await A.estado('sueldos', tG), '| cambiar la suya', await A.estado(`sueldos/${uidG}`, tG, 'PATCH', { id: uidG, acuerdos: [] }))
  console.log('SANDRA: la de Gabriela', await A.estado(`sueldos/${uidG}`, tS), '| todas', await A.estado('sueldos', tS), '| cambiar la suya', await A.estado(`sueldos/${uidS}`, tS, 'PATCH', { id: uidS, acuerdos: [] }), '| cambiar la de Gabriela', await A.estado(`sueldos/${uidG}`, tS, 'PATCH', { id: uidG, acuerdos: [] }))
  const otroDueno = { id: 'sin-cuenta-x', email: '', nombre: 'Otro', rol: 'owner', activo: true, sinCuenta: true }
  console.log('DUEÑO SIN CUENTA: agregarlo como Sandra', await A.estado('usuarios/sin-cuenta-x', tS, 'PATCH', otroDueno), '| como Gabriela', await A.estado('usuarios/sin-cuenta-x', tG, 'PATCH', otroDueno), '| cambiarle el nombre a Elena como Sandra', await A.estado(`usuarios/${uidElena}?updateMask.fieldPaths=nombre`, tS, 'PATCH', { nombre: 'Otra' }))

  // ───────────────────────── CON LAS REGLAS DE ANTES ─────────────────────────
  // Lo que pasa entre que se publica y que alguien pega las reglas nuevas en
  // la consola: el servidor sigue con «solo el dueño».
  const actuales = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8')
  const deAntes = actuales.replace(
    /allow read: if estoyAlMando\(\) \|\| \(estoyActivo\(\) && request\.auth\.uid == persona\);\s*allow create, update: if soyOwner\(\) && request\.resource\.data\.forma == 2;\s*allow delete: if soyOwner\(\);/,
    'allow read, write: if soyOwner();',
  )
  if (deAntes === actuales) console.log('\n¡NO SE PUDO ARMAR LA REGLA DE ANTES! La regla de sueldos cambió: actualizá este guion.')
  else {
    console.log('\n===== Con la regla de antes pegada en el servidor (solo el dueño) =====')
    console.log('regla de antes puesta:', await A.ponerReglas(deAntes))
    await pS.goto(A.URL + '#/sueldos'); await pS.waitForTimeout(4000)
    console.log('SANDRA en Sueldos:', (await pS.locator('.aviso-error').count()) ? (await A.texto(pS.locator('.aviso-error').first())).slice(0, 330) : '(sin cartel)')
    console.log('   ¿ve igual los pagos?', await pS.locator('section[aria-label="Sueldo de Gabriela Pérez"] li.item').count(), 'pagos de Gabriela · acordado:', await A.texto(pS.locator('section[aria-label="Sueldo de Gabriela Pérez"] .fila').first()), '· ¿dice «sin definir»?', (await pS.locator('section[aria-label="Sueldo de Gabriela Pérez"]').innerText()).toLowerCase().includes('sin definir') || (await pS.locator('section[aria-label="Sueldo de Gabriela Pérez"]').innerText()).includes('Sin sueldo definido'))
    await pS.screenshot({ path: `${CAP}/sueldos-encargada-reglas-viejas.png`, fullPage: true })
    await pG.goto(A.URL + '#/caja'); await pG.waitForTimeout(500)
    await pG.goto(A.URL + '#/mi-sueldo'); await pG.waitForTimeout(4000)
    console.log('GABRIELA en Mi sueldo:', (await pG.locator('.aviso-error').count()) ? (await A.texto(pG.locator('.aviso-error').first())).slice(0, 200) : '(sin cartel)')
    console.log('   ¿ve igual lo cobrado?', await A.texto(pG.locator('section[aria-label="Mi sueldo del mes"] .fila').nth(1)))
  }
  console.log('\nRECHAZOS anotados en el servidor:', (await A.listar('rechazos')).map((x) => `${x.tabla}:${x.accion}`).join(', ') || 0)
  await b.close()
})().catch((e) => { console.error('FALLO:', e); process.exit(1) })
