/**
 * Si se puede usar un código para un producto nuevo.
 *
 * La regla vive acá y no adentro del formulario para que se pueda
 * probar: son cuatro casos y uno de ellos --no saber-- es el que
 * importa de verdad.
 *
 * Por qué hace falta preguntarle al servidor: un dispositivo que estuvo
 * un rato sin internet NO tiene los productos que se crearon mientras
 * tanto. Para él ese código está libre. Al subirlo, `setDoc` pisa el
 * del servidor y el producto que estaba desaparece debajo del nuevo.
 */

export type DecisionCodigo =
  | 'libre'
  | 'ya-existe-aca'
  | 'ya-existe-en-el-servidor'
  /** No se pudo preguntar. NO es lo mismo que estar libre. */
  | 'sin-conexion'

/**
 * `enLaNube` es true / false / null, y null quiere decir "no se pudo
 * averiguar". Tratarlo como "libre" sería justamente el error.
 */
export function decidirCodigoNuevo(existeAca: boolean, enLaNube: boolean | null): DecisionCodigo {
  if (existeAca) return 'ya-existe-aca'
  if (enLaNube === true) return 'ya-existe-en-el-servidor'
  if (enLaNube === null) return 'sin-conexion'
  return 'libre'
}

/**
 * El cartel, o null si se puede seguir.
 *
 * Sin conexión se FRENA, no se avisa. Decisión de Emmanuel del 21/10, y
 * la razón es doble: los productos los da de alta solo Sandra desde la
 * Mac, así que frenar no traba una venta en el mostrador; y mientras no
 * exista el respaldo nocturno, un producto pisado no se puede
 * recuperar de ningún lado. Cuando el respaldo esté andando se revisa.
 */
export function mensajeDeCodigo(decision: DecisionCodigo, codigo: string): string | null {
  switch (decision) {
    case 'ya-existe-aca':
      return `Ya existe un producto con el código ${codigo}.`
    case 'ya-existe-en-el-servidor':
      return (
        `Ya existe un producto con el código ${codigo} en el servidor, aunque todavía no haya ` +
        `llegado a este dispositivo. Elegí otro código.`
      )
    case 'sin-conexion':
      return 'Sin conexión no se pueden crear productos nuevos. Conectate y probá de nuevo.'
    case 'libre':
      return null
  }
}
