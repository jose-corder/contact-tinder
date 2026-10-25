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
import { ErrorBoundary } from './ui/ErrorBoundary'
import { motionProps } from './ui/motion'
import { useRouteFocus } from './ui/useRouteFocus'

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

function RoutePage({ children, ownsMain, reduced, pageRef, pathname }: {
  children: ReactNode; ownsMain: boolean; reduced: boolean; pageRef: RefObject<HTMLElement | null>; pathname: string
}) {
  const present = useIsPresent()
  const Page = ownsMain ? motion.div : motion.main
  return <Page ref={(node) => { if (present && node) pageRef.current = node }} id={present ? 'main-content' : undefined} tabIndex={-1}
    inert={!present} aria-hidden={!present || undefined} data-route-path={pathname} className="min-w-0" style={{ gridArea: '1 / 1' }}
    {...motionProps(reduced, { transition: { duration: 0.14, ease: 'easeOut' } })}>{children}</Page>
}

export function AnimatedRoutes() {
  const location = useLocation()
  const navigation = useNavigationType()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const page = useRef<HTMLElement>(null)
  const path = location.pathname.replace(/\/$/, '') || '/'
  useRouteFocus(location.pathname, navigation, page)
  useLayoutEffect(() => { document.title = `${routeTitles[path] ?? 'Home'} · Contacts.` }, [path])
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="grid">
      <AnimatePresence initial={false}>
        <RoutePage key={location.pathname} pathname={location.pathname} pageRef={page} ownsMain={path === '/import'} reduced={reduced}>
          <Routes location={location}>
            <Route path="/" element={<ErrorBoundary><HomeScreen /></ErrorBoundary>} />
            <Route path="/import" element={<ErrorBoundary><ImportScreen /></ErrorBoundary>} />
            <Route path="/deck/:pass" element={<ErrorBoundary><DeckRoute /></ErrorBoundary>} />
            <Route path="/review" element={<ErrorBoundary><ReviewScreen /></ErrorBoundary>} />
            <Route path="/export" element={<ErrorBoundary><ExportScreen /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><SettingsScreen /></ErrorBoundary>} />
            <Route path="*" element={<ErrorBoundary><Navigate to="/" replace /></ErrorBoundary>} />
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
