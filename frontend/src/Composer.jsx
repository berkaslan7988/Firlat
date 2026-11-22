import { useEffect, useState } from 'react'
import { FolderUp, ImageUp, Send, Type, Upload, Users } from 'lucide-react'
import { DeviceIcon, Modal, ModalHead, deviceKindLabel } from './ui.jsx'
import { sendText, setTarget, toast, useStore } from './store.js'
import { rich, t } from './i18n.js'

export function targetLabel(target, devices) {
  if (!target) return t('Herkese')
  const d = devices.find((x) => x.id === target)
  return d ? d.name : t('Herkese')
}

/** The recipient picker beside the dock: one route per device, plus "everyone". */
function Routes() {
  const devices = useStore((s) => s.devices)
  const me = useStore((s) => s.me)
  const target = useStore((s) => s.target)
  const others = devices.filter((d) => d.id !== me.id).sort((a, b) => Number(b.host) - Number(a.host))
  return (
    <fieldset className="routes">
      <legend className="eyebrow">{t('Alıcı')}</legend>
      <label className="route">
        <input type="radio" name="route" checked={!target} onChange={() => setTarget(null)} />
        <span className="route-body">
          <span className="nm">{t('Herkese')}</span>
          <span className="note">{t('Bağlı her cihazın panosuna')}</span>
        </span>
        <Users size={17} className="ic" />
      </label>
      {others.map((d) => (
        <label key={d.id} className="route">
          <input type="radio" name="route" checked={target === d.id} onChange={() => setTarget(d.id)} />
          <span className="route-body">
            <span className="nm">{d.name}</span>
            <span className="note">{t('{kind} · yalnızca o görür', { kind: deviceKindLabel(d) })}</span>
          </span>
          <span className="ic">
            <DeviceIcon kind={d.kind} host={d.host} />
          </span>
        </label>
      ))}
      {others.length === 0 && <p className="note muted" style={{ fontSize: '.82rem' }}>{t('Başka cihaz bağlanınca burada rota olarak belirir.')}</p>}
    </fieldset>
  )
}

export function Composer({ onPick, onPickFolder, onText, over }) {
  const touch = useStore((s) => s.me.kind !== 'desktop')
  return (
    <section className={`dock-frame${over ? ' over' : ''}`} aria-label={t('Yükleme rampası')}>
      <div className="dock">
        <div className="dock-main">
          <span className="eyebrow">{t('Rampa 01 · yükleme')}</span>
          <h1>
            {t('Bırak,')}
            <br />
            {t('fırlasın.')}
          </h1>
          <p>
            {touch
              ? t('Fotoğraf, video, belge ya da metin. Boyut sınırı yok, sıkıştırma yok.')
              : rich('Dosya, klasör ya da metin. Boyut sınırı yok, sıkıştırma yok; yapıştırmak için {keys}.', {
                  keys: (
                    <>
                      <kbd>Ctrl</kbd> <kbd>V</kbd>
                    </>
                  ),
                })}
          </p>
          <div className="dock-actions">
            <button className="btn primary lg" onClick={onPick}>
              {touch ? <ImageUp size={19} /> : <Upload size={19} />}
              {touch ? t('Dosya ya da fotoğraf') : t('Dosya seç')}
            </button>
            {!touch && (
              <button className="btn lg" onClick={onPickFolder}>
                <FolderUp size={18} />
                {t('Klasör')}
              </button>
            )}
            <button className="btn lg" onClick={() => onText('')}>
              <Type size={18} />
              {t('Metin')}
            </button>
          </div>
        </div>
        <Routes />
      </div>
    </section>
  )
}

export function TextModal({ open, initial, onClose }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const devices = useStore((s) => s.devices)
  const target = useStore((s) => s.target)
  useEffect(() => {
    if (open) setText(initial || '')
  }, [open, initial])
  const submit = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await sendText(text)
      toast(t('Metin gitti.'))
      onClose()
    } catch (e) {
      toast(e.message, { error: true })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} label={t('Metin gönder')}>
      <ModalHead
        title={t('Metin fırlat')}
        sub={t('Link, adres, kod, alışveriş listesi… Alıcı: {to}.', { to: targetLabel(target, devices) })}
        onClose={onClose}
      />
      <textarea
        className="field"
        data-autofocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
        }}
        placeholder={t('Buraya yaz ya da yapıştır')}
        aria-label={t('Metin')}
      />
      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          {t('Vazgeç')}
        </button>
        <button className="btn primary" onClick={submit} disabled={!text.trim() || busy}>
          <Send size={16} />
          {t('Gönder')}
        </button>
      </div>
    </Modal>
  )
}
