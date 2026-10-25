import { InlineNotice } from '@/ui'
import { IconDownload, IconShare } from '@/ui/icons'
import { useInstallPrompt } from './useInstallPrompt'

export default function InstallRow() {
  const install = useInstallPrompt()
  if (!install.visible) return null
  return <section aria-label="Install app" className="mt-8 flex items-center gap-3 border-y border-rule py-4">
    {install.ios ? <IconShare size={18} /> : <IconDownload size={18} />}
    <div className="min-w-0 flex-1"><h2 className="t-body">Install app</h2>
      <p className="mt-1 t-meta text-ink-2">{install.ios ? 'Share → Add to Home Screen' : 'Keep Contacts. one tap away.'}</p>
      {install.error && <InlineNotice tone="error">{install.error}</InlineNotice>}
    </div>
    {!install.ios && install.available && <button className="hit-44 t-body underline underline-offset-4" disabled={install.busy} onClick={() => void install.install()}>Install Contacts.</button>}
  </section>
}
