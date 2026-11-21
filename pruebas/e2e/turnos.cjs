// Rearmar los turnos que no llegaron al servidor (20/11), de punta a punta.
// El caso armado como el real: faltan el 03/11 mañana, el 03/11 tarde y el
// 04/11 tarde; sus ventas, sus egresos y el historial de Gabriela sí están.
// Los montos son inventados.
const { chromium } = require('playwright')
const A = require('./ayudas.cjs')
const CAP = A.CAPTURAS

const arq = (billetes, monedas = 0) => ({ billetes, monedas })
const total = (a) => Object.entries(a.billetes).reduce((s, [d, n]) => s + Number(d) * n, a.monedas)
const C02T = arq({ 10000: 3 }), C03M = arq({ 10000: 3, 1000: 4 }), C03T = arq({ 10000: 4 }, 50), C04M = arq({ 10000: 2, 1000: 5 }), C04T = arq({ 10000: 2, 2000: 1 })
const turno = (id, fecha, t, abre, cierra) => ({ id, fecha, turno: t, estado: 'cerrado', vendedor: 'Sandra', cajaInicial: total(abre), horaApertura: t === 'M' ? '09:00' : '16:00', horaCierre: t === 'M' ? '13:00' : '20:00', arqueoApertura: abre, arqueoCierre: cierra, notaCierre: null, cierreAutorizado: null, solicitudCierre: null, notas: null })
const venta = (id, jornadaId, fecha, total, medioPago = 'EFECTIVO', hora = '10:00') => ({ id, jornadaId, fecha, hora, codigo: 'TM015', descripcion: 'MATE', cantidad: 1, precioUnitario: total, costoUnitario: 1000, medioPago, total, vendedor: 'Gabriela', creadoEn: new Date(`${fecha}T${hora}:00-03:00`).getTime() })
let n = 0
const h = (clave, accion, fecha, hora, extra = {}) => ({ id: `h-${n++}`, tabla: 'jornadas', clave, accion, queEs: '', campo: null, valorAnterior: null, valorNuevo: null, quien: 'gabi@prueba.test', quienNombre: 'Gabriela', quienRol: 'empleado', cuando: new Date(`${fecha}T${hora}:00-03:00`).getTime(), motivo: null, ...extra })
const historialDe = (clave, fecha, t, abre, cierra, conteo) => [
  h(clave, 'creo', fecha, abre, { queEs: `Turno del ${fecha} a la ${t}` }),
  h(clave, 'edito', fecha, cierra, { campo: 'arqueoCierre', valorNuevo: conteo }),
  h(clave, 'edito', fecha, cierra, { campo: 'estado', valorAnterior: 'abierto', valorNuevo: 'cerrado', id: `h-${n++}` }),
]

