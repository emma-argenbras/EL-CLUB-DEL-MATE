/**
 * Los iconos del menu de la compu (opcion B, elegida el 06/11): trazos
 * simples en lugar de emojis, que se ven distinto en cada aparato. Toman
 * el color del texto que los rodea.
 */
export type NombreIcono =
  | 'panel'
  | 'caja'
  | 'productos'
  | 'proveedores'
  | 'gastos'
  | 'reportes'
  | 'ajustes'
  | 'midia'
  | 'efectivo'
  | 'tarjeta'

const TRAZOS: Record<NombreIcono, JSX.Element> = {
  panel: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  caja: (
    <>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  productos: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  proveedores: (
    <>
      <path d="M3 6h11v10H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  gastos: (
    <>
      <path d="M3 7h18v12H3z" />
      <path d="M3 7l12-4 2 4" />
      <circle cx="16" cy="13" r="1.5" />
    </>
  ),
  reportes: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  ajustes: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  midia: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  efectivo: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  tarjeta: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
}

export default function Icono({ nombre, tamano = 18 }: { nombre: NombreIcono; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
