// Küçük yardımcılar: biçimlendirme, cihaz kimliği, depolama, kopyalama.
import { getLang, locale, t } from './i18n.js'

export const store = {
  get(k, d = null) {
    try {
      const v = localStorage.getItem('firlat.' + k)
      return v == null ? d : JSON.parse(v)
    } catch {
      return d
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('firlat.' + k, JSON.stringify(v))
    } catch {
      /* gizli pencere vb. */
    }
  },
}

const nf = (digits) => new Intl.NumberFormat(locale(), { maximumFractionDigits: digits })

export function bytes(n) {
  if (n == null || n < 0) return '—'
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < u.length - 1)
  return `${nf(n >= 100 ? 0 : 1).format(n)} ${u[i]}`
}

export function rate(bps) {
  if (!bps || bps < 1) return '—'
  return bytes(bps) + t('/sn')
}

export function eta(sec) {
  if (!isFinite(sec) || sec <= 0) return ''
  if (sec < 1) return t('bitmek üzere')
  if (sec < 60) return t('~{n} sn', { n: Math.ceil(sec) })
  if (sec < 3600) return t('~{n} dk', { n: Math.ceil(sec / 60) })
  return t('~{n} sa', { n: nf(1).format(sec / 3600) })
}

export function when(ms) {
  const d = new Date(ms)
  const diff = (Date.now() - ms) / 1000
  if (diff < 45) return t('şimdi')
  if (diff < 3600) return t('{n} dk önce', { n: Math.round(diff / 60) })
  const hm = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  const today = new Date()
  const y = new Date(today)
  y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return hm
  if (d.toDateString() === y.toDateString()) return t('dün {time}', { time: hm })
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) + ' ' + hm
}

// ------------------------------------------------------------ cihaz
const ADJ = ['Sakin', 'Hızlı', 'Uykulu', 'Meraklı', 'Cesur', 'Şanslı', 'Neşeli', 'Gizemli', 'Tembel', 'Kibar', 'Çılgın', 'Bilge', 'Utangaç', 'Haylaz', 'Asil']
const ANIMAL = ['Vaşak', 'Penguen', 'Kirpi', 'Baykuş', 'Tilki', 'Panda', 'Ahtapot', 'Kaplumbağa', 'Flamingo', 'Rakun', 'Sincap', 'Yunus', 'Kanguru', 'Lama', 'Martı']
const ADJ_EN = ['Calm', 'Swift', 'Sleepy', 'Curious', 'Brave', 'Lucky', 'Cheerful', 'Mysterious', 'Lazy', 'Polite', 'Wild', 'Wise', 'Shy', 'Cheeky', 'Noble']
const ANIMAL_EN = ['Lynx', 'Penguin', 'Hedgehog', 'Owl', 'Fox', 'Panda', 'Octopus', 'Turtle', 'Flamingo', 'Raccoon', 'Squirrel', 'Dolphin', 'Kangaroo', 'Llama', 'Gull']

const pick = (list) => list[Math.floor(Math.random() * list.length)]
export function randomName() {
  return getLang() === 'en' ? `${pick(ADJ_EN)} ${pick(ANIMAL_EN)}` : `${pick(ADJ)} ${pick(ANIMAL)}`
}

export function deviceKind() {
  const ua = navigator.userAgent || ''
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/iPad|Tablet/.test(ua) || touchMac || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet'
  if (/Mobi|iPhone|Android/.test(ua)) return 'phone'
  return 'desktop'
}

function rid() {
  const a = new Uint8Array(8)
  crypto.getRandomValues(a)
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function loadMe() {
  let me = store.get('me')
  if (!me || !me.id) {
    me = { id: rid(), name: null }
    store.set('me', me)
  }
  return { ...me, kind: deviceKind() }
}

export const newId = rid

// ------------------------------------------------------------ dosya türü
export function fileType(item) {
  const m = item.mime || ''
  const ext = (item.name || '').split('.').pop().toLowerCase()
  if (m.startsWith('image/') || ['heic', 'heif', 'webp', 'avif'].includes(ext)) return 'image'
  if (m.startsWith('video/') || ['mkv', 'mov', 'avi'].includes(ext)) return 'video'
  if (m.startsWith('audio/') || ['mp3', 'flac', 'm4a', 'wav', 'ogg'].includes(ext)) return 'audio'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'xz', 'iso'].includes(ext)) return 'archive'
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'epub'].includes(ext)) return 'doc'
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json', 'c', 'cpp', 'java', 'go', 'rs', 'sh', 'bat', 'ps1'].includes(ext)) return 'code'
  if (['apk', 'exe', 'msi', 'dmg', 'ipa'].includes(ext)) return 'app'
  return 'file'
}

export function canPreview(item) {
  const m = item.mime || ''
  return /^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)$/.test(m) && item.size < 40 * 1024 * 1024
}

export function ext(name) {
  const i = name.lastIndexOf('.')
  return i > 0 && i > name.length - 8 ? name.slice(i + 1).toUpperCase() : ''
}

// ------------------------------------------------------------ kopyalama
// HTTP üzerinden (güvenli olmayan bağlam) navigator.clipboard yok; textarea yedeği.
export async function copyText(text) {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* yedeğe düş */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

export function onlyUrl(text) {
  const t = text.trim()
  return /^https?:\/\/\S+$/i.test(t) ? t : null
}

// ------------------------------------------------------------ sürükle-bırak
// Klasörleri de açar: [{file, rel}]
export async function filesFromDrop(dt) {
  const items = Array.from(dt.items || [])
  const entries = items.map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
  if (!entries.some((e) => e && e.isDirectory)) {
    return Array.from(dt.files || []).map((file) => ({ file, rel: null }))
  }
  const out = []
  const walk = async (entry, prefix) => {
    if (!entry) return
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej))
      out.push({ file, rel: prefix ? prefix + file.name : null })
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const all = []
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej))
        if (!batch.length) break
        all.push(...batch)
      }
      for (const e of all) await walk(e, prefix + entry.name + '/')
    }
  }
  for (const e of entries) await walk(e, '')
  return out
}

export function filesFromInput(list) {
  return Array.from(list || []).map((file) => ({ file, rel: file.webkitRelativePath || null }))
}

// ------------------------------------------------------------ etiket
/** A readable tracking code from an item id: FR-7Q2K-0041. */
export function trackingCode(id = '') {
  const x = String(id).replace(/[^0-9a-z]/gi, '').toUpperCase().padEnd(8, '0')
  return `FR-${x.slice(0, 4)}-${x.slice(4, 8)}`
}

/** Bar widths (1–3 px) for a decorative barcode, stable per id. */
export function barWidths(id = '', count = 34) {
  let h = 2166136261
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const out = []
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
    out.push(1 + (h % 3))
  }
  return out
}
