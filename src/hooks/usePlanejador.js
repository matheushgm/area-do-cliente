// Fluxo do planejador de atividades (formulário → cálculo da data → comparação
// com o time → aprovação → criação no ClickUp). Extraído da página para o
// layout poder mudar sem mexer em regra nenhuma.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { sugerirAtividade, listarListasClickUp, criarAtividade } from '../lib/atividades'
import { hojeISO } from '../lib/atividadesCarga'

// Tipo de tarefa (campo do ClickUp) → departamento que normalmente executa
export const TIPO_PARA_DEPARTAMENTO = {
  'Criação de Arte Estática':     'Designer',
  'Criação de Landing Page':      'Web Designer',
  'Relatório':                    'Gestor de tráfego',
  'Edição de vídeo':              'Designer',
  'Integração':                   'Tecnologia',
  'Copy de anúncio':              'Copywriter',
  'Copy de Landing Page':         'Copywriter',
  'Estratégia':                   'Estrategista',
  'Traqueamento':                 'Tecnologia',
  'Reunião':                      'Account Manager',
  'Preenchimento de resultado':   'Gestor de tráfego',
  'Otimização':                   'Gestor de tráfego',
  'Subir Criativo':               'Gestor de tráfego',
  'Criar Campanha':               'Gestor de tráfego',
  'Gravação de vídeo':            'Designer',
  'Fotografia':                   'Designer',
  'Edição de fotografia':         'Designer',
  'Mídia Offline':                'Designer',
  'Motion design':                'Designer',
  'Projeto de identidade visual': 'Designer',
  'Branding (estratégia)':        'Estrategista',
}
export const TIPOS_TAREFA = Object.keys(TIPO_PARA_DEPARTAMENTO)
export const DEPARTAMENTOS = [
  'Gestor de tráfego', 'Estrategista', 'Comercial', 'Copywriter',
  'Web Designer', 'Designer', 'Account Manager', 'Tecnologia',
]
// No squad da Área do Cliente o departamento de tecnologia ainda se chama assim
const DEPARTAMENTO_ALIAS_SQUAD = { 'Tecnologia': 'Automação / Integração' }
export const PRIORIDADES = [
  { value: 'urgent', label: 'Urgente' },
  { value: 'high',   label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low',    label: 'Baixa' },
]

const FORM_VAZIO = () => ({
  projectId: '', listId: '', titulo: '', descricao: '', tipo: '', departamento: '',
  responsavelId: '', horas: '', prioridade: 'normal', naoAntesDe: hojeISO(), dataDesejada: '',
})

/**
 * @param {object} p
 * @param {Array} p.projects      projetos do AppContext
 * @param {Array} p.teamMembers   perfis do AppContext
 * @param {Array} p.squads        squads do AppContext
 * @param {object} p.config       configuração do cálculo (horas_por_tipo etc.)
 * @param {Function} p.showToast
 * @param {Function} [p.onCriada] callback após criar no ClickUp (recarregar histórico)
 */
export function usePlanejador({ projects, teamMembers, squads, config, showToast, onCriada }) {
  const clientes = useMemo(() => (projects || [])
    .filter((p) => p.clickupFolderId || p.clickup_folder_id)
    .map((p) => ({
      id: p.id,
      nome: (p.companyName || p.company_name || '').trim(),
      folderId: p.clickupFolderId || p.clickup_folder_id,
      listId: p.clickupListId || p.clickup_list_id || null,
      squad: p.squad || null,
      status: p.status,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [projects])

  const responsaveis = useMemo(() => (teamMembers || [])
    .filter((m) => Number(m.clickupUserId ?? m.clickup_user_id) > 0)
    .map((m) => ({ id: m.id, nome: m.name, clickupId: Number(m.clickupUserId ?? m.clickup_user_id), avatar: m.avatar }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [teamMembers])
  const responsavelPorClickup = useMemo(() => new Map(responsaveis.map((r) => [r.clickupId, r])), [responsaveis])

  // ── Formulário ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState(FORM_VAZIO)
  const [horasTouched, setHorasTouched] = useState(false)
  const [listas, setListas] = useState([])
  const [listasErro, setListasErro] = useState(null)
  const [loadingListas, setLoadingListas] = useState(false)

  const set = useCallback((campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (campo === 'horas') setHorasTouched(true)
  }, [])

  const cliente = clientes.find((c) => c.id === form.projectId) || null
  const responsavel = responsaveis.find((r) => r.id === form.responsavelId) || null

  // Resultado do cálculo
  const [calculando, setCalculando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erroCalculo, setErroCalculo] = useState(null)
  const [dataEscolhida, setDataEscolhida] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [comparacao, setComparacao] = useState(null)
  const [comparando, setComparando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [criada, setCriada] = useState(null)
  const calcSeq = useRef(0)
  const ultimoVisivel = useRef(0) // seq do último cálculo NÃO silencioso (controla o "calculando")

  const limparResultado = useCallback(() => {
    setResultado(null); setComparacao(null); setErroCalculo(null); setDataEscolhida(''); setJustificativa('')
  }, [])

  const setProjectId = useCallback((id) => {
    setForm((f) => ({ ...f, projectId: id, listId: '' }))
    limparResultado()
    setCriada(null)
  }, [limparResultado])

  const setTipo = useCallback((novo) => {
    setForm((f) => {
      const dep = TIPO_PARA_DEPARTAMENTO[novo] || f.departamento
      const h = config?.horas_por_tipo?.[novo]
      return { ...f, tipo: novo, departamento: dep, horas: horasTouched || h == null ? f.horas : String(h) }
    })
  }, [config, horasTouched])

  const setResponsavelId = useCallback((id) => {
    setForm((f) => ({ ...f, responsavelId: id }))
    limparResultado()
  }, [limparResultado])

  // Listas da pasta do cliente (a tarefa vai para "Geral" por padrão)
  useEffect(() => {
    if (!cliente?.folderId) { setListas([]); return }
    let cancelled = false
    setLoadingListas(true)
    setListasErro(null)
    listarListasClickUp(cliente.folderId)
      .then((r) => {
        if (cancelled) return
        const ls = r?.listas || []
        setListas(ls)
        const geral = ls.find((l) => l.name.trim().toLowerCase() === 'geral') || ls[0]
        setForm((f) => ({ ...f, listId: geral?.id || cliente.listId || '' }))
      })
      .catch((e) => {
        if (cancelled) return
        setListas([])
        setListasErro(e.message)
        setForm((f) => ({ ...f, listId: cliente.listId || '' }))
      })
      .finally(() => { if (!cancelled) setLoadingListas(false) })
    return () => { cancelled = true }
  }, [cliente?.folderId, cliente?.listId])

  // Departamento + squad do cliente → responsável sugerido
  useEffect(() => {
    if (!form.departamento || !cliente) return
    const squad = (squads || []).find((s) => s.id === cliente.squad)
    const assignments = squad?.department_assignments || squad?.departmentAssignments || {}
    const profileId = assignments[form.departamento] || assignments[DEPARTAMENTO_ALIAS_SQUAD[form.departamento]] || null
    if (profileId && responsaveis.some((r) => r.id === profileId)) {
      setForm((f) => (f.responsavelId === profileId ? f : { ...f, responsavelId: profileId }))
    }
  }, [form.departamento, cliente, squads, responsaveis])

  const horasNum = Number(String(form.horas).replace(',', '.'))
  const formOk = !!cliente && !!form.listId && form.titulo.trim().length > 2 && !!responsavel && horasNum > 0

  // ── Cálculo ────────────────────────────────────────────────────────────────
  const calcular = useCallback(async ({ dataForcada = null, silencioso = false } = {}) => {
    if (!responsavel || !(horasNum > 0)) return
    const seq = ++calcSeq.current
    if (!silencioso) { ultimoVisivel.current = seq; setCalculando(true); setErroCalculo(null); setComparacao(null) }
    try {
      const r = await sugerirAtividade({
        assignees: [responsavel.clickupId],
        horas: horasNum,
        naoAntesDe: form.naoAntesDe || null,
        dataDesejada: dataForcada || null,
      })
      if (seq !== calcSeq.current) return
      const res = r?.resultados?.[0]
      if (!res) throw new Error(r?.erros?.[0]?.error || 'Sem resultado para o responsável.')
      setResultado(res)
      if (!silencioso) {
        const entrega = res.sugestao?.entrega || ''
        const desejada = form.dataDesejada
        if (desejada && entrega && desejada < entrega) {
          setDataEscolhida(desejada)
          calcular({ dataForcada: desejada, silencioso: true })
        } else {
          setDataEscolhida(desejada && desejada > entrega ? desejada : entrega)
        }
        setJustificativa('')
      }
    } catch (e) {
      if (seq !== calcSeq.current) return
      setErroCalculo(e.message)
      if (!silencioso) setResultado(null)
    } finally {
      // O cálculo visível pode disparar um recálculo silencioso (data forçada)
      // que avança calcSeq; por isso o "calculando" é desligado pelo último
      // cálculo visível, e não pelo último cálculo de qualquer tipo.
      if (!silencioso && seq === ultimoVisivel.current) setCalculando(false)
    }
  }, [responsavel, horasNum, form.naoAntesDe, form.dataDesejada])

  const sugerida = resultado?.sugestao?.entrega || null
  const forcandoData = !!(resultado && dataEscolhida && sugerida && dataEscolhida < sugerida)
  // Data escolhida antes da sugerida: reavalia a sobrecarga (debounce)
  useEffect(() => {
    if (!forcandoData) return
    const t = setTimeout(() => calcular({ dataForcada: dataEscolhida, silencioso: true }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataEscolhida, forcandoData])

  const comparar = useCallback(async () => {
    if (!(horasNum > 0) || responsaveis.length === 0) return
    setComparando(true)
    try {
      const r = await sugerirAtividade({
        assignees: responsaveis.map((p) => p.clickupId),
        horas: horasNum,
        naoAntesDe: form.naoAntesDe || null,
      })
      const rows = (r?.resultados || [])
        .map((res) => ({ pessoa: responsavelPorClickup.get(res.clickupUserId), resultado: res }))
        .filter((x) => x.pessoa)
        .sort((a, b) => {
          const ea = a.resultado.sugestao?.entrega || '9999', eb = b.resultado.sugestao?.entrega || '9999'
          return ea < eb ? -1 : ea > eb ? 1 : (a.resultado.totais.ocupacaoProximosDias - b.resultado.totais.ocupacaoProximosDias)
        })
      setComparacao({ rows, erros: r?.erros || [] })
    } catch (e) {
      showToast?.(e.message, 'error')
    } finally {
      setComparando(false)
    }
  }, [horasNum, responsaveis, form.naoAntesDe, responsavelPorClickup, showToast])

  const escolherAlternativa = useCallback((row) => {
    setForm((f) => ({ ...f, responsavelId: row.pessoa.id }))
    setResultado(row.resultado)
    setDataEscolhida(row.resultado.sugestao?.entrega || '')
    setJustificativa('')
  }, [])

  // ── Aprovação ──────────────────────────────────────────────────────────────
  const forcada = forcandoData ? resultado?.forcada : null
  const sobrecarga = !!(forcada && !forcada.cabe)
  const podeCriar = formOk && !!resultado && !!dataEscolhida && !criando && (!sobrecarga || justificativa.trim().length >= 5)

  const aprovar = useCallback(async () => {
    if (!podeCriar) return
    setCriando(true)
    try {
      const r = await criarAtividade({
        projectId: cliente.id,
        clienteNome: cliente.nome,
        listId: form.listId,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipoTarefa: form.tipo || null,
        departamento: form.departamento || null,
        responsavelProfileId: responsavel.id,
        assigneeClickupId: responsavel.clickupId,
        horas: horasNum,
        prioridade: form.prioridade,
        dataInicio: resultado.sugestao?.inicio || null,
        dataSugerida: sugerida,
        dataEscolhida,
        sobrecarga,
        horasExcedentes: sobrecarga ? forcada.horasExcedentes : null,
        justificativa: sobrecarga ? justificativa.trim() : null,
        snapshot: { hoje: resultado.hoje, capacidadeDia: resultado.capacidadeDia, totais: resultado.totais, resumo: resultado.resumo, sugestao: resultado.sugestao },
      })
      setCriada({ ...r, titulo: form.titulo.trim(), responsavel: responsavel.nome, data: dataEscolhida })
      showToast?.('Tarefa criada no ClickUp')
      onCriada?.(r)
    } catch (e) {
      showToast?.(e.message, 'error')
    } finally {
      setCriando(false)
    }
  }, [podeCriar, cliente, form, responsavel, horasNum, resultado, sugerida, dataEscolhida, sobrecarga, forcada, justificativa, showToast, onCriada])

  const novaAtividade = useCallback((preset = {}) => {
    setCriada(null)
    limparResultado()
    setHorasTouched(false)
    setForm((f) => ({ ...FORM_VAZIO(), projectId: f.projectId, listId: f.listId, ...preset }))
  }, [limparResultado])

  return {
    form, set, setProjectId, setTipo, setResponsavelId,
    clientes, responsaveis, responsavelPorClickup, listas, loadingListas, listasErro,
    cliente, responsavel, horasNum, formOk,
    TIPOS_TAREFA, DEPARTAMENTOS, PRIORIDADES, config,
    calculando, resultado, erroCalculo, sugerida, dataEscolhida, setDataEscolhida,
    forcandoData, forcada, sobrecarga, justificativa, setJustificativa,
    calcular: () => calcular(), comparacao, comparando, comparar, escolherAlternativa,
    criando, criada, podeCriar, aprovar, novaAtividade,
  }
}
