// Página pública (sem login) onde o cliente manda um pedido para o time: /pedido/:token.
// Três etapas: tipo do pedido → detalhes (campos do tipo + prazo e contato) → revisão.
// Tipos e campos em src/lib/pedidoTipos.js (os mesmos que o servidor valida). Link do Drive
// é conferido na hora pelo servidor (aberto para "qualquer pessoa com o link"?).
// Cai na fila de Intake do VertaTask. Usa o client_share_token do projeto.
// O formulário (`PedidoFormulario`) também roda dentro do portal do cliente, no módulo
// Solicitações: lá a sessão do portal autentica e o cliente pode subir arquivos.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2, CheckCircle2, AlertCircle, AlertTriangle, Send, ArrowLeft, ArrowRight, Check, Info, Lock, RefreshCw, Pencil, Clock,
  Image, Clapperboard, LayoutTemplate, Megaphone, Wallet, MessageCircle, PenLine, UploadCloud,
} from 'lucide-react'
import CampoArquivos from '../components/Pedido/CampoArquivos'
import {
  TIPOS_PEDIDO, TIPOS_PEDIDO_MAP, GRUPOS_PEDIDO, CAMPOS_FINAIS, camposVisiveis, validarPedido, montarPedido, lerLinkDrive, valorDe, telefoneTexto,
  valorTexto, numeroBR, resumir,
} from '../lib/pedidoTipos'
import { useI18n, idiomaAtual } from '../i18n'

const ICONES = { subir_criativos: UploadCloud, criativo_estatico: Image, criativo_video: Clapperboard, landing_page: LayoutTemplate, nova_campanha: Megaphone, orcamento: Wallet, whatsapp: MessageCircle, outras: PenLine }
const ETAPAS = ['tipo', 'detalhes', 'revisao']

// ── Textos traduzidos ────────────────────────────────────────────────────────
// pedidoTipos.js é lido também pelo servidor, que monta a tarefa do Intake em português: ele não
// importa o i18n e nada nele muda. A página mostra cada tipo, campo, opção e erro pela chave do
// namespace `pedidoTipos` (id do tipo, do campo e o valor da opção) e cai no texto do arquivo
// quando falta a chave. Em português usa direto o arquivo. O que vai ao servidor segue em pt.

// Texto que muda com as respostas (label/ajuda/prazoMsg em função): qual variante do dicionário usar.
const VARIANTES = {
  'criativo_estatico.drive.label': (r) => (r.situacao === 'pronto' ? 'pronto' : 'outro'),
  'criativo_estatico.drive.ajuda': (r) => (r.situacao === 'pronto' ? 'pronto' : 'outro'),
  'criativo_video.drive.label': (r) => (r.situacao === 'pronto' || r.situacao === 'editar' ? r.situacao : 'outro'),
  'criativo_video.prazoMsg': (r) => (r.situacao === 'roteiro' ? 'roteiro' : 'editar'),
}

// Mensagens de validarPedido (página e servidor) → chave em pedido.erros.
const ERROS = [
  [/^Escolha uma opção\.$/, 'escolha'],
  [/^Preencha este campo\.$/, 'preencha'],
  [/^Use até (\d+) caracteres\.$/, 'max', (m) => ({ max: m[1] })],
  [/^Opção inválida\.$/, 'opcaoInvalida'],
  [/^Use um número de (\d+) a (\d+)\.$/, 'numero', (m) => ({ min: m[1], max: m[2] })],
  [/^Coloque um valor em reais\.$/, 'dinheiro'],
  [/^Data inválida\.$/, 'data'],
  [/^Coloque o número com DDD\.$/, 'telefone'],
  [/^Cole o link completo/, 'linkCompleto'],
  [/^Esse não é um link do Google Drive\.$/, 'naoEDrive'],
  [/^Cole o link do Google Drive\.$/, 'coleDrive'],
  [/^Esse link está fechado/, 'driveFechado'],
  [/^Não achei nada nesse link/, 'driveInexistente'],
  [/^Tem que ser depois do início\.$/, 'depoisInicio'],
  [/^Coloque o WhatsApp com DDD ou um e-mail\.$/, 'contato'],
]

