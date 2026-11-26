// Opções das perguntas 3 a 5 do NPS. O valor gravado em `respostas[].q3/q4/q5` é o texto em
// português (o módulo interno, src/components/NPSModule.jsx, tem o mesmo mapa); na tela vale o
// rótulo do idioma atual (nps.opcoes.*).
import { t } from '../i18n'

export const NPS_Q3_OPCOES = ['Ruim', 'Regular', 'Bom', 'Excelente']
export const NPS_Q4_OPCOES = ['Sim, dentro do esperado', 'Parcialmente', 'Não, abaixo do esperado']
export const NPS_Q5_OPCOES = ['Sim, tenho clareza total', 'Às vezes fico com dúvidas', 'Não, sinto falta de mais transparência']

const CHAVE = {
  Ruim: 'ruim', Regular: 'regular', Bom: 'bom', Excelente: 'excelente',
  'Sim, dentro do esperado': 'q4Sim', Parcialmente: 'q4Parcial', 'Não, abaixo do esperado': 'q4Nao',
  'Sim, tenho clareza total': 'q5Sim', 'Às vezes fico com dúvidas': 'q5AsVezes', 'Não, sinto falta de mais transparência': 'q5Nao',
}

export const rotuloOpcaoNps = (v) => (CHAVE[v] ? t(`nps.opcoes.${CHAVE[v]}`) : v)
