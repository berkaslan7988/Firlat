// Uygulama durumu: tek bir dış depo + useSyncExternalStore.
import { useSyncExternalStore } from 'react'
import { loadMe, newId, randomName, store as ls } from './lib.js'
import { t, tx } from './i18n.js'

const PARALLEL = 3

let state = {
  phase: 'loading', // loading | pair | ready | down
  host: false,
  server: null,
  items: [],
  devices: [],
  me: loadMe(),
  live: false,
  uploads: [], // {tid,name,size,done,rate,status,to,error,batch}
  incoming: {}, // tid -> {tid,name,size,done,rate,from,to}
  toasts: [],
  target: null,
  fresh: {}, // canlı gelen öğeler: id -> true (bir süre vurgulanır)
}

const subs = new Set()
function set(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  subs.forEach((f) => f())
}
export const getState = () => state
export function useStore(sel = (s) => s) {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => sel(state),
  )
}

// ------------------------------------------------------------ API
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'X-Firlat': '1', ...(opts.body && typeof opts.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
    credentials: 'same-origin',
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const e = new Error(tx(data && data.message) || t('Hata {code}', { code: res.status }))
    e.status = res.status
    e.code = data && data.error
    throw e
  }
  return data
}

// ------------------------------------------------------------ toast
let toastSeq = 0
export function toast(text, opts = {}) {
  const id = ++toastSeq
  set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, ...opts }] }))
  setTimeout(() => dismissToast(id), opts.ms || (opts.action ? 7000 : 3200))
  return id
}
export function dismissToast(id) {
  set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

// ------------------------------------------------------------ açılış
export async function boot() {
  const params = new URLSearchParams(location.search)
  const code = params.get('pair')
  if (code) {
    history.replaceState(null, '', location.pathname)
    try {
      await pair(code, true)
      return
    } catch {
      /* elle girsin */
    }
  }
  await load()
}

async function load() {
  try {
    const data = await api(`/api/state?device=${state.me.id}`)
    let me = state.me
    if (!me.name) {
      me = { ...me, name: data.host ? data.server.name : randomName() }
      ls.set('me', { id: me.id, name: me.name })
    }
    set({ phase: 'ready', host: data.host, server: data.server, items: data.items, devices: data.devices, me })
    connect()
  } catch (e) {
    if (e.status === 401) {
      // shown on the pairing label, so it needs a name before the first pairing
      if (!state.me.name) {
        const me = { ...state.me, name: randomName() }
        ls.set('me', { id: me.id, name: me.name })
        set({ me })
      }
      set({ phase: 'pair' })
    } else set({ phase: 'down' })
  }
}

export async function pair(code, silent = false) {
  const name = state.me.name || randomName()
  if (!state.me.name) {
    set({ me: { ...state.me, name } })
    ls.set('me', { id: state.me.id, name })
  }
  try {
    await api('/api/pair', { method: 'POST', body: JSON.stringify({ code, name }) })
  } catch (e) {
    if (!silent) throw e
    set({ phase: 'pair' })
    throw e
  }
  await load()
  toast(t('Eşleşme tamam. Artık fırlatabilirsin.'))
}

// ------------------------------------------------------------ canlı olaylar
let es = null
let retryTimer = null
const pending = new Map() // batch -> {from, items, timer}

function connect() {
  if (es) es.close()
  const { id, name, kind } = state.me
  es = new EventSource(`/api/events?device=${id}&name=${encodeURIComponent(name)}&kind=${kind}`)
  let first = true
  es.onopen = () => {
    set({ live: true })
    if (!first) resync()
    first = false
  }
  es.onerror = () => {
    set({ live: false })
    if (es.readyState === EventSource.CLOSED) {
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => load(), 2500)
    }
  }
  const on = (ev, fn) => es.addEventListener(ev, (e) => fn(JSON.parse(e.data)))
  on('devices', ({ devices }) => {
    set((s) => ({ devices, target: s.target && devices.some((d) => d.id === s.target) ? s.target : null }))
  })
  on('item', ({ item }) => {
    if (state.items.some((i) => i.id === item.id)) return
    set((s) => ({ items: [item, ...s.items] }))
    if (item.from.id !== state.me.id) {
      announce(item)
      set((s) => ({ fresh: { ...s.fresh, [item.id]: true } }))
      setTimeout(() => set((s) => {
        const fresh = { ...s.fresh }
        delete fresh[item.id]
        return { fresh }
      }), 90_000)
    }
  })
  on('removed', ({ id }) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })))
  on('renamed', ({ id, name }) =>
    set((s) => ({ items: s.items.map((i) => (i.from.id === id ? { ...i, from: { ...i.from, name } } : i)) })),
  )
  on('progress', (p) => set((s) => ({ incoming: { ...s.incoming, [p.tid]: p } })))
  on('progress_end', ({ tid }) =>
    set((s) => {
      const incoming = { ...s.incoming }
      delete incoming[tid]
      return { incoming }
    }),
  )
  on('paired', ({ name }) => toast(t('{name} eşleşti ve ağa katıldı.', { name })))
}

