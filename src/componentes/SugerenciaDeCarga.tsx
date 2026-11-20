import { useState } from 'react'
import { normalizar } from '../lib/formato'
import {
  categoriaQueSugiere,
  preguntaDeLaSugerencia,
  queParece,
  sugerenciaAplicada,
  type PersonaConSueldo,
  type QueParece,
} from '../lib/sueldos'

/**
 * Mientras alguien escribe el concepto de un gasto: si nombra a alguien
 * del equipo o a un dueño, o dice «sueldo», «semana» o «retiro», ofrece
 * cargarlo como lo que parece (19/11).
 *
 * Hasta ese día un pago anotado «SEMANA GABI» quedaba en OTROS, porque la
 * categoría viene puesta en OTROS y nadie la cambiaba: de siete pagos,
 * cinco. No cambia nada solo: pregunta, y con un toque deja la categoría
 * y la persona puestas. Con «No» se va hasta que cambie el concepto.
 */
export default function SugerenciaDeCarga({
  concepto,
  categoria,
  persona,
  personas,
  onAplicar,
}: {
  concepto: string
  categoria: string | null
  persona: string | null
  /** Las personas activas, con su rol y sus apodos. */
  personas: PersonaConSueldo[]
  onAplicar: (parece: QueParece, categoria: 'SUELDOS' | 'RETIRO SOCIOS') => void
}) {
  const [descartada, setDescartada] = useState<string | null>(null)
  const parece = queParece(concepto, personas)
  if (!parece || sugerenciaAplicada(parece, categoria, persona)) return null
  if (descartada === normalizar(concepto)) return null
  return (
    <div className="aviso aviso-ojo" role="status" style={{ marginTop: 0 }}>
      <strong>{preguntaDeLaSugerencia(parece)}</strong>{' '}
      {parece.persona
        ? 'Si lo cargás así, queda anotado a su nombre.'
        : 'Si lo es, cargalo así y elegí de quién.'}
      <div className="botonera" style={{ marginTop: 8 }}>
        <button type="button" onClick={() => setDescartada(normalizar(concepto))}>
          No
        </button>
        <button
          type="button"
          className="boton-principal"
          onClick={() => onAplicar(parece, categoriaQueSugiere(parece))}
        >
          Sí, cargarlo así
        </button>
      </div>
    </div>
  )
}
