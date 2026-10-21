import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { CURRENCIES, EMOTIONS, MARKETS, type Direction, type Market, type Trade, type TradeInput } from '../../shared/types'
import { computeTrade } from '../../shared/calc'
import { toISO } from '../../shared/stats'
import { api, ApiError } from '../lib/api'
import { fmtMoney, fmtNum, fmtPct, pnlColor } from '../lib/format'
import { Modal } from './Modal'

type FormState = {
  date: string
  entryTime: string
  exitTime: string
  asset: string
  market: Market
  direction: Direction
  entryPrice: string
  exitPrice: string
  positionSize: string
  quantity: string
  stopLoss: string
  takeProfit: string
  plannedRisk: string
  fees: string
  currency: string
  grossResult: string
  strategy: string
  setup: string
  followedPlan: '' | 'yes' | 'no'
  emotion: string
  comment: string
  mistakes: string
  lessons: string
}

const s = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))

function initial(t: Trade | null, defaultDate?: string): FormState {
  return {
    date: t?.date ?? defaultDate ?? toISO(new Date()),
    entryTime: s(t?.entryTime),
    exitTime: s(t?.exitTime),
    asset: s(t?.asset),
    market: t?.market ?? 'Forex',
    direction: t?.direction ?? 'long',
    entryPrice: s(t?.entryPrice),
    exitPrice: s(t?.exitPrice),
    positionSize: s(t?.positionSize),
    quantity: s(t?.quantity),
    stopLoss: s(t?.stopLoss),
    takeProfit: s(t?.takeProfit),
    plannedRisk: s(t?.plannedRisk),
    fees: t ? s(t.fees) : '',
    currency: t?.currency ?? 'EUR',
    grossResult: '',
    strategy: s(t?.strategy),
    setup: s(t?.setup),
    followedPlan: t?.followedPlan == null ? '' : t.followedPlan ? 'yes' : 'no',
    emotion: s(t?.emotion),
    comment: s(t?.comment),
    mistakes: s(t?.mistakes),
    lessons: s(t?.lessons),
  }
}

