// Corpo do painel lateral "Nova atividade", no estilo composer do Linear:
// título grande sem borda, briefing e a grade de propriedades embaixo.
// Toda a lógica vem do hook usePlanejador (objeto `pl`); aqui é só a tela.
import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ExternalLink, Loader2 } from 'lucide-react'
import { fmtLonga, hojeISO } from '../../lib/atividadesCarga'

export const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ln-t2'

// As classes .ln-* ficam depois das utilities no CSS, então uma utility não
// sobrescreve o que elas definem (padding, borda, altura). Quando o campo
// precisa de algo diferente do .ln-input, os tokens são repetidos aqui.
const CAMPO_BASE = 'w-full rounded-md bg-ln-ink/[0.03] border border-ln-ink/[0.08] text-[13px] text-ln-t1 placeholder:text-ln-t4 outline-none transition-colors duration-150 focus:border-ln-accent/60 focus:bg-ln-ink/[0.04]'
export const SELECT_CLS = `${CAMPO_BASE} h-8 pl-2.5 pr-7 appearance-none disabled:opacity-50 disabled:cursor-not-allowed ${FOCO}`
export const AREA_CLS = `${CAMPO_BASE} px-2.5 py-1.5 resize-none ${FOCO}`

function linhasDe(texto, min = 2, max = 8) {
  const quebras = (String(texto || '').match(/\n/g) || []).length
  return Math.min(max, Math.max(min, quebras + 1))
}

export function Campo({ id, label, hint, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="ln-label">
        {label}
        {hint && <span className="font-normal text-ln-t4/80"> · {hint}</span>}
      </label>
      {children}
    </div>
  )
}