function useTextos() {
  const { t, lang, locale } = useI18n()
  return useMemo(() => {
    const pt = lang === 'pt'
    // chave de pedidoTipos ou o texto do arquivo
    const tr = (caminho, padrao, vars) => {
      if (pt) return padrao
      const chave = `pedidoTipos.${caminho}`
      const v = t(chave, vars)
      return v === chave ? padrao : v
    }
    const baseCampo = (tipo, campo) => (CAMPOS_FINAIS.includes(campo) ? `finais.${campo.k}` : `tipos.${tipo?.id}.campos.${campo.k}`)
    // label, curto, ajuda ou placeholder do campo, já resolvido para as respostas `r`
    const campoTxt = (tipo, campo, prop, r) => {
      const padrao = valorDe(campo[prop], r)
      if (!padrao || pt) return padrao
      const variante = typeof campo[prop] === 'function' && VARIANTES[`${tipo?.id}.${campo.k}.${prop}`]
      return tr(`${baseCampo(tipo, campo)}.${prop}${variante ? `.${variante(r)}` : ''}`, padrao)
    }
    const opcaoTxt = (tipo, campo, o, prop = 'label') => (o[prop] ? tr(`${baseCampo(tipo, campo)}.opcoes.${o.v}.${prop}`, o[prop]) : o[prop])
    const erroTxt = (msg) => {
      if (!msg || pt) return msg
      for (const [re, k, vars] of ERROS) { const m = re.exec(msg); if (m) return t(`pedido.erros.${k}`, vars?.(m)) }
      return msg
    }
    const dinheiro = (v, periodo) => {
      const n = numeroBR(v)
      if (!Number.isFinite(n)) return ''
      const fmt = n.toLocaleString(locale, { style: 'currency', currency: 'BRL', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
      return `${fmt} ${t(periodo === 'dia' ? 'pedido.porDia' : 'pedido.porMes')}`
    }
    // valor legível de uma resposta (revisão), igual a valorTexto mas no idioma da página
    const valorTxt = (tipo, campo, v, r) => {
      if (pt) return valorTexto(campo, v, r)
      if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) return ''
      const rot = (x) => { const o = campo.opcoes?.find((op) => op.v === x); return o ? opcaoTxt(tipo, campo, o) : x }
      switch (campo.tipo) {
        case 'escolha': return rot(v)
        case 'multi': return (Array.isArray(v) ? v : [v]).map(rot).join(', ')
        case 'dinheiro': return dinheiro(v, r[`${campo.k}_periodo`])
        case 'data': {
          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v))
          return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(locale) : ''
        }
        case 'check': return t('pedido.sim')
        default: return valorTexto(campo, v, r)
      }
    }
    // título do pedido como o cliente lê (o que vai para o time é o de montarPedido, em pt)
    const tituloTxt = (tipo, r, tituloPt) => {
      if (pt) return tituloPt
      const base = `tipos.${tipo.id}`
      const campo = (k) => tipo.campos.find((c) => c.k === k)
      let v = null
      switch (tipo.id) {
        case 'criativo_estatico':
        case 'criativo_video':
          v = tr(`${base}.titulo`, null, { assunto: r.assunto }); break
        case 'landing_page':
          v = r.situacao === 'ajuste'
            ? tr(`${base}.tituloAjuste`, null, { texto: resumir(r.ajuste, 70) })
            : tr(`${base}.tituloNova`, null, { texto: resumir(r.oferta, 70) })
          break
        case 'nova_campanha':
          v = tr(`${base}.titulo`, null, { oferta: resumir(r.oferta, 70) }); break
        case 'orcamento': {
          const acao = tr(`${base}.tituloAcao.${r.acao === 'diminuir' ? 'diminuir' : 'aumentar'}`, null)
          const plataformas = (r.plataformas || []).map((x) => valorTxt(tipo, campo('plataformas'), [x], r)).join(tr('e', ' e '))
          if (acao) v = tr(`${base}.titulo`, null, { acao, plataformas, valor: dinheiro(r.valor, r.valor_periodo) })
          break
        }
        case 'whatsapp': {
          const tem = (x) => Array.isArray(r.mudanca) && r.mudanca.includes(x)
          const partes = []
          if (tem('trocar')) partes.push(tr(`${base}.tituloTrocar`, null, { numero: telefoneTexto(r.numero_novo) }))
          else if (tem('adicionar')) partes.push(tr(`${base}.tituloAdicionar`, null, { numero: telefoneTexto(r.numero_novo) }))
          if (tem('mensagem')) partes.push(tr(`${base}.tituloMensagem`, null))
          if (tem('outra') && !partes.length) partes.push(resumir(r.outra_desc, 60))
          if (!partes.includes(null)) v = tr(`${base}.titulo`, null, { partes: partes.join(tr('e', ' e ')) || tr(`${base}.tituloAlteracao`, '') })
          break
        }
        default: v = null
      }
      return v ? resumir(v, 200) : tituloPt
    }
    return { t, pt, tr, campoTxt, opcaoTxt, erroTxt, valorTxt, tituloTxt }
  }, [t, lang, locale])
}

const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const gravarLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* modo privado */ } }
const hoje = () => new Date().toLocaleDateString('sv-SE')

