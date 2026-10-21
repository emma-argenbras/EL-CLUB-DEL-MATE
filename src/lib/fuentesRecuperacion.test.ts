import { describe, expect, it } from 'vitest'
import {
  leerFecha,
  leerFuenteCSV,
  leerFuenteJSON,
  leerPlata,
  leerPorcentaje,
  partirLineaCSV,
} from './fuentesRecuperacion'

describe('leerPlata', () => {
  it('lee el formato argentino con espacio y signo', () => {
    // Tal cual viene del Excel.
    expect(leerPlata(' $1.111,20')).toBe(1111.2)
    expect(leerPlata(' $14.000,00')).toBe(14000)
    expect(leerPlata('$415,00')).toBe(415)
  })

  it('no se cree "SIN STOCK" escrito donde va un precio', () => {
    // FAB001 y FAB002 lo tienen en la columna del precio de venta.
    expect(leerPlata('SIN STOCK')).toBeNull()
  })

  it('una celda vacia no es cero', () => {
    expect(leerPlata('')).toBeNull()
    expect(leerPlata('   ')).toBeNull()
  })
})

describe('leerPorcentaje', () => {
  it('165% es 1.65', () => {
    expect(leerPorcentaje('165%')).toBeCloseTo(1.65)
    expect(leerPorcentaje('130%')).toBeCloseTo(1.3)
  })

  it('vacio es nada', () => {
    expect(leerPorcentaje('')).toBeNull()
  })
})

describe('leerFecha', () => {
  it('lee las tres formas completas que trae la planilla', () => {
    expect(leerFecha('22/08/2026')).toBe('2026-08-22')
    expect(leerFecha('9/09/2026')).toBe('2026-09-09')
    expect(leerFecha('22/8/2026')).toBe('2026-08-22')
  })

  it('descarta las rotas en vez de inventar el año', () => {
    // De la fecha depende que un costo figure vencido o actual: una
    // fecha inventada es peor que ninguna.
    expect(leerFecha('22/8')).toBeNull()
    expect(leerFecha('21-12-24')).toBeNull()
    expect(leerFecha('21-12')).toBeNull()
    expect(leerFecha('')).toBeNull()
  })

  it('descarta un dia o un mes imposible', () => {
    expect(leerFecha('32/08/2026')).toBeNull()
    expect(leerFecha('22/13/2026')).toBeNull()
  })
})

describe('partirLineaCSV', () => {
  it('respeta las comillas', () => {
    expect(partirLineaCSV('GOM001,"JUEGO ""J"" DOBLE CABO",GOMECITO')).toEqual([
      'GOM001',
      'JUEGO "J" DOBLE CABO',
      'GOMECITO',
    ])
  })

  it('respeta una coma adentro de un campo', () => {
    expect(partirLineaCSV('A,"UNO, DOS",B')).toEqual(['A', 'UNO, DOS', 'B'])
  })

  it('aguanta campos vacios al final', () => {
    expect(partirLineaCSV('A,B,,')).toEqual(['A', 'B', '', ''])
  })
})

describe('leerFuenteCSV', () => {
  // Tal cual lo exporta Google Sheets: el decimal va con coma, asi que
  // la celda de plata viaja entre comillas.
  const CSV = [
    'CODIGOS,PRODUCTOS,PROVEEDOR,FECHA,PRECIO COMPRA,RENTABILIDAD,PRECIO VENTA,FECHA',
    'MR001,MATE RAFAEL,MATES RAFAEL MISIONES,22/08/2026," $9.500,00",130%,"$21.000,00",22/8/2026',
    '',
    'FAB001,MATE TORPEDO,FABRICA DE MATES,27/05/2024," $10.050,00",130%,SIN STOCK,',
    '116-033,PORTA PLATO,MOHICANO,22/8," $10.661,00",130%,"$25.000,00",',
  ].join('\n')

  it('lee codigo, proveedor, costo, rentabilidad y fecha', () => {
    const fuente = leerFuenteCSV(CSV, 'Excel', '2026-10-11')
    const mr = fuente.valores.get('MR001')
    expect(mr?.proveedor).toBe('MATES RAFAEL MISIONES')
    expect(mr?.precioCompra).toBe(9500)
    expect(mr?.rentabilidad).toBeCloseTo(1.3)
    expect(mr?.fechaCompra).toBe('2026-08-22')
  })

  it('"SIN STOCK" no rompe la fila: el costo igual se lee', () => {
    expect(leerFuenteCSV(CSV, 'Excel', null).valores.get('FAB001')?.precioCompra).toBe(10050)
  })

  it('una fecha rota deja el costo pero sin fecha', () => {
    const p = leerFuenteCSV(CSV, 'Excel', null).valores.get('116-033')
    expect(p?.precioCompra).toBe(10661)
    expect(p?.fechaCompra).toBeUndefined()
  })

  it('saltea la fila en blanco que separa proveedores', () => {
    expect(leerFuenteCSV(CSV, 'Excel', null).valores.size).toBe(3)
  })

  it('un codigo repetido no pisa al primero', () => {
    // En la planilla hay codigos repetidos con productos distintos: no
    // se puede elegir a ciegas cual es el bueno.
    const csv = [
      'CODIGOS,PRODUCTOS,PROVEEDOR,FECHA,PRECIO COMPRA,RENTABILIDAD,PRECIO VENTA,FECHA',
      '509-54,TAPON N2,MOHICANO,22/08/2026," $1.091,00",340%,"$5.000,00",',
      '509-54,TAPA BOTELLA,MOHICANO,22/08/2026," $1.391,00",140%,"$3.400,00",',
    ].join('\n')
    expect(leerFuenteCSV(csv, 'Excel', null).valores.get('509-54')?.precioCompra).toBe(1091)
  })
})

describe('leerFuenteJSON', () => {
  it('lee una lista de productos', () => {
    const fuente = leerFuenteJSON(
      JSON.stringify([
        { codigo: 'MR001', precioCompra: 9500, proveedor: 'MATES RAFAEL', fechaCompra: '2026-08-12' },
        { codigo: 'SIN', precioCompra: null, proveedor: null },
      ]),
      'foto',
      '2026-08-12',
    )
    expect(fuente.valores.get('MR001')?.precioCompra).toBe(9500)
    // El que no aporta nada no entra.
    expect(fuente.valores.has('SIN')).toBe(false)
  })

  it('tambien acepta { productos: [...] }', () => {
    const fuente = leerFuenteJSON(JSON.stringify({ productos: [{ codigo: 'A', precioCompra: 1 }] }), 'x', null)
    expect(fuente.valores.size).toBe(1)
  })
})
