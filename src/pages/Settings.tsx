import { useState } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '../lib/store'

export function SettingsPage() {
  const { startingCapital, setStartingCapital, trades } = useStore()
  const [value, setValue] = useState(startingCapital ? String(startingCapital) : '')
  const [saved, setSaved] = useState(false)

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Paramètres</h1>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Capital de départ</h2>
        <p className="text-sm text-muted">Sert de point de départ à la courbe d’évolution du capital. Laissez vide (ou 0) pour afficher uniquement les résultats cumulés.</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(value.replace(',', '.'))
            setStartingCapital(Number.isFinite(n) && n >= 0 ? n : 0)
            setSaved(true)
            setTimeout(() => setSaved(false), 1800)
          }}
        >
          <input className="field max-w-48" inputMode="decimal" placeholder="Ex. 10000" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-primary" type="submit">
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </form>
        <p className="text-xs text-muted">Ce réglage est mémorisé dans votre navigateur.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Vos données</h2>
        <p className="text-sm text-muted">
          {trades.length} trade{trades.length > 1 ? 's' : ''} stocké{trades.length > 1 ? 's' : ''} dans le fichier <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">data/journal.db</code> (captures dans <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">data/uploads/</code>). Pour sauvegarder, copiez simplement le dossier <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">data</code>.
        </p>
        <a href="/api/export.csv" className="btn btn-ghost inline-flex">
          <Download size={15} /> Exporter tout l’historique (CSV)
        </a>
      </section>

      <section className="card space-y-2 p-5 text-sm text-muted">
        <h2 className="text-sm font-semibold text-ink">À savoir</h2>
        <p>Les totaux additionnent les résultats tels quels : si vous mélangez plusieurs devises, ils ne sont pas convertis. Les montants s’affichent dans la devise la plus utilisée.</p>
      </section>
    </div>
  )
}
