import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Trade } from '../../shared/types'
import { api } from './api'
import { TradeFormModal } from '../components/TradeForm'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TradeDetailModal } from '../components/TradeDetail'

interface FormState {
  trade?: Trade | null
  date?: string
}

interface Store {
  trades: Trade[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  openForm: (s?: FormState) => void
  openDetail: (t: Trade) => void
  askDelete: (t: Trade) => void
  startingCapital: number
  setStartingCapital: (v: number) => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore doit être utilisé dans <StoreProvider>')
  return s
}

const CAPITAL_KEY = 'tj.startingCapital'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [detail, setDetail] = useState<Trade | null>(null)
  const [toDelete, setToDelete] = useState<Trade | null>(null)
  const [startingCapital, setCapital] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(CAPITAL_KEY)) || 0
    } catch {
      return 0
    }
  })

  const reload = useCallback(async () => {
    try {
      setTrades(await api.list())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const setStartingCapital = useCallback((v: number) => {
    setCapital(v)
    try {
      localStorage.setItem(CAPITAL_KEY, String(v))
    } catch {
      /* stockage indisponible : on garde la valeur en mémoire */
    }
  }, [])

  const value = useMemo<Store>(
    () => ({
      trades,
      loading,
      error,
      reload,
      openForm: (s = {}) => setForm(s),
      openDetail: setDetail,
      askDelete: setToDelete,
      startingCapital,
      setStartingCapital,
    }),
    [trades, loading, error, reload, startingCapital, setStartingCapital],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {form && (
        <TradeFormModal
          trade={form.trade ?? null}
          defaultDate={form.date}
          onClose={() => setForm(null)}
          onSaved={async () => {
            setForm(null)
            setDetail(null)
            await reload()
          }}
        />
      )}
      {detail && (
        <TradeDetailModal
          trade={trades.find((t) => t.id === detail.id) ?? detail}
          onClose={() => setDetail(null)}
          onEdit={(t) => {
            setDetail(null)
            setForm({ trade: t })
          }}
          onDelete={(t) => setToDelete(t)}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Supprimer ce trade ?"
          message={`${toDelete.asset} du ${toDelete.date} sera définitivement supprimé, ainsi que sa capture d'écran. Les statistiques seront recalculées.`}
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            await api.remove(toDelete.id)
            setToDelete(null)
            setDetail(null)
            await reload()
          }}
        />
      )}
    </Ctx.Provider>
  )
}
