// Layout probe: drives installed Chrome over CDP (no deps; Node 22+ WebSocket), seeds demo data,
// then for each route × viewport: emulates the device, optionally acts, screenshots, and runs a
// geometry probe (overflow, clipped text, tiny targets, overlaps, offscreen dialogs, focus rings).
// Usage: node scripts/layout-probe.mjs [outDir] [routesJson]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = resolve(process.argv[2] ?? 'qa-screens-v5')
const SIZES = [[320, 568], [360, 740], [390, 844], [430, 932], [844, 390], [1024, 768], [1280, 800]]
const ROUTES = process.argv[3] ? JSON.parse(process.argv[3]) : [
  { name: 'home', route: '/' },
  { name: 'import', route: '/import' },
  { name: 'deck', route: '/deck/triage' },
  { name: 'deck-sheet', route: '/deck/triage', act: 'work' },
  { name: 'deck-flipped', route: '/deck/triage', act: 'view all fields' },
  { name: 'review-unsorted', route: '/review?tab=unsorted' },
  { name: 'review-work', route: '/review?tab=work' },
  { name: 'review-row', route: '/review?tab=unsorted', act: 'view ' },
  { name: 'export', route: '/export' },
  { name: 'settings', route: '/settings' },
]
mkdirSync(OUT, { recursive: true })

const profile = resolve(OUT, '.profile')
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] })
const wsUrl = await new Promise((res, rej) => {
  let buf = ''
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]) })
  chrome.on('exit', (c) => rej(new Error('chrome exited ' + c)))
})
const port = new URL(wsUrl).port
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const events = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result) }
  else if (msg.method) events.push(msg)
}
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''))
  return r.result.value
}
await send('Page.enable'); await send('Runtime.enable')
const goto = async (url) => { await send('Page.navigate', { url }); await sleep(400); for (let i = 0; i < 50; i++) { if (await evaluate('document.readyState') === 'complete') break; await sleep(100) } await sleep(1200) }

// Seed once (idempotent import through the app UI) and dismiss the coach.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await goto(`${BASE}/import`)
await evaluate(`(async () => { for (let i = 0; i < 40; i++) { const b = [...document.querySelectorAll('button')].find((b) => /sample contacts/i.test(b.textContent)); if (b) { b.click(); break } await new Promise((r) => setTimeout(r, 250)) } for (let i = 0; i < 80; i++) { if (/Start triage/i.test(document.body.textContent)) { await new Promise((r) => setTimeout(r, 1500)); return 'seeded' }; await new Promise((r) => setTimeout(r, 250)) } return 'timeout' })()`).then((v) => console.log('seed:', v))
await evaluate(`(() => { for (const p of ['triage','work','personal']) localStorage.setItem('ct.coach.' + p, 'seen'); return 1 })()`)

