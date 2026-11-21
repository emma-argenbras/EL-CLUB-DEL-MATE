import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * El fundador está escrito en dos lugares: en la app (EMAILS_FUNDADORES,
 * en el motor) y en las reglas del servidor (esFundador). Si dicen cosas
 * distintas, uno de los dos deja hacer algo que el otro no. El motor no
 * se puede cargar sin Firebase, así que se leen los dos archivos.
 */
const mails = (texto: string) => [...texto.matchAll(/'([^'@\s]+@[^'\s]+)'/g)].map((m) => m[1]).sort()

describe('el fundador (20/11)', () => {
  const motor = readFileSync('src/sync/motor.ts', 'utf8')
  const reglas = readFileSync('firestore.rules', 'utf8')
  const enLaApp = mails(/export const EMAILS_FUNDADORES = \[([^\]]*)\]/.exec(motor)?.[1] ?? '')
  const enLasReglas = mails(/function esFundador\(\) \{[\s\S]*?\[([\s\S]*?)\]/.exec(reglas)?.[1] ?? '')

  it('la app y las reglas dicen lo mismo', () => {
    expect(enLaApp.length).toBeGreaterThan(0)
    expect(enLaApp).toEqual(enLasReglas)
  })

  it('es solo Emmanuel: Sebastián entra solo a mirar y no se puede hacer dueño solo', () => {
    expect(enLaApp).toEqual(['emmanuel@elclubdelmate.com'])
  })
})
