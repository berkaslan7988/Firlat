// Lists UI strings that have no English yet, and English entries no code uses any more.
// Keys are the Turkish text inside t('…'), rich('…') and tx('…') calls, plus the server's messages.
// Run from frontend/:  node tools/check-i18n.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { EN } from '../src/en.js'

const files = readdirSync('src').filter((f) => /\.(jsx?|mjs)$/.test(f) && f !== 'en.js').map((f) => 'src/' + f)
const src = files.map((f) => readFileSync(f, 'utf8')).join('\n')
const server = readFileSync('../server.py', 'utf8')
const used = new Set()
const lit = (q) => (q[0] === "'" ? q.slice(1, -1).replace(/\\'/g, "'") : JSON.parse(q))
for (const m of src.matchAll(/\b(?:t|rich|tx)\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)) used.add(lit(m[1]))
// server messages reach the UI through tx()
for (const m of server.matchAll(/err\(\d+, "[a-z_]+", "([^"]+)"/g)) used.add(m[1])
const skip = new Set(['Türkçe', 'English'])
const missing = [...used].filter((k) => !(k in EN) && !skip.has(k) && /\p{L}/u.test(k))
const unused = Object.keys(EN).filter((k) => !src.includes(k) && !server.includes(k))
if (missing.length) console.log('MISSING (' + missing.length + '):\n' + missing.map((k) => '  ' + JSON.stringify(k)).join('\n'))
if (unused.length) console.log('UNUSED (' + unused.length + '):\n' + unused.map((k) => '  ' + JSON.stringify(k)).join('\n'))
if (missing.length) process.exit(1)
console.log(`PASS: ${used.size} strings, all with English.`)
