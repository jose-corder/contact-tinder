import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function browserMode() {
  return !window.matchMedia?.('(display-mode: standalone)').matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
}

export function useInstallPrompt() {
  const [browser, setBrowser] = useState(browserMode)
  const [installed, setInstalled] = useState(false)
  const [prompt, setPrompt] = useState<InstallPromptEvent>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ios = (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  const safari = ios && /Version\/[\d.]+.*Safari\//.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent)
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
    setBusy(true); setError('')
    try {
      await prompt.prompt()
      if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true)
      setPrompt(undefined)
    } catch { setError('Could not open installation. Try again.') }
    finally { setBusy(false) }
  }
  return { visible: browser && !installed && (ios || !!prompt), ios, safari, available: !!prompt, busy, error, install }
}
