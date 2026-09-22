"use client";

/**
 * Durable client-side queue for Mat check-ins made while offline (F5.3). Items persist in IndexedDB so a
 * reload doesn't lose them; replay happens on reconnect. Last write per (session, person) wins locally;
 * the server's state wins after replay (the page refreshes from the server).
 */
export interface QueuedCheckIn {
  key: string; // `${sessionId}:${personId}`
  sessionId: string;
  personId: string;
  present: boolean;
  at: number;
}

const DB = "koryograph-mat";
const STORE = "checkins";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
    t.oncomplete = () => db.close();
  });
}

export async function enqueue(item: Omit<QueuedCheckIn, "key" | "at">): Promise<void> {
  await tx("readwrite", (s) => s.put({ ...item, key: `${item.sessionId}:${item.personId}`, at: Date.now() }));
}

export async function pending(sessionId?: string): Promise<QueuedCheckIn[]> {
  const all = await tx<QueuedCheckIn[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedCheckIn[]>);
  return all.filter((i) => !sessionId || i.sessionId === sessionId).sort((a, b) => a.at - b.at);
}

export async function remove(key: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(key));
}

/** True when a thrown error means "couldn't reach the server" rather than a server-side rejection. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return err instanceof TypeError || (err instanceof Error && /fetch|network|Failed to/i.test(err.message));
}
