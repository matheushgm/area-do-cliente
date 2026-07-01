import { Image as ImageIcon, ShieldCheck, Check, Minus, X, ArrowRight } from 'lucide-react'
import { APLICACAO_WIREFRAME } from './aplicacaoSchema'
import { Slot, MediaBox, SectionTag, CtaButton, WireframeEditProvider } from './wireframePrimitives'

// ─── Aplicação direta Wireframe ───────────────────────────────────────────────
// Esqueleto P&B da página de aplicação direta. Igual à LP de referência, mas a
// coluna direita do hero é um FORMULÁRIO (nome, e-mail, telefone) — captação já na
// primeira dobra. Slots editáveis quando `editable`. Imagens são placeholders.

const P = APLICACAO_WIREFRAME.placeholders

export default function AplicacaoWireframe({ content = {}, className = '', editable = false, onEdit = null }) {
  const c = { ...APLICACAO_WIREFRAME.emptyContent, ...content }
  const arr = (v, fb) => (v?.length ? v : fb)
  const E = APLICACAO_WIREFRAME.emptyContent

  return (
    <WireframeEditProvider editable={editable} onEdit={onEdit}>
    <div className={`bg-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200 text-slate-800 ${className}`}>

      {/* ── Header / logo ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center py-4 bg-slate-900">
        <div className="flex items-center gap-2 text-slate-500">
          <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Logo</span>
        </div>
      </div>

      {/* ── HERO (2 colunas: promessa · formulário) ──────────────────────── */}
      <section className="bg-slate-900 px-6 sm:px-10 py-10">
        <SectionTag onDark>Hero</SectionTag>
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* esquerda: promessa */}
          <div>
            <div className="inline-block rounded-full border border-slate-700 px-3 py-1 mb-4">
              <Slot value={c.heroBadge} placeholder={P.heroBadge} path="heroBadge"
                className="text-[9px] font-semibold uppercase tracking-widest text-slate-300" />
            </div>
            <Slot as="h1" value={c.headline} placeholder={P.headline} path="headline"
              className="block text-2xl sm:text-3xl font-extrabold text-white leading-tight" />
            <ul className="space-y-2 mt-5">
              {arr(c.heroBullets, E.heroBullets).map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <Slot value={b} placeholder={P.heroBullet} path={`heroBullets.${i}`} className="text-sm text-slate-200" />
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <Slot value={c.heroGuarantee} placeholder={P.heroGuarantee} path="heroGuarantee" />
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {arr(c.heroTags, E.heroTags).map((t, i) => (
                <span key={i} className="rounded-full border border-slate-700 px-3 py-1">
                  <Slot value={t} placeholder={P.heroTag} path={`heroTags.${i}`}
                    className="text-[9px] font-semibold uppercase tracking-widest text-slate-300" />
                </span>
              ))}
            </div>
          </div>
          {/* direita: FORMULÁRIO (nome, e-mail, telefone) */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <Slot as="p" value={c.heroFormTitle} placeholder={P.heroFormTitle} path="heroFormTitle"
              className="block text-sm font-bold text-white text-center mb-4" />
            {['Nome completo', 'E-mail', 'Telefone'].map((f) => (
              <div key={f} className="mb-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{f}</p>
                <div className="h-8 rounded-lg border border-slate-700 bg-slate-900" />
              </div>
            ))}
            <div className="mt-4 flex justify-center">
              <CtaButton value={c.heroFormCta} placeholder={P.heroFormCta} path="heroFormCta" onDark />
            </div>
          </div>
        </div>
      </section>

      {/* ── DORES & SOLUÇÕES ─────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 text-center">
        <SectionTag>Dores & soluções</SectionTag>
        <Slot as="h2" value={c.painsTitle} placeholder={P.painsTitle} path="painsTitle"
          className="block text-lg font-bold text-slate-800 max-w-2xl mx-auto" />
        <Slot as="p" value={c.painsSubtitle} placeholder={P.painsSubtitle} path="painsSubtitle"
          className="block text-xs text-slate-500 mt-2 max-w-xl mx-auto" />
        <div className="grid md:grid-cols-3 gap-3 mt-6 text-left">
          {arr(c.pains, E.pains).map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded bg-slate-300" />
                </div>
                <Slot value={p.pain} placeholder={P.painPain} path={`pains.${i}.pain`} multiline
                  className="text-xs font-bold text-slate-700 leading-snug" />
              </div>
              <div className="flex items-start gap-1.5 pl-1">
                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                <Slot value={p.solution} placeholder={P.painSolution} path={`pains.${i}.solution`} multiline
                  className="text-[10px] text-slate-500 leading-snug" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SEM × COM ────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-50 border-y border-slate-100">
        <SectionTag>Sem × Com</SectionTag>
        <Slot as="h2" value={c.comparisonTitle} placeholder={P.comparisonTitle} path="comparisonTitle"
          className="block text-lg font-bold text-slate-800 text-center max-w-2xl mx-auto mb-6" />
        <div className="grid md:grid-cols-2 gap-4">
          {/* sem */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center"><X className="w-3.5 h-3.5 text-slate-400" /></div>
              <Slot value={c.withoutTitle} placeholder={P.withoutTitle} path="withoutTitle"
                className="text-sm font-bold text-slate-700" />
            </div>
            <ul className="space-y-2">
              {arr(c.without, E.without).map((x, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Minus className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                  <Slot value={x} placeholder={P.withoutItem} path={`without.${i}`} className="text-xs text-slate-500" />
                </li>
              ))}
            </ul>
          </div>
          {/* com */}
          <div className="rounded-2xl border-2 border-slate-300 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>
              <Slot value={c.withTitle} placeholder={P.withTitle} path="withTitle"
                className="text-sm font-bold text-slate-800" />
            </div>
            <ul className="space-y-2">
              {arr(c.with, E.with).map((x, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                  <Slot value={x} placeholder={P.withItem} path={`with.${i}`} className="text-xs text-slate-700" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── AUTORIDADE & PROVA ───────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10">
        <SectionTag>Autoridade & prova</SectionTag>
        <div className="grid lg:grid-cols-2 gap-6 items-center">
          <div>
            <Slot as="h2" value={c.authorityTitle} placeholder={P.authorityTitle} path="authorityTitle"
              className="block text-lg font-bold text-slate-800 leading-snug" />
            <Slot as="p" value={c.authorityText} placeholder={P.authorityText} path="authorityText" multiline
              className="block text-xs text-slate-500 mt-2 leading-relaxed" />
          </div>
          <div className="relative">
            <MediaBox icon="image" label="Imagem" className="rounded-2xl aspect-[4/3] w-full" />
            <div className="mt-2">
              <Slot value={c.authorityCaption} placeholder={P.authorityCaption} path="authorityCaption"
                className="text-[10px] text-slate-400 italic" />
            </div>
          </div>
        </div>
        <Slot as="h3" value={c.resultsTitle} placeholder={P.resultsTitle} path="resultsTitle"
          className="block text-sm font-bold text-slate-700 mt-8 mb-3" />
        <div className="grid sm:grid-cols-3 gap-3">
          {arr(c.results, E.results).map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Slot as="p" value={r.value} placeholder={P.resultValue} path={`results.${i}.value`}
                className="block text-xl font-extrabold text-slate-900 leading-tight" />
              <Slot as="p" value={r.desc} placeholder={P.resultDesc} path={`results.${i}.desc`} multiline
                className="block text-[10px] text-slate-500 mt-1 leading-snug" />
            </div>
          ))}
        </div>
      </section>

      {/* ── O QUE RECEBE NA REUNIÃO (passos) ─────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-50 border-y border-slate-100">
        <SectionTag>O que recebe na reunião</SectionTag>
        <Slot as="h2" value={c.methodTitle} placeholder={P.methodTitle} path="methodTitle"
          className="block text-lg font-bold text-slate-800" />
        <Slot as="p" value={c.methodSubtitle} placeholder={P.methodSubtitle} path="methodSubtitle" multiline
          className="block text-xs text-slate-500 mt-2 max-w-2xl leading-relaxed" />
        <div className="space-y-3 mt-6">
          {arr(c.steps, E.steps).map((s, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr] gap-4 items-start rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col items-start gap-1 w-28 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white text-sm font-bold">{String(i + 1).padStart(2, '0')}</div>
                <Slot value={s.tag} placeholder={P.stepTag} path={`steps.${i}.tag`}
                  className="text-[8px] font-bold uppercase tracking-widest text-slate-400" />
              </div>
              <div>
                <Slot as="p" value={s.title} placeholder={P.stepTitle} path={`steps.${i}.title`}
                  className="block text-sm font-bold text-slate-800" />
                <Slot as="p" value={s.desc} placeholder={P.stepDesc} path={`steps.${i}.desc`} multiline
                  className="block text-[11px] text-slate-500 mt-1 leading-snug" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── OBJEÇÕES ─────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10">
        <SectionTag>Objeções</SectionTag>
        <Slot as="h2" value={c.objectionsTitle} placeholder={P.objectionsTitle} path="objectionsTitle"
          className="block text-lg font-bold text-slate-800 max-w-2xl mb-6" />
        <div className="grid md:grid-cols-3 gap-3">
          {arr(c.objections, E.objections).map((o, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-2 mb-2">
                <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <Slot value={o.objection} placeholder={P.objectionObjection} path={`objections.${i}.objection`} multiline
                  className="text-xs font-bold text-slate-700 leading-snug" />
              </div>
              <Slot as="p" value={o.rebuttal} placeholder={P.objectionRebuttal} path={`objections.${i}.rebuttal`} multiline
                className="block text-[10px] text-slate-500 leading-snug pl-6" />
            </div>
          ))}
        </div>
      </section>

      {/* ── FORMULÁRIO / CTA FINAL ───────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-900 text-center">
        <SectionTag onDark>Formulário / CTA final</SectionTag>
        <Slot as="h2" value={c.ctaTitle} placeholder={P.ctaTitle} path="ctaTitle"
          className="block text-lg font-bold text-white max-w-2xl mx-auto" />
        <Slot as="p" value={c.ctaSubtitle} placeholder={P.ctaSubtitle} path="ctaSubtitle" multiline
          className="block text-xs text-slate-300 mt-2 max-w-xl mx-auto" />
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 max-w-md mx-auto mt-6 text-left">
          {['Nome completo', 'E-mail', 'Telefone'].map((f) => (
            <div key={f} className="mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{f}</p>
              <div className="h-8 rounded-lg border border-slate-700 bg-slate-900" />
            </div>
          ))}
          <div className="mt-4 flex justify-center">
            <CtaButton value={c.formCta} placeholder={P.formCta} path="formCta" onDark />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Logo</span>
        </div>
        <Slot value={c.footerNote} placeholder={P.footerNote} path="footerNote"
          className="text-[9px] text-slate-500 text-right" />
      </footer>
    </div>
    </WireframeEditProvider>
  )
}
