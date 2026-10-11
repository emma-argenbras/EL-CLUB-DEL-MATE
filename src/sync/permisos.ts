import type { Rol } from '../db/db'
import type { Perfil } from './sesion'

/**
 * Quien puede hacer que.
 *
 * Antes esto era `rol === 'owner'` repetido en diez pantallas. Con dos
 * roles se podia vivir asi; con tres no, porque "owner" se usaba para
 * dos cosas distintas que ahora se separan:
 *
 *   - estar al mando: ver las ganancias, autorizar cierres, tocar
 *     precios. Lo hacen un dueño y un encargado por igual.
 *   - ser el dueño: borrar todos los datos, pisar la base con un
 *     respaldo, y decidir quien mas es dueño. Eso no se delega.
 *
 * Cada permiso tiene su nombre aca y una sola definicion. Si manana hay
 * un rol mas, se cambia en este archivo y no en diez.
 */

/** El rol tal como se lee en pantalla. */
export const ETIQUETA_ROL: Record<Rol, string> = {
  owner: 'Dueño/a',
  encargado: 'Encargado/a',
  empleado: 'Empleado/a',
}

/**
 * Lo que hace cada rol, en una linea. Lo usa el selector del alta de
 * usuarios. Vive aca y no en la pantalla para que una prueba pueda
 * verificar que ningun rol quedo sin texto: un rol sin etiqueta sale en
 * el menu como una opcion vacia, que es imposible de elegir a ciegas.
 */
export const QUE_HACE_CADA_ROL: Record<Rol, string> = {
  empleado: 'Empleado/a — opera la caja, no ve ganancias',
  encargado: 'Encargado/a — maneja todo, sin borrar datos ni tocar dueños',
  owner: 'Dueño/a — maneja todo, sin límites',
}

/**
 * Esta al mando del negocio: ve los numeros de ganancia, autoriza
 * cierres, da el visto bueno a las diferencias y edita precios,
 * productos, proveedores y gastos.
 *
 * Sin nube configurada no hay cuentas ni roles y la app corre en un solo
 * dispositivo: quien la abre es el dueño. Por eso un perfil nulo cuenta
 * como al mando, igual que antes.
 */
export function estaAlMando(perfil: Perfil | null): boolean {
  return !perfil || perfil.rol === 'owner' || perfil.rol === 'encargado'
}

/**
 * Es dueño del negocio. Lo que queda reservado a esto son las tres
 * cosas que pueden destruir o repartir el negocio entero.
 */
export function esDueno(perfil: Perfil | null): boolean {
  return !perfil || perfil.rol === 'owner'
}

/** Borrar todos los datos (Ajustes > Zona peligrosa). */
export function puedeBorrarTodo(perfil: Perfil | null): boolean {
  return esDueno(perfil)
}

/**
 * Importar un respaldo.
 *
 * Va con el mismo candado que borrar todo, y no es exceso de celo:
 * importar pisa el catalogo, los turnos y las ventas con lo que diga el
 * archivo. Quien puede importar puede borrar, solo que mas despacio.
 */
export function puedeImportarRespaldo(perfil: Perfil | null): boolean {
  return esDueno(perfil)
}

/**
 * Crear, editar o desactivar a una persona con ESE rol.
 *
 * Un encargado maneja al equipo pero no a los dueños: ni los crea, ni
 * los edita, ni les apaga el acceso. Si pudiera, el limite de su propio
 * rol seria una formalidad --se haria dueño, o dejaria al dueño afuera--.
 */
export function puedeTocarUsuarioConRol(perfil: Perfil | null, rolObjetivo: Rol): boolean {
  if (esDueno(perfil)) return true
  if (perfil?.rol !== 'encargado') return false
  return rolObjetivo !== 'owner'
}

/** Los roles que esta persona puede elegir al dar de alta a alguien. */
export function rolesQuePuedeAsignar(perfil: Perfil | null): Rol[] {
  if (esDueno(perfil)) return ['owner', 'encargado', 'empleado']
  if (perfil?.rol === 'encargado') return ['encargado', 'empleado']
  return []
}

/** Entra a Ajustes (respaldo, usuarios del equipo, catalogo publico). */
export function puedeVerAjustes(perfil: Perfil | null): boolean {
  return estaAlMando(perfil)
}
