import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AnimatedRoutes } from '@/App'

vi.mock('@/features/home/HomeScreen', () => ({ default: () => { throw new Error('Home failed') } }))
vi.mock('@/features/home/SettingsScreen', () => ({ default: () => { throw new Error('Settings failed') } }))
vi.mock('@/features/import/ImportScreen', () => ({ default: () => { throw new Error('Import failed') } }))
vi.mock('@/features/deck/DeckScreen', () => ({ default: () => { throw new Error('Deck failed') } }))
vi.mock('@/features/review/ReviewScreen', () => ({ default: () => { throw new Error('Review failed') } }))
vi.mock('@/features/export/ExportScreen', () => ({ default: () => { throw new Error('Export failed') } }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(['/', '/settings', '/import', '/deck/triage', '/deck/work', '/deck/personal', '/review', '/export'])(
  'contains render failures on %s and offers reload', path => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<MemoryRouter initialEntries={[path]}><AnimatedRoutes /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong loading this screen')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
  },
)
