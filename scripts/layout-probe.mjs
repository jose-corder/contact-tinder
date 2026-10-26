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

const profile = process.env.PROBE_PROFILE ?? resolve(OUT, '.profile')
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${profile}`, '--remote-debugging-port=0', BASE + '/'], { stdio: ['ignore', 'pipe', 'pipe'] })
const wsUrl = await new Promise((res, rej) => {
  let buf = ''
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]) })
  chrome.on('exit', (c) => rej(new Error('chrome exited ' + c)))
})
const port = new URL(wsUrl).port
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(BASE + "/import")}`, { method: 'PUT' })).json()
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
const goto = async (url) => { await send('Page.navigate', { url }); await sleep(400); for (let i = 0; i < 50; i++) { try { if (await evaluate('document.readyState') === 'complete') break } catch { /* navigating */ } await sleep(100) } await sleep(1200) }

// Seed once (idempotent import through the app UI) and dismiss the coach.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await goto(`${BASE}/import`)
for (let attempt = 0; attempt < 3; attempt++) {
  try { console.log("seed:", await evaluate(`(async () => { for (let i = 0; i < 40; i++) { const b = [...document.querySelectorAll('button')].find((b) => /sample contacts/i.test(b.textContent)); if (b) { b.click(); break } await new Promise((r) => setTimeout(r, 250)) } for (let i = 0; i < 80; i++) { if (/Start triage|Import another file/i.test(document.body.textContent)) { await new Promise((r) => setTimeout(r, 1500)); return 'seeded' }; await new Promise((r) => setTimeout(r, 250)) } return 'timeout' })()`)); break }
  catch (e) { console.log("seed attempt failed:", e.message.slice(0, 80)); await sleep(1500); await goto(`${BASE}/import`) }
}
try { await evaluate(`(() => { for (const p of ['triage','work','personal']) localStorage.setItem('ct.coach.' + p, 'seen'); return 1 })()`) } catch (e) { console.log('coach:', e.message.slice(0, 60)) }

const PROBE = String.raw`(() => {
  const w = window, d = document, vw = w.innerWidth, vh = w.innerHeight, findings = []
  const root = d.documentElement
  if (root.scrollWidth > vw + 1) findings.push({ kind: 'horizontal-overflow', by: root.scrollWidth - vw })
  const desc = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (e.textContent && e.textContent.trim() ? ' "' + e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) + '"' : '')
  const inClosedDetails = (e) => { const det = e.closest('details:not([open])'); return !!det && !e.closest('summary') }
  const visible = (e) => { const cs = w.getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && e.getClientRects().length > 0 && !inClosedDetails(e) }
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
  // A control is on a hidden (turned-away) face when an ancestor hides its backface and hit-testing
  // at the control's centre does not reach that face (Chrome excludes turned-away faces from hit tests).
  const onHiddenFace = (e) => {
    const face = (() => { for (let p = e; p && p !== d.body; p = p.parentElement) if (w.getComputedStyle(p).backfaceVisibility === 'hidden') return p; return null })()
    if (!face) return false
    if (openDialog && !openDialog.contains(e)) return false // covered by the modal, not a turned-away face
    const r = clipped(e); if (!r.width || !r.height) return false // scrolled out of its container
    const x = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1)
    const hit = d.elementFromPoint(x, y)
    return !!hit && !face.contains(hit) && !hit.contains(face)
  }
  // Visible part of a rect after clipping by scrolling/overflow-hidden ancestors.
  const clipped = (e) => {
    let r = e.getBoundingClientRect(); let top = r.top, bottom = r.bottom, left = r.left, right = r.right
    for (let p = e.parentElement; p && p !== d.body; p = p.parentElement) {
      const cs = w.getComputedStyle(p)
      if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') { const pr = p.getBoundingClientRect(); top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom); left = Math.max(left, pr.left); right = Math.min(right, pr.right) }
    }
    return { top, bottom, left, right, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
  }
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
    const a = clipped(A), b = clipped(B); if (!a.width || !a.height || !b.width || !b.height) continue
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    if (ox > 4 && oy > 4) findings.push({ kind: 'overlap', a: desc(A), b: desc(B), ox: Math.round(ox), oy: Math.round(oy) })
  }
  const ae = d.activeElement
  if (ae && ae !== d.body) { const cs = w.getComputedStyle(ae); if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) findings.push({ kind: 'focus-ring-visible', el: desc(ae) }) }
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
    // Phones get real touch semantics (pointer: coarse, hover: none) like a device would report.
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 })
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: mobile, configuration: 'mobile' })
    await goto(`${BASE}${route}`)
    if (act) {
      // Find the control, then press it with real pointer input so :focus-visible behaves as on a device.
      const at = await evaluate(`(() => { const want = ${JSON.stringify(act)}; const b = [...document.querySelectorAll('button')].find((b) => { const t = (b.getAttribute('aria-label') || b.textContent).trim().toLowerCase(); return want.endsWith(' ') ? t.startsWith(want) : t === want }); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
      if (at) {
        if (mobile) {
          await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] })
          await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: at.x, y: at.y }] })
        } else {
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 })
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 })
        }
      } else console.log(`  (no button for act "${act}")`)
      await sleep(1500)
    }
    try {
      const probe = await evaluate(PROBE)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(resolve(OUT, `${name}-${width}x${height}.png`), Buffer.from(shot.data, 'base64'))
      results.push({ name, size: `${width}x${height}`, ...probe })
      console.log(`${name} ${width}x${height}: ${probe.findings.length}`)
    } catch (e) { console.log(`${name} ${width}x${height}: ERROR ${e.message.slice(0, 80)}`); results.push({ name, size: `${width}x${height}`, error: e.message, findings: [] }) }
  }
}
writeFileSync(resolve(OUT, 'probe.json'), JSON.stringify(results, null, 2))
ws.close(); chrome.kill()
console.log('done', results.reduce((n, r) => n + r.findings.length, 0), 'findings')
