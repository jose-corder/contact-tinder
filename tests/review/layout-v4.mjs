// #14/#38/#58: actual Review sheets at portrait, keyboard and landscape sizes.
// Run after npm run build: node tests/review/layout-v4.mjs
// Uses installed Chromium and a local file only; no server or added dependencies.
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
assert(chrome, 'Set CHROME_PATH to an installed Chromium executable')
const output = mkdtempSync(join(tmpdir(), 'contacts-review-'))
const prepared = []
const virtual = resolve('tests/review/layout-browser-entry.tsx')
const source = `
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import RowSheet from '../../src/features/review/RowSheet'
import MergeSheet from '../../src/features/review/MergeSheet'
import { emptyDecision } from '../../src/domain/types'
import { resetAll, upsertContacts, saveDecisions } from '../../src/db/repo'
const scenario = JSON.parse(document.body.dataset.scenario)
const visual = Object.assign(new EventTarget(), { height: scenario.visual, offsetTop: 0 })
Object.defineProperty(window, 'visualViewport', { value: visual, configurable: true })
document.documentElement.style.fontSize = scenario.large ? '32px' : '16px'
for (const side of ['top', 'bottom', 'left', 'right'])
  document.documentElement.style.setProperty('--sheet-safe-' + side, scenario.safe + 'px')
const contact = (id, displayName) => ({ id, displayName, org: 'International community development organization',
  phones: [{ value: '+12025550101', e164: '+12025550101' }], phoneKeys: ['+12025550101'], emails: [], emailKeys: [], raw: '', importedAt: 1, source: 'vcf' })
const a = contact('a', 'Maria Alexandra Fernandez'), b = contact('b', 'Maria Fernandez family contact')
const ad = { ...emptyDecision('a', 1), bucket: 'work', workStatus: 'current', workTypes: ['client'], customTags: ['studio'] }
const bd = { ...emptyDecision('b', 1), bucket: 'personal', relation: 'family', personalTypes: ['neighbor'], customTags: ['school'] }
window.addEventListener('error', event => parent.postMessage({ name: scenario.name, error: event.message }, '*'))
;(async () => {
  await resetAll(); await upsertContacts([a, b]); await saveDecisions([ad, bd])
  createRoot(document.getElementById('root')).render(<MemoryRouter>{scenario.mode === 'merge'
    ? <MergeSheet pair={{ id: 'pair', a, b, reason: 'shared phone', createdAt: 1 }} onClose={() => {}} onMerged={() => {}} />
    : <RowSheet row={{ contact: a, decision: ad }} onClose={() => {}} />}</MemoryRouter>)
})().catch(error => parent.postMessage({ name: scenario.name, error: String(error) }, '*'))
setTimeout(() => {
  if (scenario.mode === 'remove') [...document.querySelectorAll('button')].find(button => button.textContent === 'Remove from app')?.click()
}, 800)
setTimeout(async () => {
  await document.fonts.ready
  try {
    const panel = document.querySelector('.sheet-panel'), body = document.querySelector('.sheet-body')
    const rect = panel.getBoundingClientRect()
    const fields = [...panel.querySelectorAll('h3, .sheet-confirm, [role="alert"], button:not(.sheet-handle), input')]
    const checks = fields.filter(field => !field.closest('details:not([open])')).map(field => {
      field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      const item = field.getBoundingClientRect(), box = body.getBoundingClientRect()
      const inside = body.contains(field)
      return { text: field.textContent || field.getAttribute('aria-label'), inside,
        reachable: inside ? item.bottom > box.top && item.top < box.bottom : item.top >= rect.top && item.bottom <= rect.bottom,
        horizontal: item.left >= rect.left - 1 && item.right <= rect.right + 1 }
    })
    const names = checks.map(check => check.text)
    if (scenario.mode === 'merge' && (!names.includes("Keep A's") || !names.includes("Keep B's") || !names.includes('Combine'))) throw Error('Comparison did not load')
    if (scenario.mode === 'remove' && !names.includes('Confirm removal')) throw Error('Removal confirmation did not open')
    body.scrollTop = scenario.mode === 'remove' ? body.scrollHeight : 0
    parent.postMessage({ name: scenario.name, constrained: panel.dataset.constrained,
      panel: { top: rect.top, bottom: rect.bottom, height: rect.height },
      body: { height: body.clientHeight, scrollHeight: body.scrollHeight }, checks }, '*')
  } catch (error) { parent.postMessage({ name: scenario.name, error: String(error) }, '*') }
}, 1800)
`

