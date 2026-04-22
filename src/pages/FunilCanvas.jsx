import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Modal from '../components/UI/Modal'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { fmtCurrency } from '../lib/utils'
import {
  GitFork, Zap, Menu, Plus, Trash2, Copy,
  AlertCircle, ChevronDown, ChevronUp,
  BarChart3, TrendingUp, DollarSign, Users,
  ArrowRight, Settings, X, Check, ChevronLeft, Pencil, Layers,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const NODE_W        = 200
const NODE_H        = 168
const PORT_R        = 7
const LS_KEY        = 'rl_funil_canvas'
const MAX_SCENARIOS = 3
const CANVAS_W      = 3000
const CANVAS_H      = 2000

const NODE_TYPES = [
  // ── Traffic sources ──────────────────────────────────────────────────────────
  { type: 'meta',        label: 'Meta Ads',             accent: 'border-blue-300 bg-blue-50',        text: 'text-blue-600'     },
  { type: 'google',      label: 'Google Ads',            accent: 'border-red-300 bg-red-50',          text: 'text-red-600'      },
  { type: 'remarketing', label: 'Remarketing Meta',      accent: 'border-sky-300 bg-sky-50',          text: 'text-sky-600'      },
  // ── Pages ────────────────────────────────────────────────────────────────────
  { type: 'optinpage',   label: 'Opt-in / Captação',    accent: 'border-purple-300 bg-purple-50',    text: 'text-purple-600'   },
  { type: 'thankyou',    label: 'Obrigado',              accent: 'border-green-300 bg-green-50',      text: 'text-green-600'    },
  { type: 'salespage',   label: 'Página de Vendas',      accent: 'border-yellow-300 bg-yellow-50',    text: 'text-yellow-600'   },
  { type: 'apppage',     label: 'Pág. de Aplicação',     accent: 'border-amber-300 bg-amber-50',      text: 'text-amber-600'    },
  { type: 'custompage',  label: 'Página Personalizada',  accent: 'border-fuchsia-300 bg-fuchsia-50',  text: 'text-fuchsia-600'  },
  // ── Sales & checkout ─────────────────────────────────────────────────────────
  { type: 'orderform',   label: 'Order Form / Compra',   accent: 'border-emerald-300 bg-emerald-50',  text: 'text-emerald-600'  },
  // ── Communication ────────────────────────────────────────────────────────────
  { type: 'email',       label: 'E-mail',                accent: 'border-cyan-300 bg-cyan-50',        text: 'text-cyan-600'     },
  { type: 'whatsapp',    label: 'WhatsApp',              accent: 'border-green-400 bg-green-50',      text: 'text-green-700'    },
  { type: 'call',        label: 'Ligação',               accent: 'border-lime-300 bg-lime-50',        text: 'text-lime-700'     },
  { type: 'webinar',     label: 'Webinar',               accent: 'border-violet-300 bg-violet-50',    text: 'text-violet-600'   },
  { type: 'meeting',     label: 'Reunião de Venda',      accent: 'border-indigo-300 bg-indigo-50',    text: 'text-indigo-600'   },
  // ── Utilities ────────────────────────────────────────────────────────────────
  { type: 'wait',        label: 'Aguardar',              accent: 'border-gray-300 bg-gray-50',        text: 'text-gray-500'     },
  { type: 'upsell',      label: 'Upsell',                accent: 'border-orange-300 bg-orange-50',    text: 'text-orange-600'   },
  { type: 'downsell',    label: 'Downsell',              accent: 'border-teal-300 bg-teal-50',        text: 'text-teal-600'     },
  { type: 'textlabel',   label: 'Texto Personalizado',   accent: 'border-slate-300 bg-slate-50',      text: 'text-slate-500'    },
]

// Traffic source types (no input port, appear at the top of the funnel)
const TRAFFIC_TYPES = ['meta', 'google']

const DEFAULT_CONV = {
  // Traffic
  meta: 100, google: 100, remarketing: 25,
  // Pages
  optinpage: 30, thankyou: 100, salespage: 5, apppage: 10, custompage: 50,
  // Sales
  orderform: 80,
  // Communication
  email: 100, whatsapp: 60, call: 40, webinar: 30, meeting: 50,
  // Utilities
  wait: 100, upsell: 20, downsell: 30, textlabel: 100,
}

const NO_INPUT_TYPES  = TRAFFIC_TYPES
// Nodes where a purchase/sale conversion occurs (used to identify final_sales)
const SALE_TYPES      = ['orderform', 'salespage']
const OPTIN_TYPES     = ['optinpage']

function getNodeDef(type) {
  return NODE_TYPES.find(n => n.type === type) || NODE_TYPES[0]
}

// ─── NodeIcon — wireframe SVG icons (Geru-style) ──────────────────────────────
function NodeIcon({ type, size = 36 }) {
  const W = 40, H = 52   // page-type viewBox

  // ── Browser frame shared elements ──
  const frame = (
    <>
      <rect x="0.75" y="0.75" width="38.5" height="50.5" rx="3.5"
        fill="white" stroke="#9CA3AF" strokeWidth="1.5"/>
      <rect x="0.75" y="0.75" width="38.5" height="8.5" rx="3.5" fill="#E5E7EB"/>
      <rect x="0.75" y="5" width="38.5" height="4.5" fill="#E5E7EB"/>
      <line x1="0.75" y1="9.25" x2="39.25" y2="9.25" stroke="#D1D5DB" strokeWidth="0.75"/>
      <circle cx="6"    cy="5" r="1.3" fill="#9CA3AF"/>
      <circle cx="10.5" cy="5" r="1.3" fill="#9CA3AF"/>
      <circle cx="15"   cy="5" r="1.3" fill="#9CA3AF"/>
    </>
  )

  // ── Meta Ads ──
  if (type === 'meta') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#93C5FD" strokeWidth="1.5"/>
      {/* Simplified Meta "M" / infinity-like mark */}
      <path d="M8 25 C8 25 8 14 14 14 C18 14 19 20 20 22 C21 20 22 14 26 14 C32 14 32 25 32 25"
        fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="14" cy="20.5" rx="3.5" ry="5.5" fill="none" stroke="#3B82F6" strokeWidth="2" opacity="0.4"/>
      <ellipse cx="26" cy="20.5" rx="3.5" ry="5.5" fill="none" stroke="#3B82F6" strokeWidth="2" opacity="0.4"/>
    </svg>
  )

  // ── Google Ads ──
  if (type === 'google') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#FCA5A5" strokeWidth="1.5"/>
      {/* Magnifying glass */}
      <circle cx="17" cy="17" r="8.5" fill="none" stroke="#EF4444" strokeWidth="2.5"/>
      <line x1="23.5" y1="23.5" x2="31" y2="31" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
      {/* "G" hint inside circle */}
      <path d="M20 17 L17.5 17 A4.5 4.5 0 1 1 20.5 20" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )

  // ── Wait ──
  if (type === 'wait') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <circle cx="20" cy="20" r="18.25" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1.5"/>
      <text x="20" y="19" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="sans-serif" fill="#4B5563">X</text>
      <text x="20" y="29" textAnchor="middle" fontSize="7.5" fontWeight="600" fontFamily="sans-serif" fill="#6B7280">DIAS</text>
    </svg>
  )

  // ── Email ──
  if (type === 'email') return (
    <svg viewBox="0 0 40 30" width={size} height={size * 30 / 40}>
      <rect x="0.75" y="0.75" width="38.5" height="28.5" rx="3" fill="white" stroke="#9CA3AF" strokeWidth="1.5"/>
      <path d="M1.5 3.5 L20 16 L38.5 3.5" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="1.5" y1="28.5" x2="11" y2="17"  stroke="#9CA3AF" strokeWidth="1"/>
      <line x1="38.5" y1="28.5" x2="29" y2="17" stroke="#9CA3AF" strokeWidth="1"/>
    </svg>
  )

  // ── Opt-in Page ──
  if (type === 'optinpage') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      <rect x="5"  y="12.5" width="22" height="2" rx="1" fill="#9CA3AF"/>
      <rect x="5"  y="16.5" width="15" height="1.5" rx="0.75" fill="#D1D5DB"/>
      <rect x="5"  y="21"   width="30" height="4"   rx="1.5" fill="white" stroke="#D1D5DB" strokeWidth="1"/>
      <rect x="5"  y="27"   width="30" height="4"   rx="1.5" fill="white" stroke="#D1D5DB" strokeWidth="1"/>
      <rect x="5"  y="33.5" width="30" height="5.5" rx="2"   fill="#9CA3AF"/>
      <rect x="8"  y="41"   width="24" height="1.5" rx="0.75" fill="#E5E7EB"/>
      <rect x="12" y="44"   width="16" height="1.5" rx="0.75" fill="#E5E7EB"/>
    </svg>
  )

  // ── Thank You ──
  if (type === 'thankyou') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      <rect x="8"  y="12.5" width="24" height="2"   rx="1"    fill="#9CA3AF"/>
      <rect x="12" y="16.5" width="16" height="1.5"  rx="0.75" fill="#D1D5DB"/>
      <circle cx="20" cy="32" r="10.5" fill="none" stroke="#9CA3AF" strokeWidth="1.5"/>
      <path d="M14.5 32 L18.5 36 L25.5 27" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="8"  y="45"  width="24" height="1.5"  rx="0.75" fill="#D1D5DB"/>
      <rect x="12" y="48"  width="16" height="1.5"  rx="0.75" fill="#E5E7EB"/>
    </svg>
  )

  // ── Sales Page ──
  if (type === 'salespage') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      <rect x="4"  y="11.5" width="32" height="17" rx="2" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1"/>
      <polygon points="17,17 17,24 25,20.5" fill="#9CA3AF"/>
      <rect x="5"  y="31"   width="30" height="2"   rx="1"    fill="#9CA3AF"/>
      <rect x="5"  y="35"   width="24" height="1.5"  rx="0.75" fill="#D1D5DB"/>
      <rect x="5"  y="38.5" width="18" height="1.5"  rx="0.75" fill="#E5E7EB"/>
      <rect x="5"  y="43"   width="30" height="5.5"  rx="2"    fill="#9CA3AF"/>
    </svg>
  )

  // ── Order Form ──
  if (type === 'orderform') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      <rect x="5"  y="12"  width="20" height="2"   rx="1"    fill="#9CA3AF"/>
      <rect x="5"  y="16"  width="30" height="3.5"  rx="1.5"  fill="white" stroke="#D1D5DB" strokeWidth="1"/>
      <rect x="5"  y="21.5" width="30" height="3.5" rx="1.5"  fill="white" stroke="#D1D5DB" strokeWidth="1"/>
      {/* Card 1 (Visa-style) */}
      <rect x="5"  y="27.5" width="13.5" height="8.5" rx="1.5" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1"/>
      <rect x="5"  y="29.5" width="13.5" height="2.5" fill="#D1D5DB"/>
      <rect x="6.5" y="33.5" width="6" height="1"  rx="0.5" fill="#9CA3AF"/>
      {/* Card 2 (MC-style circles) */}
      <rect x="21" y="27.5" width="14" height="8.5" rx="1.5" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1"/>
      <circle cx="26" cy="31.75" r="3.2" fill="none" stroke="#D1D5DB" strokeWidth="1.2"/>
      <circle cx="30" cy="31.75" r="3.2" fill="none" stroke="#D1D5DB" strokeWidth="1.2"/>
      <rect x="5"  y="38.5" width="30" height="5.5" rx="2" fill="#9CA3AF"/>
      <rect x="5"  y="46"   width="30" height="1.5" rx="0.75" fill="#E5E7EB"/>
    </svg>
  )

  // ── Upsell ──
  if (type === 'upsell') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      <rect x="5"  y="12.5" width="25" height="2"   rx="1"    fill="#9CA3AF"/>
      <rect x="5"  y="16.5" width="30" height="1.5"  rx="0.75" fill="#D1D5DB"/>
      <rect x="5"  y="20"   width="20" height="1.5"  rx="0.75" fill="#E5E7EB"/>
      {/* Up arrow */}
      <polygon points="20,24 13.5,31 17,31 17,37 23,37 23,31 26.5,31" fill="#9CA3AF"/>
      <rect x="5"  y="42"   width="30" height="5.5"  rx="2"    fill="#9CA3AF"/>
    </svg>
  )

  // ── Downsell ──
  if (type === 'downsell') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      <rect x="5"  y="12.5" width="25" height="2"   rx="1"    fill="#9CA3AF"/>
      <rect x="5"  y="16.5" width="30" height="1.5"  rx="0.75" fill="#D1D5DB"/>
      <rect x="5"  y="20"   width="20" height="1.5"  rx="0.75" fill="#E5E7EB"/>
      {/* Down arrow */}
      <polygon points="20,37 13.5,30 17,30 17,24 23,24 23,30 26.5,30" fill="#9CA3AF"/>
      <rect x="5"  y="42"   width="30" height="5.5"  rx="2"    fill="#9CA3AF"/>
    </svg>
  )

  // ── Remarketing Meta ──
  if (type === 'remarketing') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#7DD3FC" strokeWidth="1.5"/>
      {/* Circular refresh arc */}
      <path d="M28 10 A12 12 0 1 1 8.5 22" fill="none" stroke="#0EA5E9" strokeWidth="2.2" strokeLinecap="round"/>
      {/* Arrowhead at arc start (top-right area) */}
      <polygon points="28,7 24,12 32,12" fill="#0EA5E9"/>
      {/* Meta M-like mark */}
      <path d="M14 25 C14 25 14 20 16.5 20 C18 20 18.8 22 19.8 23.5 C20.8 22 21.5 20 23 20 C25.5 20 25.5 25 25.5 25"
        fill="none" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round"/>
      <ellipse cx="16.5" cy="22.5" rx="2" ry="3" fill="none" stroke="#0EA5E9" strokeWidth="1.2" opacity="0.4"/>
      <ellipse cx="23"   cy="22.5" rx="2" ry="3" fill="none" stroke="#0EA5E9" strokeWidth="1.2" opacity="0.4"/>
    </svg>
  )

  // ── Webinar ──
  if (type === 'webinar') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#C4B5FD" strokeWidth="1.5"/>
      {/* Monitor */}
      <rect x="4" y="8" width="25" height="17" rx="2" fill="none" stroke="#7C3AED" strokeWidth="1.8"/>
      {/* Play button */}
      <polygon points="12,13 12,21 21,17" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Camera (right side) */}
      <rect x="30" y="12.5" width="6" height="8" rx="1.5" fill="none" stroke="#7C3AED" strokeWidth="1.5"/>
      <polygon points="30,14 27,16.5 30,19" fill="#7C3AED"/>
      {/* Monitor stand */}
      <line x1="16.5" y1="25" x2="16.5" y2="29" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11"   y1="29" x2="22"   y2="29" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Audience dots */}
      <circle cx="9"  cy="35" r="2.5" fill="none" stroke="#7C3AED" strokeWidth="1.2"/>
      <circle cx="20" cy="35" r="2.5" fill="none" stroke="#7C3AED" strokeWidth="1.2"/>
      <circle cx="31" cy="35" r="2.5" fill="none" stroke="#7C3AED" strokeWidth="1.2"/>
    </svg>
  )

  // ── Página de Aplicação ──
  if (type === 'apppage') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      <rect x="5"  y="11.5" width="20" height="2"   rx="1"    fill="#9CA3AF"/>
      <rect x="5"  y="15.5" width="30" height="3.5"  rx="1.5"  fill="white" stroke="#D1D5DB" strokeWidth="1"/>
      <rect x="5"  y="20.5" width="30" height="3.5"  rx="1.5"  fill="white" stroke="#D1D5DB" strokeWidth="1"/>
      {/* Checkbox row 1 */}
      <rect x="5"  y="26.5" width="3.5" height="3.5" rx="0.75" fill="none" stroke="#F59E0B" strokeWidth="1.2"/>
      <path d="M5.8 28.5 L7 30 L8.7 27" fill="none" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="11" y="27"   width="20" height="1.5"  rx="0.75" fill="#D1D5DB"/>
      {/* Checkbox row 2 */}
      <rect x="5"  y="32"   width="3.5" height="3.5" rx="0.75" fill="none" stroke="#F59E0B" strokeWidth="1.2"/>
      <rect x="11" y="32.5" width="16" height="1.5"  rx="0.75" fill="#D1D5DB"/>
      {/* CTA button */}
      <rect x="5"  y="38"   width="30" height="5.5"  rx="2"    fill="#F59E0B"/>
    </svg>
  )

  // ── Página Personalizada ──
  if (type === 'custompage') return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>
      {frame}
      {/* Dashed content border */}
      <rect x="5" y="11" width="30" height="37" rx="2" fill="none" stroke="#E879F9" strokeWidth="1" strokeDasharray="3 2"/>
      {/* 5-point star in center */}
      <polygon
        points="20,14 21.9,19.5 27.6,19.5 23,23 24.8,28.5 20,25 15.2,28.5 17,23 12.4,19.5 18.1,19.5"
        fill="none" stroke="#C026D3" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Pencil icon (bottom-right) */}
      <path d="M27 34 L24 37 L23 36 L26 33 Z" fill="#E879F9" stroke="#C026D3" strokeWidth="0.75"/>
      <path d="M26 33 L28.5 30.5 C29 30 29 29.5 28.5 29 C28 28.5 27.5 28.5 27 29 L24.5 31.5 Z" fill="#F0ABFC" stroke="#C026D3" strokeWidth="0.75"/>
      {/* Text lines */}
      <rect x="8"  y="41" width="18" height="1.2" rx="0.6" fill="#F0ABFC"/>
      <rect x="8"  y="44" width="12" height="1.2" rx="0.6" fill="#F0ABFC"/>
    </svg>
  )

  // ── Ligação ──
  if (type === 'call') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#BEF264" strokeWidth="1.5"/>
      {/* Phone receiver: earpiece (top-left) + mouthpiece (bottom-right) + handle */}
      <rect x="9"  y="7"  width="9" height="13" rx="4.5" fill="none" stroke="#65A30D" strokeWidth="2"/>
      <rect x="22" y="20" width="9" height="13" rx="4.5" fill="none" stroke="#65A30D" strokeWidth="2"/>
      <path d="M13.5 20 C13.5 25 17 28 20 28 C23 28 26.5 25 26.5 20"
        fill="none" stroke="#65A30D" strokeWidth="2" strokeLinecap="round"/>
      {/* Sound waves */}
      <path d="M31 13 A5 5 0 0 1 31 20" fill="none" stroke="#A3E635" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M34 10.5 A9 9 0 0 1 34 22.5" fill="none" stroke="#BEF264" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )

  // ── WhatsApp ──
  if (type === 'whatsapp') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#4ADE80" strokeWidth="1.5"/>
      {/* Speech bubble with tail */}
      <path d="M20 5.5 A14.5 14.5 0 0 1 34.5 20 A14.5 14.5 0 0 1 20 34.5 L12.5 37 L14.5 29.5 A14.5 14.5 0 0 1 5.5 20 A14.5 14.5 0 0 1 20 5.5 Z"
        fill="#DCFCE7" stroke="#22C55E" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Phone handset inside */}
      <path d="M14 15 C13.5 16 13.5 18 14.5 19.5 C15.5 21 17 22 18.5 22.5 L20 21 C20.5 20.5 21.5 20.5 22 21 L23.5 22.5 C24 23 24 24 23.5 24.5 L22.5 25 C20.5 26 17.5 24.5 15 22 C12.5 19.5 11.5 16.5 13 14.5 L14 14 C14.5 13.5 15.5 13.5 16 14 Z"
        fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )

  // ── Reunião de Venda ──
  if (type === 'meeting') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#A5B4FC" strokeWidth="1.5"/>
      {/* Meeting table */}
      <ellipse cx="20" cy="25" rx="14" ry="5" fill="none" stroke="#4338CA" strokeWidth="1.8"/>
      {/* Person left */}
      <circle cx="11" cy="14" r="4" fill="none" stroke="#4338CA" strokeWidth="1.5"/>
      <path d="M5 24 C5 20 7.5 18 11 18 C12.5 18 14 18.8 15 20" fill="none" stroke="#4338CA" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Person right */}
      <circle cx="29" cy="14" r="4" fill="none" stroke="#4338CA" strokeWidth="1.5"/>
      <path d="M35 24 C35 20 32.5 18 29 18 C27.5 18 26 18.8 25 20" fill="none" stroke="#4338CA" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Handshake at table center */}
      <path d="M16 26 C17.5 24.5 19 24 20 24.5 C21 24 22.5 24.5 24 26"
        fill="none" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )

  // ── Texto Personalizado ──
  if (type === 'textlabel') return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="8" fill="white" stroke="#CBD5E1" strokeWidth="1.5"/>
      {/* Large "T" */}
      <line x1="20" y1="11" x2="20" y2="28" stroke="#64748B" strokeWidth="3"   strokeLinecap="round"/>
      <line x1="11" y1="11" x2="29" y2="11" stroke="#64748B" strokeWidth="3"   strokeLinecap="round"/>
      {/* Text lines */}
      <rect x="8"  y="31" width="24" height="1.5" rx="0.75" fill="#94A3B8"/>
      <rect x="8"  y="34.5" width="18" height="1.5" rx="0.75" fill="#CBD5E1"/>
    </svg>
  )

  // Fallback (browser frame, empty)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={size * H / W}>{frame}</svg>
  )
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function initFunnels() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (Array.isArray(data.funnels)) return data.funnels
    // ── Migrate old format { scenarios, activeScenarioId } ──
    if (Array.isArray(data.scenarios) && data.scenarios.length) {
      return [{
        id: crypto.randomUUID(),
        name: 'Meu Funil',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scenarios: data.scenarios,
      }]
    }
    return []
  } catch { return [] }
}

