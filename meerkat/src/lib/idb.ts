/** 사진 등 큰 데이터를 위한 아주 작은 IndexedDB 래퍼 (기기 안에만 저장) */
const DB = 'meerkat';
const STORE = 'blobs';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idb = {
  put: (key: string, value: Blob | string) => tx('readwrite', (s) => s.put(value, key)),
  get: <T = Blob>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key)),
  del: (key: string) => tx('readwrite', (s) => s.delete(key)),
  keys: () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()),
  clear: () => tx('readwrite', (s) => s.clear()),
};
