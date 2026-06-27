import { Image as ImageIcon, Play, User, ShieldCheck, Check } from 'lucide-react'
import { VSL_WIREFRAME } from './vslSchema'

// ─── VSL Wireframe ────────────────────────────────────────────────────────────
// Renderização visual (sem imagens reais) da página VSL. Recebe `content` no shape
// de `VSL_WIREFRAME.emptyContent`; cada slot vazio cai no placeholder-guia.
// O objetivo é o cliente/designer enxergarem o COPY aplicado no layout — não é a
// página final, é o esqueleto com o texto encaixado.

const P = VSL_WIREFRAME.placeholders

// Texto de um slot: valor real (preto) ou placeholder-guia (cinza itálico).
// Suporta **negrito** → realce em accent.
function Slot({ value, placeholder, className = '', as: Tag = 'span' }) {
  const has = typeof value === 'string' && value.trim().length > 0
  const content = has ? value : placeholder
  return (
    <Tag className={`${className} ${has ? '' : 'text-slate-400 italic font-normal'}`}>
      {has ? renderEmphasis(value) : content}
    </Tag>
  )
}

// Converte **trecho** em <span> destacado.
function renderEmphasis(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <span key={i} className="text-orange-500">{p.replace(/\*\*/g, '')}</span>
      : <span key={i}>{p}</span>
  )
}

