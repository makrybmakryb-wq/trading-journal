import type { Trade, TradeInput } from '../../shared/types'

export class ApiError extends Error {
  fields: Record<string, string>
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message)
    this.fields = fields
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(body.error ?? `Erreur ${res.status}`, body.fields)
  return body as T
}

export const api = {
  list: () => fetch('/api/trades').then((r) => handle<Trade[]>(r)),
  meta: () => fetch('/api/meta').then((r) => handle<{ assets: string[]; strategies: string[]; setups: string[] }>(r)),

  save: (input: TradeInput & { removeScreenshot?: boolean }, file: File | null, id?: number) => {
    const fd = new FormData()
    fd.append('data', JSON.stringify(input))
    if (file) fd.append('screenshot', file)
    return fetch(id ? `/api/trades/${id}` : '/api/trades', { method: id ? 'PUT' : 'POST', body: fd }).then((r) => handle<Trade>(r))
  },

  remove: (id: number) => fetch(`/api/trades/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r)),
}
