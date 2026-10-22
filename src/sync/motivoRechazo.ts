/**
 * Por qué el servidor rechazó un cambio en un producto.
 *
 * Firestore contesta "Missing or insufficient permissions" y nada más:
 * no dice cuál de las condiciones de la regla falló. El 22/10 eso costó
 * una mañana entera: las ediciones de Sandra no llegaban, sus renglones
 * de historial sí, y no había forma de saber desde afuera si era su rol
 * en el servidor o un dato que la edición dejaba vacío.
 *
 * Esto repite, del lado de la app, las mismas preguntas que hace la
 * regla de productos en firestore.rules, con lo que el servidor tiene
 * de verdad (el producto y el perfil propio, leídos del servidor, no de
 * la copia local). Si la regla cambia, esto tiene que cambiar con ella.
 */

/** Lo que la regla deja cambiar solo a un dueño o a un encargado. */
export const CAMPOS_DE_MANDO = ['archivado', 'precioVenta'] as const

/** Lo que la regla no deja pisar con vacío (noPisaConVacio). */
export const CAMPOS_QUE_NO_SE_VACIAN = [
  'precioCompra',
  'proveedorId',
  'proveedor',
  'rentabilidad',
] as const

export type MotivoRechazo =
  | { tipo: 'sin-perfil' }
  | { tipo: 'desactivado' }
  | { tipo: 'rol'; rol: string | null; campos: string[] }
  | { tipo: 'vacio'; campos: { campo: string; enElServidor: unknown }[] }
  /**
   * Un campo de mando que en el servidor no existe y el cambio agrega
   * sin valor (archivado en false, precio en null). Para la regla es un
   * cambio --diff() cuenta los campos que aparecen--, aunque no cambie
   * nada: es lo que le pasaba a Gabriela con casi todo el catalogo, que
   * nacio de la semilla sin el campo «archivado».
   */
  | { tipo: 'aparece'; campos: string[] }
  | { tipo: 'borrar-no-permitido' }
  | { tipo: 'no-se-sabe' }

type Datos = Record<string, unknown>

/** El perfil propio tal como está en el servidor (usuarios/{uid}). */
export interface PerfilEnElServidor {
  rol?: unknown
  activo?: unknown
}

/**
 * Lo mismo que hace `get(campo, null)` en las reglas: un campo que no
 * está y un campo en null son lo mismo.
 */
function leer(datos: Datos | null, campo: string): unknown {
  if (!datos) return null
  const valor = datos[campo]
  return valor === undefined ? null : valor
}

