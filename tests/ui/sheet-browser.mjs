// Optional rendered-layout acceptance: npm run build && node tests/ui/sheet-browser.mjs
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
const output = mkdtempSync(join(tmpdir(), 'contacts-sheet-'))
const virtual = resolve('tests/ui/sheet-browser-entry.tsx')
const source = `
import { createRoot } from 'react-dom/client'
import { Sheet, SheetConfirm, SheetFooterActions, InlineNotice } from '../../src/ui/index'
const scenario = JSON.parse(document.body.dataset.scenario)
const visual = Object.assign(new EventTarget(), { height: scenario.visual, offsetTop: 0 })
Object.defineProperty(window, 'visualViewport', { value: visual, configurable: true })
document.documentElement.style.fontSize = scenario.large ? '24px' : '16px'
for (const side of ['top', 'bottom', 'left', 'right'])
  document.documentElement.style.setProperty('--sheet-safe-' + side, scenario.safe + 'px')
const confirm = <SheetConfirm title="Unsaved selections" body="Keep selected types and tags for this contact, or discard these changes?"
  confirmLabel="Keep selected types" cancelLabel="Discard" onConfirm={() => {}} onCancel={() => {}} />
createRoot(document.getElementById('root')).render(<Sheet open title="Contact details" onClose={() => {}}
  footer={<>{scenario.legacy && confirm}<SheetFooterActions secondary={{ label: 'Cancel', onClick: () => {} }}
    primary={{ label: 'Save contact', onClick: () => {} }} /></>}>
  <label>Name<input aria-label="Name" defaultValue="Maria" /></label>
  <p>All fields remain available while the keyboard is open.</p>
  <label>Notes<textarea aria-label="Notes" defaultValue="Unsaved notes" /></label>
  {!scenario.legacy && confirm}
  <InlineNotice tone="error">Could not save. Please try again.</InlineNotice>
</Sheet>)
setTimeout(async () => {
  await document.fonts.ready
  try {
    const panel = document.querySelector('.sheet-panel')
    const body = document.querySelector('.sheet-body')
    const fields = [...document.querySelectorAll('input, textarea, .sheet-confirm, [role="alert"], .sheet-actions button')]
    const rect = panel.getBoundingClientRect()
    const checks = fields.map(field => {
      field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      const item = field.getBoundingClientRect(), box = body.getBoundingClientRect()
      return { text: field.textContent || field.getAttribute('aria-label'), inside: body.contains(field),
        reachable: item.bottom > box.top && item.top < box.bottom,
        whole: item.height > box.height || (item.top >= box.top - 1 && item.bottom <= box.bottom + 1),
        horizontal: item.left >= rect.left - 1 && item.right <= rect.right + 1 }
    })
    body.scrollTop = 0
    parent.postMessage({ name: scenario.name, constrained: panel.dataset.constrained,
      panel: { top: rect.top, bottom: rect.bottom, height: rect.height },
      body: { height: body.clientHeight, scrollHeight: body.scrollHeight },
      headerHeight: document.querySelector('.sheet-header').getBoundingClientRect().height,
      checks }, '*')
  } catch (error) { parent.postMessage({ name: scenario.name, error: String(error) }, '*') }
}, 1200)
`
const bundle = await rolldown({ input: virtual, platform: 'browser',
  onLog: (level, log, next) => { if (log.code !== 'MODULE_LEVEL_DIRECTIVE') next(level, log) },
  transform: { define: { 'process.env.NODE_ENV': '"production"' }, jsx: { runtime: 'automatic' } },
  plugins: [{ name: 'sheet-qa', resolveId: id => id === virtual ? virtual : undefined,
    load: id => id === virtual ? source : undefined }],
})
const { output: chunks } = await bundle.generate({ format: 'iife' })
await bundle.close()
const code = chunks.find(chunk => chunk.type === 'chunk').code
const assets = resolve('dist/assets')
const css = readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(join(assets, name), 'utf8')).join('\n')
  .replace(/(?:\/contact-tinder)?\/assets\//g, pathToFileURL(assets).href + '/')
const scenarios = [
  { name: 'keyboard-inline', width: 320, height: 568, visual: 240, safe: 0, large: true, legacy: false },
  { name: 'keyboard-expanded-footer', width: 320, height: 568, visual: 240, safe: 0, large: true, legacy: true },
  { name: 'landscape-expanded-footer', width: 568, height: 320, visual: 320, safe: 24, large: true, legacy: true },
  { name: 'normal', width: 390, height: 844, visual: 844, safe: 0, large: false, legacy: false },
]
for (const scenario of scenarios) {
  const inner = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>
    <body data-scenario='${JSON.stringify(scenario)}'><div id="root"></div><script>${code.replaceAll('</script', '<\\/script')}</script>`
  const html = `<!doctype html><body><pre id="result">pending</pre><iframe style="border:0;width:${scenario.width}px;height:${scenario.height}px"></iframe>
    <script>onmessage=e=>document.getElementById('result').textContent=JSON.stringify(e.data);
    document.querySelector('iframe').srcdoc=${JSON.stringify(inner).replaceAll('</script', '<\\/script')};</script>`
  const file = join(output, scenario.name + '.html')
  writeFileSync(file, html)
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
  const constrained = scenario.name !== 'normal'
  assert.equal(result.constrained, String(constrained), scenario.name)
  if (constrained) {
    assert(result.headerHeight <= 76, 'Collapsed header exceeds handle + 32px title')
    assert(result.body.scrollHeight > result.body.height, 'Must scroll expanded content')
    assert(result.panel.top >= scenario.safe - 1, 'Panel above usable viewport')
    assert(result.panel.bottom <= scenario.visual - scenario.safe + 1, 'Panel below usable viewport')
    for (const check of result.checks) assert(check.inside && check.reachable && check.whole && check.horizontal, JSON.stringify(check))
  } else {
    assert(result.checks.filter(check => check.text === 'Save contact' || check.text === 'Cancel').every(check => !check.inside))
  }
  console.log(JSON.stringify(result))
}
console.log('Rendered sheet evidence: ' + output)
