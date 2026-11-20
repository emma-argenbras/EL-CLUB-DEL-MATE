import { conMotivo, db } from './db'
import { MOTIVO_ACCESO_PARA_MIRAR, usuarioParaMirar, type LoQuePasa } from '../lib/accesoParaMirar'

/** Cuántos retiros y deudas apuntan hoy a ese dueño sin cuenta. */
export async function loQuePasaALaCuenta(idSinCuenta: string): Promise<LoQuePasa> {
  const [retiros, vencimientos] = await Promise.all([
    db.movimientos.filter((m) => m.persona === idSinCuenta).count(),
    db.vencimientos.filter((v) => v.aQuien === idSinCuenta).count(),
  ])
  return { retiros, deudas: vencimientos }
}

/**
 * Pasa a un dueño sin cuenta a su usuario con cuenta, de una: crea el
 * usuario nuevo (solo mira), le pasa los retiros y las deudas, y saca el
 * viejo. Todo en una transacción y con su motivo en el historial. La
 * cuenta de Firebase ya tiene que estar creada (ver crearCuentaParaMirar
 * en el motor): esto recibe su id.
 */
export async function pasarALaCuenta(idSinCuenta: string, uid: string, email: string): Promise<LoQuePasa> {
  return conMotivo(MOTIVO_ACCESO_PARA_MIRAR, () =>
    db.transaction('rw', db.usuarios, db.movimientos, db.vencimientos, async () => {
      const viejo = await db.usuarios.get(idSinCuenta)
      if (!viejo || !viejo.sinCuenta) throw new Error('Ese dueño ya no está como dueño sin cuenta.')
      if (await db.usuarios.get(uid)) throw new Error('Esa cuenta ya tiene un usuario.')
      await db.usuarios.add(usuarioParaMirar(viejo, uid, email))
      const retiros = await db.movimientos.filter((m) => m.persona === idSinCuenta).primaryKeys()
      for (const id of retiros) await db.movimientos.update(id, { persona: uid })
      const deudas = await db.vencimientos.filter((v) => v.aQuien === idSinCuenta).primaryKeys()
      for (const id of deudas) await db.vencimientos.update(id, { aQuien: uid })
      await db.usuarios.delete(idSinCuenta)
      return { retiros: retiros.length, deudas: deudas.length }
    }),
  )
}
