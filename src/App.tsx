import { useLayoutEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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

function AnimatedRoutes() {
  const location = useLocation()
  const navigation = useNavigationType()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  // Import owns its main landmark; the other screens use a plain Frame.
  const Page = location.pathname.replace(/\/$/, '') === '/import' ? motion.div : motion.main
  useLayoutEffect(() => {
    if (navigation !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, navigation])
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <AnimatePresence mode="wait" initial={false}>
      <Page key={location.pathname} id="main-content" tabIndex={-1}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
        transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }}>
      <Routes location={location}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/import" element={<ImportScreen />} />
        <Route path="/deck/:pass" element={<DeckRoute />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/export" element={<ExportScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Page>
    </AnimatePresence>
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
