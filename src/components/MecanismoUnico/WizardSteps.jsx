// ─────────────────────────────────────────────────────────────────────────────
// Passos do wizard guiado de Mecanismo Único.
// Cada passo = uma decisão por tela + micro-ensino + exemplo, no mesmo espírito
// do wizard de Oferta Matadora. Usados pela shell interna e pela página pública.
// ─────────────────────────────────────────────────────────────────────────────
import { AlertTriangle, Check, Lightbulb, Trophy } from 'lucide-react'
import MarkdownBlock from '../Criativos/MarkdownBlock'
import { Label, Field, DynamicStringList, DynamicTable } from './Fields'
import {
  VILOES, TIPOS_PROVA, FORMATOS_NOME, TECNICAS,
  CRITERIOS_VALIDACAO, TESTE_AMIGO,
  countValidacao, vereditoValidacao,
} from './mecanismoUnicoData'
import { buildPitch } from './mecanismoShared'

// ─── Caixinhas de apoio ─────────────────────────────────────────────────────
function Ensino({ children }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-purple/5 border border-rl-purple/25">
      <Lightbulb className="w-4 h-4 text-rl-purple mt-0.5 shrink-0" />
      <p className="text-xs text-rl-text leading-relaxed">{children}</p>
    </div>
  )
}

function Exemplo({ children }) {
  return (
    <div className="rounded-xl bg-rl-surface/50 border border-rl-border/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-1">Exemplo</p>
      <p className="text-xs text-rl-subtle leading-relaxed italic">{children}</p>
    </div>
  )
}

// ─── Passo 0 — Concorrentes ─────────────────────────────────────────────────
export function StepConcorrentes({ data, set }) {
  return (
    <div className="space-y-4">
      <Ensino>
        Antes de criar o seu mecanismo, é preciso saber contra o que ele compete. Liste
        de 3 a 5 concorrentes diretos e o que cada um entrega hoje.
      </Ensino>
      <DynamicTable
        title="Seus concorrentes"
        hint="Quem seu cliente considera antes de escolher você?"
        columns={[
          { id: 'nome',   label: 'Concorrente',   placeholder: 'Ex: Fulano' },
          { id: 'oferta', label: 'O que oferece', placeholder: 'Ex: Curso online + comunidade' },
        ]}
        rows={data.concorrentes}
        onChange={(rows) => set('concorrentes', rows)}
      />
      <Exemplo>
        &ldquo;Agência X: gestão de tráfego por R$3k/mês&rdquo; · &ldquo;Curso do Fulano:
        aulas gravadas + grupo no WhatsApp&rdquo;
      </Exemplo>
    </div>
  )
}

// ─── Passo 1 — Padrão do mercado ────────────────────────────────────────────
export function StepMercado({ data, set }) {
  return (
    <div className="space-y-4">
      <Ensino>
        Tudo o que &ldquo;todo mundo&rdquo; oferece e promete vira ruído: o cliente já ouviu,
        já duvidou. Mapear isso aqui é o que permite criar contraste depois.
      </Ensino>
      <DynamicStringList
        title="O que é padrão no mercado?"
        hint="O que todo mundo entrega igual (calls semanais, método em X passos, suporte WhatsApp...)"
        placeholder="Ex: Calls semanais"
        items={data.padroesMercado}
        onChange={(items) => set('padroesMercado', items)}
      />
      <DynamicStringList
        title="Promessas que todo mundo faz"
        hint="Frases batidas que você vê em todo lugar do seu nicho."
        placeholder='Ex: "Escale seu faturamento"'
        items={data.promessasComuns}
        onChange={(items) => set('promessasComuns', items)}
      />
      <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
        <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
        <p className="text-xs text-rl-text leading-snug">
          <strong>Alerta:</strong> se você oferece as mesmas coisas que listou acima, você é
          igual aos outros. Use isso pra criar contraste nos próximos passos.
        </p>
      </div>
    </div>
  )
}

