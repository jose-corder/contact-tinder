// Real layout acceptance, using installed Chromium, built CSS and local files. No server.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { rolldown } from 'rolldown'

const chrome = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
assert(chrome, 'Set CHROME_PATH to installed Chromium')
const output = process.argv[2] === '--verify' ? resolve(process.argv[3]) : mkdtempSync(join(tmpdir(), 'contacts-deck-'))
const virtual = resolve('tests/deck/layout-browser-entry.tsx')
const source = `
import 'fake-indexeddb/auto'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import DeckScreen from '../../src/features/deck/DeckScreen'
import { upsertContacts, resetAll } from '../../src/db/repo'
import { markCoachSeen } from '../../src/hooks/useCoach'
const scenario = JSON.parse(document.body.dataset.scenario)
const contact = { id: 'layout', displayName: scenario.width === 390 ? 'Daniel Rey Montemayor' : 'Daniel Rey Salazar', title: 'Regional Director',
  org: 'International Design Partnership', phones: [{value:'555 123 4567'}, {value:'555 987 6543'}],
  emails: [{value:'daniel@example.com'}, {value:'office@example.com'}], raw:'', notes:'Extra details',
  source:'demo', importedAt:1, phoneKeys:[], emailKeys:[] }
markCoachSeen('triage')
const root = createRoot(document.getElementById('root'))
resetAll().then(() => upsertContacts([contact, { ...contact, id: 'next', displayName: 'Next contact' }])).then(() => {
  root.render(<MemoryRouter><DeckScreen pass="triage" /></MemoryRouter>)
})
setTimeout(async () => {
  await document.fonts.ready
  try {
    const card = document.querySelector('.deck-current-card article')
    const body = card.querySelector('.deck-front-scroll')
    const name = body.querySelector('h2'), role = body.querySelector('.deck-identity > p')
    const rect = node => { const r = node.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height} }
    const nameLines = name.scrollHeight / parseFloat(getComputedStyle(name).lineHeight)
    const rows = [...body.querySelectorAll('.deck-field-row')].map(row => ({...rect(row), text:row.textContent}))
    const rail = document.querySelector('.deck-controls'), toolbar = document.querySelector('.deck-toolbar')
    const legend = document.querySelector('.deck-keyboard-help')
    const front = { body:rect(body), card:rect(card), rail:rect(rail), toolbar:rect(toolbar),
      pageHeight:document.documentElement.scrollHeight,
      legendHidden:getComputedStyle(legend).display === 'none', legendClipped:legend.scrollWidth > legend.clientWidth + 1,
      identity:rect(name), role:rect(role), nameLines,
      nameClamp:getComputedStyle(name).webkitLineClamp, roleClamp:getComputedStyle(role).webkitLineClamp,
      nameOverflow:name.scrollHeight > name.clientHeight + 4,
      overflow:getComputedStyle(body).overflowY, rows, constrained:card.dataset.constrained }
    const button = [...card.querySelectorAll('button')].find(node => node.textContent === 'View all fields')
    button.scrollIntoView({block:'center'})
    const viewReachable = button.getBoundingClientRect().top >= 0 && button.getBoundingClientRect().bottom <= innerHeight
    button.click()
    setTimeout(() => {
      const details = document.querySelector('.deck-current-card [aria-label="All contact fields"]')
      const back = [...card.querySelectorAll('button')].find(node => node.textContent === 'Back')
      back.scrollIntoView({block:'center'})
      const backReachable = back.getBoundingClientRect().top >= 0 && back.getBoundingClientRect().bottom <= innerHeight
      back.click()
      document.querySelector('.deck-screen').scrollTop = 0; window.scrollTo(0,0)
      parent.postMessage({name:scenario.name, ...front, viewReachable, backReachable,
        detailsOverflow:getComputedStyle(details).overflowY}, '*')
      // Capture a fresh front after testing the flip, avoiding an in-flight 3D animation.
      root.render(<MemoryRouter key="capture"><DeckScreen pass="triage" /></MemoryRouter>)
    }, 500)
  } catch(error) { parent.postMessage({name:scenario.name,error:String(error)}, '*') }
}, 1800)
`
const bundle = await rolldown({ input: virtual, platform: 'browser',
  onLog: (level, log, next) => { if (log.code !== 'MODULE_LEVEL_DIRECTIVE') next(level, log) },
  transform: { define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.BASE_URL': '"/"', 'import.meta.hot': 'undefined' }, jsx: { runtime: 'automatic' } },
  plugins: [{ name: 'deck-layout', resolveId: id => {
    if (id.endsWith('.css')) return '\0empty-css'
    if (id === virtual) return virtual
    if (id.startsWith('@/')) return ['.ts', '.tsx', '/index.tsx'].map(ext => resolve('src', id.slice(2) + ext)).find(existsSync)
  }, load: id => id === virtual ? source : id === '\0empty-css' ? '' : undefined }],
})
const { output: chunks } = await bundle.generate({ format: 'iife' })
await bundle.close()
const code = chunks.find(chunk => chunk.type === 'chunk').code
const assets = resolve('dist/assets')
const css = readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(join(assets, name), 'utf8')).join('\n')
  .replace(/(?:\/contact-tinder)?\/assets\//g, pathToFileURL(assets).href + '/')
const scenarios = [
  { name: 'portrait-390', width: 390, height: 844 },
  { name: 'portrait-320', width: 320, height: 568 },
  { name: 'portrait-430', width: 430, height: 932 },
  { name: 'landscape-844', width: 844, height: 390 },
  { name: 'short-height', width: 320, height: 540 },
]
for (const scenario of scenarios) {
  const inner = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>
    <body data-scenario='${JSON.stringify(scenario)}'><div id="root"></div><script>${code.replaceAll('</script', '<\\/script')}</script>`
  const html = `<!doctype html><body><pre id="result" style="white-space:pre-wrap;font:10px monospace;max-height:80px;overflow:auto">pending</pre><iframe style="border:0;width:${scenario.width}px;height:${scenario.height}px"></iframe>
    <script>onmessage=e=>document.getElementById('result').textContent=JSON.stringify(e.data);
    document.querySelector('iframe').srcdoc=${JSON.stringify(inner).replaceAll('</script', '<\\/script')};</script>`
  const file = join(output, scenario.name + '.html')
  writeFileSync(file, html)
  if (process.argv[2] === '--prepare') continue
  const saved = process.argv[2] === '--verify' ? readFileSync(join(output, scenario.name + '.dom'), 'utf8') : null
  const run = saved === null ? spawnSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--window-size=800,1000', '--user-data-dir=' + join(output, 'profile-' + scenario.name),
    '--virtual-time-budget=5000', '--screenshot=' + join(output, scenario.name + '.png'), '--dump-dom', pathToFileURL(file).href],
  { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 12 * 1024 * 1024 }) : { status: 0, stdout: saved, stderr: '' }
  assert.equal(run.status, 0, run.error?.message ?? run.stderr)
  const match = run.stdout.match(/<pre id="result"[^>]*>(.*?)<\/pre>/s)
  assert(match && match[1] !== 'pending', 'Browser did not finish: ' + run.stderr)
  const result = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'))
  console.log(JSON.stringify(result))
  assert(!result.error, result.error)
  if (scenario.name !== 'short-height') {
    assert(result.card.height <= 560, 'Card exceeds 560px cap')
    assert(result.pageHeight <= scenario.height + 1, 'Deck must not scroll the page')
    assert(result.card.bottom <= result.rail.top || result.card.right <= result.rail.left, 'Card overlaps controls')
    assert(result.toolbar.bottom <= scenario.height && result.toolbar.bottom >= scenario.height - 24, 'Actions must stay at the safe bottom')
  }
  if (scenario.width < 360) assert(result.legendHidden, 'Hide keyboard legend on narrow phones')
  else assert(result.legendHidden || !result.legendClipped, 'Keyboard legend is clipped')
  assert.equal(result.overflow, 'visible')
  assert.equal(result.nameClamp, '2')
  assert.equal(result.roleClamp, '2')
  assert(!result.nameOverflow, 'Two-line name must remain fully readable')
  assert(result.viewReachable && result.backReachable, 'Details controls must be reachable')
  for (const row of result.rows) assert(row.top >= result.body.top && row.bottom <= result.body.bottom + 1, 'Essential row clipped')
  if (scenario.name === 'short-height') assert.equal(result.detailsOverflow, 'visible')
}
console.log('Rendered deck evidence: ' + output)