const PROBE = String.raw`(() => {
  const w = window, d = document, vw = w.innerWidth, vh = w.innerHeight, findings = []
  const root = d.documentElement
  if (root.scrollWidth > vw + 1) findings.push({ kind: 'horizontal-overflow', by: root.scrollWidth - vw })
  const desc = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (e.textContent && e.textContent.trim() ? ' "' + e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) + '"' : '')
  const visible = (e) => { const cs = w.getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && e.getClientRects().length > 0 }
  const srOnly = (e) => e.closest('.sr-only') !== null
  const inScroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = w.getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true } return false }
  const els = [...d.querySelectorAll('body *')].filter((e) => visible(e) && !srOnly(e))
  for (const e of els) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(e)) findings.push({ kind: 'offscreen-x', el: desc(e), left: Math.round(r.left), right: Math.round(r.right) })
    const cs = w.getComputedStyle(e)
    if (e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 2 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis') findings.push({ kind: 'clipped-text', el: desc(e), by: e.scrollWidth - e.clientWidth })
    if (e.children.length === 0 && e.textContent.trim() && e.scrollHeight > e.clientHeight + 2 && cs.overflowY === 'hidden') findings.push({ kind: 'clipped-text-y', el: desc(e), by: e.scrollHeight - e.clientHeight })
  }
  const openDialog = d.querySelector('[role="dialog"][aria-modal="true"]')
  const onHiddenFace = (e) => { for (let p = e; p && p !== d.body; p = p.parentElement) { const cs = w.getComputedStyle(p); if (cs.backfaceVisibility === 'hidden' && /rotateY(|matrix3d/.test(cs.transform) && cs.transform !== 'none') { const m = new DOMMatrix(cs.transform); if (m.m33 < 0) return true } } return false }
  const scope = openDialog ?? d
  const allInteractive = [...d.querySelectorAll('button, a[href], input:not([type=hidden]), [role="button"], [role="tab"], [role="radio"], summary')].filter((e) => visible(e) && !srOnly(e))
  for (const e of allInteractive) if (onHiddenFace(e) && !e.closest('[inert],[aria-hidden="true"]')) findings.push({ kind: 'hidden-face-focusable', el: desc(e) })
  const interactive = allInteractive.filter((e) => scope.contains(e) && !onHiddenFace(e))
  for (const e of interactive) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue
    const after = w.getComputedStyle(e, '::after'); const extra = after && after.content !== 'none' && after.position === 'absolute' ? 8 : 0
    if ((r.height + extra < 43.5 || r.width + extra < 43.5) && !(e.tagName === 'A' && r.height >= 24 && r.width >= 44)) findings.push({ kind: 'small-target', el: desc(e), w: Math.round(r.width), h: Math.round(r.height) })
  }
  for (let i = 0; i < interactive.length; i++) for (let j = i + 1; j < interactive.length; j++) {
    const A = interactive[i], B = interactive[j]; if (A.contains(B) || B.contains(A)) continue
    const a = A.getBoundingClientRect(), b = B.getBoundingClientRect(); if (!a.width || !b.width) continue
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    if (ox > 4 && oy > 4) findings.push({ kind: 'overlap', a: desc(A), b: desc(B), ox: Math.round(ox), oy: Math.round(oy) })
  }
  const ae = d.activeElement
  if (ae && ae !== d.body && ae.matches(':focus-visible')) findings.push({ kind: 'focus-ring-visible', el: desc(ae) })
  const dialog = d.querySelector('[role="dialog"]')
  if (location.pathname.includes('/deck/') && !dialog && root.scrollHeight > vh + 1 && vh >= 560) findings.push({ kind: 'page-scroll', by: root.scrollHeight - vh })
  if (dialog) {
    const r = dialog.getBoundingClientRect()
    if (r.bottom > vh + 1 || r.top < -1) findings.push({ kind: 'dialog-offscreen', top: Math.round(r.top), bottom: Math.round(r.bottom), vh })
    const last = [...dialog.querySelectorAll('button')].pop(); if (last) { const fr = last.getBoundingClientRect(); if (fr.bottom > vh + 1) findings.push({ kind: 'footer-offscreen', bottom: Math.round(fr.bottom), vh }) }
  }
  return { url: location.pathname + location.search, vw, vh, findings }
})()`

const results = []
for (const { name, route, act } of ROUTES) {
  for (const [width, height] of SIZES) {
    const mobile = width < 900
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
    await goto(`${BASE}${route}`)
    if (act) {
      await evaluate(`(() => { const want = ${JSON.stringify(act)}; const b = [...document.querySelectorAll('button')].find((b) => { const t = (b.getAttribute('aria-label') || b.textContent).trim().toLowerCase(); return want.endsWith(' ') ? t.startsWith(want) : t === want }); if (b) { b.click(); return 'clicked ' + (b.getAttribute('aria-label') || b.textContent).trim() } return 'no button' })()`)
      await sleep(1500)
    }
    const probe = await evaluate(PROBE)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(resolve(OUT, `${name}-${width}x${height}.png`), Buffer.from(shot.data, 'base64'))
    results.push({ name, size: `${width}x${height}`, ...probe })
    console.log(`${name} ${width}x${height}: ${probe.findings.length}`)
  }
}
writeFileSync(resolve(OUT, 'probe.json'), JSON.stringify(results, null, 2))
ws.close(); chrome.kill()
console.log('done', results.reduce((n, r) => n + r.findings.length, 0), 'findings')
