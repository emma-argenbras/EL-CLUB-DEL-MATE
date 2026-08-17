import { useState } from 'react'

export default function PantallaLogin() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [avisoRecuperar, setAvisoRecuperar] = useState('')

  async function entrar() {
    setError('')
    if (!email.trim() || contrasena.length < 6) {
      setError('Cargá tu mail y tu contraseña (mínimo 6 caracteres).')
      return
    }
    setTrabajando(true)
    try {
      const { iniciarSesion } = await import('../sync/motor')
      await iniciarSesion(email, contrasena)
    } catch (e) {
      const codigo = (e as { code?: string }).code
      setError(
        codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential'
          ? 'El mail o la contraseña no son correctos.'
          : codigo === 'auth/too-many-requests'
            ? 'Demasiados intentos. Probá de nuevo en un rato.'
            : `No se pudo iniciar sesión: ${e}`,
      )
    } finally {
      setTrabajando(false)
    }
  }

  async function olvideContrasena() {
    setError('')
    setAvisoRecuperar('')
    if (!email.trim()) {
      setError('Escribí primero tu mail arriba, y después tocá este link.')
      return
    }
    try {
      const { recuperarContrasena } = await import('../sync/motor')
      await recuperarContrasena(email)
    } catch {
      // No decimos si el mail existe o no: evita que alguien use esto para
      // averiguar mails validos. El mensaje de abajo es siempre el mismo.
    } finally {
      setAvisoRecuperar(`Si ${email.trim()} tiene cuenta, le va a llegar un mail para elegir una contraseña nueva.`)
    }
  }

  return (
    <div className="pantalla-carga">
      <div className="logo-carga">🧉</div>
      <div className="tarjeta" style={{ width: 'min(360px, 90vw)', textAlign: 'left' }}>
        <p className="tarjeta-titulo">Iniciar sesión</p>
        {error && <div className="aviso aviso-error">{error}</div>}
        {avisoRecuperar && <div className="aviso aviso-ok">{avisoRecuperar}</div>}
        <div className="campo">
          <label htmlFor="login-email">Mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu-mail@elclubdelmate.com"
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
            autoFocus
          />
        </div>
        <div className="campo">
          <label htmlFor="login-pass">Contraseña</label>
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
          />
        </div>
        <button
          className="boton-principal"
          style={{ width: '100%' }}
          onClick={entrar}
          disabled={trabajando}
        >
          {trabajando ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          className="boton-chico"
          style={{ width: '100%', marginTop: 8 }}
          onClick={olvideContrasena}
        >
          Olvidé mi contraseña
        </button>
      </div>
      <p className="silencio" style={{ maxWidth: 320, textAlign: 'center' }}>
        Usá el mail y la contraseña que te dio quien administra el negocio.
      </p>
    </div>
  )
}

export function PantallaSinPerfil({ email }: { email: string | null }) {
  return (
    <div className="pantalla-carga">
      <div className="logo-carga">🧉</div>
      <div className="tarjeta" style={{ width: 'min(360px, 90vw)', textAlign: 'left' }}>
        <p className="tarjeta-titulo">Cuenta sin perfil asignado</p>
        <p className="silencio">
          Entraste como <strong>{email}</strong>, pero todavía nadie te asignó un rol en el
          equipo. Pedile a un dueño que te dé de alta desde Ajustes → Usuarios del equipo.
        </p>
        <button
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => {
            if (confirm('¿Cerrar esta sesión?')) {
              import('../sync/motor').then((m) => m.cerrarSesion())
            }
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
