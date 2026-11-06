import type { Jornada, Movimiento, Venta } from '../db/db'
import { contarOperaciones } from '../db/cambioProducto'
import { resumirJornada } from './calculos'

/**
 * Los numeros del tablero del Panel en la compu (opcion B, elegida el
 * 06/11): lo de hoy en cuatro recuadros, y la semana en barras.
 */

export function saludo(hora: number): string {
  if (hora < 12) return 'Buenos días'
  if (hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

/** El lunes de la semana de esa fecha (el domingo cuenta como fin de semana). */
export function lunesDe(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay() // 0 = domingo
  return sumarDias(fecha, -((dia + 6) % 7))
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Lo vendido cada dia de lunes a sabado de esa semana. */
export function ventasDeLaSemana(lunes: string, ventas: Pick<Venta, 'fecha' | 'total'>[]): { fecha: string; dia: string; total: number }[] {
  return DIAS.map((dia, i) => {
    const fecha = sumarDias(lunes, i)
    const total = ventas.filter((v) => v.fecha === fecha).reduce((s, v) => s + v.total, 0)
    return { fecha, dia, total: Math.round(total * 100) / 100 }
  })
}

export interface Hoy {
  vendido: number
  operaciones: number
  /** Lo que deberia haber en el cajon de los turnos abiertos. null si no hay ninguno abierto. */
  enElCajon: number | null
  /** Lo cobrado con tarjeta, transferencia o QR. */
  banco: number
}

export function resumenDeHoy(jornadas: Jornada[], ventas: Venta[], movimientos: Movimiento[]): Hoy {
  const todo = resumirJornada(0, ventas, [])
  const abiertas = jornadas.filter((j) => j.estado === 'abierto')
  const enElCajon =
    abiertas.length === 0
      ? null
      : abiertas.reduce(
          (s, j) =>
            s +
            resumirJornada(
              j.cajaInicial,
              ventas.filter((v) => v.jornadaId === j.id),
              movimientos.filter((m) => m.jornadaId === j.id),
            ).cierreEsperado,
          0,
        )
  return {
    vendido: todo.totalVentas,
    operaciones: contarOperaciones(ventas),
    enElCajon,
    banco: todo.banco,
  }
}
