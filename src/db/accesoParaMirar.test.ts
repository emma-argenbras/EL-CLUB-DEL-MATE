import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, engancharAutor, historialAlDia, type Movimiento, type Usuario, type Vencimiento } from './db'
import { loQuePasaALaCuenta, pasarALaCuenta } from './accesoParaMirar'
import { MOTIVO_ACCESO_PARA_MIRAR } from '../lib/accesoParaMirar'

const elena: Usuario = { id: 'sin-cuenta-1', email: '', nombre: 'Elena', rol: 'owner', activo: true, sinCuenta: true, apodos: 'Mamá' }
const retiro = (id: string, persona: string | null): Movimiento => ({
  id, fecha: '2026-11-03', tipo: 'GASTO_CAJA_GRANDE', concepto: 'Retiro', monto: 10, categoria: 'RETIRO SOCIOS',
  jornadaId: null, esVariable: false, persona,
})
const deuda = (id: string, aQuien: string | null): Vencimiento => ({
  id, concepto: 'Compu', dia: 10, montoAproximado: 1, categoria: 'EQUIPAMIENTO', cuenta: 'cajaGrande', esVariable: false,
  avisarDiasAntes: 3, desde: '2026-11-10', activo: true, notas: null, cuotas: { total: 6, primera: 2, periodo: '2026-11' }, aQuien,
})

beforeEach(async () => {
  await Promise.all([db.usuarios.clear(), db.movimientos.clear(), db.vencimientos.clear()])
  await historialAlDia()
  await db.historial.clear()
  engancharAutor(() => ({ email: 'dueno@prueba.test', nombre: 'Emmanuel', rol: 'owner' }))
  await db.usuarios.add(elena)
  await db.movimientos.bulkAdd([retiro('r1', 'sin-cuenta-1'), retiro('r2', 'sin-cuenta-1'), retiro('r3', 'emma'), retiro('r4', null)])
  await db.vencimientos.bulkAdd([deuda('d1', 'sin-cuenta-1'), deuda('d2', 'emma')])
})

describe('pasar a un dueño sin cuenta a su cuenta para mirar (20/11)', () => {
  it('cuenta lo que pasa antes de tocar nada', async () => {
    expect(await loQuePasaALaCuenta('sin-cuenta-1')).toEqual({ retiros: 2, deudas: 1 })
    expect((await db.movimientos.get('r1'))?.persona).toBe('sin-cuenta-1')
  })

  it('crea su usuario, le pasa los retiros y la deuda, y saca el viejo: no pierde nada', async () => {
    expect(await pasarALaCuenta('sin-cuenta-1', 'uid-elena', 'Elena@Prueba.test')).toEqual({ retiros: 2, deudas: 1 })
    expect(await db.usuarios.get('uid-elena')).toMatchObject({ nombre: 'Elena', rol: 'socio', email: 'elena@prueba.test', apodos: 'Mamá' })
    expect(await db.usuarios.get('sin-cuenta-1')).toBeUndefined()
    expect((await db.movimientos.toArray()).map((m) => `${m.id}:${m.persona}`).sort()).toEqual(['r1:uid-elena', 'r2:uid-elena', 'r3:emma', 'r4:null'])
    expect((await db.vencimientos.toArray()).map((v) => `${v.id}:${v.aQuien}`).sort()).toEqual(['d1:uid-elena', 'd2:emma'])
  })

  it('queda en el historial con su motivo', async () => {
    await historialAlDia()
    await db.historial.clear() // lo de la preparación no cuenta
    await pasarALaCuenta('sin-cuenta-1', 'uid-elena', 'elena@prueba.test')
    await historialAlDia()
    const renglones = await db.historial.toArray()
    expect(renglones.length).toBeGreaterThanOrEqual(5) // el alta, la baja, dos retiros y la deuda
    expect(new Set(renglones.map((h) => h.motivo))).toEqual(new Set([MOTIVO_ACCESO_PARA_MIRAR]))
    expect(renglones.filter((h) => h.tabla === 'movimientos' && h.campo === 'persona').map((h) => h.valorNuevo)).toEqual(['uid-elena', 'uid-elena'])
  })

  it('si ya no es un dueño sin cuenta, o la cuenta ya tiene usuario, no toca nada', async () => {
    await expect(pasarALaCuenta('no-existe', 'uid-x', 'x@prueba.test')).rejects.toThrow(/ya no está/)
    await db.usuarios.add({ id: 'uid-elena', email: 'e@prueba.test', nombre: 'Otra', rol: 'empleado', activo: true })
    await expect(pasarALaCuenta('sin-cuenta-1', 'uid-elena', 'elena@prueba.test')).rejects.toThrow(/ya tiene un usuario/)
    expect((await db.movimientos.get('r1'))?.persona).toBe('sin-cuenta-1')
    expect(await db.usuarios.get('sin-cuenta-1')).toBeDefined()
  })
})
