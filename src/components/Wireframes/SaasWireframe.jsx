import { Image as ImageIcon, Check, Plus, Sparkles } from 'lucide-react'
import { SAAS_WIREFRAME } from './saasSchema'
import { Slot, MediaBox, SectionTag, CtaButton, WireframeEditProvider } from './wireframePrimitives'

// ─── SaaS / Produto Wireframe ─────────────────────────────────────────────────
// Esqueleto P&B de página de produto SaaS (referência: templates modernos de
// software, tipo Pluggo/Webflow). Hero centralizado com captura de e-mail em uma
// linha e o print da ferramenta logo abaixo, seguido de diferenciais, recursos,
// prova com métrica, CTA intermediário, FAQ e CTA final.
// DIFERENÇA para Aplicação/Webinar: a conversão é o próprio produto (teste grátis),
// não uma reunião. Por isso o formulário tem um campo só.

const P = SAAS_WIREFRAME.placeholders

export default function SaasWireframe({ content = {}, className = '', editable = false, onEdit = null }) {
  const c = { ...SAAS_WIREFRAME.emptyContent, ...content }
  const arr = (v, fb) => (v?.length ? v : fb)
  const E = SAAS_WIREFRAME.emptyContent

  return (
    <WireframeEditProvider editable={editable} onEdit={onEdit}>
    <div className={`bg-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200 text-slate-800 ${className}`}>

      {/* ── Header / nav ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-6 sm:px-10 py-3.5 bg-slate-900">
        <div className="flex items-center gap-2 text-slate-500">
          <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Logo</span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          {arr(c.navLinks, E.navLinks).map((l, i) => (
            <Slot key={i} value={l} placeholder={P.navLink} path={`navLinks.${i}`}
              className="text-[9px] font-semibold uppercase tracking-widest text-slate-400" />
          ))}
        </div>
        <span className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-full bg-white">
          <Slot value={c.navCta} placeholder={P.navCta} path="navCta"
            className="text-[9px] font-bold text-slate-900 outline-none" />
        </span>
      </div>

      {/* ── HERO (centralizado: selo → headline → sub → e-mail → print) ──── */}
      <section className="bg-slate-900 px-6 sm:px-10 pt-10 pb-0 text-center">
        <div><SectionTag onDark>Hero</SectionTag></div>
        <div className="inline-block rounded-full border border-slate-700 px-3 py-1 mb-4">
          <Slot value={c.heroBadge} placeholder={P.heroBadge} path="heroBadge"
            className="text-[9px] font-semibold uppercase tracking-widest text-slate-300" />
        </div>
        <Slot as="h1" value={c.headline} placeholder={P.headline} path="headline"
          className="block text-2xl sm:text-4xl font-extrabold text-white leading-tight max-w-3xl mx-auto" />
        <Slot as="p" value={c.heroSubheadline} placeholder={P.heroSubheadline} path="heroSubheadline" multiline
          className="block text-xs text-slate-300 mt-4 max-w-xl mx-auto leading-relaxed" />

        {/* form de 1 campo: e-mail + botão, na mesma linha */}
        <div className="mt-7 max-w-md mx-auto flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 p-1.5">
          <div className="flex-1 px-4 text-left">
            <Slot value={c.heroFormPlaceholder} placeholder={P.heroFormPlaceholder} path="heroFormPlaceholder"
              className="text-[10px] text-slate-500" />
          </div>
          <CtaButton value={c.heroCta} placeholder={P.heroCta} path="heroCta" onDark />
        </div>

        {/* print do produto: encostado na borda inferior, como nos templates SaaS */}
        <div className="mt-8 -mb-px">
          <MediaBox icon="image" label="Screenshot do produto" className="h-44 rounded-t-2xl border-b-0" />
          <Slot as="p" value={c.heroImageCaption} placeholder={P.heroImageCaption} path="heroImageCaption"
            className="block text-[9px] text-slate-500 mt-2 pb-4" />
        </div>
      </section>

      {/* ── DIFERENCIAIS (3 cards) ───────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 text-center">
        <SectionTag>Diferenciais</SectionTag>
        <Slot value={c.featuresEyebrow} placeholder={P.featuresEyebrow} path="featuresEyebrow"
          className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2" />
        <Slot as="h2" value={c.featuresTitle} placeholder={P.featuresTitle} path="featuresTitle"
          className="block text-lg font-bold text-slate-800 max-w-2xl mx-auto" />
        <Slot as="p" value={c.featuresSubtitle} placeholder={P.featuresSubtitle} path="featuresSubtitle" multiline
          className="block text-xs text-slate-500 mt-2 max-w-xl mx-auto" />
        <div className="grid md:grid-cols-3 gap-3 mt-6 text-left">
          {arr(c.features, E.features).map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center mb-3">
                <Sparkles className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <Slot as="p" value={f.title} placeholder={P.featureTitle} path={`features.${i}.title`}
                className="block text-xs font-bold text-slate-700 mb-1.5" />
              <Slot as="p" value={f.desc} placeholder={P.featureDesc} path={`features.${i}.desc`} multiline
                className="block text-[10px] text-slate-500 leading-snug" />
            </div>
          ))}
        </div>
      </section>

      {/* ── RECURSOS DO PRODUTO (5 blocos com print) ─────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-50 border-y border-slate-100">
        <div className="text-center">
          <SectionTag>Recursos do produto</SectionTag>
          <Slot value={c.howEyebrow} placeholder={P.howEyebrow} path="howEyebrow"
            className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2" />
          <Slot as="h2" value={c.howTitle} placeholder={P.howTitle} path="howTitle"
            className="block text-lg font-bold text-slate-800 max-w-2xl mx-auto" />
          <Slot as="p" value={c.howSubtitle} placeholder={P.howSubtitle} path="howSubtitle" multiline
            className="block text-xs text-slate-500 mt-2 max-w-xl mx-auto" />
        </div>
        {/* bento: os 2 primeiros em destaque, os 3 seguintes menores */}
        <div className="grid md:grid-cols-2 gap-3 mt-6">
          {arr(c.howItems, E.howItems).slice(0, 2).map((h, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <MediaBox icon="image" label="Print da tela" className="h-24 rounded-xl mb-3" />
              <Slot as="p" value={h.title} placeholder={P.howItemTitle} path={`howItems.${i}.title`}
                className="block text-xs font-bold text-slate-700 mb-1" />
              <Slot as="p" value={h.desc} placeholder={P.howItemDesc} path={`howItems.${i}.desc`} multiline
                className="block text-[10px] text-slate-500 leading-snug" />
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-3">
          {arr(c.howItems, E.howItems).slice(2, 5).map((h, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5">
                <Check className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <Slot as="p" value={h.title} placeholder={P.howItemTitle} path={`howItems.${i + 2}.title`}
                className="block text-xs font-bold text-slate-700 mb-1" />
              <Slot as="p" value={h.desc} placeholder={P.howItemDesc} path={`howItems.${i + 2}.desc`} multiline
                className="block text-[10px] text-slate-500 leading-snug" />
            </div>
          ))}
        </div>
      </section>

      {/* ── PROVA SOCIAL (depoimento com métrica) ────────────────────────── */}
      <section className="px-6 sm:px-10 py-10">
        <div className="text-center">
          <SectionTag>Prova social</SectionTag>
          <Slot value={c.proofEyebrow} placeholder={P.proofEyebrow} path="proofEyebrow"
            className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2" />
          <Slot as="h2" value={c.proofTitle} placeholder={P.proofTitle} path="proofTitle"
            className="block text-lg font-bold text-slate-800 max-w-2xl mx-auto" />
          <Slot as="p" value={c.proofSubtitle} placeholder={P.proofSubtitle} path="proofSubtitle" multiline
            className="block text-xs text-slate-500 mt-2 max-w-xl mx-auto" />
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-6">
          {arr(c.testimonials, E.testimonials).map((t, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <Slot as="p" value={t.metric} placeholder={P.testimonialMetric} path={`testimonials.${i}.metric`}
                className="block text-2xl font-extrabold text-slate-800 leading-none" />
              <Slot as="p" value={t.metricLabel} placeholder={P.testimonialMetricLabel} path={`testimonials.${i}.metricLabel`}
                className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1.5" />
              <Slot as="p" value={t.quote} placeholder={P.testimonialQuote} path={`testimonials.${i}.quote`} multiline
                className="block text-[11px] text-slate-600 leading-snug mt-4 pt-4 border-t border-slate-200" />
              <div className="flex items-center gap-2.5 mt-4">
                <MediaBox icon="user" label="" className="w-8 h-8 rounded-full shrink-0" />
                <div>
                  <Slot as="p" value={t.name} placeholder={P.testimonialName} path={`testimonials.${i}.name`}
                    className="block text-[10px] font-bold text-slate-700" />
                  <Slot as="p" value={t.role} placeholder={P.testimonialRole} path={`testimonials.${i}.role`}
                    className="block text-[9px] text-slate-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA INTERMEDIÁRIO ────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-50 border-y border-slate-100">
        <SectionTag>CTA intermediário</SectionTag>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <Slot as="h2" value={c.midCtaTitle} placeholder={P.midCtaTitle} path="midCtaTitle"
              className="block text-lg font-bold text-slate-800 leading-snug" />
            <Slot as="p" value={c.midCtaText} placeholder={P.midCtaText} path="midCtaText" multiline
              className="block text-xs text-slate-500 mt-2.5 leading-relaxed" />
            <div className="mt-5">
              <CtaButton value={c.midCtaButton} placeholder={P.midCtaButton} path="midCtaButton" />
            </div>
          </div>
          <MediaBox icon="image" label="Imagem de apoio" className="h-36 rounded-2xl" />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10">
        <div className="text-center">
          <SectionTag>FAQ</SectionTag>
          <Slot value={c.faqEyebrow} placeholder={P.faqEyebrow} path="faqEyebrow"
            className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2" />
          <Slot as="h2" value={c.faqTitle} placeholder={P.faqTitle} path="faqTitle"
            className="block text-lg font-bold text-slate-800 mb-6" />
        </div>
        <div className="max-w-2xl mx-auto space-y-2">
          {arr(c.faqs, E.faqs).map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <Slot value={f.q} placeholder={P.faqQ} path={`faqs.${i}.q`} multiline
                  className="text-xs font-bold text-slate-700 leading-snug" />
                <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              </div>
              <Slot as="p" value={f.a} placeholder={P.faqA} path={`faqs.${i}.a`} multiline
                className="block text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-slate-200" />
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-900 text-center">
        <SectionTag onDark>CTA final</SectionTag>
        <Slot as="h2" value={c.finalCtaTitle} placeholder={P.finalCtaTitle} path="finalCtaTitle"
          className="block text-xl font-bold text-white max-w-2xl mx-auto" />
        <Slot as="p" value={c.finalCtaSubtitle} placeholder={P.finalCtaSubtitle} path="finalCtaSubtitle" multiline
          className="block text-xs text-slate-300 mt-3 max-w-xl mx-auto leading-relaxed" />
        <div className="mt-6">
          <CtaButton value={c.finalCtaButton} placeholder={P.finalCtaButton} path="finalCtaButton" onDark />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Logo</span>
        </div>
        <div className="flex items-center gap-3">
          <Slot value={c.footerTitle} placeholder={P.footerTitle} path="footerTitle"
            className="text-[9px] text-slate-500 text-right" />
          <CtaButton value={c.footerCta} placeholder={P.footerCta} path="footerCta" onDark />
        </div>
      </footer>
    </div>
    </WireframeEditProvider>
  )
}
