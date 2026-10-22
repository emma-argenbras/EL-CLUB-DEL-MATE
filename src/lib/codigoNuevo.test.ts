import { describe, expect, it } from 'vitest'
import { decidirCodigoNuevo, mensajeDeCodigo } from './codigoNuevo'

describe('decidirCodigoNuevo', () => {
  it('libre: no está acá ni en el servidor', () => {
    expect(decidirCodigoNuevo(false, false)).toBe('libre')
  })

  it('ya existe acá', () => {
    expect(decidirCodigoNuevo(true, false)).toBe('ya-existe-aca')
  })

  it('existe en el servidor aunque acá no esté: el dispositivo está atrasado', () => {
    expect(decidirCodigoNuevo(false, true)).toBe('ya-existe-en-el-servidor')
  })

  it('NO SABER NO ES ESTAR LIBRE', () => {
    // Es el caso que importa: si null cayera en "libre", el producto
    // del servidor se perdería al sincronizar.
    expect(decidirCodigoNuevo(false, null)).toBe('sin-conexion')
  })

  it('si ya está acá, no hace falta preguntar nada más', () => {
    expect(decidirCodigoNuevo(true, null)).toBe('ya-existe-aca')
  })
})

describe('mensajeDeCodigo', () => {
  it('libre no dice nada', () => {
    expect(mensajeDeCodigo('libre', 'MR007')).toBeNull()
  })

  it('sin conexión FRENA, con el cartel que pidió Emmanuel', () => {
    expect(mensajeDeCodigo('sin-conexion', 'MR007')).toBe(
      'Sin conexión no se pueden crear productos nuevos. Conectate y probá de nuevo.',
    )
  })

  it('los dos "ya existe" nombran el código', () => {
    expect(mensajeDeCodigo('ya-existe-aca', 'MR007')).toContain('MR007')
    expect(mensajeDeCodigo('ya-existe-en-el-servidor', 'MR007')).toContain('MR007')
  })

  it('el del servidor explica por qué no se ve en la lista', () => {
    expect(mensajeDeCodigo('ya-existe-en-el-servidor', 'MR007')).toContain(
      'todavía no haya llegado a este dispositivo',
    )
  })
})
