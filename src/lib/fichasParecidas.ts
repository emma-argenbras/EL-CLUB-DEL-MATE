import { normalizar } from './formato'
import type { Proveedor } from '../db/db'

/**
 * Qué fichas de proveedor parecen ser la misma.
 *
 * Sandra terminó de asociar los productos y quedaron fichas repetidas
 * que el id derivado del nombre no junta solo, porque los nombres no
 * normalizan igual: SALDO y SALDOS, VICTOR ESTEBANEZ y VICTOR
 * ESTEVANEZ, ARIEL GARCIA y ARIEL GARCIA MISIONES, DISTRIBUIDORA DE
 * MATES y DISTRIBUIDORA MATES.
 *
 * Esto NO une nada: arma la lista de sospechosos para que alguien
 * mire. Cada caso lo decide una persona, que es la única que sabe si
 * "MATES RAFAEL" y "MATES DEL LITORAL" son el mismo o dos distintos.
 */

/**
 * Palabras que no distinguen una cosa de otra.
 *
 * "con" esta y "sin" NO, a proposito: "TABLA CON 2 HERRADURAS" y "TABLA
 * 2 HERRADURAS" son la misma, pero "TABLA CON HERRADURA" y "TABLA SIN
 * HERRADURA" son dos productos distintos. Sacar las dos los juntaria.
 */
const DE_RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con'])

/** El nombre en palabras, sin acentos, sin relleno y sin plurales. */
export function palabrasClave(nombre: string): string[] {
  return normalizar(nombre)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !DE_RELLENO.has(p))
    .map((p) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p))
}

/** Cuántas letras hay que cambiar para pasar de una palabra a la otra. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0
  const previa = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = previa[0]
    previa[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temporal = previa[j]
      previa[j] = Math.min(
        previa[j] + 1,
        previa[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      anterior = temporal
    }
  }
  return previa[b.length]
}

export type Parecido = 'mismo-nombre' | 'empieza-igual' | 'casi-igual'

export interface ParParecido {
  a: Proveedor
  b: Proveedor
  por: Parecido
  /** En palabras, para que la pantalla lo pueda explicar. */
  porque: string
}

/** Si una lista de palabras es el comienzo exacto de la otra. */
function esComienzoDe(corta: string[], larga: string[]): boolean {
  if (corta.length === 0 || corta.length >= larga.length) return false
  return corta.every((p, i) => p === larga[i])
}

function comparar(a: Proveedor, b: Proveedor): ParParecido | null {
  const pa = palabrasClave(a.nombre)
  const pb = palabrasClave(b.nombre)
  if (pa.length === 0 || pb.length === 0) return null

  if (pa.join(' ') === pb.join(' ')) {
    return { a, b, por: 'mismo-nombre', porque: 'Son el mismo nombre escrito igual o casi igual.' }
  }

  if (esComienzoDe(pa, pb) || esComienzoDe(pb, pa)) {
    const [corta, larga] = pa.length < pb.length ? [a, b] : [b, a]
    return {
      a,
      b,
      por: 'empieza-igual',
      porque: `"${larga.nombre}" empieza exactamente igual que "${corta.nombre}".`,
    }
  }

  // Una letra de diferencia en una sola palabra: ESTEBANEZ/ESTEVANEZ,
  // SALDO/SALDOS. Con palabras cortas no se aplica, porque ahi una
  // letra ya cambia el nombre (MATE y MATA no son el mismo).
  if (pa.length === pb.length) {
    let distintas = 0
    let cambios = 0
    for (let i = 0; i < pa.length; i++) {
      if (pa[i] === pb[i]) continue
      distintas++
      const d = distancia(pa[i], pb[i])
      cambios += d
      if (d > 1 || Math.min(pa[i].length, pb[i].length) < 5) return null
    }
    if (distintas === 1 && cambios === 1) {
      return {
        a,
        b,
        por: 'casi-igual',
        porque: 'Se escriben igual salvo por una letra.',
      }
    }
  }

  return null
}

/**
 * Todos los pares sospechosos, del más parecido al menos.
 *
 * Las fichas inactivas también entran: una ficha inactiva con el mismo
 * nombre que una activa es justamente el caso que hay que unir.
 */
export function fichasParecidas(proveedores: Proveedor[]): ParParecido[] {
  const orden: Record<Parecido, number> = {
    'mismo-nombre': 0,
    'casi-igual': 1,
    'empieza-igual': 2,
  }
  const pares: ParParecido[] = []
  for (let i = 0; i < proveedores.length; i++) {
    for (let j = i + 1; j < proveedores.length; j++) {
      const par = comparar(proveedores[i], proveedores[j])
      if (par) pares.push(par)
    }
  }
  return pares.sort(
    (x, y) => orden[x.por] - orden[y.por] || x.a.nombre.localeCompare(y.a.nombre),
  )
}
