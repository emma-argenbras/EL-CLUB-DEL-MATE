/**
 * Armado de mensajes y enlaces de WhatsApp.
 *
 * Todo esto es "etapa 1": no hay ninguna conexion con WhatsApp ni cuenta
 * nueva de por medio. Se arma un enlace wa.me y el celular abre el
 * WhatsApp que la persona ya tiene instalado, con el texto escrito. Quien
 * manda el mensaje sigue siendo una persona.
 */

/**
 * Numero de la tienda, en formato internacional y solo digitos
 * (54 + area sin el 0 + numero sin el 15). Ej: '543454123456'.
 *
 * Mientras este vacio, el catalogo publico no muestra el boton de
 * consultar: es preferible que no aparezca a que abra un chat con nadie.
 */
export const TELEFONO_TIENDA = ''

/** De donde cuelga el catalogo publico. */
export const URL_CATALOGO = 'https://app.elclubdelmate.com/catalogo/'

const FIRMA = 'El Club del Mate · Concordia'

/** Lo minimo que hace falta saber de un producto para compartirlo. */
export interface ProductoCompartible {
  codigo: string
  descripcion: string
  precioVenta: number | null
}

/**
 * Deja el numero como lo quiere wa.me: solo digitos. Un numero escrito
 * como "+54 9 345 412-3456" y otro como "5493454123456" tienen que
 * terminar igual.
 */
export function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '')
}

/**
 * Precio tal como se lee en un mensaje: sin decimales y con punto de
 * miles, que es como se escriben los precios en el local.
 */
function precioEnTexto(precio: number | null): string {
  if (precio === null || !Number.isFinite(precio)) return 'consultar'
  return `$ ${Math.round(precio).toLocaleString('es-AR')}`
}

/**
 * El mensaje que se manda por un producto. Los asteriscos son negrita en
 * WhatsApp.
 */
export function mensajeProducto(
  producto: ProductoCompartible,
  urlCatalogo: string = URL_CATALOGO,
): string {
  const lineas = [
    `🧉 *${producto.descripcion}*`,
    precioEnTexto(producto.precioVenta),
  ]
  if (producto.codigo) lineas.push('', `Código ${producto.codigo}`)
  lineas.push('', `Mirá todo el catálogo 👉 ${urlCatalogo}`, FIRMA)
  return lineas.join('\n')
}

/** El mensaje que se manda cuando se comparte el catalogo entero. */
export function mensajeCatalogo(urlCatalogo: string = URL_CATALOGO): string {
  return [
    '🧉 *El Club del Mate*',
    'Mirá nuestro catálogo con precios actualizados:',
    urlCatalogo,
    '',
    FIRMA,
  ].join('\n')
}

/**
 * El mensaje que escribe un cliente desde el catalogo publico: va
 * dirigido a la tienda, asi que esta redactado al reves que los de
 * arriba.
 */
export function mensajeConsulta(producto: ProductoCompartible): string {
  const que = producto.codigo
    ? `${producto.descripcion} (${producto.codigo})`
    : producto.descripcion
  return `¡Hola! Quería consultar por *${que}*, que vi en el catálogo.`
}

/**
 * Enlace que abre WhatsApp con el texto ya cargado.
 *
 * Sin telefono, WhatsApp pide elegir a quien mandarselo: es lo que se
 * quiere cuando la que comparte es una vendedora. Con telefono, abre
 * directo ese chat: es lo que se quiere cuando el que escribe es un
 * cliente que quiere hablar con la tienda.
 */
export function enlaceWhatsApp(texto: string, telefono?: string): string {
  const destino = telefono ? soloDigitos(telefono) : ''
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
}
