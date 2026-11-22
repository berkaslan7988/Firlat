import { useMemo, useState } from 'react'
import { Archive, Check, Copy, Download, ExternalLink, FolderOpen, Inbox, Trash2 } from 'lucide-react'
import { bytes, copyText, onlyUrl, when } from './lib.js'
import { clearBoard, fileUrl, removeItem, reveal, toast, useStore, zipUrl } from './store.js'
import { Barcode, KindBox, Modal, ModalHead, Preview, RouteArrow } from './ui.jsx'
import { t } from './i18n.js'

function Linkify({ text }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
        {p}
      </a>
    ) : (
      p
    ),
  )
}

/** GÖNDEREN → ALICI, with the type box on the right. */
function Route({ item, count }) {
  const me = useStore((s) => s.me)
  const devices = useStore((s) => s.devices)
  const mine = item.from.id === me.id
  const toName = !item.to ? t('Herkese') : item.to === me.id ? me.name : devices.find((d) => d.id === item.to)?.name || t('Bir cihaz')
  return (
    <div className="label-route">
      <div style={{ minWidth: 0 }}>
        <span className="cap">{t('Gönderen')}</span>
        <span className={`place${mine ? ' me' : ''}`} title={item.from.name}>
          {mine ? me.name : item.from.name}
        </span>
      </div>
      <RouteArrow />
      <div style={{ minWidth: 0 }}>
        <span className="cap">{t('Alıcı')}</span>
        <span className={`place${item.to === me.id ? ' me' : ''}`} title={toName}>
          {toName}
        </span>
      </div>
      <KindBox item={item} count={count} />
    </div>
  )
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className="icon-btn go"
      title={t('Kopyala')}
      aria-label={t('Metni kopyala')}
      onClick={async () => {
        const done = await copyText(text)
        if (done) {
          setOk(true)
          setTimeout(() => setOk(false), 1400)
        } else toast(t('Kopyalanamadı; metni seçip kopyala.'), { error: true })
      }}
    >
      {ok ? <Check size={18} /> : <Copy size={18} />}
    </button>
  )
}

function Actions({ item, onDelete }) {
  const host = useStore((s) => s.host)
  const me = useStore((s) => s.me)
  const canDelete = host || item.from.id === me.id
  const url = item.kind === 'text' ? onlyUrl(item.text) : null
  return (
    <div className="label-actions">
      {item.kind === 'text' ? (
        <>
          {url && (
            <a className="icon-btn" href={url} target="_blank" rel="noreferrer noopener" title={t('Aç')} aria-label={t('Linki aç')}>
              <ExternalLink size={18} />
            </a>
          )}
          <CopyBtn text={item.text} />
        </>
      ) : host ? (
        <button className="icon-btn" title={t('Klasörde göster')} aria-label={t('{name} klasörde göster', { name: item.name })} onClick={() => reveal(item.id)}>
          <FolderOpen size={18} />
        </button>
      ) : (
        <a className="icon-btn go" href={fileUrl(item.id)} download={item.name} title={t('İndir')} aria-label={t('{name} indir', { name: item.name })}>
          <Download size={18} />
        </a>
      )}
      {canDelete && (
        <button className="icon-btn danger" title={t('Sil')} aria-label={t('Sil')} onClick={() => onDelete(item)}>
          <Trash2 size={17} />
        </button>
      )}
    </div>
  )
}

function Label({ item, onDelete }) {
  const [open, setOpen] = useState(false)
  const fresh = useStore((s) => !!s.fresh[item.id])
  const isText = item.kind === 'text'
  return (
    <article className={`label${fresh ? ' fresh' : ''}`}>
      <Route item={item} />
      <div className="label-body">
        <Preview item={item} />
        <div className="txt">
          {isText ? (
            <div className={`label-text${open ? ' open' : ''}`} onClick={() => setOpen(true)}>
              <Linkify text={item.text} />
            </div>
          ) : (
            <span className="label-name" title={item.rel || item.name}>
              {item.name}
            </span>
          )}
          <span className="label-meta">
            {isText ? t('{n} karakter', { n: item.text.length }) : bytes(item.size)} · {when(item.created)}
          </span>
        </div>
      </div>
      <div className="label-foot">
        <Barcode id={item.id} />
        <Actions item={item} onDelete={onDelete} />
      </div>
      {fresh && <span className="new">{t('YENİ')}</span>}
    </article>
  )
}