async function resync() {
  try {
    const data = await api(`/api/state?device=${state.me.id}`)
    set({ items: data.items, devices: data.devices, server: data.server, incoming: {} })
  } catch (e) {
    if (e.status === 401) set({ phase: 'pair' })
  }
}

// Aynı partiden gelen dosyaları tek bildirimde topla
function announce(item) {
  const key = item.batch || item.id
  let p = pending.get(key)
  if (!p) {
    p = { from: item.from, items: [], toMe: item.to === state.me.id }
    pending.set(key, p)
  }
  p.items.push(item)
  clearTimeout(p.timer)
  p.timer = setTimeout(() => {
    pending.delete(key)
    const n = p.items.length
    const who = p.from.name
    if (p.items[0].kind === 'text') {
      const it = p.items[0]
      toast(p.toMe ? t('{who} sana bir metin gönderdi.', { who }) : t('{who} bir metin gönderdi.', { who }), {
        action: { label: t('Kopyala'), copy: it.text },
      })
      return
    }
    const what = n > 1 ? t('{n} dosya', { n }) : `“${p.items[0].name}”`
    const line = p.toMe ? t('{who} sana {what} fırlattı.', { who, what }) : t('{who} {what} fırlattı.', { who, what })
    if (state.host) {
      toast(`${line} ${t('Klasörde hazır.')}`, { action: { label: t('Göster'), reveal: n > 1 ? null : p.items[0].id } })
    } else {
      toast(line, { action: { label: t('İndir'), href: n > 1 ? zipUrl(p.items.map((i) => i.id)) : fileUrl(p.items[0].id) } })
    }
  }, 900)
}

// ------------------------------------------------------------ eylemler
export const fileUrl = (id, inline = false) => `/api/file/${id}${inline ? '?inline=1' : ''}`
export const zipUrl = (ids) => `/api/zip?ids=${ids.join(',')}&device=${state.me.id}`

export function setTarget(target) {
  set({ target })
}

export async function rename(name) {
  name = name.replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!name) return
  const me = { ...state.me, name }
  set({ me })
  ls.set('me', { id: me.id, name })
  try {
    await api('/api/rename', { method: 'POST', body: JSON.stringify({ device: me.id, name }) })
  } catch {
    /* bir sonraki bağlantıda düzelir */
  }
  connect()
}

export async function sendText(text) {
  const t = text.trim() ? text : ''
  if (!t) return
  await api('/api/text', {
    method: 'POST',
    body: JSON.stringify({ text, to: state.target, from: { id: state.me.id, name: state.me.name } }),
  }).then(({ item }) => {
    if (!state.items.some((i) => i.id === item.id)) set((s) => ({ items: [item, ...s.items] }))
  })
}

export async function removeItem(id) {
  try {
    await api(`/api/item/${id}?device=${state.me.id}`, { method: 'DELETE' })
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  } catch (e) {
    toast(e.message, { error: true })
  }
}

export async function clearBoard(files) {
  try {
    await api('/api/clear', { method: 'POST', body: JSON.stringify({ files }) })
    set({ items: [] })
  } catch (e) {
    toast(e.message, { error: true })
  }
}

export function reveal(id = null) {
  api('/api/reveal', { method: 'POST', body: JSON.stringify({ id }) }).catch((e) => toast(e.message, { error: true }))
}

// ------------------------------------------------------------ yükleme kuyruğu
const xhrs = new Map()
const files = new Map()

export function enqueue(list) {
  if (!list.length) return
  const batch = newId()
  const to = state.target
  const ups = list.map(({ file, rel }) => {
    const tid = newId()
    files.set(tid, { file, rel })
    return { tid, name: rel || file.name, size: file.size, done: 0, rate: 0, status: 'queued', to, batch, t: Date.now() }
  })
  set((s) => ({ uploads: [...s.uploads.filter((u) => u.status === 'queued' || u.status === 'sending'), ...ups] }))
  pump()
}

