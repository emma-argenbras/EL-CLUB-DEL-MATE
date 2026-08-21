import React from 'react'
import ReactDOM from 'react-dom/client'
import CatalogoPublico from './CatalogoPublico'
import './catalogo.css'

/**
 * El catalogo publico es una pagina aparte de la app.
 *
 * Va separada a proposito: un cliente que abre el enlace desde WhatsApp
 * no tiene por que descargarse la app de administracion entera, ni pasar
 * por el login, ni registrar el service worker. Esta pagina solo lee el
 * catalogo publicado y lo muestra.
 */
ReactDOM.createRoot(document.getElementById('catalogo')!).render(
  <React.StrictMode>
    <CatalogoPublico />
  </React.StrictMode>,
)
