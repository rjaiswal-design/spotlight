import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider } from 'lightweight-ui'
import './styles.css'
import App from './App'
import { installSpring } from './lib/spring'

installSpring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
