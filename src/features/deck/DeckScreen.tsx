// STUB — replaced by Codex agent B. Keep the default export name and the `pass` prop.
import { PASS_META } from '@/domain/taxonomy'
import type { Pass } from '@/domain/types'
import { Frame, TopBar } from '@/ui'

export default function DeckScreen({ pass }: { pass: Pass }) {
  return (
    <Frame>
      <TopBar title={PASS_META[pass].title} backTo="/" right="0 / 0" progress={0} />
      <p className="text-ink-2">Coming soon.</p>
    </Frame>
  )
}
