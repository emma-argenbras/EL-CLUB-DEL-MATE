/**
 * Como se llama un documento en Firestore cuando la clave la elegimos
 * nosotros.
 *
 * El problema
 * -----------
 * Los productos se guardan con su codigo como clave: el codigo es el
 * nombre del documento. Y 34 codigos del catalogo tienen una barra
 * adentro (EL11/05, EL22/102, EL82/471...). Para Firestore la barra no
 * es un caracter mas: es el separador de la ruta. Asi que
 *
 *   doc(firestore, 'negocios', 'el-club-del-mate', 'productos', 'EL11/05')
 *
 * no apunta a un producto llamado "EL11/05" sino a la ruta
 * negocios/el-club-del-mate/productos/EL11/05, que tiene cinco tramos
 * --impar-- y por lo tanto no es un documento. Firestore lo rechaza al
 * instante:
 *
 *   Invalid document reference. Document references must have an even
 *   number of segments, but .../productos/EL11/05 has 5.
 *
 * Y lo rechaza TIRANDO una excepcion en el momento de armar la
 * referencia, no devolviendo una promesa rechazada. Eso tuvo dos
 * consecuencias, las dos silenciosas:
 *
 *   - esos 34 productos nunca subieron, y como la excepcion no pasa por
 *     avisarRechazo(), tampoco aparecia el aviso de "el servidor
 *     rechazo un cambio". Se guardaban local y chau.
 *   - en la subida inicial la excepcion cortaba el armado del lote, y
 *     con el lote se cortaba TODO lo que venia despues en la cola:
 *     el resto de los productos, los turnos, las ventas, los gastos y
 *     --sobre todo-- los proveedores. De ahi vienen los proveedorId que
 *     apuntan a proveedores que en el servidor no existen.
 *
 * La solucion
 * -----------
 * Se escapa la barra al nombrar el documento, y se desescapa al leerlo.
 * El codigo que ve una persona no cambia en ningun lado: el codigo de
 * verdad viaja adentro del documento, en el campo `codigo`, y esto es
 * solo como se llama el archivo.
 *
 * Se escapan DOS caracteres y nada mas: la barra, porque rompe, y el
 * porcentaje, porque es el caracter de escape y sin escaparlo el ida y
 * vuelta no seria reversible (un codigo "A%2FB" volveria como "A/B").
 *
 * Que se escapen solo esos dos es la parte importante, y es a proposito:
 * los otros 1.303 productos conservan EXACTAMENTE el nombre de documento
 * que ya tienen en el servidor. Si esto escapara de mas --con
 * encodeURIComponent, por ejemplo, que tambien toca los espacios-- cada
 * producto con un espacio en el codigo pasaria a ser un documento nuevo
 * y quedaria el viejo al lado, duplicado. Un arreglo que duplica el
 * catalogo es peor que el problema.
 */

/** El nombre del documento en Firestore para una clave nuestra. */
export function aClaveDeNube(clave: string): string {
  return clave.replaceAll('%', '%25').replaceAll('/', '%2F')
}

/** La clave nuestra a partir del nombre del documento. */
export function aClaveLocal(id: string): string {
  return id.replaceAll('%2F', '/').replaceAll('%25', '%')
}

/**
 * Si esta clave necesita escaparse. Sirve para contar cuantos productos
 * estaban afectados sin tener que comparar cadenas en cada pantalla.
 */
export function necesitaEscape(clave: string): boolean {
  return clave.includes('/') || clave.includes('%')
}
