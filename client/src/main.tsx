// SPDX-License-Identifier: GPL-3.0-or-later
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const saved = localStorage.getItem('theme')
if (saved === 'light' || (!saved && window.matchMedia('(prefers-color-scheme: light)').matches)) {
  document.documentElement.classList.add('light-theme')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
