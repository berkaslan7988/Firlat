// Turkish is the source language: every UI string is written in Turkish and used as its own key.
// English lives in en.js; a key missing there falls back to Turkish (`node tools/check-i18n.mjs` lists them).
import { Fragment, createElement, useSyncExternalStore } from 'react'
import { EN } from './en.js'

const KEY = 'firlat.lang'

function stored() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    return v === 'tr' || v === 'en' ? v : null
  } catch {
    return null
  }
}

/** A language picked on this device wins; otherwise a browser that lists Turkish gets Turkish, any other gets English. */
export function detectLang() {
  const picked = stored()
  if (picked) return picked
  const list = navigator.languages?.length ? navigator.languages : [navigator.language]
  return list.some((l) => /^tr\b/i.test(l || '')) ? 'tr' : 'en'
}

let current = detectLang()
const subs = new Set()

export const getLang = () => current
export const locale = () => (current === 'en' ? 'en-GB' : 'tr-TR')

export function setLang(lang) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lang))
  } catch {
    /* private window */
  }
  if (lang === current) return
  current = lang
  document.documentElement.lang = lang
  subs.forEach((f) => f())
}

export function useLang() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => current,
  )
}

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m))

/** Translates a Turkish UI string; placeholders look like {name}. */
export function t(key, vars) {
  const e = current === 'en' ? EN[key] : undefined
  const s = typeof e === 'function' ? e(vars || {}) : (e ?? key)
  return vars ? fill(s, vars) : s
}

/** Like t(), but placeholders can be elements: rich(key, { name: <kbd>…</kbd> }). */
export function rich(key, vars) {
  const e = current === 'en' ? EN[key] : undefined
  const s = typeof e === 'string' ? e : key
  return s.split(/\{(\w+)\}/).map((p, i) => (i % 2 ? createElement(Fragment, { key: i }, vars[p]) : p))
}

/** Translates a message the server sent (it speaks Turkish). Unknown text passes through. */
export function tx(msg) {
  if (current !== 'en' || !msg) return msg
  return EN[msg] !== undefined ? t(msg) : msg
}

document.documentElement.lang = current
