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
  socio: 'Dueño/a, solo mira',
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
  socio: 'Dueño/a, solo mira — ve el Panel y los Reportes, no carga ni cambia nada',
}

/**
 * Entra solo a mirar (20/11): un dueño que ve el Panel y los Reportes y
 * nada más. No carga, no edita ni borra, ni en la app ni pidiéndoselo al
 * servidor (las reglas lo frenan aunque la app tuviera un error).
 */
export function soloMira(perfil: Perfil | null): boolean {
  return perfil?.rol === 'socio'
}

/**
 * Ve los números del negocio y todos los avisos del Panel: quien está al
 * mando y un dueño que solo mira. Ver no es poder hacer: los botones que
 * llevan a resolver algo se esconden para quien solo mira.
 */
export function veLosNumeros(perfil: Perfil | null): boolean {
  return estaAlMando(perfil) || soloMira(perfil)
}

/**
 * Es uno de los dueños del negocio, mire o maneje: para los retiros, las
 * deudas del local con un dueño y los límites de la encargada.
 */
export function esRolDeDueno(rol: Rol | null | undefined): boolean {
  return rol === 'owner' || rol === 'socio'
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
 * Va con el mismo candado que borrar todo. Desde el 19/11 importar
 * reemplaza solo lo de ese aparato y no le borra nada al servidor (ver
 * db/importarRespaldo.ts), pero lo que el archivo tenga y el servidor no
 * se sube: con un archivo viejo puede revivir cosas borradas a proposito.
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
  return !esRolDeDueno(rolObjetivo)
}

/** Los roles que esta persona puede elegir al dar de alta a alguien. */
export function rolesQuePuedeAsignar(perfil: Perfil | null): Rol[] {
  if (esDueno(perfil)) return ['owner', 'socio', 'encargado', 'empleado']
  if (perfil?.rol === 'encargado') return ['encargado', 'empleado']
  return []
}

/**
 * Ver los sueldos acordados y ordenar los pagos (19/11): los dueños y
 * quien esta de encargado.
 *
 * Cuanto cobra cada persona es lo mas reservado que tiene la app. Lo
 * decidio Emmanuel el 19/11: la administracion la lleva la encargada, y
 * para eso tiene que ver lo acordado, decir de quien es cada pago y a que
 * mes corresponde. Va junto con la regla de `sueldos` de firestore.rules:
 * las dos se cambian a la vez.
 */
export function puedeVerSueldos(perfil: Perfil | null): boolean {
  return perfil?.rol === 'owner' || perfil?.rol === 'encargado'
}

/**
 * Definir o cambiar lo acordado con alguien: solo un dueño.
 *
 * Asi nadie se cambia el propio sueldo. La regla del servidor dice lo
 * mismo: en `sueldos` escribe solo un dueño.
 */
export function puedeDefinirSueldos(perfil: Perfil | null): boolean {
  return perfil?.rol === 'owner'
}

/**
 * Tiene «Mi sueldo»: quien trabaja en el negocio y no es dueño. Ve solo lo
 * suyo del mes (lo acordado, lo cobrado y lo que falta). Un dueño no cobra
 * sueldo: retira, y eso se ve en Sueldos.
 */
export function tieneMiSueldo(perfil: Perfil | null): boolean {
  return perfil?.rol === 'encargado' || perfil?.rol === 'empleado'
}

/** Entra a Ajustes (respaldo, usuarios del equipo, catalogo publico). */
export function puedeVerAjustes(perfil: Perfil | null): boolean {
  return estaAlMando(perfil)
}