/** Several files sent together: one label with a manifest of its contents. */
function Batch({ items, onDelete }) {
  const host = useStore((s) => s.host)
  const me = useStore((s) => s.me)
  const [all, setAll] = useState(false)
  const first = items[0]
  const total = items.reduce((a, i) => a + i.size, 0)
  const folder = first.rel ? first.rel.split('/')[0] : null
  const sameFolder = folder && items.every((i) => i.rel && i.rel.split('/')[0] === folder)
  const shown = all ? items : items.slice(0, 4)
  const fresh = useStore((s) => items.some((i) => s.fresh[i.id]))
  const canDelete = host || first.from.id === me.id
  return (
    <article className={`label${fresh ? ' fresh' : ''}`}>
      <Route item={first} count={items.length} />
      <div className="label-body">
        <div className="txt">
          <span className="label-name">{sameFolder ? folder : t('{n} dosya', { n: items.length })}</span>
          <span className="label-meta">
            {sameFolder ? `${t('{n} dosya', { n: items.length })} · ` : ''}
            {bytes(total)} · {when(first.created)}
          </span>
        </div>
      </div>
      <div className="manifest-list">
        {shown.map((i) => (
          <div key={i.id} className="row">
            <span className="nm" title={i.rel || i.name}>
              {i.rel ? i.rel.split('/').slice(1).join('/') || i.name : i.name}
            </span>
            <span className="sz">{bytes(i.size)}</span>
            {host ? (
              <button className="icon-btn sm" aria-label={t('{name} klasörde göster', { name: i.name })} onClick={() => reveal(i.id)}>
                <FolderOpen size={15} />
              </button>
            ) : (
              <a className="icon-btn sm" href={fileUrl(i.id)} download={i.name} aria-label={t('{name} indir', { name: i.name })}>
                <Download size={15} />
              </a>
            )}
          </div>
        ))}
        {items.length > 4 && (
          <div className="more">
            <button className="link-btn" onClick={() => setAll(!all)}>
              {all ? t('Daha az göster') : t('{n} dosya daha', { n: items.length - 4 })}
            </button>
          </div>
        )}
      </div>
      <div className="label-foot">
        <Barcode id={first.batch || first.id} />
        <div className="label-actions">
          {host ? (
            <button className="btn sm" onClick={() => reveal(first.id)}>
              <FolderOpen size={16} />
              {t('Göster')}
            </button>
          ) : (
            <a className="btn sm primary" href={zipUrl(items.map((i) => i.id))} download>
              <Archive size={16} />
              ZIP
            </a>
          )}
          {canDelete && (
            <button className="icon-btn danger" title={t('Sil')} aria-label={t('Hepsini sil')} onClick={() => onDelete(items)}>
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
      {fresh && <span className="new">{t('YENİ')}</span>}
    </article>
  )
}

export function Board() {
  const items = useStore((s) => s.items)
  const me = useStore((s) => s.me)
  const host = useStore((s) => s.host)
  const [filter, setFilter] = useState('all')
  const [del, setDel] = useState(null)
  const [clear, setClear] = useState(false)

  const counts = useMemo(
    () => ({
      all: items.length,
      in: items.filter((i) => i.from.id !== me.id).length,
      out: items.filter((i) => i.from.id === me.id).length,
    }),
    [items, me.id],
  )
  const groups = useMemo(() => {
    const list = items.filter((i) => (filter === 'all' ? true : filter === 'in' ? i.from.id !== me.id : i.from.id === me.id))
    const map = new Map()
    for (const it of list) {
      const key = it.kind === 'file' && it.batch ? it.batch : it.id
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    }
    return [...map.values()]
  }, [items, filter, me.id])

  const visibleFiles = groups.flat().filter((i) => i.kind === 'file')
  const delList = Array.isArray(del) ? del : del ? [del] : []
  const delOne = delList.length === 1 ? delList[0] : null

  return (
    <section aria-label={t('Pano')} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="board-head">
        <h2>
          {t('Pano')} <span className="mono">{items.length}</span>
        </h2>
        <div className="seg" role="group" aria-label={t('Süz')}>
          {[
            ['all', t('Tümü')],
            ['in', t('Gelen')],
            ['out', t('Giden')],
          ].map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l} <span className="count">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="board-tools">
          {host ? (
            <>
              <button className="btn sm ghost" onClick={() => reveal(null)}>
                <FolderOpen size={16} />
                {t('Klasör')}
              </button>
              {items.length > 0 && (
                <button className="btn sm ghost" onClick={() => setClear(true)}>
                  <Trash2 size={15} />
                  {t('Temizle')}
                </button>
              )}
            </>
          ) : (
            visibleFiles.length > 1 && (
              <a className="btn sm ghost" href={zipUrl(visibleFiles.map((i) => i.id))} download>
                <Archive size={16} />
                {t('Hepsi (ZIP)')}
              </a>
            )
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <Inbox size={34} strokeWidth={1.5} />
          <b>{filter === 'in' ? t('Henüz gelen yok') : filter === 'out' ? t('Henüz bir şey atmadın') : t('Pano bomboş')}</b>
          <p>
            {filter === 'all'
              ? t('İlk fırlatışı sen yap: dosyayı sürükle, seç ya da yapıştır.')
              : t('Burada görünmesi için birinin bir şey göndermesi lazım.')}
          </p>
        </div>
      ) : (
        <div className="board">
          {groups.map((g) =>
            g.length === 1 ? <Label key={g[0].id} item={g[0]} onDelete={setDel} /> : <Batch key={g[0].batch} items={g} onDelete={setDel} />,
          )}
        </div>
      )}

      <Modal open={delList.length > 0} onClose={() => setDel(null)} label={t('Sil')}>
        <ModalHead
          title={t('Silinsin mi?')}
          sub={
            delOne
              ? delOne.kind === 'file'
                ? t('“{name}” panodan kalkar ve ana bilgisayardaki klasörden de silinir.', { name: delOne.name })
                : t('Metin herkesin panosundan kalkar.')
              : t('{n} dosya panodan kalkar ve ana bilgisayardaki klasörden de silinir.', { n: delList.length })
          }
          onClose={() => setDel(null)}
        />
        <div className="modal-foot">
          <button className="btn ghost" onClick={() => setDel(null)} data-autofocus>
            {t('Vazgeç')}
          </button>
          <button
            className="btn danger"
            onClick={() => {
              delList.forEach((i) => removeItem(i.id))
              setDel(null)
            }}
          >
            <Trash2 size={16} />
            {t('Sil')}
          </button>
        </div>
      </Modal>

      <Modal open={clear} onClose={() => setClear(false)} label={t('Panoyu temizle')}>
        <ModalHead
          title={t('Pano temizlensin mi?')}
          sub={t('Liste herkes için boşalır. Dosyaları klasörde bırakabilir ya da onlarla birlikte silebilirsin.')}
          onClose={() => setClear(false)}
        />
        <div className="modal-foot">
          <button
            className="btn danger"
            onClick={() => {
              clearBoard(true)
              setClear(false)
            }}
          >
            {t('Dosyalarla birlikte sil')}
          </button>
          <button
            className="btn primary"
            data-autofocus
            onClick={() => {
              clearBoard(false)
              setClear(false)
            }}
          >
            {t('Yalnızca listeyi temizle')}
          </button>
        </div>
      </Modal>
    </section>
  )
}
