import type { Usuario } from '../db/db'

/**
 * Darle acceso para mirar a un dueño que hasta ahora no tenía cuenta
 * (20/11): Sebastián y Elena van a entrar a ver el Panel y los Reportes,
 * sin cargar ni cambiar nada (el rol 'socio').
 *
 * Hoy figuran como «dueños sin cuenta» (id sin-cuenta-…), con sus retiros
 * anotados a ese id. Una cuenta de Firebase tiene su propio id, que la app
 * no puede elegir, así que al darle cuenta se crea su usuario nuevo y todo
 * lo que apuntaba al viejo pasa al nuevo: los retiros (Movimiento.persona)
 * y las deudas del local con él (Vencimiento.aQuien). El viejo se saca.
 *
 * La contraseña no la escribe nadie: la cuenta se crea con una al azar que
 * no se muestra ni se guarda, y le llega un mail para elegir la suya. Así
 * no pasa por el chat, ni por Emmanuel, ni queda en ningún lado.
 */

export const MOTIVO_ACCESO_PARA_MIRAR = 'Acceso para mirar: el dueño sin cuenta pasa a tener la suya'

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function mailLimpio(email: string): string {
  return email.trim().toLowerCase()
}

/** Por qué no se le puede dar acceso con ese mail, o null si está bien. */
export function problemaDelAcceso(
  dueno: Pick<Usuario, 'id' | 'sinCuenta' | 'rol' | 'activo'> | undefined,
  email: string,
  existentes: Pick<Usuario, 'email' | 'nombre'>[],
): string | null {
  if (!dueno) return 'Ese dueño ya no está en la lista.'
  if (!dueno.sinCuenta || dueno.rol !== 'owner') return 'Esto es para un dueño que hoy no tiene cuenta.'
  if (dueno.activo === false) return 'Está desactivado: reactivalo primero.'
  const mail = mailLimpio(email)
  if (!mail) return 'Escribí su mail.'
  if (!MAIL.test(mail)) return 'Ese mail no parece completo: fijate que tenga @ y el dominio.'
  const yaEsta = existentes.find((u) => u.email && mailLimpio(u.email) === mail)
  if (yaEsta) return `Ese mail ya es el de ${yaEsta.nombre}.`
  return null
}

/** Cuántas cosas pasan del id viejo al nuevo. */
export interface LoQuePasa {
  retiros: number
  deudas: number
}

/** La pregunta antes de crear la cuenta: con quién, qué va a poder y cuánto se mueve. */
export function textoDeConfirmacionAcceso(nombre: string, email: string, pasa: LoQuePasa): string {
  const cosas = [
    pasa.retiros > 0 ? `${pasa.retiros} ${pasa.retiros === 1 ? 'retiro anotado' : 'retiros anotados'}` : null,
    pasa.deudas > 0 ? `${pasa.deudas} ${pasa.deudas === 1 ? 'deuda del local' : 'deudas del local'} con ${nombre}` : null,
  ].filter(Boolean)
  return [
    `¿Darle acceso para mirar a ${nombre}, con ${mailLimpio(email)}?`,
    '',
    '· Va a ver el Panel y los Reportes. No va a poder cargar, cambiar ni borrar nada.',
    '· Le llega un mail para elegir su contraseña: nadie más la sabe. Si no lo ve, que mire en correo no deseado.',
    cosas.length > 0
      ? `· Pasan a su cuenta ${cosas.join(' y ')}: no se pierde nada.`
      : '· No tiene retiros anotados todavía.',
    '',
    `Queda en el historial como «${MOTIVO_ACCESO_PARA_MIRAR}».`,
  ].join('\n')
}

/** Su usuario nuevo, con su id de cuenta: el mismo nombre y apodos, solo mira. */
export function usuarioParaMirar(viejo: Usuario, uid: string, email: string): Usuario {
  return {
    id: uid,
    email: mailLimpio(email),
    nombre: viejo.nombre,
    rol: 'socio',
    activo: true,
    secciones: null,
    apodos: viejo.apodos ?? null,
  }
}

/** Una contraseña al azar que nadie ve: la cuenta nace sin que nadie la sepa. */
export function contrasenaAlAzar(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
