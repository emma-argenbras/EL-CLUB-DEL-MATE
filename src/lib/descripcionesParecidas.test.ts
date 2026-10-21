import { describe, expect, it } from 'vitest'
import type { Producto } from '../db/db'
import { claveDescripcion, gruposRepetidos, productosParecidos } from './descripcionesParecidas'

function prod(codigo: string, descripcion: string, extra: Partial<Producto> = {}): Producto {
  return {
    codigo, descripcion, proveedor: null, proveedorId: null, fechaCompra: null,
    precioCompra: null, rentabilidad: null, precioVenta: 1000, fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(), stock: null, activo: true, ...extra,
  }
}

describe('claveDescripcion', () => {
  it('ignora mayusculas, acentos y espacios de mas', () => {
    expect(claveDescripcion('  Matera   Botinera ')).toBe(claveDescripcion('MATERA BOTINERA'))
    expect(claveDescripcion('PORTA TERMO RÍGIDO')).toBe(claveDescripcion('PORTA TERMO RIGIDO'))
  })

  it('ignora el plural y las palabras de relleno', () => {
    expect(claveDescripcion('TABLA GUAYUBIRA GRUESA 2 HERRADURAS')).toBe(
      claveDescripcion('TABLA GUAYUBIRA GRUESA CON 2 HERRADURAS'),
    )
  })
})

describe('productosParecidos', () => {
  const base = [
    prod('LST010', 'MATERA RECTANGULAR'),
    prod('500-270', 'LIMPIA BOMBILLA'),
    prod('GF001', 'LIMPIA BOMBILLA'),
    prod('116-033', 'PORTA PLATO LONA ESTAMPADA'),
  ]

  it('EL CASO LST016: la misma descripcion que uno que ya existe', () => {
    const r = productosParecidos('MATERA RECTANGULAR', base)
    expect(r).toHaveLength(1)
    expect(r[0].producto.codigo).toBe('LST010')
    expect(r[0].por).toBe('misma')
  })

  it('encuentra los dos que ya comparten descripcion', () => {
    expect(productosParecidos('LIMPIA BOMBILLA', base).map((x) => x.producto.codigo)).toEqual([
      '500-270',
      'GF001',
    ])
  })

  it('avisa por una letra de diferencia', () => {
    const r = productosParecidos('MATERA RECTANGULER', base)
    expect(r[0]?.por).toBe('casi-igual')
  })

  it('no avisa por una descripcion distinta', () => {
    expect(productosParecidos('MATE DE CALABAZA', base)).toEqual([])
  })

  it('no avisa por compartir solo las primeras palabras', () => {
    // A diferencia de los proveedores, acá "empieza igual" sobra: medio
    // catalogo empieza con BILLETERA o PORTA TERMO.
    expect(productosParecidos('PORTA PLATO LONA ESTAMPADA GRANDE', base)).toEqual([])
  })

  it('al editar, el producto no se avisa a si mismo', () => {
    expect(productosParecidos('MATERA RECTANGULAR', base, 'LST010')).toEqual([])
  })

  it('no mira archivados ni descontinuados', () => {
    const con = [prod('X', 'MATERA RECTANGULAR', { archivado: true }), prod('Y', 'MATERA RECTANGULAR', { descontinuado: true })]
    expect(productosParecidos('MATERA RECTANGULAR', con)).toEqual([])
  })

  it('una descripcion vacia no avisa nada', () => {
    expect(productosParecidos('   ', base)).toEqual([])
  })

  it('los de misma descripcion van antes que los de una letra', () => {
    const r = productosParecidos('MATERA RECTANGULAR', [
      prod('A', 'MATERA RECTANGULER'),
      prod('B', 'MATERA RECTANGULAR'),
    ])
    expect(r.map((x) => x.por)).toEqual(['misma', 'casi-igual'])
  })
})

describe('gruposRepetidos', () => {
  it('agrupa los que comparten descripcion y deja afuera los unicos', () => {
    const grupos = gruposRepetidos([
      prod('A', 'LIMPIA BOMBILLA'),
      prod('B', 'LIMPIA BOMBILLA'),
      prod('C', 'LIMPIA BOMBILLA'),
      prod('D', 'MATE DE CAÑA'),
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].productos.map((p) => p.codigo)).toEqual(['A', 'B', 'C'])
  })

  it('los grupos mas grandes van primero', () => {
    const grupos = gruposRepetidos([
      prod('A', 'UNO'), prod('B', 'UNO'),
      prod('C', 'DOS GRANDE'), prod('D', 'DOS GRANDE'), prod('E', 'DOS GRANDE'),
    ])
    expect(grupos.map((g) => g.productos.length)).toEqual([3, 2])
  })

  it('no cuenta archivados ni descontinuados', () => {
    const grupos = gruposRepetidos([
      prod('A', 'LIMPIA BOMBILLA'),
      prod('B', 'LIMPIA BOMBILLA', { archivado: true }),
    ])
    expect(grupos).toEqual([])
  })

  it('los sin descripcion no forman un grupo entre ellos', () => {
    expect(gruposRepetidos([prod('A', ''), prod('B', '  ')])).toEqual([])
  })
})
