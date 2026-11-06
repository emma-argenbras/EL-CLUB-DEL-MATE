/**
 * Que la ruedita del mouse no cambie los numeros.
 *
 * En la compu, un campo de numero con el cursor adentro sube o baja su
 * valor cuando se gira la ruedita encima. Pasaba en el conteo de caja:
 * se cargaba la cantidad de billetes, se giraba para bajar en la
 * pantalla, y el numero cambiaba --o quedaba en cero-- sin que nadie lo
 * viera. Un conteo que cambia solo es una diferencia de caja inventada
 * (punto 6 del pedido del 06/11).
 *
 * La salida es la mas simple que no depende de cada formulario: si la
 * ruedita gira sobre el campo de numero que tiene el foco, se le saca el
 * foco. El numero queda como estaba y la pantalla baja, que es lo que la
 * persona queria hacer. Vale para todos los campos de numero de la app,
 * los de hoy y los que se agreguen.
 */

interface CampoQueSeSuelta {
  type: string
  blur: () => void
}

function esCampoDeNumero(elemento: unknown): elemento is CampoQueSeSuelta {
  return (
    typeof elemento === 'object' &&
    elemento !== null &&
    (elemento as { type?: unknown }).type === 'number' &&
    typeof (elemento as { blur?: unknown }).blur === 'function'
  )
}

/** Lo que hace con cada giro: true si solto el campo. */
export function alGirarLaRuedita(objetivo: unknown, conFoco: unknown): boolean {
  if (objetivo !== conFoco || !esCampoDeNumero(conFoco)) return false
  conFoco.blur()
  return true
}

interface DocumentoConFoco {
  activeElement: unknown
  addEventListener: (
    tipo: 'wheel',
    oyente: (e: { target: unknown }) => void,
    opciones: { passive: boolean; capture: boolean },
  ) => void
}

/** Se llama una vez al arrancar la app. */
export function protegerNumerosDeLaRuedita(documento: DocumentoConFoco): void {
  documento.addEventListener(
    'wheel',
    (e) => {
      alGirarLaRuedita(e.target, documento.activeElement)
    },
    // En captura, para llegar antes que cualquier otro manejador; pasivo,
    // porque no frena el desplazamiento de la pantalla.
    { passive: true, capture: true },
  )
}
