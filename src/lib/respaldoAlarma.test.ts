import { describe, expect, it } from 'vitest'
import {
  alarmasDelRespaldo,
  cargados,
  ordenarColeccion,
  ordenarProfundo,
  type Coleccion,
} from './respaldoAlarma'

/** Tantos productos con costo y proveedor cargados, y el resto vacios. */
function productos(total: number, conDato: number): Coleccion {
  const salida: Coleccion = {}
  for (let i = 0; i < total; i++) {
    salida[`P${String(i).padStart(4, '0')}`] =
      i < conDato
        ? { precioCompra: 1000, proveedor: 'MOHICANO', precioVenta: 2650 }
        : { precioCompra: null, proveedor: null, precioVenta: 2650 }
  }
  return salida
}

describe('ordenar, para que el diff se pueda leer', () => {
  it('ordena las claves de un documento', () => {
    expect(JSON.stringify(ordenarProfundo({ z: 1, a: 2 }))).toBe('{"a":2,"z":1}')
  })

  it('ordena tambien adentro', () => {
    expect(JSON.stringify(ordenarProfundo({ x: { z: 1, a: 2 } }))).toBe('{"x":{"a":2,"z":1}}')
  })

  it('no toca el orden de una lista: ahi el orden es el dato', () => {
    expect(ordenarProfundo([3, 1, 2])).toEqual([3, 1, 2])
  })

  it('deja null y fechas como estan', () => {
    const fecha = new Date('2026-10-20')
    expect(ordenarProfundo({ a: null, f: fecha })).toEqual({ a: null, f: fecha })
  })

  it('ordena los documentos por id', () => {
    expect(Object.keys(ordenarColeccion({ B: {}, A: {}, C: {} }))).toEqual(['A', 'B', 'C'])
  })
})

describe('cargados', () => {
  it('cuenta los que tienen costo y proveedor', () => {
    expect(cargados(productos(10, 4))).toEqual({ precioCompra: 4, proveedor: 4 })
  })

  it('un proveedor en blanco no cuenta como cargado', () => {
    expect(cargados({ A: { proveedor: '   ' } }).proveedor).toBe(0)
  })

  it('un costo en cero si cuenta: cero es un dato', () => {
    expect(cargados({ A: { precioCompra: 0 } }).precioCompra).toBe(1)
  })
})

describe('alarmasDelRespaldo', () => {
  it('la primera noche nunca es alarma', () => {
    expect(alarmasDelRespaldo('productos', null, productos(1352, 1200))).toEqual([])
  })

  it('un dia normal no dice nada', () => {
    expect(alarmasDelRespaldo('productos', productos(1352, 1200), productos(1355, 1210))).toEqual([])
  })

  it('avisa cuando desaparecen documentos', () => {
    const avisos = alarmasDelRespaldo('ventas', productos(1000, 0), productos(800, 0))
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain('200 menos')
  })

  it('no avisa por una baja chica', () => {
    expect(alarmasDelRespaldo('ventas', productos(1000, 0), productos(970, 0))).toEqual([])
  })

  it('EL CASO DEL 20/10: los productos siguen, pero se vaciaron', () => {
    const avisos = alarmasDelRespaldo('productos', productos(1352, 899), productos(1352, 619))
    expect(avisos).toHaveLength(2)
    expect(avisos[0]).toContain('280 se quedaron sin precioCompra')
    expect(avisos[1]).toContain('280 se quedaron sin proveedor')
  })

  it('una carga normal del dia no dispara la alarma de vaciado', () => {
    expect(alarmasDelRespaldo('productos', productos(1352, 900), productos(1352, 885))).toEqual([])
  })

  it('que se carguen datos nuevos nunca es alarma', () => {
    expect(alarmasDelRespaldo('productos', productos(1352, 600), productos(1352, 1340))).toEqual([])
  })

  it('el vaciado solo se mira en productos', () => {
    expect(alarmasDelRespaldo('ventas', productos(100, 90), productos(100, 10))).toEqual([])
  })
})
