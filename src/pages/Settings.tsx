import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { exportCsv, exportJson, importJson } from '../lib/backup'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function SettingsPage() {
  const { startingCapital, setStartingCapital, trades, reload } = useStore()
  const [value, setValue] = useState(String(startingCapital))
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const code = 'rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs'

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Paramètres</h1>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Capital de départ</h2>
        <p className="text-sm text-muted">Capital en $ (100 000 par défaut). Il sert de point de départ à la courbe du capital et au calcul automatique de la quantité (90 % du capital, recalculé quand la position tombe à 80 %).</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(value.replace(',', '.'))
            setStartingCapital(Number.isFinite(n) && n > 0 ? n : 100000)
            setSaved(true)
            setTimeout(() => setSaved(false), 1800)
          }}
        >
          <input className="field max-w-48" inputMode="decimal" placeholder="100000" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-primary" type="submit">
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </form>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Sauvegarde de vos données</h2>
        <p className="text-sm text-muted">
          Vos {trades.length} trade{trades.length > 1 ? 's' : ''} sont stockés <strong className="text-ink">dans ce navigateur, sur cet appareil</strong> (pas sur un serveur). Ils restent après fermeture, mais seraient perdus si vous videz les données du site, changez de navigateur ou d’appareil.
          <strong className="text-ink"> Faites une sauvegarde régulièrement</strong> et utilisez-la pour passer d’un appareil à l’autre.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                const n = await exportJson()
                setMsg({ ok: true, text: `Sauvegarde téléchargée (${n} trades, captures comprises).` })
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message })
              }
            }}
          >
            <Download size={15} /> Télécharger une sauvegarde
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Restaurer une sauvegarde
          </button>
          <button className="btn btn-ghost" onClick={() => exportCsv(trades)} disabled={!trades.length}>
            <Download size={15} /> Export CSV (Excel)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              setPending(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-gain' : 'text-loss'}`}>{msg.text}</p>}
        <p className="text-xs text-muted">
          La sauvegarde (<span className={code}>.json</span>) contient tout, captures d’écran incluses. Le CSV s’ouvre dans Excel mais ne contient pas les captures et ne peut pas être ré-importé.
        </p>
      </section>

      <section className="card space-y-2 p-5 text-sm text-muted">
        <h2 className="text-sm font-semibold text-ink">À savoir</h2>
        <p>Les totaux additionnent les résultats tels quels : si vous mélangez plusieurs devises, ils ne sont pas convertis. Les montants s’affichent dans la devise la plus utilisée.</p>
      </section>

      {pending && (
        <ConfirmDialog
          title="Restaurer cette sauvegarde ?"
          message={`« ${pending.name} » remplacera TOUS les trades actuels (${trades.length}). Si besoin, téléchargez d’abord une sauvegarde de l’état actuel.`}
          confirmLabel="Remplacer mes données"
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            try {
              const n = await importJson(pending)
              await reload()
              setMsg({ ok: true, text: `${n} trades restaurés.` })
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message })
            }
            setPending(null)
          }}
        />
      )}
    </div>
  )
}