const bundle = await rolldown({ input: virtual, platform: 'browser',
  onLog: (level, log, next) => { if (log.code !== 'MODULE_LEVEL_DIRECTIVE') next(level, log) },
  transform: { define: { 'process.env.NODE_ENV': '"production"' }, jsx: { runtime: 'automatic' } },
  plugins: [{ name: 'sheet-qa', resolveId: id => id === virtual ? virtual : id.startsWith('@/') ? ['.ts', '.tsx', '/index.ts', '/index.tsx'].map(ext => resolve('src', id.slice(2) + ext)).find(existsSync) : undefined,
    load: id => id === virtual ? source : undefined }],
})
const { output: chunks } = await bundle.generate({ format: 'iife' })
await bundle.close()
const code = chunks.find(chunk => chunk.type === 'chunk').code
const assets = resolve('dist/assets')
const css = readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(join(assets, name), 'utf8')).join('\n')
  .replace(/(?:\/contact-tinder)?\/assets\//g, pathToFileURL(assets).href + '/')
const scenarios = ['merge', 'remove'].flatMap(mode => [
  { name: mode + '-320', mode, width: 320, height: 568, visual: 568, safe: 0, large: false },
  { name: mode + '-390', mode, width: 390, height: 844, visual: 844, safe: 0, large: false },
  { name: mode + '-keyboard', mode, width: 320, height: 568, visual: 240, safe: 0, large: true },
  { name: mode + '-landscape', mode, width: 568, height: 320, visual: 320, safe: 24, large: true },
])

for (const scenario of scenarios) {
  const inner = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>
    <body data-scenario='${JSON.stringify(scenario)}'><div id="root"></div><script>${code.replaceAll('</script', '<\\/script')}</script>`
  const html = `<!doctype html><body><pre id="result">pending</pre><iframe style="border:0;width:${scenario.width}px;height:${scenario.height}px"></iframe>
    <script>onmessage=e=>document.getElementById('result').textContent=JSON.stringify(e.data);
    document.querySelector('iframe').srcdoc=${JSON.stringify(inner).replaceAll('</script', '<\\/script')};</script>`
  const file = join(output, scenario.name + '.html')
  writeFileSync(file, html)
  if (process.argv.includes('--prepare')) { prepared.push({ scenario, file, screenshot: join(output, scenario.name + '.png'), profile: join(output, 'profile-' + scenario.name) }); continue }
  const run = spawnSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--hide-scrollbars', '--window-size=800,1000',
    '--user-data-dir=' + join(output, 'profile-' + scenario.name), '--virtual-time-budget=4000',
    '--screenshot=' + join(output, scenario.name + '.png'), '--dump-dom', pathToFileURL(file).href],
  { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 12 * 1024 * 1024 })
  assert.equal(run.status, 0, run.error?.message ?? run.stderr)
  const match = run.stdout.match(/<pre id="result">(.*?)<\/pre>/s)
  assert(match && match[1] !== 'pending', 'Browser did not finish: ' + run.stderr)
  const result = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'))
  assert(!result.error, result.error)
  assert(result.panel.top >= scenario.safe - 1, 'Panel above viewport')
  assert(result.panel.bottom <= scenario.visual - scenario.safe + 1, 'Panel below viewport')
  for (const check of result.checks) assert(check.reachable && check.horizontal, JSON.stringify(check))
  console.log(JSON.stringify(result))
}
if (process.argv.includes('--prepare')) { writeFileSync(join(output, 'plan.json'), JSON.stringify(prepared)); console.log(join(output, 'plan.json')) }
else console.log('Rendered sheet evidence: ' + output)
