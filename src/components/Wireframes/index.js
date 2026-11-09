// ─── Registry de wireframes ───────────────────────────────────────────────────
// Cada tipo de página tem um wireframe próprio (layout + slots + geração estruturada).
// O VSL é o primeiro pronto; os demais entram aqui conforme forem construídos.
//
// Para adicionar um novo wireframe: criar o componente + schema + gerador e registrar
// um item `ready: true` com { Component, emptyContent, system, buildInstruction, parse, toText }.

import VSLWireframe from './VSLWireframe'
import { VSL_WIREFRAME } from './vslSchema'
import { VSL_SYSTEM, buildVslInstruction, parseVslContent, vslToText } from './vslGenerate'
import WebinarWireframe from './WebinarWireframe'
import { WEBINAR_WIREFRAME } from './webinarSchema'
import { WEBINAR_SYSTEM, buildWebinarInstruction, parseWebinarContent, webinarToText } from './webinarGenerate'
import AplicacaoWireframe from './AplicacaoWireframe'
import { APLICACAO_WIREFRAME } from './aplicacaoSchema'
import { APLICACAO_SYSTEM, buildAplicacaoInstruction, parseAplicacaoContent, aplicacaoToText } from './aplicacaoGenerate'
import SaasWireframe from './SaasWireframe'
import { SAAS_WIREFRAME } from './saasSchema'
import { SAAS_SYSTEM, buildSaasInstruction, parseSaasContent, saasToText } from './saasGenerate'
import { t } from '../../i18n'
import { instrucaoDeIdioma } from '../../lib/claude'

// name/label/description são getters: traduzem no idioma atual a cada leitura
// (wireframes.tipos.*). `system` também: a copy sai em JSON lido pelas CHAVES, então
// os valores podem vir no idioma de quem gera (instrucaoDeIdioma).

export const WIREFRAMES = {
  vsl: {
    id: 'vsl',
    get name() { return t('wireframes.tipos.vsl.nome') },
    get label() { return t('wireframes.tipos.vsl.rotulo') },
    get description() { return t('wireframes.tipos.vsl.descricao') },
    ready: true,
    Component: VSLWireframe,
    emptyContent: VSL_WIREFRAME.emptyContent,
    get system() { return VSL_SYSTEM + instrucaoDeIdioma() },
    buildInstruction: buildVslInstruction,
    parse: parseVslContent,
    toText: vslToText,
  },
  webinar: {
    id: 'webinar',
    get name() { return t('wireframes.tipos.webinar.nome') },
    get label() { return t('wireframes.tipos.webinar.rotulo') },
    get description() { return t('wireframes.tipos.webinar.descricao') },
    ready: true,
    Component: WebinarWireframe,
    emptyContent: WEBINAR_WIREFRAME.emptyContent,
    get system() { return WEBINAR_SYSTEM + instrucaoDeIdioma() },
    buildInstruction: buildWebinarInstruction,
    parse: parseWebinarContent,
    toText: webinarToText,
  },
  aplicacao: {
    id: 'aplicacao',
    get name() { return t('wireframes.tipos.aplicacao.nome') },
    get label() { return t('wireframes.tipos.aplicacao.rotulo') },
    get description() { return t('wireframes.tipos.aplicacao.descricao') },
    ready: true,
    Component: AplicacaoWireframe,
    emptyContent: APLICACAO_WIREFRAME.emptyContent,
    get system() { return APLICACAO_SYSTEM + instrucaoDeIdioma() },
    buildInstruction: buildAplicacaoInstruction,
    parse: parseAplicacaoContent,
    toText: aplicacaoToText,
  },
  saas: {
    id: 'saas',
    get name() { return t('wireframes.tipos.saas.nome') },
    get label() { return t('wireframes.tipos.saas.rotulo') },
    get description() { return t('wireframes.tipos.saas.descricao') },
    ready: true,
    Component: SaasWireframe,
    emptyContent: SAAS_WIREFRAME.emptyContent,
    get system() { return SAAS_SYSTEM + instrucaoDeIdioma() },
    buildInstruction: buildSaasInstruction,
    parse: parseSaasContent,
    toText: saasToText,
  },
}

// Ordem e rótulos de TODOS os tipos previstos (inclui os que ainda não estão prontos,
// mostrados como "em breve" no seletor).
export const WIREFRAME_TYPES = [
  { id: 'vsl', get label() { return t('wireframes.tipos.vsl.nome') }, ready: true },
  { id: 'webinar', get label() { return t('wireframes.tipos.webinar.nome') }, ready: true },
  { id: 'aplicacao', get label() { return t('wireframes.tipos.aplicacao.nome') }, ready: true },
  { id: 'saas', get label() { return t('wireframes.tipos.saas.nome') }, ready: true },
  { id: 'quiz', get label() { return t('wireframes.tipos.quiz.nome') }, ready: false },
  { id: 'vendas', get label() { return t('wireframes.tipos.vendas.nome') }, ready: false },
  { id: 'material', get label() { return t('wireframes.tipos.material.nome') }, ready: false },
  { id: 'lancamento', get label() { return t('wireframes.tipos.lancamento.nome') }, ready: false },
  { id: 'local', get label() { return t('wireframes.tipos.local.nome') }, ready: false },
]

export function getWireframe(type) {
  return WIREFRAMES[type] || null
}
