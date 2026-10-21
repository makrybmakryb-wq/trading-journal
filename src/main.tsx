import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { StoreProvider } from './lib/store'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { TradesPage } from './pages/Trades'
import { CalendarPage } from './pages/CalendarPage'
import { AnalyticsPage } from './pages/Analytics'
import { SettingsPage } from './pages/Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <StoreProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="trades" element={<TradesPage />} />
            <Route path="calendrier" element={<CalendarPage />} />
            <Route path="analyses" element={<AnalyticsPage />} />
            <Route path="parametres" element={<SettingsPage />} />
            <Route path="*" element={<p className="py-20 text-center text-muted">Page introuvable.</p>} />
          </Route>
        </Routes>
      </StoreProvider>
    </HashRouter>
  </StrictMode>,
)
