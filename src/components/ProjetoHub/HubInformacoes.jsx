// Cartão "Informações do projeto" da coluna esquerda: pares rótulo/valor com
// os dados cadastrais e contratuais, recolhível, com atalho pra editar em
// Dados do Cliente.
import { useState } from 'react'
import { ChevronDown, ChevronRight, Info, Pencil } from 'lucide-react'
import { rotuloNegocio, rotuloSegmento, rotuloMaturidade, rotuloModeloContrato, rotuloPagamento, rotuloTipoPlano, rotuloCobranca } from '../../lib/constants'
import { fmtCurrency } from '../../lib/utils'
import { ObservacoesLeitura } from '../UI/ObservacoesCampo'
import { useI18n } from '../../i18n'

function Campo({ label, valor }) {
  if (valor == null || valor === '') return null
  return (
    <div className="py-2 border-b border-rl-border/50 last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">{label}</p>
      <p className="text-sm text-rl-text mt-0.5 break-words">{valor}</p>
    </div>
  )
}

export default function HubInformacoes({ project, onEditar }) {
  const { t, locale } = useI18n()
  const [aberto, setAberto] = useState(true)
  const dataContrato = project.contractDate
    ? new Date(project.contractDate + (String(project.contractDate).length === 10 ? 'T12:00:00' : '')).toLocaleDateString(locale)
    : null
  const campos = [
    [t('hub.info.tipoNegocio'), rotuloNegocio(project.businessType)],
    [t('hub.info.segmento'), rotuloSegmento(project.segmento)],
    [t('hub.info.maturidade'), rotuloMaturidade(project.digitalMaturity)],
    [t('hub.info.responsavel'), project.responsibleName],
    [t('hub.info.cargo'), project.responsibleRole],
    [t('hub.info.modeloContrato'), String(rotuloModeloContrato(project.contractModel) || '').replace(/^[^\p{L}\d]+/u, '')],
    [t('hub.info.pagamento'), rotuloPagamento(project.contractPaymentType)],
    [t('hub.info.programaPlano'), project.planType ? rotuloTipoPlano(project.planType) : null],
    [t('hub.info.prePos'), project.billingMode ? rotuloCobranca(project.billingMode) : null],
    [t('hub.info.valor'), project.contractValue ? fmtCurrency(project.contractValue) + (project.contractModel === 'assessoria' ? t('hub.info.porMes') : '') : null],
    [t('hub.info.inicioContrato'), dataContrato],
    [t('hub.info.pastaClickup'), project.clickupFolderId ? `#${project.clickupFolderId}` : t('hub.info.naoVinculada')],
  ].filter(([, v]) => v != null && v !== '')

  return (
    <div className="glass-card border border-rl-border/60">
      <div className="flex items-center gap-2 px-4 py-3">
        <Info className="w-4 h-4 text-rl-cyan" />
        <span className="text-sm font-semibold text-rl-text flex-1">{t('hub.info.titulo')}</span>
        <span className="text-[11px] text-rl-muted">({campos.length})</span>
        <button onClick={onEditar} className="flex items-center gap-1 text-xs text-rl-subtle hover:text-rl-purple px-1.5 py-1 rounded-md hover:bg-rl-surface" title={t('hub.info.editarEmDados')}>
          <Pencil className="w-3 h-3" /> {t('comum.editar')}
        </button>
        <button onClick={() => setAberto((v) => !v)} className="p-1 rounded-md text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label={aberto ? t('hub.recolher') : t('hub.expandir')}>
          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      {aberto && (
        <div className="px-4 pb-2 border-t border-rl-border/60">
          {campos.map(([l, v]) => <Campo key={l} label={l} valor={v} />)}
          {project.observacoes && (
            <div className="py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">{t('hub.info.observacoes')}</p>
              <ObservacoesLeitura texto={project.observacoes} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
