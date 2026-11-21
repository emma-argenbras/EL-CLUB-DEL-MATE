// Un dueño que entra solo a mirar (20/11), de punta a punta. Elena es hoy
// «dueña sin cuenta» con retiros anotados; Emmanuel le da acceso para mirar
// desde Ajustes, a ella le llega el mail para elegir su contraseña (se lee
// del emulador), entra, ve el Panel y los Reportes y nada más, y no escribe
// nada en el servidor. Sus retiros siguen siendo suyos. Y el mail de
// Sebastián ya no se hace dueño solo. Montos inventados.
const { chromium } = require('playwright')
const A = require('./ayudas.cjs')
const CAP = A.CAPTURAS
const hoy = A.dia(0), mes = hoy.slice(0, 7)
const COLECCIONES = ['usuarios', 'jornadas', 'ventas', 'movimientos', 'vencimientos', 'productos', 'proveedores', 'historial', 'borrados', 'rechazos']
const contar = async () => Object.fromEntries(await Promise.all(COLECCIONES.map(async (c) => [c, (await A.listar(c)).length])))

;(async () => {
  const emma = await A.crearUsuario('emma@prueba.test')
  await A.poner(`usuarios/${emma}`, { id: emma, email: 'emma@prueba.test', nombre: 'Emmanuel', rol: 'owner', activo: true })
  await A.poner('usuarios/sin-cuenta-elena', { id: 'sin-cuenta-elena', email: '', nombre: 'Elena', rol: 'owner', activo: true, sinCuenta: true, apodos: 'Mamá' })
  const retiro = (id, dia, monto) => ({ id, fecha: `${mes}-${dia}`, tipo: 'GASTO_CAJA_GRANDE', cuenta: 'banco', concepto: 'Retiro', monto, categoria: 'RETIRO SOCIOS', jornadaId: null, esVariable: false, persona: 'sin-cuenta-elena' })
  await A.sembrar('movimientos', [retiro('r1', '02', 1111), retiro('r2', '09', 2222)])
  await A.sembrar('vencimientos', [{ id: 'd1', concepto: 'Compu del local', dia: 10, montoAproximado: 3333, categoria: 'EQUIPAMIENTO', cuenta: 'cajaGrande', esVariable: false, avisarDiasAntes: 3, desde: `${mes}-10`, activo: true, notas: null, cuotas: { total: 6, primera: 2, periodo: mes }, aQuien: 'sin-cuenta-elena' }])
  await A.sembrar('jornadas', [{ id: 'j1', fecha: `${mes}-02`, turno: 'M', estado: 'cerrado', vendedor: 'Sandra', cajaInicial: 1000, horaApertura: '09:00', horaCierre: '13:00', arqueoApertura: null, arqueoCierre: { billetes: { 1000: 3 }, monedas: 0 }, notaCierre: null, cierreAutorizado: null, solicitudCierre: null, notas: null }])
  await A.sembrar('ventas', [{ id: 'v1', jornadaId: 'j1', fecha: `${mes}-02`, hora: '10:00', codigo: 'TM015', descripcion: 'MATE', cantidad: 1, precioUnitario: 4444, costoUnitario: 1000, medioPago: 'EFECTIVO', total: 4444, vendedor: 'Sandra' }])
  const b = await chromium.launch()
  const opciones = { timezoneId: 'America/Argentina/Cordoba', locale: 'es-AR', viewport: { width: 1280, height: 900 } }

  console.log('\n===== Emmanuel le da acceso para mirar a Elena =====')
  const pe = await A.entrar(await b.newContext(opciones), 'emma@prueba.test')
  pe.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLA:', m.text().slice(0, 300)) })
  const preguntas = []
  pe.on('dialog', async (d) => { preguntas.push(d.message()); await d.accept() })
  await pe.goto(A.URL + '#/ajustes'); await pe.waitForTimeout(2500)
  const fila = pe.locator('li.item', { hasText: 'Elena' }).first()
  console.log('FILA antes:', await A.texto(fila))
  await fila.locator('button', { hasText: 'Darle acceso para mirar' }).click()
  await pe.locator('#acceso-sin-cuenta-elena').fill('Elena@Prueba.test')
  await pe.screenshot({ path: `${CAP}/acceso-formulario.png`, fullPage: false })
  await fila.locator('.tarjeta button', { hasText: 'Darle acceso para mirar' }).click()
  await pe.waitForTimeout(5000)
  console.log('PREGUNTA:\n' + preguntas.join('\n---\n'))
  const errores = await pe.locator('.aviso-error').allInnerTexts()
  if (errores.length) console.log('ERRORES EN PANTALLA:', errores.join(' | '))
  console.log('MENSAJE:', await A.texto(pe.locator('.aviso-ok').first()))
  const usuarios = await A.listar('usuarios')
  const elena = usuarios.find((u) => u.email === 'elena@prueba.test')
  console.log('SERVIDOR usuario nuevo:', JSON.stringify({ rol: elena?.rol, nombre: elena?.nombre, apodos: elena?.apodos, activo: elena?.activo }), '| el sin cuenta sigue:', usuarios.some((u) => u.id === 'sin-cuenta-elena'))
  const movs = await A.listar('movimientos'), deuda = await A.leer('vencimientos/d1')
  console.log('SERVIDOR retiros a su cuenta:', movs.filter((m) => m.persona === elena?.id).length, 'de 2 | la deuda:', deuda.aQuien === elena?.id ? 'a su cuenta' : deuda.aQuien)
  console.log('HISTORIAL:', [...new Set((await A.listar('historial')).filter((h) => h.quien === 'emma@prueba.test').map((h) => `${h.tabla}.${h.campo ?? h.accion}: ${h.motivo}`))].sort().join(' ; '))
  await pe.goto(A.URL + '#/sueldos'); await pe.waitForTimeout(2500)
  const retiros = pe.locator('.tarjeta', { hasText: 'Retiros de los dueños' }).first()
  console.log('SUELDOS de Emmanuel, retiros:', (await retiros.count()) ? (await A.texto(retiros)).slice(0, 220) : '(no está)')

  console.log('\n===== El mail para elegir la contraseña =====')
  const oob = await (await fetch(`${A.AU}/emulator/v1/projects/${A.P}/oobCodes`)).json()
  const elMail = (oob.oobCodes ?? []).filter((c) => c.email === 'elena@prueba.test')
  console.log('MAILS a Elena:', elMail.map((c) => c.requestType).join(', ') || 'ninguno')
  const r = await fetch(`${A.AU}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: elMail.at(-1)?.oobCode, newPassword: 'la-elige-elena' }) })
  console.log('ELIGE su contraseña:', r.ok ? 'sí' : await r.text())

  console.log('\n===== Elena entra a mirar =====')
  const antes = await contar()
  const pl = await A.entrar(await b.newContext(opciones), 'elena@prueba.test', 'la-elige-elena')
  pl.on('dialog', async (d) => { console.log('PREGUNTA INESPERADA:', d.message()); await d.dismiss() })
  console.log('MENÚ:', (await pl.locator('nav.menu-escritorio a').allInnerTexts()).join(' / '), '| campana:', await pl.locator('.campana, [aria-label*="otificaciones"]').count())
  await pl.goto(A.URL + '#/panel'); await pl.waitForTimeout(3500)
  for (const boton of await pl.locator('main button', { hasText: /^Mostrar/ }).all()) await boton.click()
  console.log('PANEL «Cómo viene»:', (await pl.locator('.tarjeta', { hasText: 'Cómo viene' }).count()) ? (await A.texto(pl.locator('.tarjeta', { hasText: 'Cómo viene' }).first())).slice(0, 160) : '(no está)')
  console.log('PANEL avisos:', await pl.locator('main .detalle-aviso').count(), '| botones «Ir a resolverlo»:', await pl.locator('main button', { hasText: 'Ir a resolverlo' }).count(), '| «Recordar»:', await pl.locator('main button', { hasText: /^Recordar/ }).count())
  await pl.screenshot({ path: `${CAP}/solo-mira-panel.png`, fullPage: true })
  for (const ruta of ['caja', 'gastos', 'ajustes', 'sueldos', 'turnos', 'productos', 'vencimientos', 'mi-actividad', 'historial']) {
    await pl.goto(A.URL + '#/' + ruta); await pl.waitForTimeout(800)
    process.stdout.write(`#/${ruta} → ${new URL(pl.url()).hash}  `)
  }
  console.log()
  await pl.goto(A.URL + '#/reportes'); await pl.waitForTimeout(2500)
  console.log('REPORTES:', (await pl.locator('main').innerText()).split('\n').filter((l) => /Ventas|Margen|Resultado/.test(l)).slice(0, 4).join(' | '))
  await pl.screenshot({ path: `${CAP}/solo-mira-reportes.png`, fullPage: false })
  await pl.goto(A.URL + '#/ayuda'); await pl.waitForTimeout(1500)
  console.log('AYUDA tiene «solo mirar»:', (await pl.locator('main').innerText()).includes('solo a mirar') ? 'sí' : 'no')
  await pl.waitForTimeout(8000)
  const despues = await contar()
  const cambios = COLECCIONES.filter((c) => antes[c] !== despues[c]).map((c) => `${c}: ${antes[c]} → ${despues[c]}`)
  console.log('SERVIDOR mientras Elena miraba:', cambios.length ? cambios.join(', ') : 'nada cambió')
  console.log('Renglones del historial a nombre de Elena:', (await A.listar('historial')).filter((h) => h.quien === 'elena@prueba.test').length)
  await pl.goto(A.URL + '#/panel'); await pl.waitForTimeout(3000)
  const cartel = pl.locator('.aviso', { hasText: /cosas? sin subir al servidor/ })
  console.log('cartel «sin subir» en su aparato:', (await cartel.count()) ? await cartel.first().innerText() : 'no')

  console.log('\n===== Pidiéndoselo directo al servidor, con su sesión =====')
  const token = await A.tokenDe('elena@prueba.test', 'la-elige-elena')
  for (const [que, metodo, ruta, datos] of [
    ['una venta', 'PATCH', 'ventas/v-elena', { id: 'v-elena', total: 1 }],
    ['cambiar un retiro', 'PATCH', 'movimientos/r1?updateMask.fieldPaths=monto', { monto: 1 }],
    ['borrar un turno', 'DELETE', 'jornadas/j1', null],
    ['hacerse dueña', 'PATCH', `usuarios/${elena.id}?updateMask.fieldPaths=rol`, { rol: 'owner' }],
  ]) console.log(`  ${que}:`, await A.estado(ruta, token, metodo, datos))
  console.log('  leer las ventas:', await A.estado('ventas/v1', token))

  console.log('\n===== El mail de Sebastián ya no se hace dueño solo =====')
  const ps = await (await b.newContext(opciones)).newPage()
  await ps.goto(A.URL); await ps.locator('input[placeholder="tu-mail@elclubdelmate.com"]').waitFor({ timeout: 60000 })
  await ps.locator('input[placeholder="tu-mail@elclubdelmate.com"]').fill('sebastian@elclubdelmate.com')
  await ps.locator('input[placeholder="Mínimo 6 caracteres"]').fill('una-cualquiera')
  await ps.locator('button', { hasText: 'Entrar' }).click(); await ps.waitForTimeout(5000)
  console.log('¿Entró?', (await ps.locator('main.contenido').count()) ? 'sí' : 'no', '| cuentas con su mail:', (await A.cuentas()).filter((c) => c.email === 'sebastian@elclubdelmate.com').length, '| perfiles:', (await A.listar('usuarios')).filter((u) => u.email === 'sebastian@elclubdelmate.com').length)
  console.log('\nRECHAZOS anotados en el servidor:', (await A.listar('rechazos')).length)
  await b.close()
})().catch((e) => { console.error('FALLO:', e); process.exit(1) })
