import { describe, expect, it } from 'vitest'

// La hora del local, pase lo que pase donde corra la prueba: el día en que
// se cargó algo es el del aparato, no el de Greenwich.
process.env.TZ = 'America/Argentina/Cordoba'

import {
  diaDeCarga,
  porcentajeEnElDia,
  renglonDeLaSemana,
  resumenParaCopiar,
  senalDeLaSemana,
  usoPorSemana,
  type DatosDeUso,
} from './usoDeLaApp'

/** Un momento de ese día, en la hora del aparato. */
const cargadaEl = (fecha: string, hora = 11) => new Date(`${fecha}T${String(hora).padStart(2, '0')}:00:00`).getTime()
const venta = (fecha: string, cargada: string | null, codigo = 'TM015') => ({
  fecha,
  codigo,
  ...(cargada ? { creadoEn: cargadaEl(cargada) } : {}),
})
const vacio: DatosDeUso = { jornadas: [], ventas: [], productos: [], movimientosProveedor: [] }

// El jueves 19/11/2026. Su semana empieza el lunes 16.
const HOY = '2026-11-19'

describe('cómo se viene usando la app, por semana', () => {
  it('arma las últimas semanas, de la más nueva a la más vieja, de lunes a sábado', () => {
    const semanas = usoPorSemana(vacio, HOY, 3)
    expect(semanas.map((s) => `${s.lunes}..${s.sabado}`)).toEqual([
      '2026-11-16..2026-11-21',
      '2026-11-09..2026-11-14',
      '2026-11-02..2026-11-07',
    ])
  })

  it('en la semana en curso solo cuentan los días que ya pasaron; en las anteriores, los seis menos los feriados', () => {
    const [esta, anterior, otra] = usoPorSemana(vacio, HOY, 3)
    expect(esta.diasHabiles).toBe(4) // lunes a jueves
    expect(otra.diasHabiles).toBe(6) // del 2 al 7 de noviembre
    expect(anterior.diasHabiles).toBe(5) // el lunes 9 fue feriado por la visita del papa
    // Un domingo: la semana que termina tiene sus seis días.
    expect(usoPorSemana(vacio, '2026-11-22', 1)[0].diasHabiles).toBe(6)
  })

  it('dice qué días no tienen caja cargada, y el domingo no se reclama', () => {
    const [esta, anterior] = usoPorSemana(
      {
        ...vacio,
        jornadas: [
          { fecha: '2026-11-16', estado: 'cerrado' },
          { fecha: '2026-11-16', estado: 'cerrado' }, // mañana y tarde: un solo día
          { fecha: '2026-11-18', estado: 'cerrado' },
          { fecha: '2026-11-19', estado: 'abierto' }, // el de hoy, abierto: está bien
          { fecha: '2026-11-15', estado: 'cerrado' }, // un domingo que se abrió: no suma ni resta
          ...['09', '10', '11', '12', '13', '14'].map((d) => ({ fecha: `2026-11-${d}`, estado: 'cerrado' as const })),
        ],
      },
      HOY,
      2,
    )
    expect(esta.diasConCaja).toBe(3)
    expect(esta.diasSinCaja).toEqual(['2026-11-17'])
    expect(esta.turnosSinCerrar).toBe(0)
    // Del 9 al 14 hay caja los seis días, pero el 9 fue feriado: cuentan cinco.
    expect(anterior.diasConCaja).toBe(5)
    expect(anterior.diasSinCaja).toEqual([])
  })

  it('un feriado no se reclama ni cuenta como día (20/11): el lunes 23/11/2026', () => {
    const [esta] = usoPorSemana(
      { ...vacio, jornadas: [{ fecha: '2026-11-24', estado: 'cerrado' }, { fecha: '2026-11-25', estado: 'abierto' }] },
      '2026-11-25',
      1,
    )
    expect(esta.diasHabiles).toBe(2) // martes y miércoles: el lunes fue feriado
    expect(esta.diasConCaja).toBe(2)
    expect(esta.diasSinCaja).toEqual([])
    expect(esta.feriados).toEqual([{ fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional' }])
    expect(senalDeLaSemana(esta)).toBe('bien')
    expect(renglonDeLaSemana(esta)).toMatch(/^caja 2 de 2 días \(feriado: 23\/11\) · /)
    // Si el local abrió igual el feriado, no suma un día de más.
    const [abrio] = usoPorSemana(
      { ...vacio, jornadas: ['23', '24', '25'].map((d) => ({ fecha: `2026-11-${d}`, estado: 'cerrado' as const })) },
      '2026-11-25',
      1,
    )
    expect(abrio.diasConCaja).toBe(2)
    expect(abrio.diasHabiles).toBe(2)
    // Un feriado que todavía no llegó no aparece.
    expect(usoPorSemana(vacio, '2026-11-22', 1)[0].feriados).toEqual([])
    // El mismo lunes 23 la semana todavía no tiene días hábiles: se dice en palabras, no «0 de 0».
    const [elLunes] = usoPorSemana(vacio, '2026-11-23', 1)
    expect(elLunes.diasHabiles).toBe(0)
    expect(senalDeLaSemana(elLunes)).toBe('bien')
    expect(renglonDeLaSemana(elLunes)).toMatch(/^caja: ningún día hábil todavía \(feriado: 23\/11\) · /)
  })

  it('un turno de un día anterior que sigue abierto se cuenta; el de hoy, no', () => {
    const [esta] = usoPorSemana(
      { ...vacio, jornadas: [{ fecha: '2026-11-17', estado: 'abierto' }, { fecha: HOY, estado: 'abierto' }] },
      HOY,
      1,
    )
    expect(esta.turnosSinCerrar).toBe(1)
  })

  it('separa las ventas cargadas en el día de las que se pasaron después', () => {
    const [esta] = usoPorSemana(
      {
        ...vacio,
        ventas: [
          venta('2026-11-16', '2026-11-16'),
          venta('2026-11-16', '2026-11-16', ''), // sin código, en el día
          venta('2026-11-17', '2026-11-18'), // del cuaderno, al día siguiente
          venta('2026-11-17', '2026-11-19'),
          venta('2026-11-18', null), // importada: no se sabe cuándo se cargó
          venta('2026-11-18', '2026-11-18', 'REC-TARJETA'), // el recargo no es una venta
          venta('2026-11-10', '2026-11-10'), // de otra semana
        ],
      },
      HOY,
      1,
    )
    expect(esta.ventas).toBe(5)
    expect(esta.ventasEnElDia).toBe(2)
    expect(esta.ventasDespues).toBe(2)
    expect(esta.ventasSinCodigo).toBe(1)
    expect(porcentajeEnElDia(esta)).toBe(50)
  })

  it('una venta cargada pasada la medianoche cuenta como cargada después', () => {
    const [esta] = usoPorSemana({ ...vacio, ventas: [{ fecha: '2026-11-17', codigo: 'A', creadoEn: cargadaEl('2026-11-18', 0) }] }, HOY, 1)
    expect(esta.ventasDespues).toBe(1)
    expect(diaDeCarga(cargadaEl('2026-11-17', 23))).toBe('2026-11-17')
  })

  it('el día de carga es el del local: a las 22 del 17 en Argentina ya es 18 en Greenwich', () => {
    const alas22 = Date.UTC(2026, 10, 18, 1, 0)
    expect(diaDeCarga(alas22)).toBe('2026-11-17')
    const [esta] = usoPorSemana({ ...vacio, ventas: [{ fecha: '2026-11-17', codigo: 'A', creadoEn: alas22 }] }, HOY, 1)
    expect([esta.ventasEnElDia, esta.ventasDespues]).toEqual([1, 0])
  })

  it('cuenta los costos con fecha de esa semana y los ingresos de mercadería: lo que se compara con el Excel', () => {
    const [esta, anterior] = usoPorSemana(
      {
        ...vacio,
        productos: [
          { fechaCompra: '2026-11-18' },
          { fechaCompra: '2026-11-16' },
          { fechaCompra: '2026-11-18', archivado: true }, // archivado: no cuenta
          { fechaCompra: '2026-11-11' },
          { fechaCompra: null },
        ],
        movimientosProveedor: [
          { fecha: '2026-11-18', tipo: 'compra' },
          { fecha: '2026-11-18', tipo: 'pago' }, // un pago no es una entrega
          { fecha: '2026-11-10', tipo: 'compra' },
        ],
      },
      HOY,
      2,
    )
    expect([esta.costosActualizados, esta.ingresos]).toEqual([2, 1])
    expect([anterior.costosActualizados, anterior.ingresos]).toEqual([1, 1])
  })

  it('sin ventas no inventa un porcentaje', () => {
    expect(porcentajeEnElDia(usoPorSemana(vacio, HOY, 1)[0])).toBeNull()
  })
})

describe('cómo se lee una semana', () => {
  const base = { ...usoPorSemana(vacio, HOY, 1)[0], diasConCaja: 4, diasSinCaja: [] as string[] }

  it('mal si faltó cargar la caja algún día o quedó un turno sin cerrar', () => {
    expect(senalDeLaSemana({ ...base, diasConCaja: 3, diasSinCaja: ['2026-11-17'] })).toBe('mal')
    expect(senalDeLaSemana({ ...base, turnosSinCerrar: 1 })).toBe('mal')
  })

  it('para mirar si más de una de cada diez ventas se cargó después', () => {
    expect(senalDeLaSemana({ ...base, ventas: 10, ventasEnElDia: 8, ventasDespues: 2 })).toBe('mirar')
    expect(senalDeLaSemana({ ...base, ventas: 10, ventasEnElDia: 9, ventasDespues: 1 })).toBe('bien')
  })

  it('bien si la caja está todos los días, aunque todavía no haya ventas', () => {
    expect(senalDeLaSemana(base)).toBe('bien')
  })

  it('el renglón dice lo mismo en palabras, con sus singulares', () => {
    expect(
      renglonDeLaSemana({ ...base, ventas: 40, ventasEnElDia: 36, ventasDespues: 4, costosActualizados: 1, ingresos: 2 }),
    ).toBe('caja 4 de 4 días · 40 ventas, 90 % cargadas en el día (4 después) · 1 costo actualizado · 2 ingresos de mercadería')
    expect(renglonDeLaSemana({ ...base, diasHabiles: 1, diasConCaja: 1, turnosSinCerrar: 1 })).toBe(
      'caja 1 de 1 día · 1 turno sin cerrar · sin ventas cargadas · 0 costos actualizados · 0 ingresos de mercadería',
    )
  })

  it('el resumen para copiar trae una línea por semana y los días sin caja', () => {
    const texto = resumenParaCopiar(
      usoPorSemana({ ...vacio, jornadas: [{ fecha: '2026-11-16', estado: 'cerrado' }] }, '2026-11-17', 2),
    )
    const lineas = texto.split('\n')
    expect(lineas[0]).toBe('Cómo venimos con la app')
    expect(lineas[1]).toMatch(/^Esta semana: caja 1 de 2 días/)
    expect(lineas[2]).toMatch(/^Semana del 09\/11\/2026: caja 0 de 5 días \(feriado: 09\/11\)/)
    // El lunes 9 fue feriado: no figura entre los días sin caja.
    expect(lineas[3]).toBe('Días sin caja: 17/11/2026, 10/11/2026, 11/11/2026, 12/11/2026, 13/11/2026, 14/11/2026')
    expect(resumenParaCopiar([])).toBe('')
  })
})
