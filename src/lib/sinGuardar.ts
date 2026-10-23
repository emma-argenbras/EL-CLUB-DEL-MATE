import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * Lo que hay cargado en pantalla y todavía no se guardó.
 *
 * "Actualizar" recarga la app, y una recarga se lleva todo lo que está
 * a medio escribir: las líneas de una compra, el conteo de un cierre de
 * caja, un producto nuevo. La versión nueva puede esperar unos minutos;
 * lo que alguien estaba cargando no se recupera.
 *
 * Cada formulario se anota acá mientras tiene algo sin guardar, con un
 * nombre que se entienda ("la compra", "el cierre de caja"), y el botón
 * de actualizar pregunta antes de recargar.
 */

let proximoId = 1
const abiertos = new Map<number, string>()
let foto: string[] = []
const oyentes = new Set<() => void>()

function avisar(): void {
  foto = [...new Set(abiertos.values())]
  for (const oyente of oyentes) oyente()
}

/** Anota un formulario con algo sin guardar. Devuelve cómo sacarlo. */
export function anotarSinGuardar(nombre: string): () => void {
  const id = proximoId++
  abiertos.set(id, nombre)
  avisar()
  return () => {
    if (abiertos.delete(id)) avisar()
  }
}

/** Los nombres de lo que está sin guardar, sin repetir. */
export function loQueEstaSinGuardar(): string[] {
  return foto
}

function suscribirse(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export function useLoQueEstaSinGuardar(): string[] {
  return useSyncExternalStore(suscribirse, loQueEstaSinGuardar)
}

/**
 * El texto de la pregunta antes de recargar, o null si no hay nada que
 * perder y se puede actualizar directo.
 */
export function preguntaAntesDeActualizar(sinGuardar: string[]): string | null {
  if (sinGuardar.length === 0) return null
  const que =
    sinGuardar.length === 1
      ? sinGuardar[0]
      : `${sinGuardar.slice(0, -1).join(', ')} y ${sinGuardar[sinGuardar.length - 1]}`
  return (
    `Tenés sin guardar ${que}.\n\n` +
    'Si actualizás ahora, eso se pierde. Lo mejor es guardarlo primero y actualizar después.\n\n' +
    '¿Actualizar igual?'
  )
}

/**
 * Anota el formulario mientras `sucio` sea verdadero.
 */
export function useSinGuardar(nombre: string, sucio: boolean): void {
  useEffect(() => {
    if (!sucio) return
    return anotarSinGuardar(nombre)
  }, [nombre, sucio])
}

/**
 * Lo mismo, comparando contra cómo estaba el formulario al abrirse: si
 * cualquiera de los valores cambió, hay algo sin guardar. Sirve para los
 * formularios que no tienen un "vacío" obvio, como editar un producto.
 */
export function useCambiosSinGuardar(nombre: string, valores: unknown, activo = true): void {
  const actual = JSON.stringify(valores)
  const inicial = useRef(actual)
  useSinGuardar(nombre, activo && actual !== inicial.current)
}