// ─── Passo 2 — O que já tentou ──────────────────────────────────────────────
export function StepTentativas({ data, set }) {
  return (
    <div className="space-y-4">
      <Ensino>
        Seu cliente já tentou resolver isso antes e falhou. O que ele acredita ser o motivo
        do fracasso é a porta de entrada do seu mecanismo. Use as palavras <strong>dele</strong>,
        não as suas.
      </Ensino>
      <DynamicTable
        title="O que ele já tentou antes de você?"
        hint=""
        columns={[
          { id: 'tentou',    label: 'O que tentou', placeholder: 'Ex: Curso online' },
          { id: 'resultado', label: 'Resultado',    placeholder: 'Ex: Não aplicou' },
        ]}
        rows={data.tentativas}
        onChange={(rows) => set('tentativas', rows)}
      />
      <DynamicStringList
        title="Por que ELE acha que não funcionou?"
        hint='Literalmente como ele fala. Ex: "Não tive tempo de aplicar"'
        placeholder='Ex: "Era muito complexo"'
        items={data.justificativas}
        onChange={(items) => set('justificativas', items)}
      />
      <Exemplo>
        Tentou: &ldquo;contratar um vendedor&rdquo; → Resultado: &ldquo;pediu demissão em 2
        meses&rdquo;. Ele acha que foi porque &ldquo;é difícil achar gente boa&rdquo;.
      </Exemplo>
    </div>
  )
}

