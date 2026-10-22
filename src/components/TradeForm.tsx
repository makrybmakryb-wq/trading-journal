import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { ASSETS, ASSET_MARKET, MARKETS, STRATEGIES, TOUCHES, type Direction, type Market, type Touch, type Trade, type TradeInput } from '../../shared/types'
import { computeTrade, FEE_RATE } from '../../shared/calc'
import { suggestQuantity, tradesBefore, TARGET_PCT, THRESHOLD_PCT } from '../../shared/sizing'
import { useStore } from '../lib/store'
import { toISO } from '../../shared/stats'
import { api, ApiError } from '../lib/api'
import { fmtMoney, fmtNum, fmtPct, pnlColor } from '../lib/format'
import { Modal } from './Modal'

type FormState = {
  date: string
  entryTime: string
  exitTime: string
  asset: string // une valeur de ASSETS (ou « Autre »)
  customAsset: string // nom libre si « Autre »
  market: Market
  direction: Direction
  entryPrice: string
  exitPrice: string
  quantity: string
  positionSize: string
  touched: '' | Touch
  rr: string
  followedPlan: '' | 'yes' | 'no'
  strategy: string
  comment: string
  mistakes: string
  lessons: string
}

const s = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))

function initial(t: Trade | null, defaultDate?: string): FormState {
  const known = t ? (ASSETS as readonly string[]).includes(t.asset) : true
  return {
    date: t?.date ?? defaultDate ?? toISO(new Date()),
    entryTime: s(t?.entryTime),
    exitTime: s(t?.exitTime),
    asset: t ? (known ? t.asset : 'Autre') : ASSETS[0],
    customAsset: t && !known ? t.asset : '',
    market: t?.market ?? ASSET_MARKET[ASSETS[0]],
    direction: t?.direction ?? 'long',
    entryPrice: s(t?.entryPrice),
    exitPrice: s(t?.exitPrice),
    quantity: s(t?.quantity),
    positionSize: s(t?.positionSize),
    touched: t?.touched ?? '',
    rr: s(t?.rr),
    followedPlan: t?.followedPlan == null ? '' : t.followedPlan ? 'yes' : 'no',
    strategy: s(t?.strategy),
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
  const { trades, startingCapital } = useStore()
  const [f, setF] = useState<FormState>(() => initial(trade, defaultDate))
  // Quantité et taille de position sont automatiques ; en modification on garde les valeurs enregistrées.
  const [qtyManual, setQtyManual] = useState<boolean>(!!trade)
  const [sizeManual, setSizeManual] = useState<boolean>(!!trade)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(trade?.screenshot ?? null)
  const [removeShot, setRemoveShot] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((p) => (p[k] ? { ...p, [k]: '' } : p))
  }

  const setAsset = (a: string) => {
    setF((p) => ({ ...p, asset: a, market: ASSET_MARKET[a] ?? p.market }))
    setErrors((p) => ({ ...p, asset: '' }))
  }

  // Quantité suggérée : 90 % du capital, gardée fixe tant que la position vaut plus de 80 % du capital.
  const sizing = useMemo(
    () => suggestQuantity(tradesBefore(trades, trade), startingCapital, num(f.entryPrice)),
    [trades, trade, startingCapital, f.entryPrice],
  )

  useEffect(() => {
    if (!qtyManual) setF((p) => ({ ...p, quantity: sizing.quantity === null ? '' : String(sizing.quantity) }))
  }, [qtyManual, sizing.quantity])

  // Taille de position = valeur de la position (quantité × prix d'entrée), sauf modification manuelle.
  useEffect(() => {
    if (sizeManual) return
    const q = num(f.quantity)
    const e = num(f.entryPrice)
    setF((p) => ({ ...p, positionSize: q && e ? String(Math.round(q * e * 100) / 100) : '' }))
  }, [sizeManual, f.quantity, f.entryPrice])

  // Aperçu en direct des calculs (mêmes formules qu'à l'enregistrement)
  const calc = useMemo(
    () =>
      computeTrade({
        direction: f.direction,
        entryPrice: num(f.entryPrice),
        exitPrice: num(f.exitPrice),
        quantity: num(f.quantity),
        touched: f.touched || null,
        rr: num(f.rr),
      }),
    [f],
  )
  const dash = (v: number | null) => (v === null ? '' : String(v))

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
    if (f.asset === 'Autre' && !f.customAsset.trim()) e.customAsset = 'Nom de l’actif obligatoire'
    for (const k of ['entryPrice', 'exitPrice', 'positionSize', 'quantity', 'rr'] as const) {
      if (Number.isNaN(num(f[k]))) e[k] = 'Nombre invalide'
    }
    if (num(f.entryPrice) === null) e.entryPrice = 'Obligatoire'
    if (num(f.exitPrice) === null) e.exitPrice = 'Obligatoire'
    const q = num(f.quantity)
    if (q === null) e.quantity = 'Obligatoire'
    else if (q <= 0) e.quantity = 'Doit être positive'
    const rr = num(f.rr)
    if (rr !== null && rr <= 0) e.rr = 'Doit être positif'
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
      asset: f.asset === 'Autre' ? f.customAsset : f.asset,
      market: f.market,
      direction: f.direction,
      entryPrice: num(f.entryPrice),
      exitPrice: num(f.exitPrice),
      positionSize: num(f.positionSize),
      quantity: num(f.quantity),
      touched: f.touched || null,
      rr: num(f.rr),
      strategy: f.strategy || null,
      followedPlan: f.followedPlan === '' ? null : f.followedPlan === 'yes',
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
          <Field label="Actif *" error={errors.customAsset}>
            <select className="field" value={f.asset} onChange={(e) => setAsset(e.target.value)}>
              {ASSETS.map((a) => <option key={a}>{a}</option>)}
            </select>
            {f.asset === 'Autre' && (
              <input className="field mt-2" placeholder="Nom de l’actif" value={f.customAsset} onChange={(e) => set('customAsset', e.target.value)} {...err('customAsset')} />
            )}
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
          <Field label="Prix d’entrée *" error={errors.entryPrice}>
            <input inputMode="decimal" className="field" value={f.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} {...err('entryPrice')} />
          </Field>
          <Field label="Prix de sortie *" error={errors.exitPrice}>
            <input inputMode="decimal" className="field" value={f.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} {...err('exitPrice')} />
          </Field>
          <Field label="Quantité" hint={qtyManual ? 'Modifiée à la main' : sizing.recalculated ? `Recalculée (${TARGET_PCT * 100} %)` : 'Fixe (inchangée)'} error={errors.quantity}>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                className="field"
                value={f.quantity}
                onChange={(e) => {
                  setQtyManual(true)
                  set('quantity', e.target.value)
                }}
                {...err('quantity')}
              />
              {qtyManual && (
                <button type="button" className="btn btn-ghost shrink-0" title="Revenir au calcul automatique" onClick={() => setQtyManual(false)}>
                  Auto
                </button>
              )}
            </div>
          </Field>
          <Field label="Taille de position ($)" hint={sizeManual ? 'Modifiée à la main' : 'Quantité × prix d’entrée'} error={errors.positionSize}>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                className="field"
                value={f.positionSize}
                onChange={(e) => {
                  setSizeManual(true)
                  set('positionSize', e.target.value)
                }}
                {...err('positionSize')}
              />
              {sizeManual && (
                <button type="button" className="btn btn-ghost shrink-0" title="Revenir au calcul automatique" onClick={() => setSizeManual(false)}>
                  Auto
                </button>
              )}
            </div>
          </Field>
          <Field label="Touché (TP / SL)">
            <select className="field" value={f.touched} onChange={(e) => set('touched', e.target.value as FormState['touched'])}>
              <option value="">—</option>
              {TOUCHES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="RR" hint="Ex. 2 pour 1:2" error={errors.rr}>
            <input inputMode="decimal" className="field" placeholder="2" value={f.rr} onChange={(e) => set('rr', e.target.value)} {...err('rr')} />
          </Field>
          <p className="sm:col-span-3 text-xs text-muted">
            Capital actuel : {fmtMoney(sizing.capital, 'USD')} · quantité = {TARGET_PCT * 100} % du capital, conservée tant que sa valeur reste au-dessus de {THRESHOLD_PCT * 100} % du capital.
          </p>
        </Section>

        {/* --- Risque et résultat (tout est calculé) --- */}
        <Section title="Risque et résultat (en $)">
          <Field label="Risque" hint="Calculé automatiquement">
            <input readOnly tabIndex={-1} className="field opacity-80" value={dash(calc.riskUsed)} placeholder="Touché + RR requis" />
          </Field>
          <Field label="Frais et commissions" hint={`${FEE_RATE} × montant, entrée + sortie`}>
            <input readOnly tabIndex={-1} className="field opacity-80" value={calc.autoGross === null ? '' : String(calc.fees)} />
          </Field>
          <Field label="Résultat brut" hint="Calculé automatiquement">
            <input readOnly tabIndex={-1} className="field opacity-80" value={dash(calc.autoGross)} />
          </Field>

          {/* Aperçu des résultats calculés */}
          <div className="sm:col-span-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-bg/60 p-4 sm:grid-cols-4">
            <Preview label="Résultat net" value={fmtMoney(calc.autoGross === null ? null : calc.netResult, 'USD', true)} color={pnlColor(calc.netResult)} />
            <Preview label="Gain / perte %" value={fmtPct(calc.resultPct, 2, true)} color={pnlColor(calc.resultPct)} />
            <Preview label="Risque retenu" value={fmtMoney(calc.riskUsed, 'USD')} />
            <Preview label="Ratio R réalisé" value={calc.rrRealized === null ? '—' : `${fmtNum(calc.rrRealized, 2)} R`} color={pnlColor(calc.rrRealized)} />
          </div>
        </Section>

        {/* --- Plan et stratégie --- */}
        <Section title="Plan et stratégie" cols="sm:grid-cols-2">
          <Field label="Plan de trading respecté ?">
            <select className="field" value={f.followedPlan} onChange={(e) => set('followedPlan', e.target.value as FormState['followedPlan'])}>
              <option value="yes">Oui</option>
              <option value="no">Non</option>
              <option value="">Non renseigné</option>
            </select>
          </Field>
          <Field label="Stratégie">
            <select className="field" value={f.strategy} onChange={(e) => set('strategy', e.target.value)}>
              <option value="">—</option>
              {f.strategy && !(STRATEGIES as readonly string[]).includes(f.strategy) && <option>{f.strategy}</option>}
              {STRATEGIES.map((x) => <option key={x}>{x}</option>)}
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
