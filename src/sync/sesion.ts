import type { Rol } from '../db/db'
import { nubeConfigurada } from './config'

/**
 * Estado reactivo de "quien esta usando la app ahora", sin depender del
 * SDK de Firebase (igual que sync/estado.ts). Si la nube no esta
 * configurada no hay cuentas ni roles: se trata a quien sea que abra la
 * app como dueño, con acceso a todo, tal como funcionaba antes de esto.
 */
export interface Perfil {
  nombre: string
  rol: Rol
}

export interface Sesion {
  cargando: boolean
  uid: string | null
  email: string | null
  perfil: Perfil | null
  /** Logueado, pero nadie le creo un perfil todavia (cuenta huerfana). */
  sinPerfil: boolean
}

let sesion: Sesion = nubeConfigurada
  ? { cargando: true, uid: null, email: null, perfil: null, sinPerfil: false }
  : { cargando: false, uid: null, email: null, perfil: { nombre: 'Vos', rol: 'owner' }, sinPerfil: false }

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

export function esOwner(s: Sesion = sesion): boolean {
  return s.perfil?.rol === 'owner'
}
