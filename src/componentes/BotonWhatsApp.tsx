import {
  enlaceWhatsApp,
  mensajeCatalogo,
  mensajeProducto,
  type ProductoCompartible,
} from '../lib/whatsapp'

/**
 * Abre el WhatsApp que la persona ya tiene instalado, con el mensaje
 * escrito, y deja que elija a quien mandarselo. No manda nada solo ni
 * necesita ninguna cuenta nueva.
 */
export function CompartirProducto({
  producto,
  chico = false,
}: {
  producto: ProductoCompartible
  chico?: boolean
}) {
  return (
    <Enlace texto={mensajeProducto(producto)} chico={chico} titulo="Compartir por WhatsApp">
      {chico ? '💬' : '💬 Compartir por WhatsApp'}
    </Enlace>
  )
}

/** Lo mismo, pero manda el enlace al catalogo entero. */
export function CompartirCatalogo({ chico = false }: { chico?: boolean }) {
  return (
    <Enlace texto={mensajeCatalogo()} chico={chico} titulo="Compartir el catálogo por WhatsApp">
      {chico ? '💬 Catálogo' : '💬 Compartir el catálogo'}
    </Enlace>
  )
}

function Enlace({
  texto,
  titulo,
  chico = false,
  children,
}: {
  texto: string
  titulo: string
  chico?: boolean
  children: React.ReactNode
}) {
  return (
    <a
      className={chico ? 'boton-chico boton-wa boton-wa-chico' : 'boton-chico boton-wa'}
      href={enlaceWhatsApp(texto)}
      target="_blank"
      rel="noopener noreferrer"
      title={titulo}
      aria-label={titulo}
      // La fila entera abre el editor del producto: este boton no.
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  )
}
