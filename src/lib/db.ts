// Stockage dans le navigateur (IndexedDB) : les trades restent après fermeture de l'onglet ou du navigateur.
// Les données appartiennent à ce navigateur, sur cet appareil et pour ce site.
import type { Trade } from '../../shared/types'

const DB_NAME = 'trading-journal'
const STORE = 'trades'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Le stockage du navigateur (IndexedDB) est indisponible. Désactivez la navigation privée ou changez de navigateur.'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Ouverture de la base impossible'))
  })
  return dbPromise
}

/** Exécute une opération dans une transaction et renvoie son résultat une fois la transaction validée. */
async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error ?? new Error('Erreur de stockage'))
    tx.onabort = () => reject(tx.error ?? new Error('Enregistrement annulé (espace de stockage plein ?)'))
  })
}

export const tradeDb = {
  all: () => run<Trade[]>('readonly', (s) => s.getAll() as IDBRequest<Trade[]>),
  get: (id: number) => run<Trade | undefined>('readonly', (s) => s.get(id) as IDBRequest<Trade | undefined>),
  /** Ajoute un trade (l'identifiant est créé automatiquement) et renvoie son id. */
  add: (trade: Omit<Trade, 'id'>) => run<IDBValidKey>('readwrite', (s) => s.add(trade)).then((k) => k as number),
  put: (trade: Trade) => run<IDBValidKey>('readwrite', (s) => s.put(trade)),
  remove: (id: number) => run<undefined>('readwrite', (s) => s.delete(id)),

  /** Remplace tout le contenu (utilisé par l'import d'une sauvegarde), dans une seule transaction. */
  async replaceAll(trades: Trade[]): Promise<void> {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.clear()
      for (const t of trades) store.put(t)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Import impossible'))
      tx.onabort = () => reject(tx.error ?? new Error('Import annulé (espace de stockage plein ?)'))
    })
  },
}

/** Demande au navigateur de ne pas effacer nos données automatiquement en cas de manque d'espace. */
export function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.()
  } catch {
    /* non supporté : sans conséquence */
  }
}
