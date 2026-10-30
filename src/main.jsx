import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Rolar a página com o cursor sobre um <input type="number"> em foco mudava o
// valor (ex.: a % de um canal no Planejamento de Campanhas). Aqui a roda nunca
// mexe no número: o campo perde o foco e a rolagem vai para o contêiner que
// rolaria (só tirar o foco deixava o primeiro giro "engolido", sem rolar nada).
// Vale para todos os campos numéricos do app de uma vez.
function scrollParent(el) {
  for (let n = el?.parentElement; n && n !== document.body; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n)
    if ((overflowY === 'auto' || overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return n
  }
  return document.scrollingElement || document.documentElement
}
document.addEventListener('wheel', (e) => {
  const el = e.target
  if (!(el instanceof HTMLInputElement) || el.type !== 'number' || document.activeElement !== el) return
  e.preventDefault()
  el.blur()
  const linha = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
  scrollParent(el).scrollBy({ left: e.deltaX * linha, top: e.deltaY * linha })
}, { passive: false })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
