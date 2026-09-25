import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@modu/console-core/styles.css'
import './app.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
