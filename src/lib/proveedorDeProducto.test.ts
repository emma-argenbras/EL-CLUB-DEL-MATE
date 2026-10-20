import { describe, expect, it } from 'vitest'
import {
  estadoDelProveedor,
  fantasmasDeLosProductos,
  textoDelProveedor,
} from './proveedorDeProducto'
import type { Producto, Proveedor } from '../db/db'

function prod(codigo: string, proveedorId: string | null, nombre: string | null): Producto {
  return {
    codigo,
    descripcion: codigo,
    proveedor: nombre,
    proveedorId,
    fechaCompra: null,
    precioCompra: null,
    rentabilidad: null,
    precioVenta: null,
    fechaPrecioVenta: null,
    busqueda: codigo.toLowerCase(),
    stock: null,
    activo: true,
  }
}

const FICHAS = new Map<string, Proveedor>([
  ['prov-mohicano', { id: 'prov-mohicano', nombre: 'MOHICANO', contacto: null, notas: null, activo: true }],
])

describe('estadoDelProveedor', () => {
  it('sin proveedorId es "sin proveedor"', () => {
    expect(estadoDelProveedor(prod('A', null, null), FICHAS)).toEqual({ tipo: 'sin' })
  })

  it('con ficha es "ok" y trae el nombre de la ficha, no el del producto', () => {
    // El nombre que vale es el de la ficha: el del producto puede ser
    // el viejo, de antes de que al proveedor se le corrigiera el nombre.
    const estado = estadoDelProveedor(prod('A', 'prov-mohicano', 'mohicano viejo'), FICHAS)
    expect(estado).toEqual({ tipo: 'ok', id: 'prov-mohicano', nombre: 'MOHICANO' })
  })

  it('apuntando a una ficha que no existe es "fantasma"', () => {
    // El caso MR001: proveedorId cargado, ficha inexistente.
    const estado = estadoDelProveedor(
      prod('MR001', 'id-de-otro-celular', 'MATES RAFAEL MISIONES SARAPICO SHOPPING'),
      FICHAS,
    )
    expect(estado).toEqual({
      tipo: 'fantasma',
      id: 'id-de-otro-celular',
      nombre: 'MATES RAFAEL MISIONES SARAPICO SHOPPING',
    })
  })

  it('un fantasma sin nombre escrito igual se reconoce', () => {
    const estado = estadoDelProveedor(prod('X', 'id-perdido', '   '), FICHAS)
    expect(estado).toEqual({ tipo: 'fantasma', id: 'id-perdido', nombre: null })
  })

  it('un fantasma NO es lo mismo que sin proveedor', () => {
    // Esta es la distincion que faltaba: el aviso de "sin proveedor"
    // contaba 402 y estos no entraban, asi que nadie los buscaba.
    const fantasma = estadoDelProveedor(prod('MR001', 'perdido', 'MATES RAFAEL'), FICHAS)
    const sin = estadoDelProveedor(prod('A', null, null), FICHAS)
    expect(fantasma.tipo).not.toBe(sin.tipo)
  })
})

describe('textoDelProveedor', () => {
  it('dice el nombre cuando la ficha existe', () => {
    expect(textoDelProveedor({ tipo: 'ok', id: 'x', nombre: 'MOHICANO' })).toBe('MOHICANO')
  })

  it('avisa cuando el proveedor no existe, y dice de quien era', () => {
    expect(textoDelProveedor({ tipo: 'fantasma', id: 'x', nombre: 'MATES RAFAEL' })).toBe(
      'proveedor inexistente: MATES RAFAEL',
    )
  })

  it('avisa igual si no quedo ni el nombre', () => {
    expect(textoDelProveedor({ tipo: 'fantasma', id: 'x', nombre: null })).toBe(
      'proveedor inexistente',
    )
  })

  it('sin proveedor no dice nada', () => {
    expect(textoDelProveedor({ tipo: 'sin' })).toBeNull()
  })
})

describe('fantasmasDeLosProductos', () => {
  it('los agrupa por nombre y los cuenta', () => {
    const productos = [
      prod('MR001', 'perdido-a', 'MATES RAFAEL'),
      prod('MR002', 'perdido-a', 'MATES RAFAEL'),
      prod('MR003', 'perdido-b', 'MATES RAFAEL'),
      prod('X1', 'prov-mohicano', 'MOHICANO'),
      prod('X2', null, null),
    ]
    const fantasmas = fantasmasDeLosProductos(productos, FICHAS)
    expect(fantasmas).toEqual([{ nombre: 'MATES RAFAEL', productos: 3 }])
  })

  it('junta dos ids distintos del mismo nombre', () => {
    // Dos dispositivos inventaron dos ids para el mismo proveedor;
    // para quien mira la pantalla es uno solo.
    const fantasmas = fantasmasDeLosProductos(
      [prod('A', 'id-1', 'SALDOS'), prod('B', 'id-2', 'saldos')],
      FICHAS,
    )
    expect(fantasmas).toHaveLength(1)
    expect(fantasmas[0].productos).toBe(2)
  })

  it('ordena por cantidad, el que mas pesa primero', () => {
    const fantasmas = fantasmasDeLosProductos(
      [
        prod('A', 'p1', 'POCOS'),
        prod('B', 'p2', 'MUCHOS'),
        prod('C', 'p2', 'MUCHOS'),
        prod('D', 'p2', 'MUCHOS'),
      ],
      FICHAS,
    )
    expect(fantasmas.map((f) => f.nombre)).toEqual(['MUCHOS', 'POCOS'])
  })

  it('sin fantasmas devuelve vacio', () => {
    expect(fantasmasDeLosProductos([prod('A', 'prov-mohicano', 'MOHICANO')], FICHAS)).toEqual([])
  })
})
