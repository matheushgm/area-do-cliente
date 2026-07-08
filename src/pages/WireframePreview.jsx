// TEMP — não commitar
import { useState } from 'react'
import WebinarWireframe from '../components/Wireframes/WebinarWireframe'
import { setByPath } from '../components/Wireframes/wireframePrimitives'

const SAMPLE = {
  heroBadge: 'Metodologia de agendamento de reunião qualificada',
  headline: 'Crie uma **máquina de reuniões qualificadas** na sua empresa em 35 dias',
  heroBullets: ['Sem depender de indicação', 'Sem contratar mais vendedores', 'Mesmo com produto nichado'],
  heroCta: 'Quero gerar reuniões qualificadas',
  heroGuarantee: 'Garantia blindada',
  heroTags: ['Previsível', 'Sem indicação', 'Dados, não achismo'],
  heroMetricLabel: 'Reuniões qualificadas',
  heroMetricValue: '+4x na agenda',
  heroMetricSub: 'em menos de 60 dias',
  painsTitle: 'Você se pega nesses problemas por não conseguir agendar reuniões?',
  painsSubtitle: 'Reconhece alguma dessas situações? Para cada uma já temos a saída pronta.',
  pains: [
    { pain: 'Vive no modo caça de clientes, esperando alguém lembrar do seu nome?', solution: 'Uma máquina de leads qualificados que trabalha 24h por dia.' },
    { pain: 'Time comercial parado, caçando contato no LinkedIn?', solution: 'Leads todos os dias direto na agenda do vendedor.' },
    { pain: 'Já tentou prospecção ativa e nada traciona rápido?', solution: 'Resultado em 14 dias, sem esperar 6 meses.' },
  ],
  comparisonTitle: 'Sua empresa sem × sua empresa com uma metodologia de agendamento',
  withoutTitle: 'Sua empresa sem método',
  without: ['Refém de indicação e da sorte', 'Time ocioso caçando contato', 'Sem saber se bate a meta', 'Medo de crescer', 'Invisível enquanto a concorrência cresce'],
  withTitle: 'Com a metodologia de agendamento',
  with: ['Máquina de leads rodando 24h', 'Agenda do comercial cheia', 'Previsibilidade de receita', 'Cresce o time com segurança', 'Na frente do público certo'],
  authorityTitle: 'Especialistas em transformar empresas de 100k/mês em **máquinas previsíveis de receita**',
  authorityText: 'Não somos mais uma agência genérica que sobe campanha e torce. Somos obcecados por funil de vendas e métricas que impactam resultado real.',
  authorityCaption: 'Estratégia, processos e tecnologia para sistemas de receita',
  resultsTitle: 'Resultados reais que entregamos',
  results: [
    { value: 'R$100k → R$500k', desc: 'de faturamento com tráfego e embalagem de oferta.' },
    { value: '+4x reuniões', desc: 'Agendamentos multiplicados em menos de 60 dias.' },
    { value: 'Retorno de 3x a 7x', desc: 'Alto ticket com leads prontos para fechar.' },
  ],
  methodTitle: 'O que você vai receber na nossa **reunião estratégica**',
  methodSubtitle: 'Não é uma call de vendas. Você sai com clareza total do que está travando sua geração de reuniões.',
  steps: [
    { tag: 'Na reunião', title: 'Diagnóstico completo do seu funil', desc: 'Raio-x dos gargalos que travam suas vendas.' },
    { tag: 'O caminho', title: 'Como aplicar a metodologia', desc: 'Passo a passo adaptado à sua realidade.' },
    { tag: 'Provas reais', title: 'Cases de quem vende por reunião', desc: 'Como geramos 3 a 4x mais reuniões.' },
    { tag: 'Próximo passo', title: 'Seu próximo passo para fazer o mesmo', desc: 'Plano claro para encher sua agenda.' },
  ],
  objectionsTitle: 'As desculpas que te impedem de agendar — e por que nenhuma se sustenta',
  objections: [
    { objection: 'Depois eu marco essa reunião.', rebuttal: 'Esse "depois" é o motivo da agenda vazia. O melhor momento é agora.' },
    { objection: 'Estou muito corrido.', rebuttal: 'É por estar corrido que você precisa dessa reunião.' },
    { objection: 'Não sei se vai valer a pena.', rebuttal: 'É gratuita e sem compromisso. Você sai com um diagnóstico.' },
  ],
  ctaTitle: 'Agende uma reunião gratuita e receba um diagnóstico completo do seu funil',
  ctaSubtitle: 'Se você fatura mais de R$ 40.000, vai entender como aplicar a metodologia.',
  formCta: 'Quero gerar leads qualificados agora',
  footerNote: 'Laboratório de Receita · Estratégia, processos e tecnologia.',
}

export default function WireframePreview() {
  const [content, setContent] = useState(SAMPLE)
  const [editing, setEditing] = useState(false)
  return (
    <div className="min-h-screen bg-gradient-dark py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-rl-text">Preview — Wireframe Webinar</h1>
            <p className="text-sm text-rl-muted mt-1">Clique em "Editar" e edite qualquer texto direto no wireframe.</p>
          </div>
          <button onClick={() => setEditing((v) => !v)} className="btn-primary text-sm">
            {editing ? 'Concluir edição' : 'Editar texto'}
          </button>
        </header>
        <section>
          <p className="text-xs font-bold text-rl-muted uppercase tracking-wider mb-3">Com copy aplicada {editing && '· (editável)'}</p>
          <WebinarWireframe content={content} editable={editing} onEdit={(p, v) => setContent((c) => setByPath(c, p, v))} />
        </section>
        <section>
          <p className="text-xs font-bold text-rl-muted uppercase tracking-wider mb-3">Vazio (placeholders-guia)</p>
          <WebinarWireframe content={{}} />
        </section>
      </div>
    </div>
  )
}
