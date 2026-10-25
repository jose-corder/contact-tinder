import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router'
import { useMediaQuery } from './ui/useMediaQuery'
import { PASS_ORDER } from './domain/taxonomy'
import type { Pass } from './domain/types'
import HomeScreen from './features/home/HomeScreen'
import SettingsScreen from './features/home/SettingsScreen'
import ImportScreen from './features/import/ImportScreen'
import DeckScreen from './features/deck/DeckScreen'
import ReviewScreen from './features/review/ReviewScreen'
import ExportScreen from './features/export/ExportScreen'
import { Toaster } from './ui/toast'

function DeckRoute() {
  const { pass } = useParams()
  if (!pass || !PASS_ORDER.includes(pass as Pass)) return <Navigate to="/deck/triage" replace />
  return <DeckScreen pass={pass as Pass} />
}

const routeTitles: Record<string, string> = {
  '/': 'Home', '/import': 'Import', '/deck/triage': 'Sort contacts',
  '/deck/work': 'Work', '/deck/personal': 'Personal', '/review': 'Review',
  '/export': 'Export', '/settings': 'Settings',
}

function RoutePage({ children, ownsMain, reduced, pageRef }: {
  children: ReactNode; ownsMain: boolean; reduced: boolean; pageRef: RefObject<HTMLElement | null>
}) {
  const present = useIsPresent()
  const Page = ownsMain ? motion.div : motion.main
  return <Page ref={(node) => { if (present) pageRef.current = node }} id={present ? 'main-content' : undefined} tabIndex={-1}
    inert={!present} aria-hidden={!present || undefined} className="min-w-0" style={{ gridArea: '1 / 1' }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0.12 : 0.14, ease: 'easeOut' }}>{children}</Page>
}

export function AnimatedRoutes() {
  const location = useLocation()
  const navigation = useNavigationType()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const page = useRef<HTMLElement>(null)
  const positions = useRef(new Map<string, { top: number; left: number }>())
  const path = location.pathname.replace(/\/$/, '') || '/'
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])
  useLayoutEffect(() => {
    document.title = `${routeTitles[path] ?? 'Home'} · Contacts.`
    const restore = () => window.scrollTo({ ...(navigation === 'POP'
      ? positions.current.get(location.key) ?? { top: 0, left: 0 } : { top: 0, left: 0 }), behavior: 'instant' })
    restore()
    if (navigation !== 'POP') {
      const main = page.current?.matches('main') ? page.current : page.current?.querySelector('main')
      if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }) }
    }
    // An exiting taller page can temporarily affect document height during a crossfade.
    const frame = requestAnimationFrame(restore)
    return () => {
      cancelAnimationFrame(frame)
      positions.current.set(location.key, { top: window.scrollY, left: window.scrollX })
    }
  }, [location.key, path, navigation])
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="grid">
      <AnimatePresence initial={false}>
        <RoutePage key={location.key} pageRef={page} ownsMain={path === '/import'} reduced={reduced}>
          <Routes location={location}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/import" element={<ImportScreen />} />
            <Route path="/deck/:pass" element={<DeckRoute />} />
            <Route path="/review" element={<ReviewScreen />} />
            <Route path="/export" element={<ExportScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RoutePage>
      </AnimatePresence>
    </div>
  </>
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AnimatedRoutes />
      <Toaster />
    </BrowserRouter>
  )
}
