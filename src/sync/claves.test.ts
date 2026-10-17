import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { aClaveDeNube, aClaveLocal, necesitaEscape } from './claves'

/** Los 34 codigos del catalogo que tienen barra, tal como estan. */
const CON_BARRA = [
  'EL11/05',
  'EL11/101',
  'EL22/101612',
  'EL33/05378',
  'EL50/18397',
  'EL82/471',
  'EL96/1606',
]

describe('aClaveDeNube', () => {
  it('escapa la barra, que es lo que rompe la referencia', () => {
    expect(aClaveDeNube('EL11/05')).toBe('EL11%2F05')
  })

  it('no toca una clave que no tiene nada raro', () => {
    // Esto es lo mas importante de todo el archivo: si una clave normal
    // cambiara, el documento que ya existe en el servidor quedaria
    // huerfano y al lado apareceria uno nuevo. Un arreglo que duplica
    // el catalogo es peor que el problema que arregla.
    for (const clave of ['116-033', 'TM015', 'GOM004', 'ADA 034', 'LST 50 X 30', 'EL62-26']) {
      expect(aClaveDeNube(clave)).toBe(clave)
    }
  })

  it('escapa el porcentaje para que el ida y vuelta sea reversible', () => {
    expect(aClaveDeNube('A%2FB')).toBe('A%252FB')
    expect(aClaveLocal(aClaveDeNube('A%2FB'))).toBe('A%2FB')
  })

  it('el nombre del documento ya no parte la ruta', () => {
    for (const codigo of CON_BARRA) {
      expect(aClaveDeNube(codigo)).not.toContain('/')
    }
  })
})

describe('ida y vuelta', () => {
  it('vuelve igual para los 34 codigos con barra', () => {
    for (const codigo of CON_BARRA) {
      expect(aClaveLocal(aClaveDeNube(codigo))).toBe(codigo)
    }
  })

  it('vuelve igual para codigos comunes', () => {
    for (const codigo of ['116-033', 'TM015', '509-54', 'ADA 034', '']) {
      expect(aClaveLocal(aClaveDeNube(codigo))).toBe(codigo)
    }
  })

  it('aguanta varias barras y barras en los bordes', () => {
    for (const codigo of ['A/B/C', '/AB', 'AB/', '//', 'A//B']) {
      expect(aClaveDeNube(codigo)).not.toContain('/')
      expect(aClaveLocal(aClaveDeNube(codigo))).toBe(codigo)
    }
  })

  it('aguanta un id de Firestore que nunca se escapo', () => {
    // Los ids de las otras tablas son uuid: pasan sin tocarse, asi que
    // esto se puede aplicar a todas las tablas sin pensar cual es cual.
    const uuid = '0c8f1b7e-9a2d-4f3c-8b1a-5d6e7f809a1b'
    expect(aClaveDeNube(uuid)).toBe(uuid)
    expect(aClaveLocal(uuid)).toBe(uuid)
  })
})

describe('el catalogo de verdad', () => {
  // Esta es la prueba que importa: no sobre ejemplos inventados sino
  // sobre los 1.280 codigos que estan hoy en el catalogo publico. Si
  // manana entra un codigo con un caracter que Firestore no acepta como
  // nombre de documento, se entera el CI y no la consola de un celular.
  const catalogo: { c: string }[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/catalogo.json'), 'utf8'),
  )

  it('hay codigos con barra, asi que esto no es teorico', () => {
    const conBarra = catalogo.filter((p) => p.c.includes('/'))
    expect(conBarra.length).toBeGreaterThan(0)
  })

  it('ningun codigo del catalogo queda con barra al nombrar el documento', () => {
    const rotos = catalogo.map((p) => aClaveDeNube(p.c)).filter((id) => id.includes('/'))
    expect(rotos).toEqual([])
  })

  it('todos los codigos del catalogo vuelven iguales', () => {
    const ida = catalogo.filter((p) => aClaveLocal(aClaveDeNube(p.c)) !== p.c)
    expect(ida).toEqual([])
  })

  it('ningun nombre de documento se repite', () => {
    // Si dos codigos distintos dieran el mismo nombre de documento, uno
    // pisaria al otro en el servidor sin avisar.
    const ids = catalogo.map((p) => aClaveDeNube(p.c))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ningun nombre de documento es de los que Firestore no acepta', () => {
    // Firestore rechaza "." y "..", y cualquier cosa de la forma
    // __algo__. Hoy no hay ninguno; la prueba esta para cuando lo haya.
    const invalidos = catalogo
      .map((p) => aClaveDeNube(p.c))
      .filter((id) => id === '.' || id === '..' || /^__.*__$/.test(id) || id === '')
    expect(invalidos).toEqual([])
  })
})

describe('necesitaEscape', () => {
  it('reconoce los que estaban rotos', () => {
    expect(necesitaEscape('EL11/05')).toBe(true)
    expect(necesitaEscape('116-033')).toBe(false)
  })
})