function patchUpload(tid, patch) {
  set((s) => ({ uploads: s.uploads.map((u) => (u.tid === tid ? { ...u, ...patch } : u)) }))
}

function pump() {
  const active = state.uploads.filter((u) => u.status === 'sending').length
  const next = state.uploads.filter((u) => u.status === 'queued').slice(0, PARALLEL - active)
  next.forEach(start)
  if (!state.uploads.some((u) => u.status === 'queued' || u.status === 'sending')) finishRound()
}

let roundTimer = null
function finishRound() {
  const ups = state.uploads
  if (!ups.length) return
  const ok = ups.filter((u) => u.status === 'done').length
  const bad = ups.filter((u) => u.status === 'error').length
  if (ok && !bad) toast(ok > 1 ? t('{n} dosya gitti.', { n: ok }) : t('Gitti.'))
  else if (bad) toast(ok ? t('{bad} dosya gönderilemedi, {ok} tanesi gitti.', { bad, ok }) : t('{bad} dosya gönderilemedi.', { bad }), { error: true })
  clearTimeout(roundTimer)
  roundTimer = setTimeout(() => {
    if (!state.uploads.some((u) => u.status === 'queued' || u.status === 'sending')) set({ uploads: [] })
  }, 2600)
}

function start(u) {
  const f = files.get(u.tid)
  if (!f) return
  const { file, rel } = f
  const q = new URLSearchParams({
    name: file.name,
    size: String(file.size),
    type: file.type || '',
    to: u.to || '',
    from: state.me.id,
    fromName: state.me.name,
    batch: u.batch,
    tid: u.tid,
  })
  if (rel) q.set('rel', rel)
  const xhr = new XMLHttpRequest()
  xhrs.set(u.tid, xhr)
  xhr.open('PUT', `/api/upload?${q}`)
  xhr.setRequestHeader('X-Firlat', '1')
  xhr.setRequestHeader('Content-Type', 'application/octet-stream')
  const samples = [[performance.now(), 0]]
  let lastPaint = 0
  xhr.upload.onprogress = (e) => {
    const t = performance.now()
    samples.push([t, e.loaded])
    while (samples.length > 2 && t - samples[0][0] > 2000) samples.shift()
    if (t - lastPaint < 120) return
    lastPaint = t
    const [t0, b0] = samples[0]
    const r = t - t0 > 50 ? ((e.loaded - b0) / (t - t0)) * 1000 : 0
    patchUpload(u.tid, { done: e.loaded, rate: r })
  }
  xhr.onload = () => {
    xhrs.delete(u.tid)
    files.delete(u.tid)
    if (xhr.status >= 200 && xhr.status < 300) {
      let item = null
      try {
        item = JSON.parse(xhr.responseText).item
      } catch {
        item = null
      }
      patchUpload(u.tid, { status: 'done', done: u.size, rate: 0 })
      if (item && !state.items.some((i) => i.id === item.id)) set((s) => ({ items: [item, ...s.items] }))
    } else {
      let msg = t('Gönderilemedi')
      try {
        msg = tx(JSON.parse(xhr.responseText).message) || msg
      } catch {
        /* */
      }
      if (xhr.status === 401) set({ phase: 'pair' })
      patchUpload(u.tid, { status: 'error', error: msg, rate: 0 })
    }
    pump()
  }
  xhr.onerror = () => {
    xhrs.delete(u.tid)
    patchUpload(u.tid, { status: 'error', error: t('Bağlantı koptu'), rate: 0 })
    files.delete(u.tid)
    pump()
  }
  xhr.onabort = () => {
    xhrs.delete(u.tid)
    files.delete(u.tid)
    pump()
  }
  patchUpload(u.tid, { status: 'sending', started: Date.now() })
  xhr.send(file)
}

export function cancelUpload(tid) {
  const x = xhrs.get(tid)
  set((s) => ({ uploads: s.uploads.filter((u) => u.tid !== tid) }))
  files.delete(tid)
  if (x) x.abort()
  else pump()
}

export function cancelAll() {
  const xs = [...xhrs.values()]
  set({ uploads: [] })
  files.clear()
  xs.forEach((x) => x.abort())
}

window.addEventListener('beforeunload', (e) => {
  if (state.uploads.some((u) => u.status === 'sending' || u.status === 'queued')) {
    e.preventDefault()
    e.returnValue = ''
  }
})