export function Seletor({ id, value, onChange, disabled = false, children }) {
  return (
    <div className="relative">
      <select id={id} value={value ?? ''} onChange={onChange} disabled={disabled} className={SELECT_CLS}>
        {children}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-ln-t4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

/** Card verde de "tarefa criada", usado no painel lateral e no planejador flutuante. */
export function CriadaCard({ criada, onNova }) {
  if (!criada) return null
  return (
    <div className="bg-ln-card border border-ln-green/40 rounded-[9px] p-4" style={{ boxShadow: 'var(--ln-ring-card)' }}>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-ln-green shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ln-t2">Tarefa criada no ClickUp</p>
          {criada.titulo && <p className="text-sm text-ln-t1 mt-1.5 break-words">{criada.titulo}</p>}
          <p className="text-xs text-ln-t3 mt-1 tabular">
            {criada.responsavel || 'Sem responsável'}
            {criada.data ? ` · entrega ${fmtLonga(criada.data)}` : ''}
          </p>
          {criada.aviso && (
            <p className="text-xs text-ln-yellow mt-2 rounded-md bg-ln-yellow/10 px-2 py-1.5">{criada.aviso}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {criada.url && (
              <a href={criada.url} target="_blank" rel="noopener noreferrer" className={`ln-primary ${FOCO}`}>
                Abrir no ClickUp <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button type="button" onClick={onNova} className={`ln-pill ${FOCO}`}>Nova atividade</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * @param {object} p
 * @param {object} p.pl                       objeto do hook usePlanejador
 * @param {string|null} p.responsavelInicial  profileId pré-selecionado (vindo da tabela do time)
 * @param {Function} p.onCalculado            chamado depois de pl.calcular() terminar
 */
export default function NovaAtividadePanel({ pl, responsavelInicial = null, onCalculado }) {
  const uid = useId()
  const [hoje] = useState(hojeISO)
  const aplicado = useRef(null)
  const form = pl?.form || {}
  const clientes = pl?.clientes || []
  const listas = pl?.listas || []
  const responsaveis = pl?.responsaveis || []
  const tipos = pl?.TIPOS_TAREFA || []
  const departamentos = pl?.DEPARTAMENTOS || []
  const prioridades = pl?.PRIORIDADES || []
  const formOk = !!pl?.formOk
  const calculando = !!pl?.calculando

  // Responsável pré-selecionado (botão "+" da tabela): aplica uma vez por valor
  useEffect(() => {
    if (!pl || !responsavelInicial || aplicado.current === responsavelInicial) return
    aplicado.current = responsavelInicial
    if (pl.form?.responsavelId !== responsavelInicial) pl.setResponsavelId?.(responsavelInicial)
  }, [pl, responsavelInicial])

  async function calcular() {
    if (!pl || !formOk || calculando) return
    await pl.calcular?.()
    onCalculado?.()
  }

  function atalho(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      calcular()
    }
  }

  if (!pl) return null

  if (pl.criada) {
    return (
      <div className="p-4">
        <CriadaCard criada={pl.criada} onNova={() => pl.novaAtividade?.()} />
      </div>
    )
  }

  const id = (campo) => `${uid}-${campo}`
  const set = (campo) => (e) => pl.set?.(campo, e.target.value)
  const semCliente = !pl.cliente
  const listaComoTexto = !pl.loadingListas && listas.length === 0

  return (
    <div className="flex flex-col min-h-full" onKeyDown={atalho}>
      <div className="flex-1 px-4 pt-3 pb-4 space-y-4">
        {/* Título e briefing, sem borda, como o composer do Linear */}
        <div className="space-y-1">
          <input
            id={id('titulo')}
            value={form.titulo || ''}
            onChange={set('titulo')}
            placeholder="Título da atividade"
            aria-label="Título da atividade"
            autoComplete="off"
            className="w-full bg-transparent border-0 p-0 text-[20px] leading-7 font-semibold tracking-[-0.01em] text-ln-t2 placeholder:text-ln-t4 outline-none"
          />
          <textarea
            id={id('descricao')}
            value={form.descricao || ''}
            onChange={set('descricao')}
            rows={linhasDe(form.descricao)}
            placeholder="Briefing, referências, onde estão os materiais…"
            aria-label="Briefing da atividade"
            className="w-full bg-transparent border-0 p-0 text-sm leading-5 text-ln-t2 placeholder:text-ln-t4 outline-none resize-none"
          />
        </div>

        <div className="border-t border-ln-ink/5" />

        {/* Propriedades */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Campo id={id('cliente')} label="Cliente">
            <Seletor id={id('cliente')} value={form.projectId} onChange={(e) => pl.setProjectId?.(e.target.value)}>
              <option value="">Selecione o cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Seletor>
            {clientes.length === 0 && <p className="text-[11px] text-ln-yellow mt-1">Nenhum cliente com pasta do ClickUp vinculada.</p>}
          </Campo>

          <Campo id={id('lista')} label="Lista no ClickUp">
            {pl.loadingListas ? (
              <div className="ln-input flex items-center gap-2 text-ln-t4 cursor-default" aria-live="polite">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando listas…
              </div>
            ) : listaComoTexto ? (
              <input
                id={id('lista')}
                value={form.listId || ''}
                onChange={set('listId')}
                disabled={semCliente}
                placeholder={semCliente ? 'Escolha o cliente primeiro' : 'ID da lista do ClickUp'}
                className={`ln-input disabled:opacity-50 disabled:cursor-not-allowed ${FOCO}`}
              />
            ) : (
              <Seletor id={id('lista')} value={form.listId} onChange={set('listId')} disabled={semCliente}>
                {listas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Seletor>
            )}
            {pl.listasErro && <p className="text-[11px] text-ln-red mt-1 break-words">{pl.listasErro}</p>}
          </Campo>

          <Campo id={id('tipo')} label="Tipo de tarefa">
            <Seletor id={id('tipo')} value={form.tipo} onChange={(e) => pl.setTipo?.(e.target.value)}>
              <option value="">Selecione</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </Seletor>
          </Campo>

          <Campo id={id('departamento')} label="Departamento">
            <Seletor id={id('departamento')} value={form.departamento} onChange={set('departamento')}>
              <option value="">Selecione</option>
              {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
            </Seletor>
          </Campo>

          <Campo id={id('responsavel')} label="Responsável" hint={pl.cliente && form.departamento ? 'sugerido pelo squad' : null}>
            <Seletor id={id('responsavel')} value={form.responsavelId} onChange={(e) => pl.setResponsavelId?.(e.target.value)}>
              <option value="">Quem executa</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Seletor>
          </Campo>

          <Campo id={id('horas')} label="Horas estimadas">
            <input
              id={id('horas')}
              type="number"
              min="0.25"
              step="0.25"
              inputMode="decimal"
              value={form.horas ?? ''}
              onChange={set('horas')}
              placeholder="ex.: 2"
              className={`ln-input tabular ${FOCO}`}
            />
          </Campo>

          <Campo id={id('prioridade')} label="Prioridade">
            <Seletor id={id('prioridade')} value={form.prioridade || 'normal'} onChange={set('prioridade')}>
              {prioridades.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Seletor>
          </Campo>

          <Campo id={id('naoAntesDe')} label="Não começar antes de">
            <input
              id={id('naoAntesDe')}
              type="date"
              min={hoje}
              value={form.naoAntesDe || ''}
              onChange={set('naoAntesDe')}
              className={`ln-input tabular ${FOCO}`}
            />
          </Campo>

          <Campo id={id('dataDesejada')} label="Prazo pedido pelo cliente" hint="opcional. Antes do que cabe, o sistema mostra a sobrecarga" className="col-span-2">
            <input
              id={id('dataDesejada')}
              type="date"
              min={hoje}
              value={form.dataDesejada || ''}
              onChange={set('dataDesejada')}
              className={`ln-input tabular ${FOCO}`}
            />
          </Campo>
        </div>
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 mt-auto border-t border-ln-ink/[0.08] bg-ln-panel/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between gap-3">
        {formOk ? (
          <p className="text-[11px] text-ln-t4 flex items-center gap-1">
            <kbd className="ln-kbd">⌘</kbd><span>/</span><kbd className="ln-kbd">Ctrl</kbd><span>+</span><kbd className="ln-kbd">Enter</kbd>
            <span className="ml-1">calcula</span>
          </p>
        ) : (
          <p className="text-[11px] text-ln-t4">Faltam cliente, título, responsável ou horas</p>
        )}
        <button
          type="button"
          onClick={calcular}
          disabled={!formOk || calculando}
          title="Calcular data de entrega"
          className={`ln-primary shrink-0 ${FOCO}`}
        >
          {calculando ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo a agenda no ClickUp…</>
          ) : 'Calcular data de entrega'}
        </button>
      </div>
    </div>
  )
}