function iguales(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Los campos que cambian entre lo que está en el servidor y lo que se
 * mandó. Es el `diff(...).affectedKeys()` de la regla: cuenta también
 * un campo que aparece o que desaparece, no solo uno que cambia de valor.
 */
function camposQueCambian(enviado: Datos, servidor: Datos): string[] {
  const todos = new Set([...Object.keys(enviado), ...Object.keys(servidor)])
  return [...todos].filter((campo) => {
    const estaAca = campo in enviado
    const estaAlla = campo in servidor
    if (estaAca !== estaAlla) return true
    return !iguales(enviado[campo], servidor[campo])
  })
}

export function motivosDelRechazo(
  accion: 'guardar' | 'borrar',
  enviado: Datos | null,
  servidor: Datos | null,
  perfil: PerfilEnElServidor | null,
): MotivoRechazo[] {
  if (!perfil) return [{ tipo: 'sin-perfil' }]
  if (perfil.activo === false) return [{ tipo: 'desactivado' }]

  const rol = typeof perfil.rol === 'string' ? perfil.rol : null
  const alMando = rol === 'owner' || rol === 'encargado'

  if (accion === 'borrar') {
    if (!alMando) return [{ tipo: 'rol', rol, campos: [] }]
    return [{ tipo: 'borrar-no-permitido' }]
  }

  // Si el producto no existe en el servidor, es un alta, y para un alta
  // alcanza con estar activo: no hay nada más que la regla mire.
  if (!servidor || !enviado) return [{ tipo: 'no-se-sabe' }]

  const motivos: MotivoRechazo[] = []

  if (!alMando) {
    const tocados = camposQueCambian(enviado, servidor).filter((c) =>
      (CAMPOS_DE_MANDO as readonly string[]).includes(c),
    )
    const aparecen = tocados.filter(
      (c) => !(c in servidor) && (enviado[c] === null || enviado[c] === false),
    )
    const deVerdad = tocados.filter((c) => !aparecen.includes(c))
    if (deVerdad.length > 0) motivos.push({ tipo: 'rol', rol, campos: deVerdad })
    if (aparecen.length > 0) motivos.push({ tipo: 'aparece', campos: aparecen })
  }

  const vaciados = CAMPOS_QUE_NO_SE_VACIAN.filter(
    (campo) => leer(servidor, campo) != null && leer(enviado, campo) == null,
  ).map((campo) => ({ campo, enElServidor: leer(servidor, campo) }))
  if (vaciados.length > 0) motivos.push({ tipo: 'vacio', campos: vaciados })

  return motivos.length > 0 ? motivos : [{ tipo: 'no-se-sabe' }]
}

/**
 * Si el único problema es un dato que el cambio dejaba vacío, el cambio
 * se puede volver a mandar sin esos campos: el servidor conserva lo que
 * ya tenía y el resto de la edición entra. Es lo que la regla quiere
 * --"un dato cargado no se pisa con vacío"-- sin tirar abajo el precio
 * o el costo nuevo que alguien acaba de cargar.
 */
export function camposParaConservar(motivos: MotivoRechazo[]): string[] | null {
  if (motivos.length === 0) return null
  const campos: string[] = []
  for (const motivo of motivos) {
    if (motivo.tipo === 'vacio') campos.push(...motivo.campos.map((c) => c.campo))
    else if (motivo.tipo === 'aparece') campos.push(...motivo.campos)
    // Cualquier otro motivo (el rol, el perfil) no se arregla mandando
    // menos campos: reintentar seria insistir.
    else return null
  }
  return campos
}

const NOMBRE_CAMPO: Record<string, string> = {
  archivado: 'archivar o desarchivar',
  precioVenta: 'el precio de venta',
  precioCompra: 'el costo',
  proveedorId: 'la ficha del proveedor',
  proveedor: 'el proveedor',
  rentabilidad: 'la rentabilidad',
}

export function textoDelMotivo(motivo: MotivoRechazo): string {
  switch (motivo.tipo) {
    case 'sin-perfil':
      return 'tu usuario no tiene perfil en el servidor'
    case 'desactivado':
      return 'tu usuario figura desactivado en el servidor'
    case 'rol': {
      const que =
        motivo.campos.length > 0
          ? motivo.campos.map((c) => NOMBRE_CAMPO[c] ?? c).join(' y ')
          : 'borrar productos'
      return (
        `en el servidor tu usuario figura con rol «${motivo.rol ?? 'sin rol'}», ` +
        `y ${que} es solo de dueño o encargado`
      )
    }
    case 'vacio':
      return (
        'el cambio dejaba vacío ' +
        motivo.campos.map((c) => NOMBRE_CAMPO[c.campo] ?? c.campo).join(', ') +
        ', que en el servidor está cargado'
      )
    case 'aparece':
      return (
        'el cambio agregaba ' +
        motivo.campos.map((c) => NOMBRE_CAMPO[c] ?? c).join(' y ') +
        ' sin valor, y en el servidor ese dato no existe: para el servidor eso es tocarlo'
      )
    case 'borrar-no-permitido':
      return 'las reglas publicadas en el servidor todavía no permiten borrar productos'
    case 'no-se-sabe':
      return 'no se pudo saber qué condición falló'
  }
}

export function textoDelRechazo(codigo: string, motivos: MotivoRechazo[]): string {
  return `El servidor no aceptó el cambio en ${codigo}: ${motivos.map(textoDelMotivo).join('; ')}.`
}
