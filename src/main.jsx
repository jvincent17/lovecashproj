import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { applyTheme, readTheme } from './lib/theme.js'
import { applyPrivacy, readPrivacy } from './lib/privacy.js'

applyTheme(readTheme())
applyPrivacy(readPrivacy())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Service worker (hanya di versi produksi) supaya bisa di-install & tetap jalan saat offline
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
