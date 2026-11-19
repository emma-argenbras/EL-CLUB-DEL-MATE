/**
 * Hacer las cosas de a una, en el orden en que se pidieron, por clave.
 *
 * Se usa para guardar lo que baja del servidor (19/11): cada aviso de la
 * escucha de una tabla se guarda cuando termino de guardarse el anterior
 * de esa misma tabla. Hasta ese dia cada aviso se guardaba por su cuenta,
 * todos a la vez, y el orden en que terminaban era el que saliera.
 *
 * Importa al abrir la app. El primer aviso trae la tabla entera y tarda
 * en guardarse; si mientras tanto la persona edita o borra algo, el eco
 * de ese cambio llega como un segundo aviso, corto, y se guardaba ANTES
 * de que el primero llegara a esa fila. Despues el primero la pisaba con
 * lo viejo: el precio recien cambiado volvia al anterior en ese aparato,
 * y lo recien borrado reaparecia (y mas tarde la revision de pendientes
 * lo volvia a subir).
 *
 * Tablas distintas no se esperan entre si. Y una tarea que falla no
 * frena a las que vienen atras: se avisa y se sigue.
 */
export interface ColaPorClave<K> {
  /** Corre `tarea` cuando terminaron las anteriores de esa clave. Nunca rechaza. */
  encolar: (clave: K, tarea: () => Promise<void>, alFallar?: (error: unknown) => void) => Promise<void>
  /**
   * Se cumple cuando termino todo lo que habia encolado para esa clave
   * AL MOMENTO de preguntar. Lo que se encole despues no lo demora, asi
   * que siempre termina. Nunca rechaza.
   */
  alDia: (clave: K) => Promise<void>
  /** Olvida las colas. Lo que ya estaba corriendo termina igual. */
  vaciar: () => void
}

export function colaPorClave<K>(): ColaPorClave<K> {
  let colas = new Map<K, Promise<void>>()
  return {
    encolar(clave, tarea, alFallar) {
      const anterior = colas.get(clave) ?? Promise.resolve()
      const esta = anterior.then(tarea).catch((error) => {
        alFallar?.(error)
      })
      colas.set(clave, esta)
      return esta
    },
    alDia(clave) {
      return colas.get(clave) ?? Promise.resolve()
    },
    vaciar() {
      colas = new Map()
    },
  }
}

/**
 * Esperar a que termine de guardarse lo que bajo de una tabla, con un
 * limite. true = ya esta guardado; false = se cumplio el limite y sigue
 * guardando.
 *
 * Lo usa la subida de lo que el servidor no tiene (19/11). Esa subida
 * compara lo que hay en este aparato contra lo que hay en el servidor,
 * y si compara ANTES de que termine de guardarse lo que bajo, ve filas
 * que otro aparato ya borro y las toma por "lo tengo yo y el servidor
 * no": las vuelve a subir, y lo borrado reaparece para todos. En la
 * prueba, con una tabla de 6.000 gastos, un gasto borrado desde otro
 * aparato mientras este estaba cerrado volvia al servidor a los 20
 * segundos de abrirlo.
 *
 * Con el limite cumplido no se sube nada de esa tabla en esta pasada:
 * entre subir tarde y revivir lo borrado, se sube tarde. El control
 * periodico vuelve a mirar.
 */
export async function esperarLoBajado<K>(
  cola: Pick<ColaPorClave<K>, 'alDia'>,
  clave: K,
  limiteMs: number,
): Promise<boolean> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<boolean>((listo) => {
    reloj = setTimeout(() => listo(false), limiteMs)
  })
  try {
    return await Promise.race([cola.alDia(clave).then(() => true), limite])
  } finally {
    clearTimeout(reloj)
  }
}
