// Preview sem login do módulo Resultados (só em DEV): /dev/resultados
// Os módulos Resultados de Tráfego e Resultados de Funil com dados fictícios
// (src/dev/mockResultados.js). Alterna B2B / B2C e claro / escuro na barra do topo.
import { useEffect, useMemo, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { ResultadosConteudo, TrafegoConteudo } from '../components/ResultadosModule'
import { useDashMock, resultadosB2B, resultadosB2C, ROI_MOCK, ID_B2B, ID_B2C } from '../dev/mockResultados'

function Pilulas({ valor, opcoes, onChange }) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-rl-surface border border-rl-border">
      {opcoes.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`px-3 py-1 rounded-md text-xs transition-colors ${valor === id ? 'bg-rl-card text-rl-text font-semibold shadow-sm' : 'text-rl-subtle hover:text-rl-text'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function DevResultados() {
  const [modelo, setModelo] = useState('b2b')
  const [modulo, setModulo] = useState('funil')
  const [tema, setTema] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark')
    // o viewer do dashboard (iframe) acompanha pela mesma chave
    try { localStorage.setItem('rl_theme', tema) } catch { /* ignore */ }
  }, [tema])

  const id = modelo === 'b2b' ? ID_B2B : ID_B2C
  const dash = useDashMock(id)
  // o funil nasce do tráfego fictício; edições do preview ficam em memória
  const [edicoes, setEdicoes] = useState({})
  const resultadosBase = useMemo(() => (dash.loading ? {} : modelo === 'b2b' ? resultadosB2B(dash.raw) : resultadosB2C(dash.raw)), [dash.loading, dash.raw, modelo])
  const project = useMemo(() => ({
    id,
    companyName: modelo === 'b2b' ? 'Aurora Odontologia' : 'Boa Noite Colchões (fictício)',
    roiCalc: ROI_MOCK,
    clientShareToken: 'token-de-teste',
    resultados: edicoes[modelo] || resultadosBase,
  }), [id, modelo, edicoes, resultadosBase])

  const contexto = useMemo(() => ({
    user: { id: 'dev', name: 'Preview', role: 'admin' }, projects: [project], squads: [], teamMembers: [],
    loadingProjects: false, loadingAuth: false, isSupabaseReady: true,
    updateProject: (pid, patch) => {
      console.log('[dev] updateProject', pid, patch)
      if (patch.resultados) setEdicoes((e) => ({ ...e, [modelo]: patch.resultados }))
    },
  }), [project, modelo])

  return (
    <AppContext.Provider value={contexto}>
      <div className="fx min-h-screen bg-rl-bg">
        <div className="sticky top-0 z-40 flex items-center gap-3 px-6 py-2.5 border-b border-rl-border bg-rl-card/90 backdrop-blur">
          <span className="text-xs font-semibold text-rl-gold">preview local · dados fictícios</span>
          <Pilulas valor={modulo} onChange={setModulo} opcoes={[['trafego', 'Resultados de Tráfego'], ['funil', 'Resultados de Funil']]} />
          <Pilulas valor={modelo} onChange={setModelo} opcoes={[['b2b', 'B2B (semanal)'], ['b2c', 'B2C (diário, lojas)']]} />
          <Pilulas valor={tema} onChange={setTema} opcoes={[['light', 'Claro'], ['dark', 'Escuro']]} />
          {edicoes[modelo] && <button onClick={() => setEdicoes((e) => ({ ...e, [modelo]: null }))} className="text-xs text-rl-purple hover:underline">desfazer edições</button>}
        </div>
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="glass-card p-4 sm:p-6">
            {modulo === 'trafego'
              ? <TrafegoConteudo key={modelo} project={project} dash={dash} mock />
              : <ResultadosConteudo key={modelo} project={project} dash={dash} mock onIrParaTrafego={() => setModulo('trafego')} />}
          </div>
        </div>
      </div>
    </AppContext.Provider>
  )
}
