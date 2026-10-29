/** Keeps recorded audio in this browser until its transcript has been saved, so a failure never loses a meeting. */

const DB_NAME = "hoja-audio";

export interface SessionMeta {
  id: string;
  mode: "note" | "meeting";
  startedAt: number;
}
export interface StoredChunk {
  session: string;
  seq: number;
  blob: Blob;
  mime: string;
  text?: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("sessions", { keyPath: "id" });
        db.createObjectStore("chunks", { keyPath: ["session", "seq"] }).createIndex("session", "session");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export const saveSession = (meta: SessionMeta) => run("sessions", "readwrite", (s) => s.put(meta));
export const saveChunk = (chunk: StoredChunk) => run("chunks", "readwrite", (s) => s.put(chunk));
export const listSessions = async () => (await run<SessionMeta[]>("sessions", "readonly", (s) => s.getAll())) ?? [];
export const getChunks = async (session: string) =>
  ((await run<StoredChunk[]>("chunks", "readonly", (s) => s.index("session").getAll(session))) ?? []).sort((a, b) => a.seq - b.seq);

export async function deleteSession(id: string): Promise<void> {
  const chunks = await getChunks(id);
  await Promise.all(chunks.map((c) => run("chunks", "readwrite", (s) => s.delete([c.session, c.seq]))));
  await run("sessions", "readwrite", (s) => s.delete(id));
}
