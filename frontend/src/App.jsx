import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle, Pencil, RefreshCw, Shuffle, Type, Upload, WifiOff } from 'lucide-react'
import { bytes, filesFromDrop, filesFromInput, randomName } from './lib.js'
import { boot, enqueue, pair, rename, useStore } from './store.js'
import { Avatar, Brand, LangSwitch, Modal, ModalHead, ThemeButton, Toasts } from './ui.jsx'
import { Composer, TextModal, targetLabel } from './Composer.jsx'
import { Incoming, Outgoing } from './Transfers.jsx'
import { Board } from './Board.jsx'
import { ConnectCard, Devices } from './Side.jsx'
import { t, tx, useLang } from './i18n.js'

function useScrolled() {
  const [s, setS] = useState(false)
  useEffect(() => {
    const on = () => setS(window.scrollY > 4)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return s
}

/** Devices online, parcels on the board and their weight, like a shipping manifest. */
function Manifest() {
  const devices = useStore((s) => s.devices)
  const items = useStore((s) => s.items)
  const total = items.reduce((a, i) => a + (i.kind === 'file' ? i.size : 0), 0)
  return (
    <span className="manifest">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span className="dot on" />
        {t('{n} cihaz çevrimiçi', { n: devices.length || 1 })}
      </span>
      <span className="sep" />
      <span>{t('{n} koli · {size}', { n: items.length, size: bytes(total) })}</span>
    </span>
  )
}

function Header({ onName }) {
  const scrolled = useScrolled()
  const phase = useStore((s) => s.phase)
  const me = useStore((s) => s.me)
  const host = useStore((s) => s.host)
  const busy = useStore((s) => s.uploads.some((u) => u.status === 'sending') || Object.keys(s.incoming).length > 0)
  return (
    <header className={`hdr${scrolled ? ' scrolled' : ''}`}>
      <div className="wrap">
        <Brand busy={busy} />
        <span className="badge">{t('YEREL AĞ')}</span>
        <div className="hdr-right">
          {phase === 'ready' && me.kind === 'desktop' && <Manifest />}
          <LangSwitch />
          <ThemeButton />
          {phase === 'ready' && (
            <button className="me-chip" onClick={onName} title={t('Cihaz adını değiştir')}>
              <Avatar kind={me.kind} host={host} me />
              <span className="nm">{me.name}</span>
              <Pencil size={14} className="pen" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function PairScreen() {
  const me = useStore((s) => s.me)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(true)
  const inputRef = useRef(null)
  const submit = async (c) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await pair(c)
    } catch (e) {
      setErr(tx(e.message) || t('Olmadı, tekrar dene.'))
      setBad(true)
      setTimeout(() => setBad(false), 400)
      setCode('')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }
  const cells = Array.from({ length: 6 }, (_, i) => (
    <span key={i} className={`digit${code[i] ? ' filled' : ''}${focused && i === Math.min(code.length, 5) && !busy && !code[i] ? ' cur' : ''}`}>
      {code[i] || ''}
    </span>
  ))
  return (
    <main className="pair-wrap">
      <section className="label pair" aria-labelledby="pair-title">
        <div className="label-route">
          <span className="eyebrow">{t('Eşleşme · 1 / 1')}</span>
          <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>
            {t('Bir kez yeter')}
          </span>
        </div>
        <div className="pair-body">
          <h1 id="pair-title">{t('Etiketteki kodu gir.')}</h1>
          <p>{t('Fırlat’ın açık olduğu bilgisayarda “Telefonu bağla” etiketinde 6 haneli bir kod var. Bu cihaz sonra hatırlanır.')}</p>
          <label className={`otp${bad ? ' bad' : ''}`}>
            {cells.slice(0, 3)}
            <span className="dash" aria-hidden="true" />
            {cells.slice(3)}
            <input
              ref={inputRef}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={t('Eşleşme kodu')}
              value={code}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(v)
                setErr('')
                if (v.length === 6) submit(v)
              }}
            />
          </label>
          <p className="pair-err" role="alert">
            {busy ? (
              <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <LoaderCircle size={14} className="spin" /> {t('Bakılıyor…')}
              </span>
            ) : (
              err
            )}
          </p>
        </div>
        <div className="pair-foot">
          <div style={{ minWidth: 0 }}>
            <span className="cap">{t('Bu cihazın adı')}</span>
            <span className="place">{me.name || '—'}</span>
          </div>
        </div>
      </section>
      <p className="pair-note">{t('QR’ı okuttuysan bu ekranı görmemen gerekirdi; kod yenilenmiş olabilir. Bilgisayardaki etikette güncel kod yazar.')}</p>
    </main>
  )
}

function Down() {
  return (
    <main className="center">
      <div className="box">
        <WifiOff size={36} strokeWidth={1.5} style={{ color: 'var(--ink-3)' }} />
        <h2>{t('Ana bilgisayara ulaşılamıyor')}</h2>
        <p>{t('Fırlat kapatılmış ya da bu cihaz ağdan düşmüş olabilir. Bilgisayarda açık olduğundan emin ol.')}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          <RefreshCw size={16} />
          {t('Tekrar dene')}
        </button>
      </div>
    </main>
  )
}

function NameModal({ open, onClose }) {
  const me = useStore((s) => s.me)
  const [name, setName] = useState(me.name || '')
  useEffect(() => {
    if (open) setName(me.name || '')
  }, [open, me.name])
  const save = () => {
    if (!name.trim()) return
    rename(name)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} label={t('Cihaz adı')}>
      <ModalHead title={t('Bu cihazın adı')} sub={t('Diğerleri seni bu adla görür; gönderdiklerinin etiketinde de yazar.')} onClose={onClose} />
      <div className="field-row">
        <input
          className="field"
          data-autofocus
          value={name}
          maxLength={40}
          autoComplete="off"
          aria-label={t('Cihaz adı')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button className="icon-btn" style={{ width: 46, height: 46 }} onClick={() => setName(randomName())} title={t('Rastgele ad')} aria-label={t('Rastgele ad')}>
          <Shuffle size={17} />
        </button>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          {t('Vazgeç')}
        </button>
        <button className="btn primary" onClick={save} disabled={!name.trim()}>
          {t('Kaydet')}
        </button>
      </div>
    </Modal>
  )
}

function DropOverlay({ show }) {
  const devices = useStore((s) => s.devices)
  const target = useStore((s) => s.target)
  if (!show) return null
  return (
    <div className="drop-overlay">
      <div className="frame">
        <div className="inner">
          <h2>{t('Bırak, fırlasın.')}</h2>
          <p>{t('ALICI: {to}', { to: targetLabel(target, devices).toLocaleUpperCase() })}</p>
        </div>
      </div>
    </div>
  )
}

function Ready() {
  const host = useStore((s) => s.host)
  const devices = useStore((s) => s.devices)
  const target = useStore((s) => s.target)
  const fileRef = useRef(null)
  const dirRef = useRef(null)
  const composerRef = useRef(null)
  const [text, setText] = useState(null)
  const [over, setOver] = useState(false)
  const [dockHidden, setDockHidden] = useState(true)

  const pick = useCallback(() => fileRef.current?.click(), [])
  const pickDir = useCallback(() => dirRef.current?.click(), [])

  // Drag and drop anywhere on the page
  useEffect(() => {
    let depth = 0
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const enter = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setOver(true)
    }
    const overH = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const leave = (e) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setOver(false)
    }
    const drop = async (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      enqueue(await filesFromDrop(e.dataTransfer))
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', overH)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', overH)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  // Paste: files are sent, text opens the text dialog
  useEffect(() => {
    const onPaste = (e) => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (document.querySelector('.overlay')) return
      const files = Array.from(e.clipboardData?.files || [])
      if (files.length) {
        e.preventDefault()
        enqueue(files.map((file) => ({ file, rel: null })))
        return
      }
      const tt = e.clipboardData?.getData('text')
      if (tt && tt.trim()) {
        e.preventDefault()
        setText(tt)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // Phone: show the sticky dock when the loading dock is off screen
  useEffect(() => {
    const el = composerRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setDockHidden(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    document.body.classList.add('has-dock')
    return () => document.body.classList.remove('has-dock')
  }, [])

  return (
    <>
      <main className="wrap main">
        <div className="col">
          <div ref={composerRef}>
            <Composer onPick={pick} onPickFolder={pickDir} onText={setText} over={over} />
          </div>
          <Outgoing />
          <Incoming />
          <Board />
        </div>
        <aside className="side">
          {host && <ConnectCard />}
          <Devices />
        </aside>
      </main>
      <footer className="foot">
        <div className="wrap">
          <span>{t('Dosyalar bu ağdan çıkmaz.')}</span>
          <span>{t('Sürükle-bırak ve yapıştır her yerde çalışır.')}</span>
        </div>
      </footer>

      <div className={`mdock${dockHidden ? ' hidden' : ''}`}>
        <button className="btn primary lg" onClick={pick}>
          <Upload size={19} />
          <span>
            {t('Dosya fırlat')}
            <span className="to">{t('ALICI: {to}', { to: targetLabel(target, devices).toLocaleUpperCase() })}</span>
          </span>
        </button>
        <button className="btn lg" onClick={() => setText('')} aria-label={t('Metin gönder')}>
          <Type size={19} />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          enqueue(filesFromInput(e.target.files))
          e.target.value = ''
        }}
      />
      <input
        ref={dirRef}
        type="file"
        hidden
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          enqueue(filesFromInput(e.target.files))
          e.target.value = ''
        }}
      />
      <TextModal open={text !== null} initial={text} onClose={() => setText(null)} />
      <DropOverlay show={over} />
    </>
  )
}

export default function App() {
  useLang() // re-render everything when the language changes
  const phase = useStore((s) => s.phase)
  const [nameOpen, setNameOpen] = useState(false)
  useEffect(() => {
    boot()
  }, [])
  return (
    <>
      <Header onName={() => setNameOpen(true)} />
      {phase === 'loading' && (
        <main className="center">
          <LoaderCircle size={26} className="spin" style={{ color: 'var(--ink-3)' }} />
        </main>
      )}
      {phase === 'pair' && <PairScreen />}
      {phase === 'down' && <Down />}
      {phase === 'ready' && <Ready />}
      <NameModal open={nameOpen} onClose={() => setNameOpen(false)} />
      <Toasts />
    </>
  )
}
