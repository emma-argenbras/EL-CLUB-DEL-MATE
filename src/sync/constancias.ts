/**
 * Si las constancias de las fichas de proveedor unidas llegaron al
 * servidor (13/11).
 *
 * La constancia en `borrados` es lo que frena a un aparato atrasado: sin
 * ella, para ese aparato una ficha que se unió en otro es algo que el
 * servidor «todavía no tiene», y la vuelve a subir. El 13/11 había cero
 * constancias de proveedores en el servidor y las fichas repetidas habían
 * vuelto. La unión las escribe en el aparato donde se hace; esto confirma
 * que el servidor las tiene, en vez de suponerlo.
 */

export interface RevisionConstancias {
  /** Cuántas se controlaron. */
  pedidas: number
  /** Los ids de proveedor cuya constancia NO está en el servidor. */
  faltan: string[]
  /** Cuántas constancias de proveedores hay en el servidor, en total. */
  enElServidor: number
}

/** De a tantas: Firestore acepta hasta 30 valores en un `in`. */
export function enTandas<T>(lista: T[], tamano: number): T[][] {
  const tandas: T[][] = []
  for (let i = 0; i < lista.length; i += tamano) tandas.push(lista.slice(i, i + tamano))
  return tandas
}

export interface Aviso {
  tipo: 'ok' | 'ojo' | 'error'
  texto: string
}

function queHacer(cuantas: number): string {
  const sin =
    cuantas === 1
      ? 'Sin ella, un aparato atrasado puede volver a subir esa ficha.'
      : 'Sin ellas, un aparato atrasado puede volver a subir esas fichas.'
  return `${sin} No repitas la limpieza: sacale una foto a este aviso y mandásela a Emmanuel.`
}

/** Lo que se dice después de unir. null es que no se pudo preguntar al servidor. */
export function avisoDeConstancias(r: RevisionConstancias | null): Aviso {
  if (!r) {
    return {
      tipo: 'ojo',
      texto:
        'No se pudo confirmar con el servidor que las constancias llegaron: fijate que haya internet y tocá «Revisar de nuevo». Las fichas se unieron igual.',
    }
  }
  const n = r.pedidas
  const m = r.faltan.length
  if (m === 0) {
    return {
      tipo: 'ok',
      texto:
        n === 1
          ? 'La constancia ya está en el servidor: ningún aparato atrasado va a volver a subir esa ficha.'
          : `Las ${n} constancias ya están en el servidor: ningún aparato atrasado va a volver a subir esas fichas.`,
    }
  }
  const cuantas =
    m === n
      ? n === 1
        ? 'La constancia no llegó al servidor.'
        : `Ninguna de las ${n} constancias llegó al servidor.`
      : `${m === 1 ? 'Falta 1' : `Faltan ${m}`} de las ${n} constancias en el servidor.`
  return { tipo: 'error', texto: `${cuantas} ${queHacer(m)}` }
}

/**
 * El renglón fijo de la pantalla: cuántas hay en el servidor y si falta
 * alguna de las que se unieron desde este aparato.
 */
export function resumenDeConstancias(r: RevisionConstancias): Aviso {
  const total =
    r.enElServidor === 1
      ? 'En el servidor hay 1 constancia de fichas unidas.'
      : `En el servidor hay ${r.enElServidor} constancias de fichas unidas.`
  const m = r.faltan.length
  if (m === 0) return { tipo: 'ok', texto: total }
  return {
    tipo: 'error',
    texto: `${total} ${m === 1 ? 'Falta 1' : `Faltan ${m}`} de las que se unieron desde este aparato. ${queHacer(m)}`,
  }
}
