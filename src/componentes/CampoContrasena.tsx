import { useState } from 'react'

interface Props {
  id: string
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  autoComplete?: string
  onEnter?: () => void
}

/** Input de contraseña con un ojito para mostrarla/ocultarla. */
export default function CampoContrasena({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  onEnter,
}: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        style={{ paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        style={{
          position: 'absolute',
          right: 4,
          top: 4,
          bottom: 4,
          width: 36,
          padding: 0,
          border: 'none',
          background: 'transparent',
          fontSize: '1.1rem',
        }}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
