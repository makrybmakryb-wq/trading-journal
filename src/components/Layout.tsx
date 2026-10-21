import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, CalendarDays, LayoutDashboard, ListOrdered, Menu, Plus, Settings, TrendingUp, X } from 'lucide-react'
import { useStore } from '../lib/store'

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/trades', label: 'Journal des trades', icon: ListOrdered },
  { to: '/calendrier', label: 'Calendrier', icon: CalendarDays },
  { to: '/analyses', label: 'Analyses', icon: BarChart3 },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
]

export function Layout() {
  const { openForm, error, loading } = useStore()
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-panel-2 hover:text-ink'}`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-2.5 px-6 py-5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gain/15 text-gain">
        <TrendingUp size={18} />
      </span>
      <span className="font-semibold tracking-tight">Journal de trading</span>
    </div>
  )

  return (
    <div className="flex min-h-full">
      {/* Menu latéral (ordinateur) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-panel lg:flex">
        {brand}
        {nav}
        <div className="p-4">
          <button className="btn btn-primary w-full" onClick={() => openForm()}>
            <Plus size={16} /> Nouveau trade
          </button>
        </div>
      </aside>

      {/* Menu coulissant (tablette / mobile) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-panel shadow-2xl">
            <button className="absolute right-3 top-4 text-muted" onClick={() => setOpen(false)} aria-label="Fermer le menu">
              <X size={20} />
            </button>
            {brand}
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre du haut (mobile) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="text-muted">
            <Menu size={22} />
          </button>
          <span className="font-semibold">Journal de trading</span>
          <button className="btn btn-primary ml-auto !px-3 !py-1.5" onClick={() => openForm()}>
            <Plus size={16} /> Trade
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-4 rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
              Impossible d’accéder au stockage du navigateur : {error}
            </div>
          )}
          {loading ? <p className="py-20 text-center text-muted">Chargement…</p> : <Outlet />}
        </main>
      </div>
    </div>
  )
}