// ─── Passo 3 — O vilão ──────────────────────────────────────────────────────
export function StepVilao({ data, set }) {
  const selected = new Set(data.viloes || [])

  function toggle(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    set('viloes', [...next])
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-rl-red/5 border border-rl-red/30">
        <p className="text-xs text-rl-text">
          <strong>Regra de ouro:</strong> o cliente NUNCA é culpado. A culpa é de algo que ele
          NÃO SABIA. Culpar o cliente fecha a conversa; culpar o vilão abre.
        </p>
      </div>

      <div>
        <Label>Escolha os candidatos a vilão</Label>
        <p className="text-[11px] text-rl-muted mb-2">Quem ou o que você pode culpar pelo fracasso?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VILOES.map((v) => {
            const checked = selected.has(v.id)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2 ${
                  checked
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                  checked ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
                }`}>
                  {checked && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span>{v.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Meu vilão principal">
          <input
            type="text"
            value={data.vilaoPrincipal || ''}
            onChange={(e) => set('vilaoPrincipal', e.target.value)}
            placeholder="Resuma em uma frase"
            className="input-field w-full"
          />
        </Field>
        <Field label="Por que isso é vilão?">
          <input
            type="text"
            value={data.vilaoJustificativa || ''}
            onChange={(e) => set('vilaoJustificativa', e.target.value)}
            placeholder="A razão lógica"
            className="input-field w-full"
          />
        </Field>
      </div>

      <Exemplo>
        Vilão: &ldquo;scripts de venda genéricos da internet&rdquo;. Por quê: &ldquo;foram
        escritos para outro tipo de produto e outro ticket&rdquo;.
      </Exemplo>
    </div>
  )
}

// ─── Passo 4 — Conexão lógica + prova ───────────────────────────────────────
export function StepProva({ data, set, setNested }) {
  const provasSelected = new Set(data.provas || [])

  function toggleProva(id) {
    const next = new Set(provasSelected)
    next.has(id) ? next.delete(id) : next.add(id)
    set('provas', [...next])
  }

  return (
    <div className="space-y-5">
      <Ensino>
        O vilão só convence se a corrente lógica fechar e existir uma prova. Sem prova, vira
        opinião: o cliente ouve e não acredita.
      </Ensino>

      <div>
        <Label>Conexão lógica</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          [VILÃO] → causou [PROBLEMA] → que levou a [FRACASSO]
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={data.conexao?.vilao || ''}
            onChange={(e) => setNested('conexao', 'vilao', e.target.value)}
            placeholder="Vilão"
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.problema || ''}
            onChange={(e) => setNested('conexao', 'problema', e.target.value)}
            placeholder="Problema causado"
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.fracasso || ''}
            onChange={(e) => setNested('conexao', 'fracasso', e.target.value)}
            placeholder="Fracasso final"
            className="input-field w-full"
          />
        </div>
      </div>

      <div>
        <Label>A prova</Label>
        <p className="text-[11px] text-rl-muted mb-2">Qual tipo de prova torna sua explicação crível?</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {TIPOS_PROVA.map((p) => {
            const checked = provasSelected.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProva(p.id)}
                className={`text-center px-2 py-2 rounded-lg border text-[11px] font-semibold transition-all ${
                  checked
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={data.provaTexto || ''}
          onChange={(e) => set('provaTexto', e.target.value)}
          rows={3}
          placeholder='Ex: "9 em cada 10 scripts da internet foram escritos por quem nunca vendeu acima de R$5.000"'
          className="input-field w-full resize-none"
        />
      </div>
    </div>
  )
}

// ─── Passo 5 — O que é diferente ────────────────────────────────────────────
export function StepDiferente({ data, set }) {
  return (
    <div className="space-y-4">
      <Ensino>
        Agora vem a virada: por que a SUA forma resolve o que os outros não resolveram.
        Cada linha é um contraste direto com o que você mapeou nos concorrentes.
      </Ensino>
      <DynamicTable
        title="Defina o que é diferente"
        hint='Complete: "Diferente de... eu..."'
        columns={[
          { id: 'deles', label: 'Diferente de...', placeholder: 'Ex: cursos que dão teoria' },
          { id: 'voce',  label: 'Eu...',           placeholder: 'Ex: implemento do seu lado' },
        ]}
        rows={data.diferentes}
        onChange={(rows) => set('diferentes', rows)}
      />
      <Exemplo>
        &ldquo;Diferente de agências que entregam relatório, eu entro na sua reunião comercial
        toda semana.&rdquo;
      </Exemplo>
    </div>
  )
}

// ─── Passo 6 — Nome do mecanismo ────────────────────────────────────────────
export function StepNome({ data, set }) {
  return (
    <div className="space-y-4">
      <Ensino>
        Um método sem nome é um serviço. Com nome, vira propriedade: o cliente consegue
        repetir pra outra pessoa e você deixa de ser comparável por preço.
      </Ensino>

      <div>
        <Label>Escolha um formato</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 mt-2">
          {FORMATOS_NOME.map((f) => {
            const active = data.formatoNome === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => set('formatoNome', active ? '' : f.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                  active
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <div className="font-bold">{f.label}</div>
                <div className="text-[10px] text-rl-muted">Ex: {f.exemplo}</div>
              </button>
            )
          })}
        </div>
        <Field label="Nome final do mecanismo">
          <input
            type="text"
            value={data.nomeMecanismo || ''}
            onChange={(e) => set('nomeMecanismo', e.target.value)}
            placeholder='Ex: "Método do Closer Interno"'
            className="input-field w-full"
            maxLength={80}
          />
        </Field>
      </div>

      {data.nomeMecanismo?.trim() && (
        <div className="rounded-xl bg-rl-gold/5 border border-rl-gold/30 p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-gold mb-1">Seu mecanismo</p>
          <p className="text-lg font-black text-rl-text">{data.nomeMecanismo}</p>
        </div>
      )}
    </div>
  )
}

// ─── Passo 7 — Por que funciona ─────────────────────────────────────────────
export function StepPorque({ data, setNested }) {
  return (
    <div className="space-y-4">
      <Ensino>
        Escolha uma ou mais técnicas para sustentar a promessa. Não precisa preencher todas:
        uma bem feita vale mais que quatro genéricas.
      </Ensino>
      <div className="space-y-3">
        {TECNICAS.map((t) => (
          <div key={t.id}>
            <p className="text-[11px] font-bold text-rl-text mb-1">{t.label}</p>
            <textarea
              value={(data.tecnicas || {})[t.id] || ''}
              onChange={(e) => setNested('tecnicas', t.id, e.target.value)}
              rows={2}
              placeholder={t.placeholder}
              className="input-field w-full resize-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Passo 8 — Montagem do pitch ────────────────────────────────────────────
export function StepMontagem({ data, set, setNested }) {
  return (
    <div className="space-y-5">
      <Ensino>
        Último esforço: junte tudo no esqueleto. O pitch se monta sozinho no passo final
        conforme você preenche aqui.
      </Ensino>

      <div className="space-y-3">
        <Field label="Eu ajudo:">
          <textarea
            value={data.euAjudo || ''}
            onChange={(e) => set('euAjudo', e.target.value)}
            rows={2}
            placeholder="Ex: Donos de agências que faturam entre R$50k e R$200k/mês e ainda são o principal vendedor"
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label="A conseguir:">
          <textarea
            value={data.aConseguir || ''}
            onChange={(e) => set('aConseguir', e.target.value)}
            rows={2}
            placeholder="Ex: Contratar o primeiro closer que bate meta em 45 dias sem o dono participar"
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label="Através do (nome do mecanismo):">
          <input
            type="text"
            value={data.atravesDo || data.nomeMecanismo || ''}
            onChange={(e) => set('atravesDo', e.target.value)}
            placeholder={data.nomeMecanismo || 'Ex: Método do Closer Interno'}
            className="input-field w-full"
          />
        </Field>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>Parte 1 — Por que falhou até agora</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFalhou?.problema || ''}
            onChange={(e) => setNested('porqueFalhou', 'problema', e.target.value)}
            rows={2}
            placeholder="Você não conseguiu... até agora porque..."
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.razao || ''}
            onChange={(e) => setNested('porqueFalhou', 'razao', e.target.value)}
            rows={2}
            placeholder="Isso acontece porque..."
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.prova || ''}
            onChange={(e) => setNested('porqueFalhou', 'prova', e.target.value)}
            rows={2}
            placeholder="[PROVA]: ..."
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>Parte 2 — Por que vai funcionar</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFunciona?.explicacao || ''}
            onChange={(e) => setNested('porqueFunciona', 'explicacao', e.target.value)}
            rows={2}
            placeholder="O [NOME DO MECANISMO]... funciona porque..."
            className="input-field w-full resize-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <textarea
              value={data.porqueFunciona?.diferente || ''}
              onChange={(e) => setNested('porqueFunciona', 'diferente', e.target.value)}
              rows={2}
              placeholder="Diferente de..."
              className="input-field w-full resize-none"
            />
            <textarea
              value={data.porqueFunciona?.voce || ''}
              onChange={(e) => setNested('porqueFunciona', 'voce', e.target.value)}
              rows={2}
              placeholder="...eu..."
              className="input-field w-full resize-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>Promessa final</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Field label="Em (prazo)">
            <input
              type="text"
              value={data.promessaPrazo || ''}
              onChange={(e) => set('promessaPrazo', e.target.value)}
              placeholder="Ex: 45 dias"
              className="input-field w-full"
            />
          </Field>
          <Field label="...você terá">
            <input
              type="text"
              value={data.promessaResultado || ''}
              onChange={(e) => set('promessaResultado', e.target.value)}
              placeholder="Ex: seu closer batendo meta sem você"
              className="input-field w-full"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Passo 9 — Validação ────────────────────────────────────────────────────
export function StepValidacao({ data, set }) {
  const count = countValidacao(data.validacao)
  const veredito = vereditoValidacao(data.validacao)

  function setCriterio(id, val) {
    set('validacao', { ...(data.validacao || {}), [id]: val })
  }

  return (
    <div className="space-y-5">
      <Ensino>
        Marque cada critério com sinceridade. Um mecanismo só está aprovado quando os 7
        respondem SIM: qualquer &ldquo;não&rdquo; aponta exatamente o passo que precisa voltar.
      </Ensino>

      <div className="space-y-2">
        {CRITERIOS_VALIDACAO.map((c, i) => {
          const cur = (data.validacao || {})[c.id]
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rl-surface/40 border border-rl-border/60">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-rl-text">
                  {i + 1}. {c.label} <span className="text-rl-muted font-normal">— {c.desc}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setCriterio(c.id, cur === 'sim' ? '' : 'sim')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    cur === 'sim'
                      ? 'bg-rl-green/15 border border-rl-green/40 text-rl-green'
                      : 'bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text'
                  }`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setCriterio(c.id, cur === 'nao' ? '' : 'nao')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    cur === 'nao'
                      ? 'bg-rl-red/15 border border-rl-red/40 text-rl-red'
                      : 'bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text'
                  }`}
                >
                  Não
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="rounded-xl p-4 border-l-4"
        style={{ background: `${veredito.color}10`, borderLeftColor: veredito.color }}
      >
        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: veredito.color }}>
          Veredito ({count}/7)
        </p>
        <p className="text-sm font-bold" style={{ color: veredito.color }}>{veredito.label}</p>
      </div>

      <div>
        <Label>Teste do amigo</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          Imagina contar o mecanismo pra um amigo no bar. Qual seria a reação?
        </p>
        <div className="space-y-2">
          {TESTE_AMIGO.map((t) => {
            const active = data.testeAmigo === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set('testeAmigo', active ? '' : t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                  active
                    ? t.id === 'aprovado'
                      ? 'bg-rl-green/10 border-rl-green/50 text-rl-green'
                      : 'bg-rl-red/10 border-rl-red/50 text-rl-red'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className="text-sm">{t.label}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  active
                    ? t.id === 'aprovado' ? 'text-rl-green' : 'text-rl-red'
                    : 'text-rl-muted'
                }`}>
                  → {t.resultado}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Passo final — pitch montado ────────────────────────────────────────────
export function StepPitchPreview({ data }) {
  const pitch = buildPitch(data)
  if (!pitch) {
    return (
      <p className="text-sm text-rl-muted text-center py-8 italic">
        Volte ao passo &ldquo;Montagem do pitch&rdquo; pra ver o resultado aparecer aqui.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-rl-gold" />
        <h4 className="text-sm font-bold text-rl-text">Seu pitch montado</h4>
      </div>
      <div className="rounded-xl bg-rl-surface/50 border border-rl-border p-4">
        <MarkdownBlock content={pitch} />
      </div>
    </div>
  )
}
