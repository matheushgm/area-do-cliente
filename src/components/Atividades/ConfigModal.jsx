// Configuração do cálculo (admin): capacidade por pessoa, horas por tipo,
// regras de atrasadas/backlog/sem data. Salva em atividades_config (linha global).
import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import Modal from '../UI/Modal'
import { supabase } from '../../lib/supabase'
import { TIPOS_TAREFA } from '../../hooks/usePlanejador'

export default function ConfigModal({ config, responsaveis, userId, onClose, onSaved, onError }) {
  const [capPadrao, setCapPadrao] = useState(String(config.capacidade_padrao_horas_dia))
  const [capPessoa, setCapPessoa] = useState(() => ({ ...(config.capacidade_por_pessoa || {}) }))
  const [diasAtraso, setDiasAtraso] = useState(String(config.dias_atraso_maximo))
  const [padraoSem, setPadraoSem] = useState(String(config.horas_padrao_sem_estimativa))
  const [backlog, setBacklog] = useState(!!config.considerar_backlog)
  const [semData, setSemData] = useState(!!config.considerar_sem_data)
  const [horasTipo, setHorasTipo] = useState(() => ({ ...(config.horas_por_tipo || {}) }))
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    const cfg = {
      ...config,
      capacidade_padrao_horas_dia: Number(capPadrao) || config.capacidade_padrao_horas_dia,
      capacidade_por_pessoa: Object.fromEntries(Object.entries(capPessoa).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])),
      dias_atraso_maximo: Number(diasAtraso) >= 0 ? Number(diasAtraso) : config.dias_atraso_maximo,
      horas_padrao_sem_estimativa: Number(padraoSem) > 0 ? Number(padraoSem) : config.horas_padrao_sem_estimativa,
      considerar_backlog: backlog,
      considerar_sem_data: semData,
      horas_por_tipo: Object.fromEntries(Object.entries(horasTipo).map(([k, v]) => [k, Number(v) > 0 ? Number(v) : config.horas_por_tipo?.[k] || 1])),
    }
    const { error } = await supabase
      .from('atividades_config')
      .upsert({ id: 'global', config: cfg, updated_at: new Date().toISOString(), updated_by: userId || null })
    setSaving(false)
    if (error) return onError(error.message)
    onSaved(cfg)
  }

  const num = 'ln-input w-20 h-7 px-2 tabular'

  return (
    <Modal onClose={onClose} maxWidth="2xl" className="ln max-h-[90vh] overflow-y-auto !bg-ln-panel !border-ln-ink/[0.12] !rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ln-t1">Capacidade e horas padrão</h2>
          <p className="text-xs text-ln-t3 mt-0.5">Regras do cálculo de data. Valem para o time inteiro.</p>
        </div>
        <button onClick={onClose} className="ln-iconbtn" aria-label="Fechar"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="ln-label">Horas produtivas por dia</label>
            <input type="number" min="1" max="12" step="0.5" value={capPadrao} onChange={(e) => setCapPadrao(e.target.value)} className="ln-input tabular" />
            <p className="text-[11px] text-ln-t4 mt-1">padrão para quem não tem valor próprio</p>
          </div>
          <div>
            <label className="ln-label">Ignorar atrasadas há mais de (dias)</label>
            <input type="number" min="0" step="1" value={diasAtraso} onChange={(e) => setDiasAtraso(e.target.value)} className="ln-input tabular" />
            <p className="text-[11px] text-ln-t4 mt-1">viram alerta, não bloqueiam a agenda</p>
          </div>
          <div>
            <label className="ln-label">Horas de tarefa sem estimativa</label>
            <input type="number" min="0.25" step="0.25" value={padraoSem} onChange={(e) => setPadraoSem(e.target.value)} className="ln-input tabular" />
            <p className="text-[11px] text-ln-t4 mt-1">sem tipo nem dificuldade no ClickUp</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-[13px] text-ln-t2">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={backlog} onChange={(e) => setBacklog(e.target.checked)} className="w-3.5 h-3.5 accent-[#5e6ad2]" /> Tarefas em backlog (com data) contam na agenda</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={semData} onChange={(e) => setSemData(e.target.checked)} className="w-3.5 h-3.5 accent-[#5e6ad2]" /> Tarefas sem data contam em hoje</label>
        </div>

        <div>
          <p className="text-[11px] font-medium text-ln-t4 uppercase tracking-wider mb-2">Capacidade por pessoa (h/dia)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {responsaveis.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-xs text-ln-t2">
                <span className="flex-1 truncate">{r.nome}</span>
                <input type="number" min="0" max="12" step="0.5" placeholder={capPadrao} value={capPessoa[r.clickupId] ?? ''} onChange={(e) => setCapPessoa((p) => ({ ...p, [r.clickupId]: e.target.value }))} className={num} />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium text-ln-t4 uppercase tracking-wider mb-2">Horas por tipo de tarefa (quando a task do ClickUp não tem estimativa)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TIPOS_TAREFA.map((t) => (
              <label key={t} className="flex items-center gap-2 text-xs text-ln-t2">
                <span className="flex-1 truncate">{t}</span>
                <input type="number" min="0.25" step="0.25" value={horasTipo[t] ?? ''} onChange={(e) => setHorasTipo((p) => ({ ...p, [t]: e.target.value }))} className={num} />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-ln-ink/5">
          <button onClick={onClose} className="ln-pill">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="ln-primary">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando…</> : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