function saveFunnelsToLS(funnels) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ funnels }))
  } catch { /* quota exceeded */ }
}

function makeScenario(name = 'Cenário 1') {
  return {
    id: crypto.randomUUID(),
    name,
    nodes: [],
    connections: [],
    calc: {
      // Meta Ads
      metaInvestido: 5000, metaCPM: 25, metaCTR: 2,
      // Google Ads
      googleInvestido: 3000, googleCPC: 5,
      // Common
      ticketMedio: 997, margemBruta: 70,
      // Legacy fallback (kept for old saved data)
      trafficVolume: 10000, adBudget: 5000,
    },
  }
}

// ─── Metrics computation (pure, supports multiple traffic sources) ────────────
function computeMetrics(scenario) {
  if (!scenario) return { stages: [], summary: null }
  const { nodes, connections, calc } = scenario
  const { ticketMedio, margemBruta } = calc

  if (!nodes.length) return { stages: [], summary: null }

  // ── Kahn's topological sort so nodes are processed after all predecessors ──
  const inDegreeMap = new Map(nodes.map(n => [n.id, 0]))
  connections.forEach(c => {
    if (inDegreeMap.has(c.toId)) inDegreeMap.set(c.toId, inDegreeMap.get(c.toId) + 1)
  })
  // Traffic source nodes always start first (in-degree treated as 0)
  const topoQueue = nodes.filter(n =>
    TRAFFIC_TYPES.includes(n.type) || (inDegreeMap.get(n.id) || 0) === 0
  )
  const ordered  = []
  const inTopo   = new Set(topoQueue.map(n => n.id))
  const queueSet = [...topoQueue]

  while (queueSet.length) {
    const node = queueSet.shift()
    ordered.push(node)
    connections
      .filter(c => c.fromId === node.id)
      .forEach(c => {
        const deg = (inDegreeMap.get(c.toId) || 0) - 1
        inDegreeMap.set(c.toId, deg)
        if (deg <= 0 && !inTopo.has(c.toId)) {
          const next = nodes.find(n => n.id === c.toId)
          if (next) { queueSet.push(next); inTopo.add(next.id) }
        }
      })
  }

  // ── Forward pass: yesMap = converted (YES port), noMap = non-converted (NO port) ──
  const yesMap      = new Map()
  const noMap       = new Map()
  let   totalBudget = 0

  for (const node of ordered) {
    let entering = 0

    if (node.type === 'meta') {
      const impr = calc.metaCPM > 0 ? (calc.metaInvestido / calc.metaCPM) * 1000 : 0
      entering      = Math.round(impr * ((calc.metaCTR ?? 0) / 100))
      totalBudget  += calc.metaInvestido ?? 0
    } else if (node.type === 'google') {
      entering      = (calc.googleCPC ?? 0) > 0 ? Math.round((calc.googleInvestido ?? 0) / calc.googleCPC) : 0
      totalBudget  += calc.googleInvestido ?? 0
    } else {
      // fromPort 'no' carries non-converted leads; 'yes' (or legacy/missing) carries converted
      const inConns = connections.filter(c => c.toId === node.id)
      entering = inConns.reduce((sum, c) => {
        if (c.fromPort === 'no') return sum + (noMap.get(c.fromId) ?? 0)
        return sum + (yesMap.get(c.fromId) ?? 0)
      }, 0)
    }

    const isTraffic = TRAFFIC_TYPES.includes(node.type)
    const convRate  = isTraffic ? 100 : (node.conversionRate ?? DEFAULT_CONV[node.type] ?? 100)
    const converted = Math.round(entering * convRate / 100)
    yesMap.set(node.id, converted)
    noMap.set(node.id, Math.max(0, entering - converted))
  }

  // Legacy fallback when no traffic source nodes exist
  if (totalBudget === 0 && !nodes.some(n => TRAFFIC_TYPES.includes(n.type))) {
    totalBudget = calc.adBudget ?? 0
  }

  // ── Build stages array ──
  const stages = ordered.map(node => {
    const isTraffic = TRAFFIC_TYPES.includes(node.type)
    const inConns   = connections.filter(c => c.toId === node.id)
    const visitors  = isTraffic
      ? (yesMap.get(node.id) ?? 0)   // traffic nodes: visitors = their own output (clicks)
      : inConns.reduce((s, c) => s + (c.fromPort === 'no' ? (noMap.get(c.fromId) ?? 0) : (yesMap.get(c.fromId) ?? 0)), 0)
    const converted = yesMap.get(node.id) ?? 0
    const convRate  = isTraffic ? 100 : (node.conversionRate ?? DEFAULT_CONV[node.type] ?? 100)
    return { node, visitors, converted, convRate }
  })

  // ── Summary metrics ──
  const lastSaleStage   = [...stages].reverse().find(s => SALE_TYPES.includes(s.node.type))
  const firstOptinStage = stages.find(s => OPTIN_TYPES.includes(s.node.type))
  const finalSales  = lastSaleStage?.converted ?? 0
  const leads       = firstOptinStage?.converted ?? 0

  const revenue     = finalSales * ticketMedio
  const grossProfit = revenue * (margemBruta / 100)
  const netProfit   = grossProfit - totalBudget
  const roas        = totalBudget > 0 ? revenue / totalBudget : 0
  const cac         = finalSales > 0 ? totalBudget / finalSales : 0
  const cpl         = leads > 0 ? totalBudget / leads : 0

  return {
    stages,
    summary: { revenue, grossProfit, netProfit, roas, cac, cpl, finalSales, leads, totalBudget },
    disconnectedCount: nodes.length - ordered.length,
  }
}

