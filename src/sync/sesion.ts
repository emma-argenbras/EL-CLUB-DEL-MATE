import {
  SECCIONES_CONFIGURABLES,
  SECCIONES_POR_DEFECTO_EMPLEADO,
  type Rol,
  type SeccionId,
} from '../db/db'
import { nubeConfigurada } from './config'
import { estaAlMando } from './permisos'

/**
 * Estado reactivo de "quien esta usando la app ahora", sin depender del
 * SDK de Firebase (igual que sync/estado.ts). Si la nube no esta
 * configurada no hay cuentas ni roles: se trata a quien sea que abra la
 * app como dueño, con acceso a todo, tal como funcionaba antes de esto.
 */
export interface Perfil {
  nombre: string
  rol: Rol
  /** Solo importa si rol es "empleado"; ver Usuario.secciones en db.ts. */
  secciones?: SeccionId[] | null
}

export interface Sesion {
  cargando: boolean
  uid: string | null
  email: string | null
  perfil: Perfil | null
  /** Logueado, pero nadie le creo un perfil todavia (cuenta huerfana). */
  sinPerfil: boolean
  /** Un owner le apago el acceso desde Ajustes: se lo saca y no puede volver a entrar. */
  desactivada: boolean
}

let sesion: Sesion = nubeConfigurada
  ? { cargando: true, uid: null, email: null, perfil: null, sinPerfil: false, desactivada: false }
  : {
      cargando: false,
      uid: null,
      email: null,
      perfil: { nombre: 'Vos', rol: 'owner' },
      sinPerfil: false,
      desactivada: false,
    }

const oyentes = new Set<() => void>()

export function fijarSesion(parcial: Partial<Sesion>): void {
  sesion = { ...sesion, ...parcial }
  for (const oyente of oyentes) oyente()
}

export function suscribirseASesion(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export function obtenerSesion(): Sesion {
  return sesion
}

/**
 * Que secciones puede ver el perfil actual.
 *
 * Quien esta al mando las ve todas; a un empleado se le habilitan una
 * por una. Las secciones son visibilidad, no permisos: lo que cada rol
 * puede HACER esta en sync/permisos.ts.
 */
export function seccionesVisibles(perfil: Perfil | null): SeccionId[] {
  if (estaAlMando(perfil)) {
    return [...SECCIONES_CONFIGURABLES]
  }
  return perfil?.secciones ?? SECCIONES_POR_DEFECTO_EMPLEADO
}