const num = (v: string): number | null => {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function TradeFormModal({
  trade,
  defaultDate,
  onClose,
  onSaved,
}: {
  trade: Trade | null
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState<FormState>(() => initial(trade, defaultDate))
  // À l'édition, le résultat brut stocké est considéré comme "manuel" seulement s'il diffère du calcul automatique.
  const [grossManual, setGrossManual] = useState<boolean>(() => {
    if (!trade) return false
    const auto = computeTrade({ direction: trade.direction, entryPrice: trade.entryPrice, exitPrice: trade.exitPrice, quantity: trade.quantity })
    return auto.autoGross === null || Math.abs(auto.autoGross - trade.grossResult) > 0.005
  })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(trade?.screenshot ?? null)
  const [removeShot, setRemoveShot] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [meta, setMeta] = useState<{ assets: string[]; strategies: string[]; setups: string[] }>({ assets: [], strategies: [], setups: [] })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {})
  }, [])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((p) => (p[k] ? { ...p, [k]: '' } : p))
  }

  // Aperçu en direct des calculs (mêmes formules que le serveur)
  const calc = useMemo(
    () =>
      computeTrade({
        direction: f.direction,
        entryPrice: num(f.entryPrice),
        exitPrice: num(f.exitPrice),
        quantity: num(f.quantity),
        stopLoss: num(f.stopLoss),
        plannedRisk: num(f.plannedRisk),
        fees: num(f.fees),
        grossResult: grossManual ? num(f.grossResult) : null,
      }),
    [f, grossManual],
  )

  const grossShown = grossManual ? f.grossResult : calc.autoGross === null ? '' : String(calc.autoGross)

  const pickFile = (file: File | null) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return setErrors((p) => ({ ...p, screenshot: 'Format non supporté (PNG, JPG, WEBP, GIF)' }))
    if (file.size > 8 * 1024 * 1024) return setErrors((p) => ({ ...p, screenshot: 'Image trop lourde (8 Mo max)' }))
    setErrors((p) => ({ ...p, screenshot: '' }))
    setFile(file)
    setRemoveShot(false)
    setPreview(URL.createObjectURL(file))
  }

  // Coller une capture d'écran depuis le presse-papiers (Ctrl/Cmd+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const blob = item?.getAsFile()
      if (blob) pickFile(new File([blob], `capture-${Date.now()}.png`, { type: blob.type }))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!f.date) e.date = 'Date obligatoire'
    if (!f.asset.trim()) e.asset = 'Actif obligatoire'
    for (const k of ['entryPrice', 'exitPrice', 'positionSize', 'quantity', 'stopLoss', 'takeProfit', 'plannedRisk', 'fees', 'grossResult'] as const) {
      if (Number.isNaN(num(f[k]))) e[k] = 'Nombre invalide'
    }
    const q = num(f.quantity)
    if (q !== null && q <= 0) e.quantity = 'Doit être positive'
    for (const k of ['plannedRisk', 'fees'] as const) {
      const v = num(f[k])
      if (v !== null && v < 0) e[k] = 'Doit être positif'
    }
    const entry = num(f.entryPrice)
    const sl = num(f.stopLoss)
    const tp = num(f.takeProfit)
    if (entry !== null && sl !== null && !e.stopLoss) {
      if (f.direction === 'long' ? sl >= entry : sl <= entry) e.stopLoss = f.direction === 'long' ? 'Doit être sous l’entrée (long)' : 'Doit être au-dessus de l’entrée (short)'
    }
    if (entry !== null && tp !== null && !e.takeProfit) {
      if (f.direction === 'long' ? tp <= entry : tp >= entry) e.takeProfit = f.direction === 'long' ? 'Doit être au-dessus de l’entrée (long)' : 'Doit être sous l’entrée (short)'
    }
    const hasAuto = calc.autoGross !== null
    const hasManual = grossManual && num(f.grossResult) !== null
    if (!hasAuto && !hasManual) e.grossResult = 'Renseignez entrée, sortie et quantité — ou saisissez le résultat brut'
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setServerError(null)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      // Fait défiler jusqu'au premier champ en erreur
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const input: TradeInput & { removeScreenshot?: boolean } = {
      date: f.date,
      entryTime: f.entryTime || null,
      exitTime: f.exitTime || null,
      asset: f.asset,
      market: f.market,
      direction: f.direction,
      entryPrice: num(f.entryPrice),
      exitPrice: num(f.exitPrice),
      positionSize: num(f.positionSize),
      quantity: num(f.quantity),
      stopLoss: num(f.stopLoss),
      takeProfit: num(f.takeProfit),
      plannedRisk: num(f.plannedRisk),
      fees: num(f.fees),
      currency: f.currency,
      grossResult: grossManual ? num(f.grossResult) : null,
      strategy: f.strategy || null,
      setup: f.setup || null,
      followedPlan: f.followedPlan === '' ? null : f.followedPlan === 'yes',
      emotion: f.emotion || null,
      comment: f.comment || null,
      mistakes: f.mistakes || null,
      lessons: f.lessons || null,
      removeScreenshot: removeShot,
    }
    setSaving(true)
    try {
      await api.save(input, file, trade?.id)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      setServerError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const err = (k: string) => (errors[k] ? { 'aria-invalid': true as const } : {})

  return (
    <Modal title={trade ? `Modifier le trade #${trade.id}` : 'Nouveau trade'} onClose={onClose} size="lg">
      <form onSubmit={submit} noValidate className="space-y-6">
        {/* --- Général --- */}
        <Section title="Général">
          <Field label="Date *" error={errors.date}>
            <input type="date" className="field" value={f.date} onChange={(e) => set('date', e.target.value)} {...err('date')} />
          </Field>
          <Field label="Heure d’entrée">
            <input type="time" className="field" value={f.entryTime} onChange={(e) => set('entryTime', e.target.value)} />
          </Field>
          <Field label="Heure de sortie">
            <input type="time" className="field" value={f.exitTime} onChange={(e) => set('exitTime', e.target.value)} />
          </Field>
          <Field label="Actif / instrument *" error={errors.asset}>
            <input className="field" list="assets-list" placeholder="EURUSD, NASDAQ, AAPL, BTC…" value={f.asset} onChange={(e) => set('asset', e.target.value)} {...err('asset')} />
            <datalist id="assets-list">{meta.assets.map((a) => <option key={a} value={a} />)}</datalist>
          </Field>
          <Field label="Marché">
            <select className="field" value={f.market} onChange={(e) => set('market', e.target.value as Market)}>
              {MARKETS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Sens">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel-2 p-1">
              {(['long', 'short'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('direction', d)}
                  className={`rounded-md py-1.5 text-sm font-medium transition ${f.direction === d ? (d === 'long' ? 'bg-gain/20 text-gain' : 'bg-loss/20 text-loss') : 'text-muted hover:text-ink'}`}
                >
                  {d === 'long' ? 'Long ▲' : 'Short ▼'}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* --- Prix et taille --- */}
        <Section title="Prix et taille de position">
          <Field label="Prix d’entrée" error={errors.entryPrice}>
            <input inputMode="decimal" className="field" value={f.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} {...err('entryPrice')} />
          </Field>
          <Field label="Prix de sortie" error={errors.exitPrice}>
            <input inputMode="decimal" className="field" value={f.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} {...err('exitPrice')} />
          </Field>
          <Field label="Quantité (unités / contrats)" error={errors.quantity}>
            <input inputMode="decimal" className="field" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} {...err('quantity')} />
          </Field>
          <Field label="Taille de position (valeur ou lots)" error={errors.positionSize}>
            <input inputMode="decimal" className="field" value={f.positionSize} onChange={(e) => set('positionSize', e.target.value)} {...err('positionSize')} />
          </Field>
          <Field label="Stop-loss" error={errors.stopLoss}>
            <input inputMode="decimal" className="field" value={f.stopLoss} onChange={(e) => set('stopLoss', e.target.value)} {...err('stopLoss')} />
          </Field>
          <Field label="Take-profit" error={errors.takeProfit}>
            <input inputMode="decimal" className="field" value={f.takeProfit} onChange={(e) => set('takeProfit', e.target.value)} {...err('takeProfit')} />
          </Field>
        </Section>

        {/* --- Risque et résultat --- */}
        <Section title="Risque et résultat">
          <Field label="Devise">
            <select className="field" value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Risque prévu" hint="Sinon déduit du stop-loss" error={errors.plannedRisk}>
            <input inputMode="decimal" className="field" value={f.plannedRisk} onChange={(e) => set('plannedRisk', e.target.value)} {...err('plannedRisk')} />
          </Field>
          <Field label="Frais et commissions" error={errors.fees}>
            <input inputMode="decimal" className="field" placeholder="0" value={f.fees} onChange={(e) => set('fees', e.target.value)} {...err('fees')} />
          </Field>
          <Field
            label="Résultat brut"
            hint={grossManual ? 'Saisi manuellement' : 'Calculé automatiquement'}
            error={errors.grossResult}
            className="sm:col-span-2"
          >
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                className="field"
                placeholder="Auto depuis les prix"
                value={grossShown}
                onChange={(e) => {
                  setGrossManual(true)
                  set('grossResult', e.target.value)
                }}
                {...err('grossResult')}
              />
              {grossManual && (
                <button type="button" className="btn btn-ghost shrink-0" onClick={() => (setGrossManual(false), set('grossResult', ''))} title="Revenir au calcul automatique">
                  Auto
                </button>
              )}
            </div>
          </Field>

          {/* Aperçu des résultats calculés */}
          <div className="sm:col-span-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-bg/60 p-4 sm:grid-cols-4">
            <Preview label="Résultat net" value={fmtMoney(calc.grossResult || calc.autoGross !== null || grossManual ? calc.netResult : null, f.currency, true)} color={pnlColor(calc.netResult)} />
            <Preview label="Gain / perte %" value={fmtPct(calc.resultPct, 2, true)} color={pnlColor(calc.resultPct)} />
            <Preview label="Risque retenu" value={fmtMoney(calc.riskUsed, f.currency)} />
            <Preview label="Ratio R réalisé" value={calc.rrRealized === null ? '—' : `${fmtNum(calc.rrRealized, 2)} R`} color={pnlColor(calc.rrRealized)} />
          </div>
        </Section>

        {/* --- Stratégie et psychologie --- */}
        <Section title="Stratégie et psychologie">
          <Field label="Stratégie">
            <input className="field" list="strategies-list" placeholder="Breakout, pullback…" value={f.strategy} onChange={(e) => set('strategy', e.target.value)} />
            <datalist id="strategies-list">{meta.strategies.map((a) => <option key={a} value={a} />)}</datalist>
          </Field>
          <Field label="Type de configuration">
            <input className="field" list="setups-list" placeholder="Double bottom, FVG…" value={f.setup} onChange={(e) => set('setup', e.target.value)} />
            <datalist id="setups-list">{meta.setups.map((a) => <option key={a} value={a} />)}</datalist>
          </Field>
          <Field label="Plan de trading respecté ?">
            <select className="field" value={f.followedPlan} onChange={(e) => set('followedPlan', e.target.value as FormState['followedPlan'])}>
              <option value="">Non renseigné</option>
              <option value="yes">Oui</option>
              <option value="no">Non</option>
            </select>
          </Field>
          <Field label="Émotion ressentie">
            <select className="field" value={f.emotion} onChange={(e) => set('emotion', e.target.value)}>
              <option value="">Non renseignée</option>
              {EMOTIONS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </Section>

        {/* --- Notes --- */}
        <Section title="Analyse" cols="sm:grid-cols-1">
          <Field label="Commentaire / analyse">
            <textarea rows={3} className="field" value={f.comment} onChange={(e) => set('comment', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Erreurs commises">
              <textarea rows={3} className="field" value={f.mistakes} onChange={(e) => set('mistakes', e.target.value)} />
            </Field>
            <Field label="Leçons à retenir">
              <textarea rows={3} className="field" value={f.lessons} onChange={(e) => set('lessons', e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* --- Capture d'écran --- */}
        <Section title="Capture d’écran du graphique" cols="sm:grid-cols-1">
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              <div className="relative inline-block max-w-full">
                <img src={preview} alt="Capture du graphique" className="max-h-64 rounded-lg border border-line" />
                <button
                  type="button"
                  className="btn btn-danger absolute right-2 top-2 !p-1.5"
                  aria-label="Retirer la capture"
                  onClick={() => (setPreview(null), setFile(null), setRemoveShot(true))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-line py-8 text-sm text-muted transition hover:border-accent hover:text-ink">
                <ImagePlus size={22} />
                Choisir une image — ou la coller avec Ctrl/Cmd+V
              </button>
            )}
            {errors.screenshot && <p className="mt-1 text-xs text-loss">{errors.screenshot}</p>}
          </div>
        </Section>

        {serverError && <div className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{serverError}</div>}
        {Object.values(errors).some(Boolean) && !serverError && <div className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">Corrigez les champs en rouge avant d’enregistrer.</div>}

        <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-panel px-5 py-3">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : trade ? 'Enregistrer les modifications' : 'Ajouter le trade'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Section({ title, children, cols = 'sm:grid-cols-3' }: { title: string; children: ReactNode; cols?: string }) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</legend>
      <div className={`grid gap-4 ${cols}`}>{children}</div>
    </fieldset>
  )
}

function Field({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-ink/80">
        {label}
        {hint && <span className="font-normal text-muted">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-loss">{error}</span>}
    </label>
  )
}

function Preview({ label, value, color = '' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}
