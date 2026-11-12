import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './cloud.css'
import './styles-long-fields.css'
import './styles-calendario.css'
import './styles-preparaciones.css'

// Tema inicial antes del primer paint (evita parpadeo)
;(function initTheme() {
  try {
    const pref = localStorage.getItem('boletines-theme-pref') || 'system'
    const systemDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolved =
      pref === 'light' ? 'light' : pref === 'dark' ? 'dark' : systemDark ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
