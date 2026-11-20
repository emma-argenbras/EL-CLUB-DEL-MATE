import { describe, expect, it } from 'vitest'
import type { Usuario } from '../db/db'
import {
  contrasenaAlAzar,
  MOTIVO_ACCESO_PARA_MIRAR,
  problemaDelAcceso,
  textoDeConfirmacionAcceso,
  usuarioParaMirar,
} from './accesoParaMirar'

const elena: Usuario = { id: 'sin-cuenta-1', email: '', nombre: 'Elena', rol: 'owner', activo: true, sinCuenta: true, apodos: 'Mamá' }
const equipo: Usuario[] = [elena, { id: 'gabi', email: 'gabi@prueba.test', nombre: 'Gabriela', rol: 'empleado', activo: true }]

describe('darle acceso para mirar a un dueño sin cuenta (20/11)', () => {
  it('pide un mail completo y que no sea de otro', () => {
    expect(problemaDelAcceso(elena, '', equipo)).toBe('Escribí su mail.')
    expect(problemaDelAcceso(elena, 'elena', equipo)).toMatch(/no parece completo/)
    expect(problemaDelAcceso(elena, 'elena@prueba', equipo)).toMatch(/no parece completo/)
    expect(problemaDelAcceso(elena, ' GABI@prueba.test ', equipo)).toBe('Ese mail ya es el de Gabriela.')
    // Aunque el de la lista esté guardado con mayúsculas.
    expect(problemaDelAcceso(elena, 'sandra@prueba.test', [...equipo, { id: 's', email: 'Sandra@Prueba.test', nombre: 'Sandra', rol: 'encargado', activo: true } as Usuario])).toBe('Ese mail ya es el de Sandra.')
    expect(problemaDelAcceso(elena, ' Elena@Prueba.test ', equipo)).toBeNull()
  })

  it('es solo para un dueño sin cuenta, activo y que siga en la lista', () => {
    expect(problemaDelAcceso(undefined, 'e@prueba.test', equipo)).toBe('Ese dueño ya no está en la lista.')
    expect(problemaDelAcceso(equipo[1], 'e@prueba.test', equipo)).toMatch(/hoy no tiene cuenta/)
    expect(problemaDelAcceso({ ...elena, sinCuenta: false }, 'e@prueba.test', equipo)).toMatch(/hoy no tiene cuenta/)
    expect(problemaDelAcceso({ ...elena, activo: false }, 'e@prueba.test', equipo)).toMatch(/reactivalo/)
  })

  it('el usuario nuevo tiene el id de su cuenta, el mismo nombre y apodos, y solo mira', () => {
    expect(usuarioParaMirar(elena, 'uid-elena', ' Elena@Prueba.test ')).toEqual({
      id: 'uid-elena', email: 'elena@prueba.test', nombre: 'Elena', rol: 'socio', activo: true, secciones: null, apodos: 'Mamá',
    })
  })

  it('la pregunta dice con qué mail, qué va a poder, cuántos retiros pasan y el motivo', () => {
    const texto = textoDeConfirmacionAcceso('Elena', ' Elena@Prueba.test', { retiros: 7, deudas: 1 })
    expect(texto).toMatch(/^¿Darle acceso para mirar a Elena, con elena@prueba\.test\?/)
    expect(texto).toContain('No va a poder cargar, cambiar ni borrar nada.')
    expect(texto).toContain('elegir su contraseña: nadie más la sabe')
    expect(texto).toContain('Pasan a su cuenta 7 retiros anotados y 1 deuda del local con Elena: no se pierde nada.')
    expect(texto).toContain(MOTIVO_ACCESO_PARA_MIRAR)
    expect(textoDeConfirmacionAcceso('Elena', 'e@p.test', { retiros: 1, deudas: 0 })).toContain('Pasan a su cuenta 1 retiro anotado: no se pierde nada.')
    expect(textoDeConfirmacionAcceso('Elena', 'e@p.test', { retiros: 0, deudas: 0 })).toContain('No tiene retiros anotados todavía.')
  })

  it('la contraseña al azar es larga y cada vez otra', () => {
    const a = contrasenaAlAzar(), b = contrasenaAlAzar()
    expect(a).toMatch(/^[0-9a-f]{48}$/)
    expect(a).not.toBe(b)
  })
})
