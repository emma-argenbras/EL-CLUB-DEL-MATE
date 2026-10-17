import { db } from '../db/db'

/**
 * El modo consulta de precios, prendido o apagado EN ESTE DISPOSITIVO.
 *
 * Vive en la tabla `ajustes`, que a proposito no sincroniza: son marcas
 * del aparato, no del negocio. Es justo lo que hace falta aca --el
 * celular del salon lo tiene prendido y el del dueño no-- y si esto
 * viajara a la nube, prenderlo en el salon le cambiaria la pantalla de
 * arranque a todo el mundo.
 */
export const CLAVE_MODO_CONSULTA = 'modo-consulta'

export async function prenderModoConsulta(): Promise<void> {
  await db.ajustes.put({ clave: CLAVE_MODO_CONSULTA, valor: '1' })
}

export async function apagarModoConsulta(): Promise<void> {
  await db.ajustes.delete(CLAVE_MODO_CONSULTA)
}

/** Para una consulta reactiva: undefined mientras carga, nunca despues. */
export async function leerModoConsulta(): Promise<boolean> {
  return (await db.ajustes.get(CLAVE_MODO_CONSULTA))?.valor === '1'
}
