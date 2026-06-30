import { Image as ImageIcon, ShieldCheck, Check } from 'lucide-react'
import { VSL_WIREFRAME } from './vslSchema'
import { Slot, MediaBox, SectionTag, CtaButton, WireframeEditProvider } from './wireframePrimitives'

// ─── VSL Wireframe ────────────────────────────────────────────────────────────
// Renderização visual (sem imagens reais) da página VSL. Recebe `content` no shape
// de `VSL_WIREFRAME.emptyContent`; cada slot vazio cai no placeholder-guia.
// Em modo `editable`, cada slot vira editável e chama `onEdit(path, valor)`.

const P = VSL_WIREFRAME.placeholders

export default function VSLWireframe({ content = {}, className = '', editable = false, onEdit = null }) {
  const c = { ...VSL_WIREFRAME.emptyContent, ...content }
  const cards = c.cards?.length ? c.cards : VSL_WIREFRAME.emptyContent.cards
  const bullets = c.bullets?.length ? c.bullets : VSL_WIREFRAME.emptyContent.bullets
  const testimonials = c.testimonials?.length ? c.testimonials : VSL_WIREFRAME.emptyContent.testimonials

  return (
    <WireframeEditProvider editable={editable} onEdit={onEdit}>
    <div className={`bg-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200 text-slate-800 ${className}`}>

      {/* ── Barra de anúncio ─────────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white text-center text-[10px] py-1.5 px-4">
        <Slot value={c.announcement} placeholder={P.announcement} path="announcement" className="text-white/90" />
      </div>

      {/* ── Header / logo ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center py-4 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-400">
          <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Logo</span>
        </div>
      </div>

      {/* ── Hero (headline + vídeo VSL + CTA) ────────────────────────────── */}
      <section className="bg-slate-900 px-6 sm:px-10 py-10 text-center">
        <SectionTag onDark>Hero</SectionTag>
        <Slot as="h1" value={c.headline} placeholder={P.headline} path="headline"
          className="block text-2xl sm:text-3xl font-extrabold text-white leading-tight max-w-2xl mx-auto" />
        <Slot as="p" value={c.subheadline} placeholder={P.subheadline} path="subheadline" multiline
          className="block text-sm text-slate-300 mt-3 max-w-xl mx-auto leading-relaxed" />
        <MediaBox icon="play" label="Vídeo VSL" className="!bg-slate-800 !border-slate-700 !text-slate-500 rounded-xl aspect-video max-w-xl mx-auto mt-6" />
        <div className="mt-6">
          <CtaButton value={c.heroCta} placeholder={P.heroCta} path="heroCta" onDark />
        </div>
      </section>

      {/* ── Para quem é a oferta (4 cards) ───────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 text-center">
        <SectionTag>Para quem é a oferta</SectionTag>
        <Slot as="h2" value={c.forWhomTitle} placeholder={P.forWhomTitle} path="forWhomTitle"
          className="block text-lg font-bold text-slate-800 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.slice(0, 4).map((card, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center mb-2.5">
                <div className="w-3.5 h-3.5 rounded bg-slate-300" />
              </div>
              <Slot as="p" value={card.title} placeholder={P.cardTitle} path={`cards.${i}.title`}
                className="block text-xs font-bold text-slate-700" />
              <Slot as="p" value={card.desc} placeholder={P.cardDesc} path={`cards.${i}.desc`} multiline
                className="block text-[10px] text-slate-500 mt-1 leading-snug" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Oferta / desconto ────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-50 border-y border-slate-100">
        <SectionTag>Oferta</SectionTag>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <Slot as="h2" value={c.offerTitle} placeholder={P.offerTitle} path="offerTitle"
              className="block text-lg font-bold text-slate-800" />
            <Slot as="p" value={c.offerText} placeholder={P.offerText} path="offerText" multiline
              className="block text-xs text-slate-500 mt-2 leading-relaxed" />
          </div>
          <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6 text-center">
            <Slot as="p" value={c.discountValue} placeholder={P.discountValue} path="discountValue"
              className="block text-4xl font-extrabold text-slate-900 leading-none" />
            <Slot as="p" value={c.discountLabel} placeholder={P.discountLabel} path="discountLabel"
              className="block text-sm font-semibold text-slate-700 mt-1" />
            <div className="mt-4">
              <CtaButton value={c.offerCta} placeholder={P.offerCta} path="offerCta" />
            </div>
          </div>
        </div>
      </section>

      {/* ── História / prova social ──────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10">
        <SectionTag>Prova social</SectionTag>
        <div className="grid md:grid-cols-[200px_1fr] gap-6 items-center">
          <MediaBox icon="user" label="Foto" className="rounded-xl aspect-square w-full max-w-[200px]" />
          <div>
            <Slot as="h2" value={c.storyTitle} placeholder={P.storyTitle} path="storyTitle"
              className="block text-lg font-bold text-slate-800" />
            <Slot as="p" value={c.storyText} placeholder={P.storyText} path="storyText" multiline
              className="block text-xs text-slate-500 mt-2 leading-relaxed" />
          </div>
        </div>
      </section>

      {/* ── Oportunidade única (preço) ───────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-900">
        <SectionTag onDark>Preço</SectionTag>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <Slot as="h2" value={c.opportunityTitle} placeholder={P.opportunityTitle} path="opportunityTitle"
              className="block text-lg font-bold text-white mb-4" />
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <Slot value={b} placeholder={P.bullet} path={`bullets.${i}`} className="text-xs text-slate-300" />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white p-6 text-center text-slate-900">
            <Slot as="p" value={c.priceLabel} placeholder={P.priceLabel} path="priceLabel"
              className="block text-[11px] text-slate-500" />
            <Slot as="p" value={c.price} placeholder={P.price} path="price"
              className="block text-3xl font-extrabold leading-none mt-1 text-slate-900" />
            <Slot as="p" value={c.priceSecondary} placeholder={P.priceSecondary} path="priceSecondary"
              className="block text-[11px] text-slate-500 mt-1" />
            <div className="mt-4">
              <CtaButton value={c.priceCta} placeholder={P.priceCta} path="priceCta" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Depoimentos ──────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10">
        <SectionTag>Depoimentos</SectionTag>
        <div className="grid sm:grid-cols-3 gap-3">
          {testimonials.slice(0, 3).map((t, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <Slot as="p" value={t.text} placeholder={P.testimonialText} path={`testimonials.${i}.text`} multiline
                className="block text-[11px] text-slate-600 leading-snug" />
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-3 h-3 text-slate-300" />
                </div>
                <div className="min-w-0">
                  <Slot as="p" value={t.name} placeholder={P.testimonialName} path={`testimonials.${i}.name`}
                    className="block text-[11px] font-bold text-slate-700 truncate" />
                  <Slot as="p" value={t.role} placeholder={P.testimonialRole} path={`testimonials.${i}.role`}
                    className="block text-[9px] text-slate-400 truncate" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-5 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[8px] font-bold uppercase tracking-widest">Logo</span>
        </div>
        <span className="text-[8px] text-slate-600 uppercase tracking-widest flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Rodapé / copyright
        </span>
      </footer>
    </div>
    </WireframeEditProvider>
  )
}
