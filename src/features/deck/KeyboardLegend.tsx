export const SKIP_HELP = 'Skip puts the card back at the end. Skipped twice, it waits in Review → Unsorted.'

export function KeyboardLegend() {
  return <div className="space-y-2">
    <p>← → ↑ ↓ swipe · Z undo · 1–9 types · T tag</p>
    <p>{SKIP_HELP} Tap the Skip caption for help.</p>
  </div>
}