;(async () => {
  const uid = await A.crearUsuario('emma@prueba.test')
  await A.poner(`usuarios/${uid}`, { id: uid, email: 'emma@prueba.test', nombre: 'Emmanuel', rol: 'owner', activo: true })
  await A.sembrar('jornadas', [turno('02T', '2026-11-02', 'T', arq({ 10000: 2 }), C02T), turno('04M', '2026-11-04', 'M', C03T, C04M), turno('05M', '2026-11-05', 'M', C04T, C04T)])
  await A.sembrar('ventas', [
    venta('v1', '3fbc0d84', '2026-11-03', 5000), venta('v2', '3fbc0d84', '2026-11-03', 2000, 'TRANSFERENCIA'),
    venta('v3', 'a75ebe2e', '2026-11-03', 6000, 'EFECTIVO', '17:00'), venta('v4', 'bf387987', '2026-11-04', 3000, 'EFECTIVO', '18:00'),
    venta('v5', '04M', '2026-11-04', 9000),
  ])
  await A.sembrar('movimientos', [{ id: 'e1', fecha: '2026-11-03', tipo: 'EGRESO_CAJA', concepto: 'Bolsas', monto: 1000, categoria: 'OTROS', jornadaId: '3fbc0d84', esVariable: true }])
  await A.sembrar('historial', [
    ...historialDe('3fbc0d84', '2026-11-03', 'mañana', '09:02', '13:05', C03M),
    ...historialDe('a75ebe2e', '2026-11-03', 'tarde', '16:01', '20:10', C03T),
    ...historialDe('bf387987', '2026-11-04', 'tarde', '16:03', '20:15', C04T),
  ])
  const b = await chromium.launch()
  const ctx = await b.newContext({ timezoneId: 'America/Argentina/Cordoba', locale: 'es-AR', viewport: { width: 1280, height: 900 } })
  const p = await A.entrar(ctx, 'emma@prueba.test')
  const preguntas = []
  p.on('dialog', async (d) => { preguntas.push(d.message()); await d.accept() })

  console.log('\n===== Antes: el Panel =====')
  await p.goto(A.URL + '#/'); await p.waitForTimeout(3500)
  const aviso = p.locator('text=/no llegaron al servidor/').first()
  console.log('AVISO del Panel:', (await aviso.count()) ? await aviso.innerText() : '(no está)')

  console.log('\n===== Turnos del día: la lista antes del botón =====')
  await p.goto(A.URL + '#/turnos'); await p.waitForTimeout(3000)
  const tarjeta = p.locator('section[aria-label="Turnos que no llegaron al servidor"]')
  console.log(await A.texto(tarjeta))
  await p.screenshot({ path: `${CAP}/turnos-antes.png`, fullPage: true })
  console.log('JORNADAS en el servidor antes de tocar:', (await A.listar('jornadas')).length)

  await tarjeta.locator('button', { hasText: /^Rearmar/ }).click(); await p.waitForTimeout(3000)
  console.log('\nPREGUNTA:\n' + preguntas.join('\n---\n'))
  console.log('\nMENSAJE:', await A.texto(tarjeta.locator('.aviso').first()))
  await p.screenshot({ path: `${CAP}/turnos-despues.png`, fullPage: true })

  console.log('\n===== En el servidor =====')
  const js = await A.listar('jornadas')
  for (const id of ['3fbc0d84', 'a75ebe2e', 'bf387987']) {
    const j = js.find((x) => x.id === id)
    console.log(id, j ? `${j.fecha} ${j.turno} ${j.estado} abrió ${j.cajaInicial} cerró ${total(j.arqueoCierre)} ${j.horaApertura}-${j.horaCierre} vendedor ${j.vendedor} visto bueno ${JSON.stringify(j.cierreAutorizado)}` : 'NO ESTÁ')
  }
  const altas = (await A.listar('historial')).filter((x) => x.quien === 'emma@prueba.test' && x.tabla === 'jornadas')
  console.log('HISTORIAL nuevo:', altas.map((x) => `${x.accion} ${x.clave} «${x.motivo}»`).join(' ; '))
  console.log('VENTAS en el servidor:', (await A.listar('ventas')).length)

  console.log('\n===== Después: Caja del 03/11 y el Panel =====')
  await p.goto(A.URL + '#/turnos'); await p.waitForTimeout(1500)
  await p.locator('#t-fecha').fill('2026-11-03'); await p.waitForTimeout(1500)
  for (const t of await p.locator('.tarjeta', { hasText: 'Caja inicial' }).all()) console.log('TURNO:', (await A.texto(t)).slice(0, 200))
  console.log('¿Sigue la tarjeta?', await tarjeta.count() ? await A.texto(tarjeta) : 'no')
  await p.goto(A.URL + '#/'); await p.waitForTimeout(3000)
  for (const boton of await p.locator('main button', { hasText: /^Mostrar/ }).all()) await boton.click()
  console.log('AVISO del Panel:', (await p.locator('text=/no llegaron al servidor/').count()) ? 'sigue' : 'ya no está')
  console.log('AVISOS de caja que quedan:', (await p.locator('main').innerText()).split('\n').filter((l) => /turno|engancha|visto bueno|diferencia/i.test(l)).slice(0, 8).join(' | '))
  console.log('\nRECHAZOS anotados en el servidor:', (await A.listar('rechazos')).length)
  await b.close()
})().catch((e) => { console.error('FALLO:', e); process.exit(1) })
