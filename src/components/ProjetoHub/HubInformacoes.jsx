// Cartão "Informações do projeto" da coluna esquerda: pares rótulo/valor com
// os dados cadastrais e contratuais, recolhível, com atalho pra editar em
// Dados do Cliente.
import { useState } from 'react'
import { ChevronDown, ChevronRight, Info, Pencil } from 'lucide-react'
import { BUSINESS_LABELS, CONTRACT_MODEL_LABELS, CONTRACT_PAYMENT_LABELS, MATURITY_LABELS } from '../../lib/constants'
import { fmtCurrency } from '../../lib/utils'

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
  const [aberto, setAberto] = useState(true)
  const dataContrato = project.contractDate
    ? new Date(project.contractDate + (String(project.contractDate).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
    : null
  const campos = [
    ['Tipo de negócio', BUSINESS_LABELS[project.businessType] || project.businessType],
    ['Segmento', project.segmento],
    ['Maturidade', MATURITY_LABELS?.[project.digitalMaturity] || project.digitalMaturity],
    ['Responsável', project.responsibleName],
    ['Cargo', project.responsibleRole],
    ['Modelo de contrato', String(CONTRACT_MODEL_LABELS[project.contractModel] || project.contractModel || '').replace(/^[^\p{L}\d]+/u, '')],
    ['Pagamento', CONTRACT_PAYMENT_LABELS?.[project.contractPaymentType] || project.contractPaymentType],
    ['Valor', project.contractValue ? fmtCurrency(project.contractValue) + (project.contractModel === 'assessoria' ? '/mês' : '') : null],
    ['Início do contrato', dataContrato],
    ['Pasta no ClickUp', project.clickupFolderId ? `#${project.clickupFolderId}` : 'não vinculada'],
  ].filter(([, v]) => v != null && v !== '')

  return (
    <div className="glass-card border border-rl-border/60">
      <div className="flex items-center gap-2 px-4 py-3">
        <Info className="w-4 h-4 text-rl-cyan" />
        <span className="text-sm font-semibold text-rl-text flex-1">Informações do projeto</span>
        <span className="text-[11px] text-rl-muted">({campos.length})</span>
        <button onClick={onEditar} className="flex items-center gap-1 text-xs text-rl-subtle hover:text-rl-purple px-1.5 py-1 rounded-md hover:bg-rl-surface" title="Editar em Dados do Cliente">
          <Pencil className="w-3 h-3" /> Editar
        </button>
        <button onClick={() => setAberto((v) => !v)} className="p-1 rounded-md text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label={aberto ? 'Recolher' : 'Expandir'}>
          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      {aberto && (
        <div className="px-4 pb-2 border-t border-rl-border/60">
          {campos.map(([l, v]) => <Campo key={l} label={l} valor={v} />)}
          {project.observacoes && <Campo label="Observações" valor={project.observacoes} />}
        </div>
      )}
    </div>
  )
}
