import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'

console.log("%c 🚀 TILO CORE: V8.6 - INTEGRITY PATCH LOADED ", "background: #222; color: #bada55; font-size: 14px; padding: 4px; border-radius: 4px;");

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
