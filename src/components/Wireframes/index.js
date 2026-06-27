// ─── Registry de wireframes ───────────────────────────────────────────────────
// Cada tipo de página tem um wireframe próprio (layout + slots + geração estruturada).
// O VSL é o primeiro pronto; os demais entram aqui conforme forem construídos.
//
// Para adicionar um novo wireframe: criar o componente + schema + gerador e registrar
// um item `ready: true` com { Component, emptyContent, system, buildInstruction, parse, toText }.

import VSLWireframe from './VSLWireframe'
import { VSL_WIREFRAME } from './vslSchema'
import { VSL_SYSTEM, buildVslInstruction, parseVslContent, vslToText } from './vslGenerate'

export const WIREFRAMES = {
  vsl: {
    id: 'vsl',
    name: 'VSL',
    label: 'VSL — Video Sales Letter',
    description: 'Página de vendas ancorada em vídeo. Hero com VSL + CTA, prova, oferta e preço.',
    ready: true,
    Component: VSLWireframe,
    emptyContent: VSL_WIREFRAME.emptyContent,
    system: VSL_SYSTEM,
    buildInstruction: buildVslInstruction,
    parse: parseVslContent,
    toText: vslToText,
  },
}

// Ordem e rótulos de TODOS os tipos previstos (inclui os que ainda não estão prontos,
// mostrados como "em breve" no seletor).
export const WIREFRAME_TYPES = [
  { id: 'vsl', label: 'VSL', ready: true },
  { id: 'aplicacao', label: 'Aplicação direta', ready: false },
  { id: 'webinar', label: 'Webinar', ready: false },
  { id: 'quiz', label: 'Quiz', ready: false },
  { id: 'vendas', label: 'Página de Vendas', ready: false },
  { id: 'material', label: 'Material Rico', ready: false },
  { id: 'lancamento', label: 'Lançamento', ready: false },
  { id: 'local', label: 'Negócio Local', ready: false },
]

export function getWireframe(type) {
  return WIREFRAMES[type] || null
}
