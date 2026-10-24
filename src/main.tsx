import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { initTheme } from './ui/theme'
import { toast } from './ui/toast'

initTheme()
let offlineReadyShown = false
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast('A new version is ready', {
      action: { label: 'Reload', onClick: () => { void updateSW(true) } },
      duration: 10000,
    })
  },
  onOfflineReady() {
    if (offlineReadyShown) return
    offlineReadyShown = true
    toast('Ready to work offline')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
