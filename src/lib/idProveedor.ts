/**
 * El id de un proveedor, derivado de su nombre.
 *
 * Por que
 * -------
 * Hasta ahora el id salia de nuevoId(), que es aleatorio. En un
 * dispositivo eso alcanza. Con cinco no: el celular de cada persona le
 * puso a "MOHICANO" un id distinto, los cinco sincronizaron, y quedo el
 * mismo proveedor cargado varias veces con los productos repartidos
 * entre las copias.
 *
 * Con el id derivado del nombre, dos dispositivos que nunca se hablaron
 * llegan al mismo id para el mismo proveedor. No hace falta que se
 * pongan de acuerdo: el nombre ya es el acuerdo.
 *
 * Esto importa especialmente para la importacion del Excel, que trae el
 * proveedor por nombre y va a crear varias decenas: si la importacion
 * usara ids nuevos, crearia una segunda copia de cada proveedor que ya
 * existe.
 *
 * El mismo valor sirve para dos cosas
 * -----------------------------------
 * Es el id, y es tambien la respuesta a "¿estos dos son el mismo
 * proveedor?". Que sea una sola funcion es a proposito: si agrupar y
 * nombrar usaran reglas distintas, se podrian agrupar dos fichas y
 * despues darles ids diferentes.
 *
 * Consecuencia: dos nombres que dan el mismo id SON el mismo proveedor
 * para la app. "HUGO-LA ENTRERRIANA" y "HUGO LA ENTRERRIANA" se juntan,
 * y eso es lo que se quiere: la diferencia es un error de tipeo, no dos
 * proveedores.
 */

/**
 * Hash corto y estable (FNV-1a en base 36).
 *
 * Solo se usa en dos casos de borde --un nombre sin una sola letra ni
 * numero, y un nombre larguisimo que hay que cortar-- donde el texto
 * del id no alcanza para distinguir. En los nombres normales no
 * aparece, asi que el id se sigue leyendo.
 */
function hashCorto(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** Cuantas letras del nombre entran en el id antes de cortarlo. */
const LARGO_MAXIMO = 60

/**
 * El nombre reducido a lo que de verdad lo identifica: sin acentos, sin
 * mayusculas, sin signos y sin espacios de mas.
 */
function aPalabras(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * El id del proveedor que se llama asi. Mismo nombre, mismo id, en
 * cualquier dispositivo y para siempre.
 */
export function idDeProveedor(nombre: string): string {
  const palabras = aPalabras(nombre)
  const texto = palabras.join('-')

  // Un nombre sin una sola letra ni numero ("---", "???"). No deberia
  // pasar, pero si pasa no pueden terminar todos con el mismo id.
  if (texto === '') return `prov-${hashCorto(nombre.trim())}`

  // Un nombre larguisimo se corta, y entonces el texto solo ya no
  // garantiza que dos nombres distintos den ids distintos: ahi se le
  // agrega el hash del nombre entero.
  if (texto.length > LARGO_MAXIMO) {
    const cortado = texto.slice(0, LARGO_MAXIMO).replace(/-+$/, '')
    return `prov-${cortado}-${hashCorto(texto)}`
  }

  return `prov-${texto}`
}

/** Si estos dos nombres son el mismo proveedor. */
export function esElMismoProveedor(a: string, b: string): boolean {
  return idDeProveedor(a) === idDeProveedor(b)
}

/** Si este proveedor ya tiene el id que le corresponde por su nombre. */
export function tieneElIdQueLeCorresponde(proveedor: { id: string; nombre: string }): boolean {
  return proveedor.id === idDeProveedor(proveedor.nombre)
}
