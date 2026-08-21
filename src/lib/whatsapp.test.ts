import { describe, expect, it } from 'vitest'
import {
  enlaceWhatsApp,
  mensajeCatalogo,
  mensajeConsulta,
  mensajeProducto,
  soloDigitos,
} from './whatsapp'

const mate = { codigo: 'TM015', descripcion: 'Mate imperial virola alpaca lisa', precioVenta: 45000 }

describe('mensajeProducto', () => {
  it('pone el nombre en negrita y el precio con punto de miles', () => {
    const texto = mensajeProducto(mate, 'https://ejemplo/catalogo/')
    expect(texto).toContain('*Mate imperial virola alpaca lisa*')
    expect(texto).toContain('$ 45.000')
    expect(texto).toContain('Código TM015')
    expect(texto).toContain('https://ejemplo/catalogo/')
  })

  it('un producto sin precio dice "consultar" en vez de $0', () => {
    const texto = mensajeProducto({ ...mate, precioVenta: null })
    expect(texto).toContain('consultar')
    expect(texto).not.toContain('$ 0')
  })

  it('no deja la linea del codigo vacia cuando el producto no tiene', () => {
    const texto = mensajeProducto({ ...mate, codigo: '' })
    expect(texto).not.toContain('Código')
  })

  it('redondea: en un mensaje no se manda un precio con centavos', () => {
    expect(mensajeProducto({ ...mate, precioVenta: 45000.4 })).toContain('$ 45.000')
  })
})

describe('mensajeCatalogo', () => {
  it('lleva el enlace que se le pasa', () => {
    expect(mensajeCatalogo('https://ejemplo/catalogo/')).toContain('https://ejemplo/catalogo/')
  })
})

describe('mensajeConsulta', () => {
  it('esta escrito desde el cliente hacia la tienda', () => {
    const texto = mensajeConsulta(mate)
    expect(texto).toContain('Quería consultar')
    expect(texto).toContain('Mate imperial virola alpaca lisa (TM015)')
  })

  it('sin codigo no deja parentesis vacios', () => {
    expect(mensajeConsulta({ ...mate, codigo: '' })).not.toContain('()')
  })
})

describe('soloDigitos', () => {
  it('deja el mismo numero escrito de cualquier forma', () => {
    expect(soloDigitos('+54 9 345 412-3456')).toBe('5493454123456')
    expect(soloDigitos('5493454123456')).toBe('5493454123456')
  })
})

describe('enlaceWhatsApp', () => {
  it('sin telefono deja elegir el destinatario', () => {
    expect(enlaceWhatsApp('hola')).toBe('https://wa.me/?text=hola')
  })

  it('con telefono abre ese chat', () => {
    expect(enlaceWhatsApp('hola', '+54 9 345 412-3456')).toBe(
      'https://wa.me/5493454123456?text=hola',
    )
  })

  it('escapa el texto: los saltos de linea y los & no rompen el enlace', () => {
    const url = enlaceWhatsApp('uno\ndos & tres')
    expect(url).toBe('https://wa.me/?text=uno%0Ados%20%26%20tres')
    // Y se puede volver al texto original.
    expect(decodeURIComponent(url.split('text=')[1])).toBe('uno\ndos & tres')
  })

  it('el mensaje de un producto sobrevive el ida y vuelta', () => {
    const texto = mensajeProducto(mate)
    const url = enlaceWhatsApp(texto)
    expect(decodeURIComponent(url.split('text=')[1])).toBe(texto)
  })
})
