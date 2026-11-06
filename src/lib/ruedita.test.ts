import { describe, expect, it, vi } from 'vitest'
import { alGirarLaRuedita, protegerNumerosDeLaRuedita } from './ruedita'

const campo = (type: string) => ({ type, blur: vi.fn() })

describe('la ruedita no cambia los numeros', () => {
  it('si gira sobre el campo de numero que tiene el foco, lo suelta', () => {
    const billetes = campo('number')
    expect(alGirarLaRuedita(billetes, billetes)).toBe(true)
    expect(billetes.blur).toHaveBeenCalledOnce()
  })

  it('un campo de texto no se toca: la ruedita no le cambia nada', () => {
    const precio = campo('text')
    expect(alGirarLaRuedita(precio, precio)).toBe(false)
    expect(precio.blur).not.toHaveBeenCalled()
  })

  it('si gira en otro lado de la pantalla, el campo con foco sigue con foco', () => {
    const billetes = campo('number')
    expect(alGirarLaRuedita({ type: 'div' }, billetes)).toBe(false)
    expect(billetes.blur).not.toHaveBeenCalled()
  })

  it('sin nada con foco no pasa nada', () => {
    expect(alGirarLaRuedita(campo('number'), null)).toBe(false)
  })

  it('al arrancar queda escuchando la ruedita en captura y sin frenar el desplazamiento', () => {
    const billetes = campo('number')
    let oyente: ((e: { target: unknown }) => void) | null = null
    const documento = {
      activeElement: billetes as unknown,
      addEventListener: vi.fn((_tipo: 'wheel', o: (e: { target: unknown }) => void) => {
        oyente = o
      }),
    }
    protegerNumerosDeLaRuedita(documento)
    expect(documento.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), {
      passive: true,
      capture: true,
    })
    oyente!({ target: billetes })
    expect(billetes.blur).toHaveBeenCalledOnce()
  })
})
