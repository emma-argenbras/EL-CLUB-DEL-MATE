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
    vaciar() {
      colas = new Map()
    },
  }
}