// ─── Cycle detection ──────────────────────────────────────────────────────────
function canReach(startId, targetId, connections) {
  const visited = new Set()
  const stack   = [startId]
  while (stack.length) {
    const cur = stack.pop()
    if (cur === targetId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    connections.filter(c => c.fromId === cur).forEach(c => stack.push(c.toId))
  }
  return false
}

// ─── NumInput ─────────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, prefix, suffix, min = 0, step = 1 }) {
  return (
    <div>
      <label className="label-field text-xs">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-xs pointer-events-none">{prefix}</span>
        )}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`input-field text-sm py-2 ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-xs pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  )
}

// ─── PalettePanel ─────────────────────────────────────────────────────────────
const PALETTE_GROUPS = [
  { label: 'Tráfego',        types: ['meta', 'google', 'remarketing'] },
  { label: 'Páginas',        types: ['optinpage', 'thankyou', 'salespage', 'apppage', 'custompage'] },
  { label: 'Vendas',         types: ['orderform', 'meeting'] },
  { label: 'Comunicação',    types: ['email', 'whatsapp', 'call', 'webinar'] },
  { label: 'Utilidades',     types: ['wait', 'upsell', 'downsell', 'textlabel'] },
]

function PalettePanel({ onAddNode }) {
  return (
    <div className="w-44 shrink-0 flex flex-col border-r border-rl-border bg-rl-surface overflow-y-auto scroll-hide">
      <div className="px-3 py-2.5 border-b border-rl-border">
        <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Elementos</p>
      </div>
      <div className="p-2 space-y-3">
        {PALETTE_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-rl-muted/60 uppercase tracking-widest px-1 pb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.types.map(type => {
                const nt = NODE_TYPES.find(n => n.type === type)
                if (!nt) return null
                return (
                  <div
                    key={nt.type}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('nodeType', nt.type)}
                    onClick={() => onAddNode(nt.type, 300, 200)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-sm ${nt.accent}`}
                    title="Arraste para o canvas ou clique para adicionar"
                  >
                    <NodeIcon type={nt.type} size={28} />
                    <span className={`text-[10px] font-semibold leading-tight ${nt.text}`}>{nt.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── FunnelNode ───────────────────────────────────────────────────────────────
function FunnelNode({
  node, isSelected, isConnecting, connectingFrom,
  visitorCount, convertedCount, cpl,
  onMouseDown, onOutputPortClick, onInputPortClick,
  onDoubleClick, onDelete,
}) {
  const def        = getNodeDef(node.type)
  const hasInput   = !NO_INPUT_TYPES.includes(node.type)
  const showZeroWarn = node.conversionRate === 0 && !TRAFFIC_TYPES.includes(node.type)

  const borderCls = isSelected
    ? 'border-2 border-blue-500 shadow-lg shadow-blue-200'
    : connectingFrom
      ? 'border-2 border-cyan-400 shadow-md shadow-cyan-100 cursor-crosshair'
      : `border ${def.accent}`

  return (
    <div
      style={{ position: 'absolute', left: node.x, top: node.y, width: NODE_W, zIndex: isSelected ? 10 : 1 }}
      className={`rounded-xl bg-white select-none transition-shadow group ${borderCls}`}
      onMouseDown={e => { if (e.target.closest('[data-port]')) return; onMouseDown(e) }}
      onDoubleClick={onDoubleClick}
      onClick={e => {
        if (e.target.closest('[data-port]')) return
        if (connectingFrom && connectingFrom.nodeId !== node.id) {
          onInputPortClick()
        }
      }}
    >
      {/* Input port (left) */}
      {hasInput && (
        <div
          data-port="input"
          onClick={e => { e.stopPropagation(); if (connectingFrom) onInputPortClick() }}
          style={{ position: 'absolute', left: -PORT_R - 1, top: '50%', transform: 'translateY(-50%)', width: PORT_R * 2, height: PORT_R * 2 }}
          className="rounded-full bg-white border-2 border-gray-300 hover:border-blue-400 cursor-pointer transition-colors z-10"
        />
      )}

      {/* Icon area — big centered icon + label */}
      <div className={`relative flex flex-col items-center justify-center pt-4 pb-3 ${def.accent} rounded-t-xl`}>
        <button
          data-port="delete"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute top-1.5 right-1.5 p-0.5 rounded text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Excluir nó"
        >
          <X className="w-3 h-3" />
        </button>
        <NodeIcon type={node.type} size={54} />
        <span className={`text-[11px] font-bold mt-2 text-center leading-tight px-2 ${def.text}`}>
          {node.label || def.label}
        </span>
      </div>

      {/* Info area — conversion rate + visitor counts */}
      <div className="px-3 pt-2 pb-2.5 space-y-1.5 border-t border-gray-100">
        {!TRAFFIC_TYPES.includes(node.type) && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-rl-muted whitespace-nowrap">Taxa conv.:</span>
            <input
              type="number"
              min={0}
              max={100}
              value={node.conversionRate ?? DEFAULT_CONV[node.type] ?? 100}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => {
                const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                const evt = new CustomEvent('nodeUpdate', { detail: { id: node.id, conversionRate: v }, bubbles: true })
                e.target.dispatchEvent(evt)
              }}
              className="w-14 text-xs border border-rl-border rounded-lg px-1.5 py-0.5 text-center focus:border-blue-400 outline-none bg-white"
            />
            <span className="text-[10px] text-rl-muted">%</span>
          </div>
        )}

        {visitorCount != null && (
          <div className="text-[10px] text-rl-muted space-y-0.5">
            <div className="flex justify-between">
              <span>Entram:</span>
              <span className="font-semibold text-rl-text">{visitorCount.toLocaleString('pt-BR')}</span>
            </div>
            {!TRAFFIC_TYPES.includes(node.type) && (
              <div className="flex justify-between">
                <span>Convertem:</span>
                <span className={`font-semibold ${convertedCount === 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {convertedCount?.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {cpl != null && cpl > 0 && (
              <div className="flex justify-between pt-0.5 mt-0.5 border-t border-dashed border-orange-200">
                <span className="text-orange-500 font-medium">Custo/lead:</span>
                <span className="font-bold text-orange-500">{fmtCurrency(cpl)}</span>
              </div>
            )}
          </div>
        )}

        {showZeroWarn && (
          <div className="flex items-center gap-1 text-amber-500">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="text-[9px]">Taxa 0% — nenhuma conversão</span>
          </div>
        )}
      </div>

      {/* SIM port — right side (converted leads) */}
      <button
        data-port="output-yes"
        onClick={e => { e.stopPropagation(); onOutputPortClick('yes') }}
        style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)', width: 40, height: 20, zIndex: 10 }}
        className={`flex items-center justify-center rounded text-[8px] font-bold border cursor-pointer transition-all select-none ${
          connectingFrom?.nodeId === node.id && connectingFrom?.port === 'yes'
            ? 'bg-green-500 border-green-500 text-white scale-110 shadow-sm'
            : 'bg-white border-green-400 text-green-600 hover:bg-green-50 hover:border-green-500 hover:shadow-sm'
        }`}
        title={`SIM — leads convertidos${!TRAFFIC_TYPES.includes(node.type) ? ` (${node.conversionRate ?? DEFAULT_CONV[node.type] ?? 100}%)` : ''}`}
      >
        SIM
      </button>

      {/* NÃO port — bottom center (non-converted leads) */}
      {!TRAFFIC_TYPES.includes(node.type) && (
        <button
          data-port="output-no"
          onClick={e => { e.stopPropagation(); onOutputPortClick('no') }}
          style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', width: 40, height: 20, zIndex: 10 }}
          className={`flex items-center justify-center rounded text-[8px] font-bold border cursor-pointer transition-all select-none ${
            connectingFrom?.nodeId === node.id && connectingFrom?.port === 'no'
              ? 'bg-red-500 border-red-500 text-white scale-110 shadow-sm'
              : 'bg-white border-red-400 text-red-500 hover:bg-red-50 hover:border-red-500 hover:shadow-sm'
          }`}
          title={`NÃO — leads não convertidos (${100 - (node.conversionRate ?? DEFAULT_CONV[node.type] ?? 100)}%)`}
        >
          NÃO
        </button>
      )}
    </div>
  )
}

// ─── SVGConnections ───────────────────────────────────────────────────────────
function SVGConnections({ connections, nodes, selectedConnId, onSelectConn }) {
  // port: 'yes' → right-center, 'no' → bottom-center, 'input' → left-center
  function getPortPos(nodeId, port) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return null
    if (port === 'no')    return { x: node.x + NODE_W / 2, y: node.y + NODE_H }
    if (port === 'input') return { x: node.x,              y: node.y + NODE_H / 2 }
    return                       { x: node.x + NODE_W,     y: node.y + NODE_H / 2 } // 'yes' / default
  }

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', overflow: 'visible' }}
    >
      <defs>
        {/* YES (green) arrowheads */}
        <marker id="arr-yes"     markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#16A34A" />
        </marker>
        <marker id="arr-yes-sel" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#15803D" />
        </marker>
        {/* NO (red/orange) arrowheads */}
        <marker id="arr-no"      markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#EA580C" />
        </marker>
        <marker id="arr-no-sel"  markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#DC2626" />
        </marker>
      </defs>

      {connections.map(conn => {
        const fromPort = conn.fromPort || 'yes'
        const from = getPortPos(conn.fromId, fromPort)
        const to   = getPortPos(conn.toId, 'input')
        if (!from || !to) return null

        let d
        if (fromPort === 'no') {
          // From bottom-center: curve downward then to the left/right
          const cpY = Math.max(50, Math.abs(to.y - from.y) * 0.5)
          const cpX = Math.max(50, Math.abs(to.x - from.x) * 0.5)
          d = `M ${from.x} ${from.y} C ${from.x} ${from.y + cpY} ${to.x - cpX} ${to.y} ${to.x} ${to.y}`
        } else {
          // From right-center: horizontal bezier
          const cp = Math.max(40, (to.x - from.x) * 0.5)
          d = `M ${from.x} ${from.y} C ${from.x + cp} ${from.y} ${to.x - cp} ${to.y} ${to.x} ${to.y}`
        }

        const isSel  = conn.id === selectedConnId
        const isNo   = fromPort === 'no'
        const stroke = isNo
          ? (isSel ? '#DC2626' : '#EA580C')
          : (isSel ? '#15803D' : '#16A34A')
        const marker = isNo
          ? (isSel ? 'url(#arr-no-sel)' : 'url(#arr-no)')
          : (isSel ? 'url(#arr-yes-sel)' : 'url(#arr-yes)')

        return (
          <g key={conn.id}>
            {/* Wide transparent hitbox */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: 'visibleStroke', cursor: 'pointer' }}
              onClick={() => onSelectConn(conn.id)}
            />
            {/* Visible path */}
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={isSel ? 2.5 : 2}
              strokeDasharray={isSel ? '0' : '6 3'}
              markerEnd={marker}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        )
      })}
    </svg>
  )
}

// ─── CalcSidebar ──────────────────────────────────────────────────────────────
function CalcSidebar({ scenario, metrics, onUpdateCalc }) {
  const { calc, nodes } = scenario
  const { stages, summary, disconnectedCount } = metrics

  // Detect which traffic sources are on the canvas (can be both simultaneously)
  const hasMeta   = nodes?.some(n => n.type === 'meta')
  const hasGoogle = nodes?.some(n => n.type === 'google')
  const hasAnyTraffic = hasMeta || hasGoogle

  // Derived read-only values
  const metaImpressoes = (calc.metaCPM > 0)
    ? Math.round((calc.metaInvestido / calc.metaCPM) * 1000)
    : 0
  const metaCliques    = Math.round(metaImpressoes * ((calc.metaCTR ?? 0) / 100))
  const googleCliques  = (calc.googleCPC > 0)
    ? Math.round((calc.googleInvestido ?? 0) / calc.googleCPC)
    : 0

  return (
    <div className="w-64 shrink-0 flex flex-col border-l border-rl-border bg-rl-surface overflow-y-auto scroll-hide">
      {/* Header */}
      <div className="px-3 py-3 border-b border-rl-border">
        <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 className="w-3 h-3" />
          Calculadora
        </p>
      </div>

      {/* ── Resultado (topo) ── */}
      <div className="px-3 pt-3 pb-3 border-b border-rl-border space-y-1.5">
        <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-2">Resultado</p>
        {summary ? (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-rl-muted">Faturamento</span>
              <span className="font-semibold text-rl-text">{fmtCurrency(summary.revenue)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-rl-muted">Lucro Líquido</span>
              <span className={`font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmtCurrency(summary.netProfit)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-rl-muted">ROAS</span>
              <span className="font-semibold text-rl-text">{summary.roas.toFixed(2)}×</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-rl-muted">CAC</span>
              <span className="font-semibold text-rl-text">{summary.finalSales > 0 ? fmtCurrency(summary.cac) : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-rl-muted">CPL</span>
              <span className="font-semibold text-rl-text">{summary.leads > 0 ? fmtCurrency(summary.cpl) : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-rl-muted">Vendas</span>
              <span className="font-semibold text-rl-text">{summary.finalSales.toLocaleString('pt-BR')}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-rl-muted">Monte o funil para ver os resultados</p>
        )}
      </div>

      {/* Traffic source inputs */}
      <div className="p-3 border-b border-rl-border space-y-2.5">

        {/* ── Meta Ads ── */}
        {hasMeta && (
          <>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
              <NodeIcon type="meta" size={14} />
              Meta Ads
            </p>
            <NumInput
              label="Valor Investido em Mídia"
              value={calc.metaInvestido ?? 5000}
              onChange={v => onUpdateCalc('metaInvestido', v)}
              prefix="R$" min={0} step={100}
            />
            <NumInput
              label="CPM"
              value={calc.metaCPM ?? 25}
              onChange={v => onUpdateCalc('metaCPM', Math.max(0.01, v))}
              prefix="R$" min={0.01} step={0.5}
            />
            <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <span className="text-xs text-rl-muted">Impressões</span>
              <span className="text-xs font-bold text-blue-600">{metaImpressoes.toLocaleString('pt-BR')}</span>
            </div>
            <NumInput
              label="CTR no Link"
              value={calc.metaCTR ?? 2}
              onChange={v => onUpdateCalc('metaCTR', Math.min(100, Math.max(0, v)))}
              suffix="%" min={0} max={100} step={0.1}
            />
            <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <span className="text-xs text-rl-muted">Cliques</span>
              <span className="text-xs font-bold text-blue-600">{metaCliques.toLocaleString('pt-BR')}</span>
            </div>
          </>
        )}

        {/* Divider between two sources */}
        {hasMeta && hasGoogle && (
          <div className="border-t border-rl-border/60" />
        )}

        {/* ── Google Ads ── */}
        {hasGoogle && (
          <>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
              <NodeIcon type="google" size={14} />
              Google Ads
            </p>
            <NumInput
              label="Valor Investido em Mídia"
              value={calc.googleInvestido ?? 3000}
              onChange={v => onUpdateCalc('googleInvestido', v)}
              prefix="R$" min={0} step={100}
            />
            <NumInput
              label="CPC"
              value={calc.googleCPC ?? 5}
              onChange={v => onUpdateCalc('googleCPC', Math.max(0.01, v))}
              prefix="R$" min={0.01} step={0.5}
            />
            <div className="flex justify-between items-center bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <span className="text-xs text-rl-muted">Cliques</span>
              <span className="text-xs font-bold text-red-600">{googleCliques.toLocaleString('pt-BR')}</span>
            </div>
          </>
        )}

        {/* ── No traffic source ── */}
        {!hasAnyTraffic && (
          <div className="flex flex-col items-center text-center py-3 gap-1">
            <BarChart3 className="w-5 h-5 text-rl-muted/40" />
            <p className="text-[11px] text-rl-muted leading-snug">
              Adicione <strong>Meta Ads</strong> ou <strong>Google Ads</strong> ao canvas para ver os dados de tráfego
            </p>
          </div>
        )}

        {/* ── Common fields ── */}
        <div className={`space-y-2.5 ${hasAnyTraffic ? 'pt-2 border-t border-rl-border/60' : ''}`}>
          <NumInput
            label="Ticket Médio"
            value={calc.ticketMedio}
            onChange={v => onUpdateCalc('ticketMedio', v)}
            prefix="R$" min={0}
          />
          <NumInput
            label="Margem Bruta"
            value={calc.margemBruta}
            onChange={v => onUpdateCalc('margemBruta', Math.min(100, Math.max(0, v)))}
            suffix="%" min={0} max={100}
          />
        </div>
      </div>

      {/* Funnel cascade */}
      <div className="flex-1 p-3">
        {stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <GitFork className="w-8 h-8 text-rl-muted/40 mb-2" />
            <p className="text-xs text-rl-muted">Adicione nós ao canvas e conecte-os para ver as métricas</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-2">Funil</p>
            {stages.map((s, i) => {
              const def = getNodeDef(s.node.type)
              return (
                <div key={s.node.id} className={`rounded-lg px-2.5 py-2 border ${def.accent}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <NodeIcon type={s.node.type} size={24} />
                    <span className={`text-[11px] font-semibold truncate flex-1 ${def.text}`}>
                      {s.node.label || def.label}
                    </span>
                    {!TRAFFIC_TYPES.includes(s.node.type) && (
                      <span className="text-[10px] font-bold text-rl-muted">{s.convRate}%</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-rl-muted">
                    <span>{s.visitors.toLocaleString('pt-BR')} entram</span>
                    {!TRAFFIC_TYPES.includes(s.node.type) && (
                      <span className="font-semibold text-rl-text">→ {s.converted.toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                </div>
              )
            })}

            {disconnectedCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-2">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="text-[10px]">{disconnectedCount} nó(s) desconectado(s)</span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── MetricsView ──────────────────────────────────────────────────────────────
function MetricsView({ metrics, scenarioName }) {
  const { stages, summary, disconnectedCount } = metrics

  if (!stages.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <GitFork className="w-12 h-12 text-rl-muted/30 mb-3" />
        <h3 className="text-base font-semibold text-rl-text mb-1">Funil vazio</h3>
        <p className="text-sm text-rl-muted">Vá para Canvas e adicione nós conectados para visualizar as métricas.</p>
      </div>
    )
  }

  const maxVisitors = stages[0]?.visitors || 1

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-rl-text">{scenarioName}</h2>
        <p className="text-sm text-rl-muted">Cascata de conversão do funil</p>
      </div>

      {disconnectedCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{disconnectedCount} nó(s) desconectado(s) não aparecem nas métricas.</p>
        </div>
      )}

      {/* Funnel visualization */}
      <div className="space-y-2">
        {stages.map((s, i) => {
          const def = getNodeDef(s.node.type)
          const widthPct = Math.max(15, Math.round(s.converted / maxVisitors * 100))
          const isLast   = i === stages.length - 1

          return (
            <div key={s.node.id}>
              <div
                className={`rounded-xl border px-4 py-3 transition-all ${def.accent}`}
                style={{ width: `${widthPct}%`, minWidth: 240 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <NodeIcon type={s.node.type} size={28} />
                  <span className={`font-semibold text-sm ${def.text}`}>{s.node.label || def.label}</span>
                  {!TRAFFIC_TYPES.includes(s.node.type) && (
                    <span className="ml-auto text-xs font-bold text-rl-muted bg-white/60 px-2 py-0.5 rounded-full border border-white">
                      {s.convRate}%
                    </span>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-rl-muted">
                  <span><strong className="text-rl-text">{s.visitors.toLocaleString('pt-BR')}</strong> entram</span>
                  {!TRAFFIC_TYPES.includes(s.node.type) && (
                    <span><strong className={s.converted === 0 ? 'text-red-500' : 'text-green-600'}>{s.converted.toLocaleString('pt-BR')}</strong> convertem</span>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="flex items-center pl-6 my-0.5 text-rl-muted">
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {[
            { label: 'Faturamento', value: fmtCurrency(summary.revenue), color: 'text-blue-600' },
            { label: 'Lucro Líquido', value: fmtCurrency(summary.netProfit), color: summary.netProfit >= 0 ? 'text-green-600' : 'text-red-500' },
            { label: 'ROAS', value: `${summary.roas.toFixed(2)}×`, color: 'text-purple-600' },
            { label: 'CAC', value: summary.finalSales > 0 ? fmtCurrency(summary.cac) : '—', color: 'text-orange-600' },
            { label: 'CPL', value: summary.leads > 0 ? fmtCurrency(summary.cpl) : '—', color: 'text-cyan-600' },
            { label: 'Vendas', value: summary.finalSales.toLocaleString('pt-BR'), color: 'text-emerald-600' },
          ].map(c => (
            <div key={c.label} className="glass-card p-3 text-center">
              <p className={`text-base font-bold ${c.color}`}>{c.value}</p>
              <p className="text-[10px] text-rl-muted mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ScenariosView ────────────────────────────────────────────────────────────
function ScenariosView({ scenarios, activeId, onSwitch, onDuplicate, onDelete, onRename }) {
  const [editingId, setEditingId] = useState(null)
  const [draftName, setDraftName] = useState('')

  const allMetrics = scenarios.map(s => ({ id: s.id, name: s.name, metrics: computeMetrics(s) }))

  const ROWS = [
    { label: 'Faturamento',    key: s => s.summary ? fmtCurrency(s.summary.revenue)    : '—' },
    { label: 'Lucro Líquido',  key: s => s.summary ? fmtCurrency(s.summary.netProfit)  : '—', colorFn: s => s.summary?.netProfit >= 0 ? 'text-green-600' : 'text-red-500' },
    { label: 'ROAS',           key: s => s.summary ? `${s.summary.roas.toFixed(2)}×`   : '—' },
    { label: 'CAC',            key: s => s.summary?.finalSales > 0 ? fmtCurrency(s.summary.cac) : '—' },
    { label: 'CPL',            key: s => s.summary?.leads > 0 ? fmtCurrency(s.summary.cpl) : '—' },
    { label: 'Vendas',         key: s => s.summary ? s.summary.finalSales.toLocaleString('pt-BR') : '—' },
    { label: 'Nós no funil',   key: (_, sc) => sc.nodes.length.toString() },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-rl-text">Comparação de Cenários</h2>
          <p className="text-sm text-rl-muted">Compare até {MAX_SCENARIOS} cenários lado a lado</p>
        </div>
        <button
          onClick={onDuplicate}
          disabled={scenarios.length >= MAX_SCENARIOS}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicar cenário atual
        </button>
      </div>

      {/* Comparison table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rl-border bg-rl-surface/60">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-rl-muted uppercase tracking-wider w-36">Métrica</th>
              {scenarios.map(s => (
                <th key={s.id} className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    {editingId === s.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={draftName}
                          onChange={e => setDraftName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { onRename(s.id, draftName); setEditingId(null) }
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          autoFocus
                          className="text-xs border border-rl-border rounded px-2 py-0.5 w-24 text-center"
                        />
                        <button onClick={() => { onRename(s.id, draftName); setEditingId(null) }} className="text-green-600 hover:text-green-700"><Check className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSwitch(s.id)}
                        className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${
                          s.id === activeId
                            ? 'bg-rl-purple/10 text-rl-purple border border-rl-purple/30'
                            : 'text-rl-muted hover:text-rl-text'
                        }`}
                      >
                        {s.name}
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(s.id); setDraftName(s.name) }}
                        className="text-[10px] text-rl-muted hover:text-rl-text transition-colors"
                      >
                        Renomear
                      </button>
                      {scenarios.length > 1 && (
                        <button
                          onClick={() => onDelete(s.id)}
                          className="text-[10px] text-rl-muted hover:text-red-500 transition-colors"
                        >
                          · Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={ri} className={`border-b border-rl-border/50 ${ri % 2 === 0 ? '' : 'bg-rl-surface/30'}`}>
                <td className="px-4 py-3 text-xs font-medium text-rl-muted">{row.label}</td>
                {allMetrics.map(am => {
                  const sc   = scenarios.find(s => s.id === am.id)
                  const val  = row.key(am.metrics, sc)
                  const col  = row.colorFn ? row.colorFn(am.metrics) : 'text-rl-text'
                  return (
                    <td key={am.id} className={`px-4 py-3 text-center text-sm font-semibold ${col}`}>
                      {val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── NodeEditModal ─────────────────────────────────────────────────────────────
function NodeEditModal({ node, onSave, onClose }) {
  const def = getNodeDef(node.type)
  const [label, setLabel]   = useState(node.label || def.label)
  const [conv,  setConv]    = useState(node.conversionRate ?? DEFAULT_CONV[node.type] ?? 100)
  const [notes, setNotes]   = useState(node.notes || '')

  return (
    <Modal onClose={onClose} maxWidth="sm">
      <div className="flex items-center gap-3 mb-5">
        <NodeIcon type={node.type} size={40} />
        <div>
          <h2 className="text-base font-bold text-rl-text">Editar Nó</h2>
          <p className="text-xs text-rl-muted">{def.label}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label-field">Rótulo</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={def.label}
            className="input-field w-full"
            autoFocus
          />
        </div>

        {!TRAFFIC_TYPES.includes(node.type) && (
          <NumInput
            label="Taxa de Conversão (%)"
            value={conv}
            onChange={v => setConv(Math.min(100, Math.max(0, v)))}
            suffix="%"
            min={0}
            max={100}
          />
        )}

        <div>
          <label className="label-field">Observações (opcional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Contexto, referências, resultados esperados..."
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 btn-ghost">Cancelar</button>
        <button
          onClick={() => { onSave({ label: label.trim() || def.label, conversionRate: conv, notes }); onClose() }}
          className="flex-1 btn-primary"
        >
          Salvar
        </button>
      </div>
    </Modal>
  )
}

// ─── FunnelList — library / home view ────────────────────────────────────────
function FunnelList({ funnels, onOpen, onCreate, onDuplicate, onRename, onDelete }) {
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal,  setRenameVal]  = useState('')

  function startRename(f) { setRenamingId(f.id); setRenameVal(f.name) }
  function commitRename()  {
    if (renameVal.trim()) onRename(renamingId, renameVal.trim())
    setRenamingId(null)
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch { return '—' }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Layers className="w-5 h-5 text-rl-purple" /> Meus Funis
          </h1>
          <p className="text-sm text-rl-muted mt-0.5">
            {funnels.length} funil{funnels.length !== 1 ? 's' : ''} salvo{funnels.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onCreate} className="btn-primary flex items-center gap-2 text-sm py-2.5 px-4">
          <Plus className="w-4 h-4" /> Novo Funil
        </button>
      </div>

      {funnels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rl-purple/10 flex items-center justify-center mb-4">
            <GitFork className="w-8 h-8 text-rl-purple/50" />
          </div>
          <h3 className="font-semibold text-rl-text mb-1">Nenhum funil criado ainda</h3>
          <p className="text-sm text-rl-muted mb-6 max-w-xs">
            Crie funis de vendas visuais e reutilize-os com diferentes clientes
          </p>
          <button onClick={onCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Criar Primeiro Funil
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {funnels.map(f => {
            const totalNodes = f.scenarios?.reduce((sum, s) => sum + (s.nodes?.length ?? 0), 0) ?? 0
            const scenCount  = f.scenarios?.length ?? 0
            const isRenaming = renamingId === f.id

            return (
              <div
                key={f.id}
                className="glass-card p-4 flex flex-col gap-3 hover:border-rl-purple/30 hover:shadow-md transition-all group"
              >
                {/* Name row */}
                {isRenaming ? (
                  <input
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                    className="input-field text-sm font-bold py-1.5"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start gap-1.5">
                    <h3
                      className="font-bold text-rl-text text-sm flex-1 leading-tight cursor-pointer hover:text-rl-purple transition-colors"
                      onClick={() => onOpen(f.id)}
                    >
                      {f.name}
                    </h3>
                    <button
                      onClick={() => startRename(f)}
                      className="p-1 rounded text-rl-muted hover:text-rl-text opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                      title="Renomear"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Stats */}
                <div className="flex gap-3 text-[11px] text-rl-muted">
                  <span className="flex items-center gap-1">
                    <GitFork className="w-3 h-3" />
                    {scenCount} cenário{scenCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {totalNodes} nó{totalNodes !== 1 ? 's' : ''}
                  </span>
                </div>

                <p className="text-[10px] text-rl-muted/70">
                  Editado em {fmtDate(f.updatedAt)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-rl-border mt-auto">
                  <button
                    onClick={() => onOpen(f.id)}
                    className="flex-1 btn-primary text-xs py-1.5 px-3"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => onDuplicate(f.id)}
                    title="Duplicar funil"
                    className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all border border-transparent hover:border-rl-border"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(f.id)}
                    title="Excluir funil"
                    className="p-1.5 rounded-lg text-rl-muted hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main FunilCanvas ─────────────────────────────────────────────────────────
export default function FunilCanvas() {
  const navigate    = useNavigate()
  const { teamMembers, squads } = useApp()
  const { toast, showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Funnel library state ─────────────────────────────────────────────────────
  const [funnels,         setFunnels]         = useState(() => initFunnels())
  const [activeFunnelId,  setActiveFunnelId]  = useState(null)
  const [activeScenId,    setActiveScenId]    = useState(null)
  const [renamingFunnel,  setRenamingFunnel]  = useState(false)
  const [funnelNameDraft, setFunnelNameDraft] = useState('')

  // ── View ────────────────────────────────────────────────────────────────────
  const [view, setView] = useState('canvas')

  // ── Canvas interaction ──────────────────────────────────────────────────────
  const [dragState,      setDragState]      = useState(null)
  const [connectingFrom, setConnectingFrom] = useState(null)
  const [selectedConnId, setSelectedConnId] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [editNode,       setEditNode]       = useState(null)

  const canvasRef = useRef(null)
  const saveTimer = useRef(null)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeFunnel   = funnels.find(f => f.id === activeFunnelId) ?? null
  const scenarios      = activeFunnel?.scenarios ?? []
  const activeId       = activeScenId
  const activeScenario = scenarios.find(s => s.id === activeId) ?? scenarios[0] ?? null

  const emptyCounts    = { all: 0, churn: 0 }
  const activeAccounts = teamMembers.filter(m => !m.disabled)

  const funnelMetrics = useMemo(
    () => computeMetrics(activeScenario),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(activeScenario)]
  )

  // ── Persistence (debounced) ──────────────────────────────────────────────────
  function debouncedSave(nextFunnels) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveFunnelsToLS(nextFunnels), 400)
  }

  // ── Funnel CRUD ───────────────────────────────────────────────────────────────
  function createFunnel() {
    const id      = crypto.randomUUID()
    const scen    = makeScenario('Cenário 1')
    const num     = funnels.length + 1
    const funnel  = {
      id,
      name:      `Novo Funil ${num}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scenarios: [scen],
    }
    setFunnels(prev => { const next = [...prev, funnel]; debouncedSave(next); return next })
    openFunnel(funnel)
  }

  function openFunnel(funnel) {
    setActiveFunnelId(funnel.id)
    setActiveScenId(funnel.scenarios?.[0]?.id ?? null)
    setView('canvas')
    setDragState(null); setConnectingFrom(null)
    setSelectedConnId(null); setSelectedNodeId(null); setEditNode(null)
  }

  function closeFunnel() {
    setActiveFunnelId(null); setActiveScenId(null)
  }

  function renameFunnel(funnelId, newName) {
    setFunnels(prev => {
      const next = prev.map(f => f.id === funnelId
        ? { ...f, name: newName.trim() || f.name, updatedAt: new Date().toISOString() }
        : f)
      debouncedSave(next); return next
    })
  }

  function duplicateFunnel(funnelId) {
    const src = funnels.find(f => f.id === funnelId)
    if (!src) return
    const newId = crypto.randomUUID()
    const newScenarios = (src.scenarios ?? []).map(s => {
      const nodeMap = new Map()
      const newNodes = (s.nodes ?? []).map(n => { const nid = crypto.randomUUID(); nodeMap.set(n.id, nid); return { ...n, id: nid } })
      const newConns = (s.connections ?? []).map(c => ({ ...c, id: crypto.randomUUID(), fromId: nodeMap.get(c.fromId) ?? c.fromId, toId: nodeMap.get(c.toId) ?? c.toId }))
      return { ...s, id: crypto.randomUUID(), nodes: newNodes, connections: newConns }
    })
    const copy = { id: newId, name: `${src.name} (cópia)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), scenarios: newScenarios }
    setFunnels(prev => { const next = [...prev, copy]; debouncedSave(next); return next })
    showToast('Funil duplicado!')
  }

  function deleteFunnel(funnelId) {
    if (!window.confirm('Excluir este funil? Esta ação não pode ser desfeita.')) return
    setFunnels(prev => { const next = prev.filter(f => f.id !== funnelId); debouncedSave(next); return next })
    if (activeFunnelId === funnelId) closeFunnel()
  }

  // ── Patch active funnel helper ────────────────────────────────────────────────
  function patchActiveFunnel(fn) {
    if (!activeFunnelId) return
    setFunnels(prev => {
      const next = prev.map(f => f.id !== activeFunnelId ? f : { ...fn(f), updatedAt: new Date().toISOString() })
      debouncedSave(next); return next
    })
  }

  // ── Scenario mutators ─────────────────────────────────────────────────────────
  function patchScenario(scenId, fn) {
    patchActiveFunnel(f => ({ ...f, scenarios: f.scenarios.map(s => s.id === scenId ? fn(s) : s) }))
  }

  function addNode(type, x, y) {
    if (TRAFFIC_TYPES.includes(type)) {
      const hasSameType = activeScenario?.nodes.some(n => n.type === type)
      if (hasSameType) { showToast(`Já existe um nó de ${getNodeDef(type).label} neste cenário`, 'error'); return }
    }
    const def     = getNodeDef(type)
    const newNode = { id: crypto.randomUUID(), type, label: def.label, x: Math.max(0, x - NODE_W / 2), y: Math.max(0, y - NODE_H / 2), conversionRate: DEFAULT_CONV[type] ?? 100, notes: '' }
    patchScenario(activeId, s => ({ ...s, nodes: [...s.nodes, newNode] }))
  }

  function updateNode(nodeId, patch) {
    patchScenario(activeId, s => ({ ...s, nodes: s.nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n) }))
  }

  function deleteNode(nodeId) {
    patchScenario(activeId, s => ({ ...s, nodes: s.nodes.filter(n => n.id !== nodeId), connections: s.connections.filter(c => c.fromId !== nodeId && c.toId !== nodeId) }))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
    if (connectingFrom?.nodeId === nodeId) setConnectingFrom(null)
  }

  function addConnection(fromId, fromPort, toId) {
    if (fromId === toId) { setConnectingFrom(null); return }
    const conns = activeScenario.connections
    // Each output port may have only one outgoing connection
    if (conns.some(c => c.fromId === fromId && (c.fromPort || 'yes') === fromPort)) {
      showToast('Esta porta já está conectada', 'error'); setConnectingFrom(null); return
    }
    if (conns.some(c => c.fromId === fromId && (c.fromPort || 'yes') === fromPort && c.toId === toId)) {
      showToast('Conexão já existe', 'error'); setConnectingFrom(null); return
    }
    if (canReach(toId, fromId, conns)) { showToast('Conexão circular não é permitida', 'error'); setConnectingFrom(null); return }
    patchScenario(activeId, s => ({ ...s, connections: [...s.connections, { id: crypto.randomUUID(), fromId, fromPort, toId }] }))
    setConnectingFrom(null)
  }

  function deleteConnection(connId) {
    patchScenario(activeId, s => ({ ...s, connections: s.connections.filter(c => c.id !== connId) }))
    setSelectedConnId(null)
  }

  function updateCalc(field, value) {
    patchScenario(activeId, s => ({ ...s, calc: { ...s.calc, [field]: value } }))
  }

  // ── Scenario management ──────────────────────────────────────────────────────
  function addScenario() {
    if (scenarios.length >= MAX_SCENARIOS) { showToast(`Máximo de ${MAX_SCENARIOS} cenários`, 'error'); return }
    const s = makeScenario(`Cenário ${scenarios.length + 1}`)
    patchActiveFunnel(f => ({ ...f, scenarios: [...f.scenarios, s] }))
    setActiveScenId(s.id)
  }

  function duplicateScenario() {
    if (scenarios.length >= MAX_SCENARIOS) { showToast(`Máximo de ${MAX_SCENARIOS} cenários`, 'error'); return }
    const src = activeScenario
    const dup = { ...JSON.parse(JSON.stringify(src)), id: crypto.randomUUID(), name: `${src.name} (cópia)` }
    patchActiveFunnel(f => ({ ...f, scenarios: [...f.scenarios, dup] }))
    setActiveScenId(dup.id)
  }

  function deleteScenario(id) {
    if (scenarios.length <= 1) { showToast('Deve existir ao menos 1 cenário', 'error'); return }
    const next    = scenarios.filter(s => s.id !== id)
    const nextAct = id === activeId ? next[0].id : activeId
    patchActiveFunnel(f => ({ ...f, scenarios: next }))
    setActiveScenId(nextAct)
  }

  function renameScenario(id, name) {
    patchScenario(id, s => ({ ...s, name: name.trim() || s.name }))
  }

  function switchScenario(id) {
    setActiveScenId(id); setSelectedNodeId(null); setSelectedConnId(null); setConnectingFrom(null)
  }

  // ── Canvas mouse events ──────────────────────────────────────────────────────
  function onNodeMouseDown(e, node) {
    e.preventDefault()
    e.stopPropagation()
    if (connectingFrom) { addConnection(connectingFrom.nodeId, connectingFrom.port, node.id); return }
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    setDragState({
      nodeId: node.id,
      startMouseX: e.clientX - rect.left + canvas.scrollLeft,
      startMouseY: e.clientY - rect.top  + canvas.scrollTop,
      origNodeX: node.x,
      origNodeY: node.y,
    })
    setSelectedNodeId(node.id)
    setSelectedConnId(null)
  }

  function onCanvasMouseMove(e) {
    if (!dragState) return
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left + canvas.scrollLeft
    const my = e.clientY - rect.top  + canvas.scrollTop
    const dx = mx - dragState.startMouseX
    const dy = my - dragState.startMouseY
    updateNode(dragState.nodeId, {
      x: Math.max(0, dragState.origNodeX + dx),
      y: Math.max(0, dragState.origNodeY + dy),
    })
  }

  function onCanvasMouseUp() {
    setDragState(null)
  }

  function onCanvasDrop(e) {
    e.preventDefault()
    const type   = e.dataTransfer.getData('nodeType')
    if (!type) return
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left + canvas.scrollLeft
    const y = e.clientY - rect.top  + canvas.scrollTop
    addNode(type, x, y)
  }

  function onCanvasClick(e) {
    if (e.target === canvasRef.current || e.target.closest('.canvas-inner')) {
      if (connectingFrom) { setConnectingFrom(null); return }
      setSelectedNodeId(null)
      setSelectedConnId(null)
    }
  }

  // Listen for custom conversionRate update events from the node's inline input
  useEffect(() => {
    function handleNodeUpdate(e) {
      const { id, conversionRate } = e.detail
      updateNode(id, { conversionRate })
    }
    document.addEventListener('nodeUpdate', handleNodeUpdate)
    return () => document.removeEventListener('nodeUpdate', handleNodeUpdate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFunnelId, activeScenId])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        setConnectingFrom(null)
        setSelectedConnId(null)
        setSelectedNodeId(null)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (selectedConnId) deleteConnection(selectedConnId)
        else if (selectedNodeId) deleteNode(selectedNodeId)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnId, selectedNodeId])

  // ── Render ───────────────────────────────────────────────────────────────────
  const VIEW_TABS = [
    { id: 'canvas',    label: 'Canvas' },
    { id: 'metrics',   label: 'Métricas' },
    { id: 'scenarios', label: 'Cenários' },
  ]

  return (
    <div className="min-h-screen flex bg-gradient-dark">

      <AppSidebar
        filter="all"
        setFilter={() => navigate('/')}
        counts={emptyCounts}
        activeAccounts={activeAccounts}
        squads={squads}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <GitFork className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">
              {activeFunnel ? activeFunnel.name : 'Funil de Vendas'}
            </span>
          </div>
        </div>

        {/* ── LIBRARY view (no active funnel) ───────────────────────────────── */}
        {!activeFunnelId && (
          <>
            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-rl-border bg-rl-surface">
              <div className="hidden lg:flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-rl flex items-center justify-center">
                  <GitFork className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-sm text-rl-text">Funil de Vendas</span>
              </div>
            </div>
            <FunnelList
              funnels={funnels}
              onOpen={id => { const f = funnels.find(x => x.id === id); if (f) openFunnel(f) }}
              onCreate={createFunnel}
              onDuplicate={duplicateFunnel}
              onRename={renameFunnel}
              onDelete={deleteFunnel}
            />
          </>
        )}

        {/* ── CANVAS view (active funnel open) ──────────────────────────────── */}
        {activeFunnelId && activeScenario && (
          <>
            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-rl-border bg-rl-surface">

              {/* Back + funnel name */}
              <button
                onClick={closeFunnel}
                className="hidden lg:flex items-center gap-1.5 text-rl-muted hover:text-rl-text transition-colors group"
                title="Voltar à lista de funis"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-medium">Funis</span>
              </button>

              <div className="hidden lg:block w-px h-5 bg-rl-border" />

              {/* Funnel name (inline editable) */}
              {renamingFunnel ? (
                <input
                  value={funnelNameDraft}
                  onChange={e => setFunnelNameDraft(e.target.value)}
                  onBlur={() => { renameFunnel(activeFunnelId, funnelNameDraft); setRenamingFunnel(false) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { renameFunnel(activeFunnelId, funnelNameDraft); setRenamingFunnel(false) }
                    if (e.key === 'Escape') setRenamingFunnel(false)
                  }}
                  className="text-sm font-bold text-rl-text bg-transparent border-b border-rl-purple outline-none w-48"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => { setFunnelNameDraft(activeFunnel.name); setRenamingFunnel(true) }}
                  className="hidden lg:flex items-center gap-1.5 group"
                  title="Renomear funil"
                >
                  <span className="text-sm font-bold text-rl-text">{activeFunnel.name}</span>
                  <Pencil className="w-3 h-3 text-rl-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              <div className="hidden lg:block w-px h-5 bg-rl-border" />

              {/* View tabs */}
              <div className="flex items-center gap-0.5 p-0.5 bg-rl-bg rounded-lg border border-rl-border">
                {VIEW_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setView(t.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      view === t.id ? 'bg-white shadow text-rl-text' : 'text-rl-muted hover:text-rl-text'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-rl-border" />

              {/* Scenario tabs */}
              <div className="flex items-center gap-1">
                {scenarios.map(s => (
                  <button
                    key={s.id}
                    onClick={() => switchScenario(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      s.id === activeId
                        ? 'bg-rl-purple/10 border-rl-purple/30 text-rl-purple'
                        : 'border-transparent text-rl-muted hover:text-rl-text hover:bg-rl-surface'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
                {scenarios.length < MAX_SCENARIOS && (
                  <button onClick={addScenario} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all" title="Adicionar cenário">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1" />

              {/* Keyboard hints */}
              {view === 'canvas' && (
                <div className="hidden xl:flex items-center gap-3 text-[10px] text-rl-muted">
                  <span className="text-green-600 font-medium">SIM</span><span>→ convertidos</span>
                  <span className="text-red-500 font-medium">NÃO</span><span>→ não convertidos</span>
                  <span>2× clique → editar</span>
                  <span>Del → excluir</span>
                  <span>Esc → cancelar</span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 flex min-h-0">

              {/* Palette (canvas view only) */}
              {view === 'canvas' && (
                <PalettePanel onAddNode={(type) => {
                  const canvas = canvasRef.current
                  const x = canvas ? canvas.scrollLeft + canvas.clientWidth / 2 : 300
                  const y = canvas ? canvas.scrollTop  + canvas.clientHeight / 2 : 200
                  addNode(type, x, y)
                }} />
              )}

              {/* Canvas */}
              {view === 'canvas' && (
                <div
                  ref={canvasRef}
                  className="flex-1 relative canvas-grid"
                  style={{ overflow: dragState ? 'hidden' : 'auto', cursor: connectingFrom ? 'crosshair' : 'default' }}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onMouseLeave={onCanvasMouseUp}
                  onDragOver={e => e.preventDefault()}
                  onDrop={onCanvasDrop}
                  onClick={onCanvasClick}
                >
                  <div className="canvas-inner" style={{ width: CANVAS_W, height: CANVAS_H, position: 'relative' }}>
                    <SVGConnections
                      connections={activeScenario.connections}
                      nodes={activeScenario.nodes}
                      selectedConnId={selectedConnId}
                      onSelectConn={id => { setSelectedConnId(id); setSelectedNodeId(null) }}
                    />
                    {activeScenario.nodes.map(node => {
                      const stage = funnelMetrics.stages.find(s => s.node.id === node.id)
                      const totalBudget = funnelMetrics.summary?.totalBudget ?? 0
                      const nodeCpl = (node.type === 'optinpage' && stage?.converted > 0 && totalBudget > 0)
                        ? totalBudget / stage.converted
                        : null
                      return (
                        <div key={node.id} className="group">
                          <FunnelNode
                            node={node}
                            isSelected={selectedNodeId === node.id}
                            isConnecting={connectingFrom?.nodeId === node.id}
                            connectingFrom={connectingFrom}
                            visitorCount={stage?.visitors}
                            convertedCount={stage?.converted}
                            cpl={nodeCpl}
                            onMouseDown={e => onNodeMouseDown(e, node)}
                            onOutputPortClick={port => {
                              if (connectingFrom?.nodeId === node.id) { setConnectingFrom(null); return }
                              if (connectingFrom) { addConnection(connectingFrom.nodeId, connectingFrom.port, node.id); return }
                              setConnectingFrom({ nodeId: node.id, port })
                            }}
                            onInputPortClick={() => {
                              if (connectingFrom && connectingFrom.nodeId !== node.id)
                                addConnection(connectingFrom.nodeId, connectingFrom.port, node.id)
                            }}
                            onDoubleClick={() => setEditNode(node)}
                            onDelete={() => deleteNode(node.id)}
                          />
                        </div>
                      )
                    })}
                    {activeScenario.nodes.length === 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <GitFork className="w-12 h-12 text-rl-muted/30 mb-3" />
                        <h3 className="text-base font-semibold text-rl-muted/60 mb-1">Canvas vazio</h3>
                        <p className="text-sm text-rl-muted/40 mb-4">Arraste elementos da paleta à esquerda ou clique para começar</p>
                        <div className="pointer-events-auto flex gap-2">
                          <button onClick={() => addNode('meta', 300, 200)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-blue-200 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                            <NodeIcon type="meta" size={18} /> Meta Ads
                          </button>
                          <button onClick={() => addNode('google', 520, 200)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all shadow-sm">
                            <NodeIcon type="google" size={18} /> Google Ads
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {view === 'metrics' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <MetricsView metrics={funnelMetrics} scenarioName={activeScenario.name} />
                </div>
              )}

              {view === 'scenarios' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <ScenariosView
                    scenarios={scenarios}
                    activeId={activeId}
                    onSwitch={switchScenario}
                    onDuplicate={duplicateScenario}
                    onDelete={deleteScenario}
                    onRename={renameScenario}
                  />
                </div>
              )}

              {/* Calculator sidebar */}
              <CalcSidebar
                scenario={activeScenario}
                metrics={funnelMetrics}
                onUpdateCalc={updateCalc}
              />
            </div>
          </>
        )}
      </div>

      {/* Node edit modal */}
      {editNode && (
        <NodeEditModal
          node={editNode}
          onSave={patch => updateNode(editNode.id, patch)}
          onClose={() => setEditNode(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
