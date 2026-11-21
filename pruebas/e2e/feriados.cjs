// Feriados, de punta a punta (20/11): el Panel y «Cómo venimos» no reclaman
// la caja de un feriado. Con el reloj del navegador puesto en el feriado y en
// el día siguiente.
const { chromium } = require('playwright')
const A = require('./ayudas.cjs')
const CAP = A.CAPTURAS

// Noviembre de 2026: caja de lunes a sabado, menos los feriados (lunes 9 y lunes 23).
const conCaja = ['02', '03', '04', '05', '06', '07', '10', '11', '12', '13', '14', '16', '17', '18', '19', '20', '21']
const turno = (dia, t) => ({ id: `j-${dia}-${t}`, fecha: `2026-11-${dia}`, turno: t, estado: 'cerrado', vendedor: 'Prueba', cajaInicial: 10000, horaApertura: t === 'M' ? '09:00' : '16:00', horaCierre: t === 'M' ? '13:00' : '20:00', arqueoApertura: { billetes: { 1000: 10 }, monedas: 0 }, arqueoCierre: { billetes: { 1000: 10 }, monedas: 0 }, notaCierre: null, cierreAutorizado: null, solicitudCierre: null, notas: null })

;(async () => {
  const uid = await A.crearUsuario('emma@prueba.test')
  await A.poner(`usuarios/${uid}`, { id: uid, email: 'emma@prueba.test', nombre: 'Emmanuel', rol: 'owner', activo: true })
  await A.sembrar('jornadas', conCaja.flatMap((d) => [turno(d, 'M'), turno(d, 'T')]))
  const b = await chromium.launch()
  const opciones = { timezoneId: 'America/Argentina/Cordoba', locale: 'es-AR', viewport: { width: 1280, height: 900 } }

  const pasadas = [
    ['LUNES 23/11 (feriado)', '2026-11-23T13:00:00Z'],
    ['MARTES 24/11', '2026-11-24T13:00:00Z'],
    // Control: sin la caja del viernes 20 el aviso tiene que aparecer, y solo por ese dia.
    ['MARTES 24/11, sin la caja del viernes 20 (control)', '2026-11-24T13:00:00Z'],
  ]
  for (const [cuando, momento] of pasadas) {
    if (cuando.includes('control')) {
      for (const id of ['j-20-M', 'j-20-T']) await fetch(`${A.BASE}/jornadas/${id}`, { method: 'DELETE', headers: A.H })
    }
    console.log(`\n===== El reloj del navegador en el ${cuando} =====`)
    const ctx = await b.newContext(opciones)
    await ctx.clock.install({ time: new Date(momento) })
    const p = await A.entrar(ctx, 'emma@prueba.test')
    console.log('HOY según la app:', await p.evaluate(() => new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' })))
    await p.goto(A.URL + '#/'); await p.waitForTimeout(3000)
    const turnosDeHoy = p.locator('.tarjeta', { hasText: 'Turnos de hoy' })
    console.log('PANEL, turnos de hoy:', (await turnosDeHoy.count()) ? await A.texto(turnosDeHoy.first()) : '(no está la tarjeta)')
    // Los avisos de mantenimiento vienen plegados: se despliegan para leerlos.
    for (const boton of await p.locator('main button', { hasText: /^Mostrar/ }).all()) await boton.click()
    await p.waitForTimeout(500)
    const controles = p.locator('.fila', { hasText: 'Controles que corre la app' })
    console.log('PANEL, revisión completa:', (await controles.count()) ? await A.texto(controles.first()) : '(no está)')
    const avisos = await p.locator('main').innerText()
    const sinCaja = avisos.split('\n').filter((l) => /no tienen? caja cargada|Son el 2026|Del 2026/.test(l))
    console.log('PANEL, avisos de días sin caja:', sinCaja.length ? sinCaja.join(' | ') : 'ninguno')
    await p.screenshot({ path: `${CAP}/feriado-panel-${momento.slice(0, 10)}${cuando.includes('control') ? '-control' : ''}.png`, fullPage: true })
    await p.goto(A.URL + '#/uso'); await p.waitForTimeout(2500)
    for (const tarjeta of (await p.locator('section.tarjeta').all()).slice(0, 3)) {
      console.log('CÓMO VENIMOS:', (await A.texto(tarjeta)).split(' | Ventas')[0])
    }
    await p.screenshot({ path: `${CAP}/feriado-como-venimos-${momento.slice(0, 10)}.png`, fullPage: true })
    await ctx.close()
  }
  console.log('\nRECHAZOS anotados en el servidor:', (await A.listar('rechazos')).length)
  await b.close()
})().catch((e) => { console.error('FALLO:', e); process.exit(1) })
