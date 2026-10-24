import { useEffect, useState } from 'react'
import { toast } from '@/ui/toast'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function browserMode() {
  return !!window.matchMedia?.('(display-mode: browser)').matches &&
    !window.matchMedia?.('(display-mode: standalone)').matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
}

export function useInstallPrompt() {
  const [browser, setBrowser] = useState(browserMode)
  const [installed, setInstalled] = useState(false)
  const [prompt, setPrompt] = useState<InstallPromptEvent>()
  const [busy, setBusy] = useState(false)
  const ios = (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
    /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setPrompt(undefined) }
    const onModeChange = () => setBrowser(browserMode())
    const queries = ['(display-mode: browser)', '(display-mode: standalone)'].map((query) => window.matchMedia?.(query))
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    queries.forEach((query) => query?.addEventListener?.('change', onModeChange))
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      queries.forEach((query) => query?.removeEventListener?.('change', onModeChange))
    }
  }, [])
  async function install() {
    if (!prompt || busy) return
    setBusy(true)
    try {
      await prompt.prompt()
      if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true)
    } catch { toast('Use your browser menu to install Contacts.') }
    finally { setPrompt(undefined); setBusy(false) }
  }
  return { visible: browser && !installed, ios, available: !!prompt, busy, install }
}
