// Modal pra anotar uma otimização feita na conta (ou uma anotação livre do
// projeto). Grava em projeto_otimizacoes; em modo edição permite excluir.
import { useState } from 'react'
import { Wrench, StickyNote, Trash2, Loader2 } from 'lucide-react'
import Modal from '../UI/Modal'
import { hojeISO } from '../../lib/atividadesCarga'
import { useI18n } from '../../i18n'

const CANAIS = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'ambos', label: 'Meta + Google' },
  { value: 'outro', label: 'hub.canais.outro' },
]

const INPUT = 'w-full px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-sm text-rl-text placeholder:text-rl-muted focus:outline-none focus:border-rl-purple/50 transition-colors'
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wider text-rl-muted mb-1'

export default function RegistroModal({ registro = null, tipoInicial = 'otimizacao', preset = {}, onSalvar, onExcluir, onClose }) {
  const { t } = useI18n()
  const editando = !!registro
  const [tipo, setTipo] = useState(registro?.tipo || tipoInicial)
  const [form, setForm] = useState({
    data: registro?.data || hojeISO(),
    canal: registro?.canal || preset.canal || 'meta',
    campanha: registro?.campanha || preset.campanha || '',
    acao: registro?.acao || preset.acao || '',
    motivo: registro?.motivo || preset.motivo || '',
    resultado: registro?.resultado || '',
    cpl: registro?.metricas_antes?.cpl ?? '',
    ctr: registro?.metricas_antes?.ctr ?? '',
    gasto: registro?.metricas_antes?.gasto ?? '',
    conv: registro?.metricas_antes?.conv ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const ehOtimizacao = tipo === 'otimizacao'
  const ok = form.acao.trim().length >= 3 && !!form.data

  async function salvar() {
    if (!ok || salvando) return
    setSalvando(true)
    setErro(null)
    const metricas = ehOtimizacao ? Object.fromEntries(
      [['cpl', form.cpl], ['ctr', form.ctr], ['gasto', form.gasto], ['conv', form.conv]]
        .filter(([, v]) => v !== '' && v != null)
        .map(([k, v]) => [k, Number(String(v).replace(',', '.'))]),
    ) : null
    try {
      await onSalvar({
        tipo,
        data: form.data,
        canal: ehOtimizacao ? form.canal : null,
        campanha: ehOtimizacao ? form.campanha.trim() || null : null,
        acao: form.acao.trim(),
        motivo: form.motivo.trim() || null,
        resultado: form.resultado.trim() || null,
        metricas_antes: metricas && Object.keys(metricas).length ? metricas : null,
      })
      onClose()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="lg">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ehOtimizacao ? 'bg-rl-purple/10 text-rl-purple' : 'bg-rl-gold/10 text-rl-gold'}`}>
          {ehOtimizacao ? <Wrench className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-rl-text">{editando ? t('hub.registro.editar') : ehOtimizacao ? t('hub.registro.registrarOtimizacao') : t('hub.registro.novaAnotacao')}</h3>
          <p className="text-xs text-rl-muted">{ehOtimizacao ? t('hub.registro.subOtimizacao') : t('hub.registro.subAnotacao')}</p>
        </div>
        {!editando && (
          <div className="flex rounded-lg border border-rl-border overflow-hidden text-xs">
            <button onClick={() => setTipo('otimizacao')} className={`px-3 py-1.5 ${ehOtimizacao ? 'bg-rl-purple text-white' : 'text-rl-subtle hover:bg-rl-surface'}`}>{t('hub.tipos.otimizacao')}</button>
            <button onClick={() => setTipo('anotacao')} className={`px-3 py-1.5 ${!ehOtimizacao ? 'bg-rl-purple text-white' : 'text-rl-subtle hover:bg-rl-surface'}`}>{t('hub.tipos.anotacao')}</button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>{t('hub.registro.data')}</label>
            <input type="date" value={form.data} onChange={set('data')} max={hojeISO()} className={INPUT} />
          </div>
          {ehOtimizacao && (
            <div>
              <label className={LABEL}>{t('hub.registro.canal')}</label>
              <select value={form.canal} onChange={set('canal')} className={INPUT}>
                {CANAIS.map((c) => <option key={c.value} value={c.value}>{c.label.startsWith('hub.') ? t(c.label) : c.label}</option>)}
              </select>
            </div>
          )}
        </div>
        {ehOtimizacao && (
          <div>
            <label className={LABEL}>{t('hub.registro.campanha')}</label>
            <input value={form.campanha} onChange={set('campanha')} placeholder={t('hub.registro.campanhaPh')} className={INPUT} />
          </div>
        )}
        <div>
          <label className={LABEL}>{ehOtimizacao ? t('hub.registro.oQueFoiFeito') : t('hub.registro.titulo')}</label>
          <input value={form.acao} onChange={set('acao')} autoFocus placeholder={ehOtimizacao ? t('hub.registro.acaoPhOtimizacao') : t('hub.registro.acaoPhAnotacao')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>{ehOtimizacao ? t('hub.registro.porque') : t('hub.registro.detalhes')}</label>
          <textarea value={form.motivo} onChange={set('motivo')} rows={3} placeholder={ehOtimizacao ? t('hub.registro.motivoPh') : ''} className={INPUT + ' resize-y'} />
        </div>
        {ehOtimizacao && (
          <div>
            <label className={LABEL}>{t('hub.registro.antes')}</label>
            <div className="grid grid-cols-4 gap-2">
              {[['gasto', t('hub.registro.phGasto')], ['conv', t('hub.registro.phConv')], ['cpl', t('hub.registro.phCpl')], ['ctr', t('hub.registro.phCtr')]].map(([k, ph]) => (
                <input key={k} value={form[k]} onChange={set(k)} placeholder={ph} inputMode="decimal" className={INPUT} />
              ))}
            </div>
          </div>
        )}
        {(editando || ehOtimizacao) && (
          <div>
            <label className={LABEL}>{t('hub.registro.resultado')}</label>
            <input value={form.resultado} onChange={set('resultado')} placeholder={t('hub.registro.resultadoPh')} className={INPUT} />
          </div>
        )}
        {erro && <p className="text-xs text-rl-red">{erro}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 mt-5">
        <div>
          {editando && onExcluir && (
            <button onClick={() => { if (window.confirm(t('hub.registro.confirmarExcluir'))) onExcluir(registro.id).then(onClose) }} className="flex items-center gap-1.5 text-xs text-rl-red hover:bg-rl-red/10 px-2 py-1.5 rounded-lg">
              <Trash2 className="w-3.5 h-3.5" /> {t('comum.excluir')}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-rl-muted hover:bg-rl-surface">{t('comum.cancelar')}</button>
          <button onClick={salvar} disabled={!ok || salvando} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {editando ? t('comum.salvar') : t('hub.registro.registrar')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