// Caixa-placeholder de mídia (imagem / vídeo / avatar).
function MediaBox({ icon: Icon, label, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 ${className}`}>
      <Icon className="w-6 h-6" strokeWidth={1.5} />
      <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
    </div>
  )
}

// Pequena etiqueta de seção (orienta o designer).
function SectionTag({ children }) {
  return (
    <span className="inline-block text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mb-3">
      {children}
    </span>
  )
}

// Botão (CTA) em estilo wireframe.
function CtaButton({ value, placeholder, accent = false }) {
  const has = value && value.trim()
  return (
    <span
      className={`inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-xs font-bold ${
        accent ? 'bg-orange-500 text-white' : 'bg-slate-800 text-white'
      } ${has ? '' : 'opacity-60'}`}
    >
      {has ? value : placeholder}
    </span>
  )
}

export default function VSLWireframe({ content = {}, className = '' }) {
  const c = { ...VSL_WIREFRAME.emptyContent, ...content }
  const cards = c.cards?.length ? c.cards : VSL_WIREFRAME.emptyContent.cards
  const bullets = c.bullets?.length ? c.bullets : VSL_WIREFRAME.emptyContent.bullets
  const testimonials = c.testimonials?.length ? c.testimonials : VSL_WIREFRAME.emptyContent.testimonials

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200 text-slate-800 ${className}`}>

      {/* ── Barra de anúncio ─────────────────────────────────────────────── */}
      <div className="bg-orange-500 text-white text-center text-[10px] py-1.5 px-4">
        <Slot value={c.announcement} placeholder={P.announcement} className="text-white/90" />
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
        <span className="inline-block text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full mb-4">
          Hero
        </span>
        <Slot
          as="h1"
          value={c.headline}
          placeholder={P.headline}
          className="block text-2xl sm:text-3xl font-extrabold text-white leading-tight max-w-2xl mx-auto"
        />
        <Slot
          as="p"
          value={c.subheadline}
          placeholder={P.subheadline}
          className="block text-sm text-slate-300 mt-3 max-w-xl mx-auto leading-relaxed"
        />
        <MediaBox icon={Play} label="Vídeo VSL" className="!bg-slate-800 !border-slate-700 !text-slate-500 rounded-xl aspect-video max-w-xl mx-auto mt-6" />
        <div className="mt-6">
          <CtaButton value={c.heroCta} placeholder={P.heroCta} accent />
        </div>
      </section>

      {/* ── Para quem é a oferta (4 cards) ───────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 text-center">
        <SectionTag>Para quem é a oferta</SectionTag>
        <Slot
          as="h2"
          value={c.forWhomTitle}
          placeholder={P.forWhomTitle}
          className="block text-lg font-bold text-slate-800 mb-6"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.slice(0, 4).map((card, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center mb-2.5">
                <div className="w-3.5 h-3.5 rounded bg-slate-300" />
              </div>
              <Slot
                as="p"
                value={card.title}
                placeholder={P.cardTitle}
                className="block text-xs font-bold text-slate-700"
              />
              <Slot
                as="p"
                value={card.desc}
                placeholder={P.cardDesc}
                className="block text-[10px] text-slate-500 mt-1 leading-snug"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Oferta / desconto ────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-50 border-y border-slate-100">
        <SectionTag>Oferta</SectionTag>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <Slot
              as="h2"
              value={c.offerTitle}
              placeholder={P.offerTitle}
              className="block text-lg font-bold text-slate-800"
            />
            <Slot
              as="p"
              value={c.offerText}
              placeholder={P.offerText}
              className="block text-xs text-slate-500 mt-2 leading-relaxed"
            />
          </div>
          <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-6 text-center">
            <Slot
              as="p"
              value={c.discountValue}
              placeholder={P.discountValue}
              className="block text-4xl font-extrabold text-orange-500 leading-none"
            />
            <Slot
              as="p"
              value={c.discountLabel}
              placeholder={P.discountLabel}
              className="block text-sm font-semibold text-slate-700 mt-1"
            />
            <div className="mt-4">
              <CtaButton value={c.offerCta} placeholder={P.offerCta} />
            </div>
          </div>
        </div>
      </section>

      {/* ── História / prova social ──────────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10">
        <SectionTag>Prova social</SectionTag>
        <div className="grid md:grid-cols-[200px_1fr] gap-6 items-center">
          <MediaBox icon={User} label="Foto" className="rounded-xl aspect-square w-full max-w-[200px]" />
          <div>
            <Slot
              as="h2"
              value={c.storyTitle}
              placeholder={P.storyTitle}
              className="block text-lg font-bold text-slate-800"
            />
            <Slot
              as="p"
              value={c.storyText}
              placeholder={P.storyText}
              className="block text-xs text-slate-500 mt-2 leading-relaxed"
            />
          </div>
        </div>
      </section>

      {/* ── Oportunidade única (preço) ───────────────────────────────────── */}
      <section className="px-6 sm:px-10 py-10 bg-slate-900">
        <span className="inline-block text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full mb-3">
          Preço
        </span>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <Slot
              as="h2"
              value={c.opportunityTitle}
              placeholder={P.opportunityTitle}
              className="block text-lg font-bold text-white mb-4"
            />
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  <Slot value={b} placeholder={P.bullet} className="text-xs text-slate-300" />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-center text-white">
            <Slot
              as="p"
              value={c.priceLabel}
              placeholder={P.priceLabel}
              className="block text-[11px] text-white/80"
            />
            <Slot
              as="p"
              value={c.price}
              placeholder={P.price}
              className="block text-3xl font-extrabold leading-none mt-1"
            />
            <Slot
              as="p"
              value={c.priceSecondary}
              placeholder={P.priceSecondary}
              className="block text-[11px] text-white/80 mt-1"
            />
            <div className="mt-4">
              <span className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-xs font-bold bg-white text-orange-600">
                {c.priceCta?.trim() || P.priceCta}
              </span>
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
              <Slot
                as="p"
                value={t.text}
                placeholder={P.testimonialText}
                className="block text-[11px] text-slate-600 leading-snug"
              />
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-slate-300" />
                </div>
                <div className="min-w-0">
                  <Slot
                    as="p"
                    value={t.name}
                    placeholder={P.testimonialName}
                    className="block text-[11px] font-bold text-slate-700 truncate"
                  />
                  <Slot
                    as="p"
                    value={t.role}
                    placeholder={P.testimonialRole}
                    className="block text-[9px] text-slate-400 truncate"
                  />
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
  )
}
