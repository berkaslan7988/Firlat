import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Laptop, Monitor, Moon, Smartphone, Sun, SunMoon, Tablet, X } from 'lucide-react'
import { barWidths, canPreview, copyText, ext, store, trackingCode } from './lib.js'
import { dismissToast, fileUrl, reveal, useStore } from './store.js'
import { getLang, setLang, t, useLang } from './i18n.js'

// ------------------------------------------------------------ brand
/** A parcel thrown along a dashed trail. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path className="trail" d="M1 12h7M3 17h5M1 22h7" />
      <g transform="rotate(-10 20 16)">
        <rect x="12" y="8" width="16" height="16" rx="2" />
        <path className="tape" d="M20 8v6" />
      </g>
    </svg>
  )
}

export function Brand({ busy }) {
  return (
    <a className={`brand${busy ? ' busy' : ''}`} href="/" aria-label="Fırlat">
      <BrandMark />
      <span className="wordmark">FIRLAT</span>
    </a>
  )
}

// ------------------------------------------------------------ theme and language
const THEMES = ['system', 'light', 'dark']
export function useTheme() {
  const [pref, setPref] = useState(() => store.get('theme', 'system'))
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const th = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref
      document.documentElement.dataset.theme = th
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th === 'dark' ? '#0d0d0d' : '#e8dfcf')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])
  const cycle = () => {
    const next = THEMES[(THEMES.indexOf(pref) + 1) % THEMES.length]
    store.set('theme', next)
    setPref(next)
  }
  return [pref, cycle]
}

export function ThemeButton() {
  useLang()
  const [pref, cycle] = useTheme()
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : SunMoon
  const label = { system: t('Tema: sistem'), light: t('Tema: açık'), dark: t('Tema: koyu') }[pref]
  return (
    <button className="icon-btn" onClick={cycle} title={label} aria-label={label}>
      <Icon size={18} />
    </button>
  )
}

export function LangSwitch() {
  const lang = useLang()
  return (
    <div className="lang-switch" role="group" aria-label={t('Dil')}>
      {['tr', 'en'].map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} title={l === 'tr' ? 'Türkçe' : 'English'} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------ devices
export function DeviceIcon({ kind, host, size = 17 }) {
  const Icon = host ? Monitor : kind === 'phone' ? Smartphone : kind === 'tablet' ? Tablet : Laptop
  return <Icon size={size} />
}

export function Avatar({ kind, host, me }) {
  return (
    <span className={`av${me ? ' me' : ''}`}>
      <DeviceIcon kind={kind} host={host} size={16} />
    </span>
  )
}

export function deviceKindLabel(d) {
  if (d.host) return t('Ana bilgisayar')
  return d.kind === 'phone' ? t('Telefon') : d.kind === 'tablet' ? t('Tablet') : t('Bilgisayar')
}

// ------------------------------------------------------------ label parts
/** The stencilled type box in a label's corner: JPG, PDF, TXT, ×12… */
export function KindBox({ item, count }) {
  let s = count ? `×${count}` : item.kind === 'text' ? (/^https?:\/\/\S+$/i.test(item.text.trim()) ? 'URL' : 'TXT') : ext(item.name) || t('DOSYA')
  if (s.length > 5) s = s.slice(0, 5)
  return <span className="kind" aria-hidden="true">{s}</span>
}

export function Barcode({ id }) {
  return (
    <div className="barcode">
      <div className="bars" aria-hidden="true">
        {barWidths(id).map((w, i) => (
          <span key={i} style={{ width: w }} />
        ))}
      </div>
      <span className="track">{trackingCode(id)}</span>
    </div>
  )
}

export function Preview({ item }) {
  const [broken, setBroken] = useState(false)
  if (item.kind !== 'file' || !canPreview(item) || broken) return null
  return (
    <span className="preview">
      <img src={fileUrl(item.id, true)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
    </span>
  )
}

export function RouteArrow() {
  return (
    <svg className="route-arrow" width="28" height="20" viewBox="0 0 28 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 10h22M17 3l7 7-7 7" />
    </svg>
  )
}

// ------------------------------------------------------------ modal
export function Modal({ open, onClose, children, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const tm = setTimeout(() => {
      const f = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('input, textarea, button')
      f?.focus()
    }, 40)
    return () => {
      clearTimeout(tm)
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="modal"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ModalHead({ title, sub, onClose }) {
  return (
    <div className="modal-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      <button className="icon-btn sm" onClick={onClose} aria-label={t('Kapat')}>
        <X size={18} />
      </button>
    </div>
  )
}

// ------------------------------------------------------------ toasts
export function Toasts() {
  useLang()
  const toasts = useStore((s) => s.toasts)
  const run = async (tt) => {
    const a = tt.action
    if (a.copy != null) {
      const ok = await copyText(a.copy)
      dismissToast(tt.id)
      if (!ok) alert(a.copy)
      return
    }
    if (a.href) {
      const el = document.createElement('a')
      el.href = a.href
      el.download = ''
      document.body.appendChild(el)
      el.click()
      el.remove()
    }
    if (a.reveal !== undefined) reveal(a.reveal)
    dismissToast(tt.id)
  }
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((tt) => (
          <motion.div
            key={tt.id}
            className={`toast${tt.error ? ' error' : ''}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span>{tt.text}</span>
            {tt.action && (
              <button className="btn sm" onClick={() => run(tt)}>
                {tt.action.label}
              </button>
            )}
            <button className="icon-btn" onClick={() => dismissToast(tt.id)} aria-label={t('Kapat')}>
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export { getLang }
