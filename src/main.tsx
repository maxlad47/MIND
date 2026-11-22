import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { ensureSeed } from './lib/seed'
import { REMOTE } from './lib/supabase'
import { initRemote } from './lib/remote'

try { registerSW({ immediate: true }) } catch { /* pas de service worker en dev */ }
if (!REMOTE) ensureSeed()
void initRemote()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <App />
      </HashRouter>
    </MotionConfig>
  </StrictMode>,
)
