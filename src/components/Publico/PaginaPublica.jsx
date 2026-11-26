import { useState } from 'react'
import { aplicarIdiomaPublico } from '../../i18n'
import SeletorIdioma from '../UI/SeletorIdioma'

// Invólucro das rotas públicas (src/routes/publicRoutes.jsx): decide o idioma antes do primeiro
// desenho (`?lang=` → escolha salva → navegador → pt) e põe o seletor PT | EN no canto da página.
// `canto="topo"` leva o seletor para cima, à direita: nos formulários B2B/B2C a SaveBar ocupa o rodapé.
export default function PaginaPublica({ children, seletor = true, canto = 'baixo' }) {
  useState(() => { aplicarIdiomaPublico(); return null })
  return (
    <>
      {children}
      {seletor && (
        <div className={`fixed ${canto === 'topo' ? 'top-3 right-3' : 'bottom-3 left-3'} z-[60] print:hidden`}>
          <SeletorIdioma flutuante />
        </div>
      )}
    </>
  )
}