// máscara do telefone enquanto digita: (62) 99999-8888
function mascaraTelefone(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const inputCls = (erro) => `w-full rounded-lg border bg-white px-3 text-base sm:text-sm text-[#0B0B14] placeholder:text-[#9AA0B2] outline-none transition focus:border-[#2A25F0] focus:ring-2 focus:ring-[#2A25F0]/20 ${erro ? 'border-[#E2564B]' : 'border-[#E4E7F0]'}`

// ── Campos ───────────────────────────────────────────────────────────────────

function Opcoes({ tipo, campo, valor, multi, onChange, erro, tx }) {
  const marcado = (v) => (multi ? (valor || []).includes(v) : valor === v)
  const alternar = (v) => {
    if (multi) {
      const atual = valor || []
      // "Vocês decidem" não convive com as outras escolhas
      if (v === 'decidam') return onChange(atual.includes(v) ? [] : [v])
      return onChange(atual.includes(v) ? atual.filter((x) => x !== v) : [...atual.filter((x) => x !== 'decidam'), v])
    }
    onChange(valor === v && !valorDe(campo.obrigatorio) ? '' : v)
  }
  const comDesc = campo.opcoes.some((o) => o.desc)
  return (
    <div role={multi ? 'group' : 'radiogroup'} className={comDesc ? 'grid gap-2 sm:grid-cols-2' : 'flex flex-wrap gap-2'}>
      {campo.opcoes.map((o) => {
        const on = marcado(o.v)
        return (
          <button
            key={o.v} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => alternar(o.v)}
            className={`text-left rounded-lg border transition flex items-start gap-2.5 ${comDesc ? 'px-3.5 py-3' : 'px-3.5 h-10 items-center'} ${on ? 'border-[#2A25F0] bg-[#2A25F0]/[0.06] ring-1 ring-[#2A25F0]' : `${erro ? 'border-[#E2564B]/60' : 'border-[#E4E7F0]'} bg-white hover:border-[#B9BCF7]`}`}
          >
            <span className={`mt-px shrink-0 w-4 h-4 inline-flex items-center justify-center border ${multi ? 'rounded' : 'rounded-full'} ${on ? 'bg-[#2A25F0] border-[#2A25F0] text-white' : 'border-[#C9CDDA] bg-white'}`}>
              {on && (multi ? <Check className="w-3 h-3" strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-white" />)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#0B0B14] leading-tight">{tx.opcaoTxt(tipo, campo, o)}</span>
              {o.desc && <span className="block text-xs text-[#767C8E] mt-0.5">{tx.opcaoTxt(tipo, campo, o, 'desc')}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function StatusDrive({ st, onConferir }) {
  const { t } = useI18n()
  if (!st) return null
  if (st.estado === 'conferindo') return <p className="text-xs text-[#5A6072] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('pedido.drive.conferindo')}</p>
  if (st.estado === 'ok') return <p className="text-xs font-semibold text-[#1F8A5B] inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {st.nome ? t('pedido.drive.abertoNome', { nome: st.nome }) : t('pedido.drive.aberto')}</p>
  if (st.estado === 'incerto') return <p className="text-xs text-[#8a6a14] inline-flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {t('pedido.drive.incerto')}</p>
  const fechado = st.estado === 'fechado'
  return (
    <div className="rounded-lg border border-[#E2564B]/30 bg-[#E2564B]/[0.05] px-3 py-2.5 text-xs text-[#3D4254]">
      <p className="font-semibold text-[#C2392F] inline-flex items-center gap-1.5">{fechado ? <Lock className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}{fechado ? t('pedido.drive.fechado') : t('pedido.drive.inexistente')}</p>
      {fechado && <p className="mt-1">{t('pedido.drive.comoLiberar1')}<b>{t('pedido.drive.compartilhar')}</b>{t('pedido.drive.comoLiberar2')}<b>{t('pedido.drive.acessoGeral')}</b>{t('pedido.drive.comoLiberar3')}<b>{t('pedido.drive.qualquerPessoa')}</b>.</p>}
      <button type="button" onClick={onConferir} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#2A25F0]"><RefreshCw className="w-3.5 h-3.5" /> {t('pedido.drive.conferirDeNovo')}</button>
    </div>
  )
}

function Campo({ tipo, campo, r, set, erro: erroPt, driveSt, conferirDrive, enviarArquivo, tx }) {
  const labelPt = valorDe(campo.label, r)
  const label = tx.campoTxt(tipo, campo, 'label', r)
  const ajuda = tx.campoTxt(tipo, campo, 'ajuda', r)
  const placeholder = tx.campoTxt(tipo, campo, 'placeholder', r)
  const erro = tx.erroTxt(erroPt)
  const obrig = valorDe(campo.obrigatorio, r)
  const v = r[campo.k]
  const id = `f-${campo.k}`

  // Upload só existe no portal; no link aberto o campo some (o Drive segue obrigatório).
  if (campo.tipo === 'arquivos') {
    if (!enviarArquivo) return null
    return (
      <div className="flex flex-col gap-1.5" data-campo={campo.k}>
        <p className="text-[13px] font-semibold text-[#3D4254]">{label}</p>
        <CampoArquivos valor={v || []} onChange={(lista) => set(campo.k, lista)} enviarArquivo={enviarArquivo} />
        {ajuda && <p className="text-xs text-[#767C8E]">{ajuda}</p>}
        {erro && <p className="text-xs font-semibold text-[#E2564B]">{erro}</p>}
      </div>
    )
  }
  if (campo.tipo === 'aviso') {
    return <div className="rounded-lg bg-[#2A25F0]/[0.06] border border-[#2A25F0]/15 px-3.5 py-3 text-[13px] text-[#3D4254] flex gap-2.5"><Info className="w-4 h-4 text-[#2A25F0] shrink-0 mt-0.5" /><p>{label}</p></div>
  }
  if (campo.tipo === 'check') {
    return (
      <button type="button" role="checkbox" aria-checked={!!v} onClick={() => set(campo.k, !v)} className={`text-left rounded-lg border px-3.5 py-3 flex items-start gap-2.5 transition ${v ? 'border-[#E2564B] bg-[#E2564B]/[0.05]' : 'border-[#E4E7F0] bg-white hover:border-[#C9CDDA]'}`}>
        <span className={`mt-px shrink-0 w-4 h-4 rounded inline-flex items-center justify-center border ${v ? 'bg-[#E2564B] border-[#E2564B] text-white' : 'border-[#C9CDDA] bg-white'}`}>{v && <Check className="w-3 h-3" strokeWidth={3} />}</span>
        <span className="text-sm font-semibold text-[#3D4254]">{label}</span>
      </button>
    )
  }

  let controle
  switch (campo.tipo) {
    case 'textarea':
      controle = <textarea id={id} rows={campo.linhas || 4} maxLength={3000} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} placeholder={placeholder} className={`${inputCls(erro)} py-2.5 resize-y`} />
      break
    case 'escolha':
    case 'multi':
      controle = <Opcoes tipo={tipo} campo={campo} valor={v} multi={campo.tipo === 'multi'} onChange={(x) => set(campo.k, x)} erro={erro} tx={tx} />
      break
    case 'numero':
      controle = <input id={id} type="number" inputMode="numeric" min={campo.min} max={campo.max} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} placeholder={placeholder} className={`${inputCls(erro)} h-11 sm:h-10 !w-28`} />
      break
    case 'dinheiro': {
      const per = r[`${campo.k}_periodo`] || 'mes'
      controle = (
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center h-11 sm:h-10 rounded-lg border bg-white focus-within:border-[#2A25F0] focus-within:ring-2 focus-within:ring-[#2A25F0]/20 ${erro ? 'border-[#E2564B]' : 'border-[#E4E7F0]'}`}>
            <span className="pl-3 pr-1 text-sm font-semibold text-[#767C8E]">R$</span>
            <input id={id} inputMode="decimal" value={v || ''} onChange={(e) => set(campo.k, e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" className="w-32 h-full pr-3 bg-transparent outline-none text-base sm:text-sm" />
          </div>
          <div className="inline-flex rounded-lg border border-[#E4E7F0] bg-white p-0.5" role="radiogroup" aria-label={tx.t('pedido.periodo')}>
            {[['mes', tx.t('pedido.porMes')], ['dia', tx.t('pedido.porDia')]].map(([k, rot]) => (
              <button key={k} type="button" role="radio" aria-checked={per === k} onClick={() => set(`${campo.k}_periodo`, k)} className={`h-9 sm:h-8 px-3 rounded-md text-sm font-semibold transition ${per === k ? 'bg-[#2A25F0] text-white' : 'text-[#5A6072] hover:text-[#0B0B14]'}`}>{rot}</button>
            ))}
          </div>
        </div>
      )
      break
    }
    case 'data':
      controle = <input id={id} type="date" min={campo.k === 'fim' && r.inicio ? r.inicio : hoje()} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} className={`${inputCls(erro)} h-11 sm:h-10 !w-48`} />
      break
    case 'telefone':
      controle = <input id={id} type="tel" inputMode="tel" autoComplete="tel" value={v || ''} onChange={(e) => set(campo.k, mascaraTelefone(e.target.value))} placeholder={placeholder || '(00) 00000-0000'} className={`${inputCls(erro)} h-11 sm:h-10 !w-56`} />
      break
    case 'link':
    case 'drive':
      controle = (
        <input
          id={id} type="url" inputMode="url" autoComplete="off" value={v || ''} onChange={(e) => set(campo.k, e.target.value.trim())}
          onBlur={() => campo.tipo === 'drive' && conferirDrive(campo.k, v)}
          placeholder={placeholder || (campo.tipo === 'drive' ? 'https://drive.google.com/…' : 'https://')} className={`${inputCls(erro)} h-11 sm:h-10`}
        />
      )
      break
    default:
      controle = <input id={id} type="text" maxLength={campo.max || 200} autoComplete={campo.k === 'nome' ? 'name' : 'off'} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} placeholder={placeholder} className={`${inputCls(erro)} h-11 sm:h-10`} />
  }

  return (
    <div className="flex flex-col gap-1.5" data-campo={campo.k}>
      <label htmlFor={id} className="text-[13px] font-semibold text-[#3D4254]">
        {label}{!obrig && !/opcional/i.test(labelPt) && campo.tipo !== 'escolha' && campo.tipo !== 'multi' ? <span className="font-normal text-[#9AA0B2]"> {tx.t('pedido.opcional')}</span> : null}
      </label>
      {controle}
      {campo.tipo === 'drive' && !lerLinkDrive(v) && !campo.aceitaOutros && <p className="text-xs text-[#767C8E]">{tx.t('pedido.drive.dica')}</p>}
      {campo.tipo === 'drive' && lerLinkDrive(v) && <StatusDrive st={driveSt} onConferir={() => conferirDrive(campo.k, v, true)} />}
      {ajuda && <p className="text-xs text-[#767C8E]">{ajuda}</p>}
      {erro && <p className="text-xs font-semibold text-[#E2564B]">{erro}</p>}
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function PedidoPublico() {
  const { token } = useParams()
  return <PedidoFormulario token={token} />
}

// `token` = link público; `portal` = { projectId, token } da sessão do portal (upload liberado).
// `embedded` tira a moldura da página; `onEnviado(titulo)` e `onVoltar` são do portal.
export function PedidoFormulario({ token, portal, embedded = false, onEnviado, onVoltar, tipoInicial = null, infoInicial = null }) {
  const chaveRascunho = portal ? `pedido.rascunho.portal.${portal.projectId}` : `pedido.rascunho.${token}`
  // Mesma API nos dois casos; muda só como se identifica.
  const ident = portal ? `projectId=${encodeURIComponent(portal.projectId)}` : `token=${encodeURIComponent(token)}`
  const sessao = portal?.token || null
  const projetoPortal = portal?.projectId || null
  const headers = useMemo(() => (sessao ? { authorization: `Bearer ${sessao}` } : {}), [sessao])
  const corpoIdent = portal ? { projectId: portal.projectId } : { token }
  const enviarArquivo = useMemo(() => (sessao ? async (file) => {
    const res = await fetch('/api/intake-publico', {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ projectId: projetoPortal, acao: 'upload', nome: file.name, tamanho: file.size, mime: file.type }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'Não consegui preparar o envio.')
    return j // { path, url }
  } : null), [sessao, headers, projetoPortal])
  const [info, setInfo] = useState(infoInicial) // { empresa, prazos }
  const [erroLink, setErroLink] = useState(null)
  // rascunho deste link: sai da página e volta sem perder o que escreveu
  const [rascunho] = useState(() => {
    if (tipoInicial && TIPOS_PEDIDO_MAP[tipoInicial]) {
      const salvo = lerLS('pedido.contato') || {}
      return { tipo: tipoInicial, etapa: 1, respostas: { nome: salvo.nome || '', contato: salvo.contato || '' } }
    }
    const x = lerLS(chaveRascunho)
    if (!x?.tipo || !TIPOS_PEDIDO_MAP[x.tipo]) return null
    // upload que estava no meio quando a página fechou não volta
    if (Array.isArray(x.respostas?.arquivos)) x.respostas.arquivos = x.respostas.arquivos.filter((a) => a?.path && !a.subindo)
    return x
  })
  const [etapa, setEtapa] = useState(rascunho ? Math.min(rascunho.etapa || 0, 1) : 0)
  const [tipoId, setTipoId] = useState(rascunho?.tipo || null)
  const [r, setR] = useState(rascunho?.respostas || {})
  const [erros, setErros] = useState({})
  const [drive, setDrive] = useState({}) // { campo: { url, estado, nome } }
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState(null)
  const [enviado, setEnviado] = useState(null) // { titulo }
  const topo = useRef(null)
  const tipo = tipoId ? TIPOS_PEDIDO_MAP[tipoId] : null
  const tx = useTextos()
  const { t } = tx

  const temInfo = !!infoInicial
  useEffect(() => {
    if (temInfo) return undefined // o portal já trouxe empresa e prazos
    let vivo = true
    fetch(`/api/intake-publico?${ident}`, { headers: { ...headers, 'X-Idioma': idiomaAtual() } })
      .then(async (res) => { const j = await res.json().catch(() => ({})); if (!vivo) return; if (!res.ok) setErroLink(j.error || { chave: 'pedido.linkInvalido' }); else setInfo({ empresa: j.empresa || '', prazos: j.prazos || {} }) })
      .catch(() => vivo && setErroLink({ chave: 'pedido.naoAbriu' }))
    return () => { vivo = false }
  }, [ident, headers, temInfo])

  useEffect(() => {
    if (enviado) return
    gravarLS(chaveRascunho, tipoId ? { tipo: tipoId, respostas: r, etapa } : null)
  }, [chaveRascunho, tipoId, r, etapa, enviado])

  useEffect(() => { topo.current?.scrollIntoView({ block: 'start', behavior: embedded ? 'smooth' : 'auto' }) }, [etapa, enviado, embedded])

  const set = useCallback((k, v) => {
    setR((x) => ({ ...x, [k]: v }))
    setErros((e) => (e[k] ? { ...e, [k]: undefined } : e))
  }, [])

  // Pergunta ao servidor se o link do Drive abre sem login. Uma conferência por URL (cache de
  // promessas): colar, sair do campo e revisar não repetem a chamada; "conferir de novo" força.
  const cacheDrive = useRef({})
  const conferirDrive = useCallback((k, url, forcar = false) => {
    if (!lerLinkDrive(url)) return Promise.resolve(null)
    if (forcar || !cacheDrive.current[url]) {
      cacheDrive.current[url] = fetch(`/api/intake-publico?${ident}&drive=${encodeURIComponent(url)}`, { headers: { ...headers, 'X-Idioma': idiomaAtual() } })
        .then(async (res) => {
          const j = await res.json().catch(() => ({}))
          if (!res.ok) return { estado: 'incerto' }
          if (j.publico === true) return { estado: 'ok', nome: j.nome }
          if (j.publico === false) return { estado: j.existe === false ? 'inexistente' : 'fechado' }
          return { estado: 'incerto' }
        })
        .catch(() => ({ estado: 'incerto' }))
    }
    setDrive((d) => (!forcar && d[k]?.url === url ? d : { ...d, [k]: { url, estado: 'conferindo' } }))
    return cacheDrive.current[url].then((res) => {
      const st = { url, ...res }
      setDrive((d) => (d[k]?.url === url ? { ...d, [k]: st } : d))
      if (st.estado === 'ok' || st.estado === 'incerto') setErros((e) => (e[k] ? { ...e, [k]: undefined } : e))
      return st
    })
  }, [ident, headers])

  // confere sozinho pouco depois de colar o link
  const camposDrive = useMemo(() => (tipo ? camposVisiveis(tipo, r).filter((c) => c.tipo === 'drive') : []), [tipo, r])
  const assinaturaDrive = camposDrive.map((c) => `${c.k}=${r[c.k] || ''}`).join('|')
  useEffect(() => {
    const h = setTimeout(() => { for (const c of camposDrive) if (lerLinkDrive(r[c.k])) conferirDrive(c.k, r[c.k]) }, 700)
    return () => clearTimeout(h)
  }, [assinaturaDrive]) // eslint-disable-line react-hooks/exhaustive-deps

  const driveParaValidar = useMemo(() => Object.fromEntries(Object.entries(drive)
    .filter(([k, st]) => st.url === r[k])
    .map(([k, st]) => [k, { publico: st.estado === 'ok' ? true : st.estado === 'fechado' || st.estado === 'inexistente' ? false : null, existe: st.estado !== 'inexistente', nome: st.nome }])), [drive, r])

  function escolherTipo(id) {
    if (id !== tipoId) {
      const salvo = lerLS('pedido.contato') || {}
      setR({ nome: salvo.nome || '', contato: salvo.contato || '' })
      setErros({}); setDrive({})
    }
    setTipoId(id); setEtapa(1)
  }

  async function revisar() {
    // espera a conferência dos links que ainda não foram conferidos
    const pend = camposDrive.filter((c) => lerLinkDrive(r[c.k]) && (drive[c.k]?.url !== r[c.k] || drive[c.k]?.estado === 'conferindo'))
    const res = await Promise.all(pend.map((c) => conferirDrive(c.k, r[c.k]).then((st) => [c.k, st])))
    const dv = { ...driveParaValidar }
    for (const [k, st] of res) if (st) dv[k] = { publico: st.estado === 'ok' ? true : st.estado === 'incerto' ? null : false, existe: st.estado !== 'inexistente' }
    const e = validarPedido(tipo, r, { drive: dv, comUpload: !!portal })
    setErros(e)
    const primeiro = [...camposVisiveis(tipo, r)].find((c) => e[c.k]) || (e.fim && { k: 'fim' }) || (e.contato && { k: 'contato' })
    if (primeiro) { document.querySelector(`[data-campo="${primeiro.k}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    setEtapa(2)
  }

  async function enviar() {
    setEnviando(true); setErroEnvio(null)
    try {
      const res = await fetch('/api/intake-publico', { method: 'POST', headers: { 'content-type': 'application/json', ...headers, 'X-Idioma': idiomaAtual() }, body: JSON.stringify({ ...corpoIdent, tipo: tipoId, respostas: r }) })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        gravarLS('pedido.contato', { nome: r.nome, contato: r.contato })
        gravarLS(chaveRascunho, null)
        setEnviado({ titulo: j.titulo || '' })
        onEnviado?.(j.titulo || '')
      } else if (j.erros) {
        setErros(j.erros); setEtapa(1)
        if (Object.keys(j.erros).some((k) => camposDrive.some((c) => c.k === k))) camposDrive.forEach((c) => conferirDrive(c.k, r[c.k], true))
      } else setErroEnvio(j.error || { chave: 'pedido.naoEnviou' })
    } catch { setErroEnvio({ chave: 'pedido.semConexao' }) }
    setEnviando(false)
  }

  function novoPedido() {
    setEnviado(null); setTipoId(null); setR({}); setErros({}); setDrive({}); setEtapa(0)
  }

  const resumo = useMemo(() => (tipo && etapa === 2 ? montarPedido(tipo, r, { drive: driveParaValidar, via: portal ? 'portal' : 'link' }) : null), [tipo, r, etapa, driveParaValidar, portal])
  const subindo = Array.isArray(r.arquivos) && r.arquivos.some((a) => a?.subindo)
  const prazoDias = tipo && info?.prazos?.[tipo.id]
  const camposTipo = tipo ? camposVisiveis(tipo, r, { finais: false }) : []
  const camposFinais = tipo ? CAMPOS_FINAIS.filter((c) => !c.quando || c.quando(r)) : []
  const Icone = tipo ? ICONES[tipo.id] : null
  // erro do servidor chega como texto (pt); o da própria página, como chave
  const msg = (x) => (x && typeof x === 'object' ? t(x.chave) : x)
  const nomeTipo = (tp) => tx.tr(`tipos.${tp.id}.nome`, tp.nome)
  const resumoTipo = (tp) => tx.tr(`tipos.${tp.id}.resumo`, tp.resumo)
  const prazoPt = prazoDias && tipo.prazoMsg?.(prazoDias, r)
  const variantePrazo = tipo && VARIANTES[`${tipo.id}.prazoMsg`]
  const prazoMsg = prazoPt ? tx.tr(`tipos.${tipo.id}.prazoMsg${variantePrazo ? `.${variantePrazo(r)}` : ''}`, prazoPt, { n: prazoDias }) : ''
  const camposDoTipo = tipo ? camposVisiveis(tipo, r) : []

  return (
    <div className={embedded ? 'rounded-2xl bg-[#F8F9FC] text-[#0B0B14] border border-[#E4E7F0]' : 'min-h-screen bg-[#F8F9FC] text-[#0B0B14]'} style={{ fontFamily: "'Manrope', system-ui, sans-serif", colorScheme: 'light' }}>
      <div ref={topo} className={embedded ? 'mx-auto w-full max-w-2xl px-4 sm:px-6 py-5 sm:py-7 scroll-mt-20' : 'mx-auto w-full max-w-2xl px-4 py-6 sm:py-10'}>
        <header className="flex items-center gap-2.5 mb-6">
          {embedded ? (
            onVoltar && <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5A6072] hover:text-[#0B0B14]"><ArrowLeft className="w-4 h-4" /> {t('pedido.minhasSolicitacoes')}</button>
          ) : (
            <>
              <img src="/vertatask-simbolo.png" alt="" className="w-7 h-7" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A25F0]">{t('pedido.marca')}</p>
                {info?.empresa && <p className="text-sm text-[#5A6072] truncate">{info.empresa}</p>}
              </div>
            </>
          )}
          {info && !enviado && (
            <ol className="ml-auto hidden sm:flex items-center gap-1.5 text-xs" aria-label={t('pedido.etapasAria')}>
              {ETAPAS.map((id, i) => (
                <li key={id} className={`flex items-center gap-1.5 ${i <= etapa ? 'text-[#0B0B14] font-semibold' : 'text-[#9AA0B2]'}`}>
                  <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] ${i < etapa ? 'bg-[#2A25F0] text-white' : i === etapa ? 'border-2 border-[#2A25F0] text-[#2A25F0]' : 'border border-[#C9CDDA]'}`}>{i < etapa ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}</span>
                  {t(`pedido.etapas.${id}`)}{i < ETAPAS.length - 1 && <span className="w-4 h-px bg-[#D7DAE5] ml-0.5" />}
                </li>
              ))}
            </ol>
          )}
          {info && !enviado && <p className="sm:hidden ml-auto text-xs font-semibold text-[#767C8E]">{t('pedido.etapaDe', { n: etapa + 1, total: ETAPAS.length })}</p>}
        </header>

        {!info && !erroLink ? (
          <div className="py-24 flex justify-center text-[#767C8E]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : erroLink ? (
          <div className="bg-white border border-[#E4E7F0] rounded-2xl p-8 text-center"><AlertCircle className="w-9 h-9 mx-auto text-[#E2564B] mb-2" /><p className="text-sm">{msg(erroLink)}</p></div>
        ) : enviado ? (
          <div className="bg-white border border-[#E4E7F0] rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="w-11 h-11 mx-auto text-[#1F8A5B] mb-3" />
            <h1 className="text-xl font-bold !text-[#0B0B14]" style={{ fontFamily: "'Sora', sans-serif" }}>{t('pedido.enviadoTitulo')}</h1>
            {enviado.titulo && <p className="mt-2 text-sm font-semibold text-[#3D4254]">{tipo ? tx.tituloTxt(tipo, r, enviado.titulo) : enviado.titulo}</p>}
            <p className="mt-2 text-sm text-[#5A6072] max-w-md mx-auto">{t('pedido.enviadoTexto', { contato: /@/.test(r.contato || '') ? r.contato : telefoneTexto(r.contato) })}{portal ? ` ${t('pedido.acompanhaNoPortal')}` : ''}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {onVoltar && <button type="button" onClick={onVoltar} className="h-11 px-5 rounded-lg bg-[#2A25F0] hover:bg-[#1800DB] text-sm font-semibold text-white">{t('pedido.acompanharSolicitacoes')}</button>}
              <button type="button" onClick={novoPedido} className="h-11 px-5 rounded-lg border border-[#E4E7F0] bg-white text-sm font-semibold text-[#2A25F0] hover:border-[#B9BCF7]">{t('pedido.outroPedido')}</button>
            </div>
          </div>
        ) : etapa === 0 || !tipo ? (
          <>
            <h1 className="text-2xl font-bold leading-tight !text-[#0B0B14]" style={{ fontFamily: "'Sora', sans-serif" }}>{info.empresa ? t('pedido.oQuePrecisaEmpresa', { empresa: info.empresa }) : t('pedido.oQuePrecisa')}</h1>
            <p className="text-sm text-[#5A6072] mt-1.5 mb-6">{t('pedido.escolhaTipo')}</p>
            {GRUPOS_PEDIDO.map((g) => (
              <section key={g.id} className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#767C8E] mb-2">{tx.tr(`grupos.${g.id}`, g.nome)}</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {TIPOS_PEDIDO.filter((tp) => tp.grupo === g.id).map((tp) => {
                    const Ic = ICONES[tp.id]
                    return (
                      <button key={tp.id} type="button" onClick={() => escolherTipo(tp.id)} className="group text-left bg-white border border-[#E4E7F0] rounded-xl px-4 py-3.5 flex items-center gap-3 transition hover:border-[#2A25F0] hover:shadow-[0_2px_12px_rgba(42,37,240,0.08)]">
                        <span className="w-10 h-10 shrink-0 rounded-lg bg-[#2A25F0]/[0.08] text-[#2A25F0] inline-flex items-center justify-center"><Ic className="w-5 h-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold text-[#0B0B14]">{nomeTipo(tp)}</span>
                          <span className="block text-[13px] text-[#767C8E] leading-snug">{resumoTipo(tp)}</span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#C9CDDA] group-hover:text-[#2A25F0] shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        ) : etapa === 1 ? (
          <>
            <button type="button" onClick={() => setEtapa(0)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5A6072] hover:text-[#0B0B14] mb-3"><ArrowLeft className="w-4 h-4" /> {t('pedido.trocarTipo')}</button>
            <div className="flex items-center gap-3 mb-1">
              <span className="w-10 h-10 shrink-0 rounded-lg bg-[#2A25F0] text-white inline-flex items-center justify-center"><Icone className="w-5 h-5" /></span>
              <h1 className="text-2xl font-bold leading-tight !text-[#0B0B14]" style={{ fontFamily: "'Sora', sans-serif" }}>{nomeTipo(tipo)}</h1>
            </div>
            <p className="text-sm text-[#5A6072] mb-5">{resumoTipo(tipo)}.</p>
            {prazoMsg && <p className="mb-4 rounded-lg bg-white border border-[#E4E7F0] px-3.5 py-2.5 text-[13px] text-[#3D4254] flex gap-2"><Clock className="w-4 h-4 text-[#2A25F0] shrink-0 mt-0.5" />{prazoMsg}</p>}

            <div className="bg-white border border-[#E4E7F0] rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
              {camposTipo.map((c) => <Campo key={c.k} tipo={tipo} tx={tx} campo={c} r={r} set={set} erro={erros[c.k]} driveSt={drive[c.k]?.url === r[c.k] ? drive[c.k] : null} conferirDrive={conferirDrive} enviarArquivo={enviarArquivo} />)}
            </div>

            <h2 className="text-[11px] font-bold uppercase !text-[#767C8E] tracking-[0.12em] text-[#767C8E] mt-7 mb-2">{t('pedido.prazoContato')}</h2>
            <div className="bg-white border border-[#E4E7F0] rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
              {camposFinais.map((c) => <Campo key={c.k} tipo={tipo} tx={tx} campo={c} r={r} set={set} erro={erros[c.k]} driveSt={null} conferirDrive={conferirDrive} />)}
            </div>

            {Object.values(erros).some(Boolean) && <p className="mt-4 text-sm font-semibold text-[#E2564B]">{t('pedido.faltou')}</p>}
            {subindo && <p className="mt-4 text-sm text-[#5A6072] inline-flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> {t('pedido.esperandoArquivos')}</p>}
            <button type="button" onClick={revisar} disabled={subindo || Object.values(drive).some((d) => d.estado === 'conferindo')} className="mt-5 w-full h-12 rounded-lg bg-[#2A25F0] hover:bg-[#1800DB] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {Object.values(drive).some((d) => d.estado === 'conferindo') ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t('pedido.revisarPedido')} <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEtapa(1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5A6072] hover:text-[#0B0B14] mb-3"><ArrowLeft className="w-4 h-4" /> {t('pedido.voltarEditar')}</button>
            <h1 className="text-2xl font-bold leading-tight !text-[#0B0B14]" style={{ fontFamily: "'Sora', sans-serif" }}>{t('pedido.confereTitulo')}</h1>
            <p className="text-sm text-[#5A6072] mt-1.5 mb-5">{t('pedido.confereTexto')}</p>
            <div className="bg-white border border-[#E4E7F0] rounded-2xl overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-[#EEF0F5] flex items-center gap-3">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-[#2A25F0]/[0.08] text-[#2A25F0] inline-flex items-center justify-center"><Icone className="w-[18px] h-[18px]" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2A25F0]">{nomeTipo(tipo)}</p>
                  <p className="text-[15px] font-bold text-[#0B0B14] leading-snug">{tx.tituloTxt(tipo, r, resumo.titulo)}</p>
                </div>
                {r.urgente && <span className="ml-auto shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[#E2564B]/10 text-[#C2392F]">{t('pedido.urgente')}</span>}
              </div>
              <dl className="divide-y divide-[#EEF0F5]">
                {resumo.itens.filter((i) => i.k !== 'urgente').map((i) => {
                  const c = camposDoTipo.find((x) => x.k === i.k)
                  return (
                  <div key={i.k} className="px-5 sm:px-6 py-3 grid gap-0.5 sm:grid-cols-[170px_1fr] sm:gap-4">
                    <dt className="text-xs font-semibold text-[#767C8E] sm:pt-0.5">{c ? (c.curto ? tx.campoTxt(tipo, c, 'curto', r) : tx.campoTxt(tipo, c, 'label', r)) : i.label}</dt>
                    <dd className="text-sm text-[#0B0B14] whitespace-pre-line break-words min-w-0">
                      {i.tipo === 'link' || i.tipo === 'drive' ? <a href={i.valor} target="_blank" rel="noreferrer" className="text-[#2A25F0] underline underline-offset-2 break-all">{i.valor}</a> : i.tipo === 'telefone' ? telefoneTexto(i.valor) : c ? tx.valorTxt(tipo, c, r[i.k], r) : i.valor}
                      {i.drive?.publico === true && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#1F8A5B]"><CheckCircle2 className="w-3.5 h-3.5" /> {i.drive.nome ? t('pedido.drive.abertoNome', { nome: i.drive.nome }) : t('pedido.drive.aberto')}</span>}
                      {i.drive && i.drive.publico == null && <span className="mt-1 flex items-center gap-1 text-xs text-[#8a6a14]"><AlertTriangle className="w-3.5 h-3.5" /> {t('pedido.drive.timeConfere')}</span>}
                    </dd>
                  </div>
                  )
                })}
              </dl>
            </div>
            {erroEnvio && <p className="mt-4 text-sm font-semibold text-[#E2564B]">{msg(erroEnvio)}</p>}
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2.5">
              <button type="button" onClick={() => setEtapa(1)} className="h-12 sm:w-auto px-5 rounded-lg border border-[#E4E7F0] bg-white text-sm font-semibold text-[#3D4254] inline-flex items-center justify-center gap-2 hover:border-[#B9BCF7]"><Pencil className="w-4 h-4" /> {t('pedido.editar')}</button>
              <button type="button" onClick={enviar} disabled={enviando} className="flex-1 h-12 rounded-lg bg-[#2A25F0] hover:bg-[#1800DB] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t('pedido.enviarPedido')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
