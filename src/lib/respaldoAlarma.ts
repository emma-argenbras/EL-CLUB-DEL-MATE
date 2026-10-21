/**
 * El vigilante del respaldo nocturno.
 *
 * Un respaldo que se hace solo y que nadie mira sirve para recuperar,
 * pero no avisa. El 20/10/2026 los costos de cientos de productos se
 * vaciaron a las 16:40 y nos enteramos al otro dia, porque alguien
 * miro. Esto es lo que mira en su lugar: compara el respaldo de hoy
 * con el de ayer y grita si algo se encogio de golpe.
 *
 * Vive en src/ --y no en scripts/-- para que lo alcancen el typecheck
 * y las pruebas. El script de respaldo lo importa.
 */

/** Un documento cualquiera de Firestore, ya pasado a JSON. */
export type Documento = Record<string, unknown>
export type Coleccion = Record<string, Documento>

/** Cuanto puede encoger una coleccion en una noche sin que sea alarma. */
export const CAIDA_MAXIMA = 0.05

/** Cuantos productos pueden quedarse sin costo o sin proveedor de golpe. */
export const VACIADOS_MAXIMO = 20

/**
 * Las claves ordenadas, en todos los niveles.
 *
 * Sin esto el JSON sale en cualquier orden y el diff de la mañana es
 * ilegible, que es justamente para lo que sirve tenerlo en git.
 */
export function ordenarProfundo(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarProfundo)
  if (valor !== null && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    const entradas = Object.keys(valor as Documento)
      .sort()
      .map((k) => [k, ordenarProfundo((valor as Documento)[k])] as const)
    return Object.fromEntries(entradas)
  }
  return valor
}

/** La coleccion con sus documentos ordenados por id. */
export function ordenarColeccion(documentos: Coleccion): Coleccion {
  return Object.fromEntries(
    Object.keys(documentos)
      .sort()
      .map((id) => [id, ordenarProfundo(documentos[id]) as Documento]),
  )
}

/** Cuantos productos tienen cargado cada campo que importa. */
export function cargados(productos: Coleccion): { precioCompra: number; proveedor: number } {
  let precioCompra = 0
  let proveedor = 0
  for (const d of Object.values(productos)) {
    if (d.precioCompra != null) precioCompra++
    if (typeof d.proveedor === 'string' && d.proveedor.trim()) proveedor++
  }
  return { precioCompra, proveedor }
}

/**
 * Que tiene de raro el respaldo de hoy contra el de ayer.
 *
 * Devuelve los avisos en palabras. Vacio quiere decir que no hay nada
 * que mirar. Sin respaldo anterior tampoco hay con que comparar: la
 * primera noche nunca es alarma.
 */
export function alarmasDelRespaldo(
  nombre: string,
  antes: Coleccion | null,
  ahora: Coleccion,
): string[] {
  if (!antes) return []
  const avisos: string[] = []

  const cuantosAntes = Object.keys(antes).length
  const cuantosAhora = Object.keys(ahora).length
  const perdidos = cuantosAntes - cuantosAhora
  if (cuantosAntes > 0 && perdidos > Math.max(1, cuantosAntes * CAIDA_MAXIMA)) {
    avisos.push(
      `${nombre}: había ${cuantosAntes} documentos y quedaron ${cuantosAhora} (${perdidos} menos).`,
    )
  }

  // Lo del 20/10 no fue que desaparecieran productos: fue que se
  // quedaron vacios. Contar documentos no lo habria visto.
  if (nombre === 'productos') {
    const a = cargados(antes)
    const b = cargados(ahora)
    for (const campo of ['precioCompra', 'proveedor'] as const) {
      const vaciados = a[campo] - b[campo]
      if (vaciados > VACIADOS_MAXIMO) {
        avisos.push(
          `productos: ${vaciados} se quedaron sin ${campo} (eran ${a[campo]}, quedaron ${b[campo]}).`,
        )
      }
    }
  }

  return avisos
}
