import { Check, CircleAlert, X } from 'lucide-react'
import { bytes, eta, rate } from './lib.js'
import { cancelAll, cancelUpload, useStore } from './store.js'
import { targetLabel } from './Composer.jsx'
import { KindBox, RouteArrow } from './ui.jsx'
import { t } from './i18n.js'

const pctOf = (done, size) => Math.min(100, (done / Math.max(size, 1)) * 100)

/** Outgoing files ride a conveyor belt. */
export function Outgoing() {
  const uploads = useStore((s) => s.uploads)
  const devices = useStore((s) => s.devices)
  if (!uploads.length) return null
  const total = uploads.reduce((a, u) => a + u.size, 0)
  const done = uploads.reduce((a, u) => a + (u.status === 'done' ? u.size : u.done), 0)
  const speed = uploads.reduce((a, u) => a + (u.status === 'sending' ? u.rate : 0), 0)
  const finished = uploads.filter((u) => u.status === 'done').length
  const active = uploads.some((u) => u.status === 'sending' || u.status === 'queued')
  const pct = total ? (done / total) * 100 : 100
  const to = targetLabel(uploads[uploads.length - 1].to, devices)
  const shown = uploads.filter((u) => u.status !== 'done').slice(0, 4)
  const hidden = uploads.filter((u) => u.status !== 'done').length - shown.length
  const first = uploads[0].name.split('/')[0]
  const title = uploads.length > 1 ? t('{n} dosya', { n: uploads.length }) : first

  return (
    <section className="xfer" aria-label={t('Yolda')}>
      <div className="xfer-top">
        <span className={`xfer-tag${active ? '' : ' done'}`}>{active ? t('YOLDA') : t('TESLİM')}</span>
        <div className="xfer-head">
          <span className="nm">
            <b>{title}</b> <span className="muted">→ {to}</span>
          </span>
          <span className="r">
            {Math.floor(pct)}% · {active && speed > 0 ? `${rate(speed)} · ${eta((total - done) / speed)}` : t('{a}/{b} dosya', { a: finished, b: uploads.length })}
          </span>
        </div>
        {active && (
          <button className="icon-btn sm" onClick={cancelAll} aria-label={t('Hepsini durdur')} title={t('Hepsini durdur')}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className={`belt${active ? '' : ' done'}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(pct)} aria-label={t('Gönderim')}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {uploads.length > 1 && shown.length > 0 && (
        <div className="xfer-list">
          {shown.map((u) => (
            <div key={u.tid} className={`xrow ${u.status}`}>
              <span className="nm" title={u.name}>
                {u.name}
              </span>
              <span className="r">
                {u.status === 'queued' && t('sırada')}
                {u.status === 'sending' && `${Math.floor(pctOf(u.done, u.size))}% · ${rate(u.rate)}`}
                {u.status === 'error' && (
                  <>
                    <CircleAlert size={13} /> {u.error}
                  </>
                )}
                {u.status === 'done' && <Check size={13} />}
                {(u.status === 'queued' || u.status === 'sending') && (
                  <button className="icon-btn sm" style={{ width: 28, height: 28 }} onClick={() => cancelUpload(u.tid)} aria-label={t('Durdur')}>
                    <X size={13} />
                  </button>
                )}
              </span>
              <div className="belt sm">
                <i style={{ width: `${pctOf(u.done, u.size)}%` }} />
              </div>
            </div>
          ))}
          {hidden > 0 && <p className="xfer-more">{t('+{n} dosya daha sırada', { n: hidden })}</p>}
        </div>
      )}
      {uploads.length === 1 && uploads[0].status === 'error' && (
        <p className="xfer-more" style={{ color: 'var(--bad)' }}>
          {uploads[0].error}
        </p>
      )}
    </section>
  )
}

/** Incoming files print out of a slot as labels. */
export function Incoming() {
  const incoming = useStore((s) => s.incoming)
  const me = useStore((s) => s.me)
  const devices = useStore((s) => s.devices)
  const list = Object.values(incoming)
  if (!list.length) return null
  const speed = list.reduce((a, p) => a + (p.rate || 0), 0)
  const size = list.reduce((a, p) => a + p.size, 0)
  const done = list.reduce((a, p) => a + p.done, 0)
  const toName = (p) => (!p.to ? t('Herkese') : p.to === me.id ? me.name : devices.find((d) => d.id === p.to)?.name || t('Bir cihaz'))
  return (
    <section className="printer" aria-label={t('Geliyor')}>
      <div className="printer-head">
        <span className="eyebrow">
          {t('Geliyor')} · {Math.floor(pctOf(done, size))}%
        </span>
        <span className="eyebrow">{speed ? rate(speed) : bytes(size)}</span>
      </div>
      <div className="slot" aria-hidden="true" />
      <div className="feed">
        {list.slice(0, 3).map((p) => (
          <article key={p.tid} className="label">
            <div className="label-route">
              <div style={{ minWidth: 0 }}>
                <span className="cap">{t('Gönderen')}</span>
                <span className="place">{p.from.name}</span>
              </div>
              <RouteArrow />
              <div style={{ minWidth: 0 }}>
                <span className="cap">{t('Alıcı')}</span>
                <span className={`place${p.to === me.id ? ' me' : ''}`}>{toName(p)}</span>
              </div>
              <KindBox item={{ kind: 'file', name: p.name }} />
            </div>
            <div className="label-body">
              <div className="txt">
                <span className="label-name" title={p.name}>
                  {p.name}
                </span>
                <span className="label-meta">
                  {bytes(p.done)} / {bytes(p.size)}
                </span>
                <div className="belt sm" style={{ marginTop: 6 }}>
                  <i style={{ width: `${pctOf(p.done, p.size)}%` }} />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      {list.length > 3 && <p className="xfer-more" style={{ marginTop: 8 }}>{t('+{n} dosya daha geliyor', { n: list.length - 3 })}</p>}
    </section>
  )
}
