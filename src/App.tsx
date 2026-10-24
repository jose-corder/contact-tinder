import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router'
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

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/import" element={<ImportScreen />} />
        <Route path="/deck/:pass" element={<DeckRoute />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/export" element={<ExportScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
