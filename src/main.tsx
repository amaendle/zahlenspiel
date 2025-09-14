import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA Service Worker einbinden
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // hier könntest du z.B. ein Toast zeigen "Neue Version verfügbar"
    updateSW(true)
  },
  onOfflineReady() {
    console.log('App ist offline verfügbar ✅')
  },
})
