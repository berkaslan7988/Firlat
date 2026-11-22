import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, ChevronDown, Copy, Info } from 'lucide-react'
import { bytes, copyText } from './lib.js'
import { setTarget, toast, useStore } from './store.js'
import { Avatar, deviceKindLabel } from './ui.jsx'
import { t } from './i18n.js'

/** The last two folders of a path: C:\Users\me\Downloads\Fırlat → …\Downloads\Fırlat */
function shortPath(p) {
  const sep = p.includes('\\') ? '\\' : '/'
  const parts = p.split(/[\\/]+/).filter(Boolean)
  return parts.length > 2 ? `…${sep}${parts.slice(-2).join(sep)}` : p
}

function QR({ text }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, text, { margin: 0, width: 320, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#00000000' } })
  }, [text])
  return (
    <div className="qr">
      <canvas ref={ref} role="img" aria-label={t('Bağlantı QR kodu')} />
    </div>
  )
}

function CopyAddr({ url }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="addr">
      <div style={{ minWidth: 0 }}>
        <span className="cap">{t('Adres')}</span>
        <code title={url}>{url.replace(/^https?:\/\//, '')}</code>
      </div>
      <button
        className="icon-btn"
        aria-label={t('Adresi kopyala')}
        onClick={async () => {
          if (await copyText(url)) {
            setOk(true)
            setTimeout(() => setOk(false), 1400)
          }
        }}
      >
        {ok ? <Check size={17} /> : <Copy size={17} />}
      </button>
    </div>
  )
}

/** "Connect a phone" is a printed shipping label taped to the side. */
export function ConnectCard() {
  const server = useStore((s) => s.server)
  const devices = useStore((s) => s.devices)
  const [ipIdx, setIpIdx] = useState(0)
  if (!server) return null
  const ips = server.ips || []
  const ip = ips[ipIdx] || ips[0]
  if (!ip) {
    return (
      <section className="connect" aria-label={t('Telefonu bağla')}>
        <span className="tape" aria-hidden="true" />
        <div className="connect-head">
          <h2>{t('Ağ bulunamadı')}</h2>
        </div>
        <div className="hint" style={{ borderBottom: 0 }}>
          <Info size={16} />
          <span>{t('Bu bilgisayar bir Wi-Fi ya da kablolu ağa bağlı görünmüyor. Bağlanınca sayfayı yenile.')}</span>
        </div>
      </section>
    )
  }
  const base = `http://${ip}:${server.port}`
  const link = server.pair_code ? `${base}/?pair=${server.pair_code}` : base
  const remote = devices.some((d) => !d.host)
  return (
    <section className="connect" aria-label={t('Telefonu bağla')}>
      <span className="tape" aria-hidden="true" />
      <div className="connect-head">
        <h2>
          {t('Telefonu')}
          <br />
          {t('bağla')}
        </h2>
        <span className="eyebrow">
          {t('Aynı Wi-Fi')}
          <br />
          {t('Bulut yok')}
        </span>
      </div>
      <div className="qr-row">
        <QR text={link} />
        <p>{t('Telefonun kamerasıyla okut; eşleşme kendiliğinden olur.')}</p>
      </div>
      {server.pair_code && (
        <div className="cells">
          <div className="cell">
            <span className="cap">{t('Eşleşme kodu')}</span>
            <div className="code">
              {server.pair_code.slice(0, 3)} {server.pair_code.slice(3)}
            </div>
          </div>
          <div className="cell">
            <span className="cap">{t('Geçerli')}</span>
            <p style={{ fontSize: '.86rem', marginTop: 4 }}>{t('Bu açılış boyunca. Eşleşen cihaz hatırlanır.')}</p>
          </div>
        </div>
      )}
      <CopyAddr url={base} />
      {ips.length > 1 && (
        <details className="ips">
          <summary>
            {t('Diğer adresler')} <ChevronDown size={14} />
          </summary>
          <ul>
            {ips.map((x, i) => (
              <li key={x}>
                <button aria-pressed={i === ipIdx} onClick={() => setIpIdx(i)}>
                  {i === ipIdx ? '● ' : '○ '}
                  {x}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!remote && !server.ever_remote && (
        <div className="hint">
          <Info size={16} />
          <span>
            {t(
              'Telefon sayfayı açamıyorsa: iki cihaz aynı ağda mı bak; Windows Güvenlik Duvarı sorarsa Python’a Özel ağlar için izin ver. Birden çok adres varsa “Diğer adresler”den başkasını dene.',
            )}
          </span>
        </div>
      )}
      {server.save_dir && (
        <div className="save" title={server.save_dir}>
          <span className="cap">{t('Gelenler')}</span>
          <span className="mono">{shortPath(server.save_dir)}</span>
          {server.free > 0 && <span className="muted"> · {t('{size} boş', { size: bytes(server.free) })}</span>}
        </div>
      )}
    </section>
  )
}

export function Devices() {
  const devices = useStore((s) => s.devices)
  const me = useStore((s) => s.me)
  const host = useStore((s) => s.host)
  const target = useStore((s) => s.target)
  const live = useStore((s) => s.live)
  const others = devices.filter((d) => d.id !== me.id)
  const sorted = [...others].sort((a, b) => Number(b.host) - Number(a.host))
  return (
    <section className="panel" aria-label={t('Ağdakiler')}>
      <div className="panel-head">
        <h2>{t('Ağdakiler')}</h2>
        <span className="eyebrow">{t('{n} cihaz', { n: others.length + 1 })}</span>
      </div>
      <div className="dev">
        <Avatar kind={me.kind} host={host} me />
        <div className="who">
          <span className="nm">{me.name}</span>
          <span className="sub">{host ? t('Bu bilgisayar · ana istasyon') : t('Bu cihaz')}</span>
        </div>
        <span className="state">
          <span className={`dot${live ? ' on' : ''}`} />
          {t('SEN')}
        </span>
      </div>
      {sorted.map((d) => (
        <button
          key={d.id}
          className="dev"
          aria-pressed={target === d.id}
          onClick={() => {
            const next = target === d.id ? null : d.id
            setTarget(next)
            if (next) toast(t('Şimdi yalnızca {name} cihazına gönderiyorsun.', { name: d.name }))
          }}
          title={target === d.id ? t('Herkese göndermeye dön') : t('Yalnızca {name} cihazına gönder', { name: d.name })}
        >
          <Avatar kind={d.kind} host={d.host} />
          <span className="who">
            <span className="nm">{d.name}</span>
            <span className="sub">{deviceKindLabel(d)}</span>
          </span>
          <span className="state">
            <span className="dot on" />
            {target === d.id ? t('ALICI') : t('AÇIK')}
          </span>
        </button>
      ))}
      {others.length === 0 && (
        <p className="alone">{host ? t('Şimdilik yalnızsın. QR’ı okutan ilk cihaz burada belirir.') : t('Ana bilgisayar şu an görünmüyor; birazdan döner.')}</p>
      )}
    </section>
  )
}
