import { readFileSync } from 'node:fs'

const css = readFileSync('src/index.css', 'utf8')
const palettes = [...css.matchAll(/--paper: (#[\da-f]{6});([\s\S]*?)--shadow-card:/g)].map((match) =>
  Object.fromEntries([...match[0].matchAll(/--([\w-]+): (#[\da-f]{6});/g)].map((token) => [token[1], token[2]])))

function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

it('keeps every selected semantic label above 4.5:1 in light, manual dark and automatic dark', () => {
  expect(palettes).toHaveLength(3)
  for (const palette of palettes) {
    for (const tone of ['delete', 'work', 'personal', 'skip', 'status-old', 'status-current', 'status-potential']) {
      const fill = tone.startsWith('status') ? tone : `stamp-${tone}`
      expect(contrast(palette[`on-${tone}`], palette[fill]), `${tone} on ${palette.paper}`).toBeGreaterThanOrEqual(4.5)
    }
    for (const surface of ['paper', 'paper-2']) {
      expect(contrast(palette['control-border'], palette[surface]), `control boundary on ${surface}`).toBeGreaterThanOrEqual(3)
      expect(contrast(palette['progress-track'], palette[surface]), `progress track on ${surface}`).toBeGreaterThanOrEqual(3)
      for (const tone of ['ink-2', 'stamp-delete', 'stamp-personal']) {
        expect(contrast(palette[tone], palette[surface]), `${tone} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    expect(contrast(palette['control-border'], palette.paper)).toBeGreaterThan(contrast(palette.rule, palette.paper))
  }
  expect(palettes[1]).toEqual(palettes[2])
})

it('preserves zoom and enforces 16px editable text after legacy utilities', () => {
  const html = readFileSync('index.html', 'utf8')
  expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/)
  const touchRule = css.indexOf('@media (pointer: coarse) { input, textarea, select { font-size: 16px; } }')
  expect(touchRule).toBeGreaterThan(css.indexOf('@layer utilities'))
  expect(css).toContain('scroll-padding-bottom: 120px')
})
