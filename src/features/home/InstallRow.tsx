import { IconDownload } from '@/ui/icons'
import { useInstallPrompt } from './useInstallPrompt'

export default function InstallRow() {
  const install = useInstallPrompt()
  if (!install.visible) return null
  return <section aria-label="Install app" className="mt-8 flex items-center gap-3 border-y border-rule py-4">
    <IconDownload size={18} />
    <div className="min-w-0 flex-1"><h2 className="text-sm">Install app</h2>
      <p className="mt-1 text-xs text-ink-2">{install.ios ? 'Share → Add to Home Screen' : install.available ? 'Keep Contacts. one tap away.' : 'Use your browser’s install option when available.'}</p>
    </div>
    {!install.ios && install.available && <button className="min-h-11 text-sm underline underline-offset-4" disabled={install.busy} onClick={() => void install.install()}>Install</button>}
  </section>
}
