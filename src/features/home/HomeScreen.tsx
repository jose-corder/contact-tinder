// STUB — replaced by Codex agent C. Keep the default export name and props.
import { Link } from 'react-router'
import { Button, Frame } from '@/ui'

export default function HomeScreen() {
  return (
    <Frame>
      <div className="flex flex-1 flex-col items-start justify-center gap-6">
        <h1 className="font-serif text-6xl text-ink">Contacts.</h1>
        <p className="max-w-[300px] text-ink-2">Swipe through your address book. Everything stays on this device.</p>
        <Link to="/import"><Button size="lg">Import contacts</Button></Link>
        <Link to="/settings" className="text-sm text-ink-2 underline underline-offset-4">Settings</Link>
      </div>
    </Frame>
  )
}
