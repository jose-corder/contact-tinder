// Live-app acceptance with real Chrome layout, pointer input and keyboard Tab.
// BASE_URL=http://localhost:5173 node tests/deck/measured-browser.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:5173'
const out = resolve('qa-screens-v6')
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(resolve(out, 'acceptance-profile-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
  { stdio: ['ignore', 'pipe', 'pipe'] })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws
const results = []
try {
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = ''
    const timeout = setTimeout(() => reject(new Error('Chrome startup timed out: ' + stderr)), 20000)
    chrome.stderr.on('data', data => {
      stderr += data
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) { clearTimeout(timeout); resolve(match[1]) }
    })
    chrome.on('error', reject)
    chrome.on('exit', code => { clearTimeout(timeout); reject(new Error(`Chrome exited ${code}: ${stderr}`)) })
  })
  const target = await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise(resolve => { ws.onopen = resolve })
  let id = 0
  const pending = new Map()
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (!pending.has(message.id)) return
    const { resolve, reject, timeout } = pending.get(message.id)
    clearTimeout(timeout); pending.delete(message.id)
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id
    const timeout = setTimeout(() => { pending.delete(key); reject(new Error(method + ' timed out')) }, 20000)
    pending.set(key, { resolve, reject, timeout }); ws.send(JSON.stringify({ id: key, method, params }))
  })
  const evaluate = async expression => {
    const value = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text)
    return value.result.value
  }
  const waitFor = async expression => {
    for (let i = 0; i < 60; i++) {
      try { if (await evaluate(expression)) return } catch (error) {
        if (!/navigated|context|closed/i.test(String(error))) throw error
      }
      await sleep(250)
    }
    throw new Error('Timed out waiting for ' + expression)
  }
  const go = async path => {
    await send('Page.navigate', { url: base + path })
    await sleep(600)
    await waitFor('document.readyState === "complete" && !!document.querySelector("#root > *")')
    await sleep(800)
  }
  const key = async (key, code = key, virtual = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtual })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtual })
  }
  const click = async selector => {
    const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2} })()`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  }
  await send('Page.enable'); await send('Runtime.enable')
  await go('/import')
  await waitFor('[...document.querySelectorAll("button")].some(b => /sample contacts/i.test(b.textContent))')
  await evaluate('[...document.querySelectorAll("button")].find(b => /sample contacts/i.test(b.textContent)).click()')
  await waitFor('/Start triage/i.test(document.body.textContent)')
  await evaluate('for (const pass of ["triage","work","personal"]) localStorage.setItem("ct.coach." + pass, "seen")')
  for (const [width, height] of [[320,568], [360,740], [390,844], [430,932], [844,390], [1024,768], [1280,800]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 })
    await go('/deck/triage')
    await waitFor('!!document.querySelector(".deck-current-card article")')
    const layout = await evaluate(`(() => {
      const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height} }
      const legend = document.querySelector('.deck-keyboard-help')
      return {card:rect('.deck-current-card'),rail:rect('.deck-controls'),toolbar:rect('.deck-toolbar'),
        pageHeight:document.documentElement.scrollHeight, legendHidden:getComputedStyle(legend).display === 'none',
        legendClipped:legend.scrollWidth > legend.clientWidth + 1}
    })()`)
    assert(layout.card.height <= 560.5, 'Card exceeds 560px')
    assert(layout.card.bottom <= layout.rail.top || layout.card.right <= layout.rail.left, 'Card overlaps rail')
    assert(layout.pageHeight <= height + 1, 'Deck page scrolls')
    assert(layout.toolbar.bottom <= height + 1 && layout.toolbar.bottom >= height - 24, 'Actions are too far from bottom')
    assert(width >= 360 || layout.legendHidden, 'Narrow legend should be hidden')
    assert(layout.legendHidden || !layout.legendClipped, 'Legend clips')
    results.push({ state: 'deck', width, height, layout })
    await click('.deck-current-card .deck-card-meta button')
    await sleep(500)
    assert(await evaluate(`document.querySelector('.deck-current-card .deck-face').inert && [...document.querySelectorAll('[inert] button')].some(b => b.textContent === 'View all fields')`))
    for (let i = 0; i < 16; i++) {
      await key('Tab', 'Tab', 9)
      assert(await evaluate('!document.activeElement.closest("[inert]")'), 'Tab reached hidden card face')
    }
    results.push({ state: 'flip-tab', width, height })
    await go('/deck/triage')
    await click('[aria-label="Work"]')
    await waitFor('!!document.querySelector("[role=dialog]")')
    await sleep(500)
    const focus = await evaluate('({tag:document.activeElement.tagName, ring:document.activeElement.matches(":focus-visible")})')
    assert.equal(focus.tag, 'H2', 'Pointer open must focus heading')
    assert.equal(focus.ring, false, 'Pointer open must not show a focus ring')
    const sheet = await evaluate(`(() => {
      const body = document.querySelector('.sheet-body'), footer = document.querySelector('.sheet-footer')
      const controls = [...body.querySelectorAll('button,a[href]')].filter(e => !footer.contains(e))
      const last = controls.at(-1); last.scrollIntoView({block:'end',behavior:'instant'})
      return {clearance:footer.getBoundingClientRect().top-last.getBoundingClientRect().bottom,
        padding:parseFloat(getComputedStyle(body).paddingBottom), footerHeight:footer.getBoundingClientRect().height}
    })()`)
    assert(sheet.clearance >= 8, 'Footer covers last body control')
    assert(Math.abs(sheet.padding - sheet.footerHeight - 16) <= 1, 'Footer clearance is not measured')
    results.push({ state: 'sheet-pointer', width, height, focus, sheet })
    await go('/deck/triage')
    await key('ArrowRight', 'ArrowRight', 39)
    await waitFor('!!document.querySelector("[role=dialog]")')
    assert.equal(await evaluate('document.activeElement.textContent'), 'Old', 'Keyboard open must focus first chip')
    results.push({ state: 'sheet-keyboard', width, height })
    console.log(`${width}x${height}: deck, flip/Tab, pointer sheet, keyboard sheet passed`)
  }
  console.log(`${results.length} browser scenarios passed`)
} finally {
  writeFileSync(resolve(out, 'acceptance.json'), JSON.stringify(results, null, 2))
  ws?.close(); chrome.kill()
}
