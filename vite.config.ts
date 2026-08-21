import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// La app se publica en la raiz de app.elclubdelmate.com (ver public/CNAME
// y .github/workflows/deploy.yml). En desarrollo la base tambien es "/".
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        // La app de administracion.
        app: resolve(__dirname, 'index.html'),
        // El catalogo publico, que queda en /catalogo/. Va como pagina
        // aparte a proposito: un cliente que abre el enlace desde
        // WhatsApp no tiene por que bajarse la app entera ni pasar por
        // el login. Tampoco registra el service worker, porque el
        // registro vive en un componente de la app y esta pagina no lo
        // importa.
        catalogo: resolve(__dirname, 'catalogo/index.html'),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': no se actualiza sola de golpe (podria cortar una venta
      // a mitad); se avisa con un boton y se aplica cuando la persona
      // toca "Actualizar".
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icono-192.png', 'icono-512.png'],
      manifest: {
        name: 'El Club del Mate',
        short_name: 'ECDM',
        description: 'Gestion y administracion de El Club del Mate',
        theme_color: '#1b4332',
        background_color: '#f7f5ef',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        lang: 'es-AR',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        // El catalogo de productos pesa; lo dejamos entrar al precache.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
