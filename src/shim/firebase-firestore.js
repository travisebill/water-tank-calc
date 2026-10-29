// firebase/firestore shim — localStorage 實作
// App 用 doc()/setDoc()/onSnapshot() 同步計算機設定到雲端。
// 這裡用 localStorage 當儲存層，完全離線可用，行為對 App 透明。
//
// 注意：setDoc() **不觸發** onSnapshot 回呼。
// 真實 Firestore 會觸發，而 App 的 onSnapshot 會 setFunds(s.funds) 傳入新陣列參考值
// → 重渲染 → 自動儲存 effect（1.5s debounce）→ setDoc → onSnapshot → 無限迴圈。
// 本 App 僅單一寫入者，不需要回呼通知，故不觸發即可完全避免該迴圈。

const listeners = new Map();   // path -> Set<cb>
const snapshots = new Map();  // path -> data

function readAll() {
  try {
    const raw = localStorage.getItem('jam_water_tank_store');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeAll(obj) {
  try { localStorage.setItem('jam_water_tank_store', JSON.stringify(obj)); } catch (e) {}
}

function notifyPath(path) {
  const set = listeners.get(path);
  if (!set) return;
  const data = snapshots.get(path);
  const snap = {
    exists: () => data !== undefined,
    data: () => data,
    id: path,
  };
  set.forEach((cb) => {
    try { cb(snap); } catch (e) {}
  });
}

export function getFirestore(app) {
  return { app, _kind: 'fs-shim' };
}

export function doc(db, ...pathParts) {
  const path = pathParts.join('/');
  return { type: 'doc', path };
}

export async function setDoc(ref, data, opts) {
  const all = readAll();
  const existing = all[ref.path] || {};
  all[ref.path] = (opts && opts.merge) ? Object.assign(existing, data) : data;
  writeAll(all);
  snapshots.set(ref.path, all[ref.path]);
  // 刻意不 notifyPath() — 見檔頭說明，避免 onSnapshot ↔ 自動儲存的無限迴圈
}

export function onSnapshot(ref, next, error) {
  const path = ref.path;
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path).add(next);

  // 初次載入（讀 localStorage）
  const all = readAll();
  if (all[path] !== undefined) snapshots.set(path, all[path]);
  setTimeout(() => {
    const data = snapshots.get(path);
    const snap = {
      exists: () => data !== undefined,
      data: () => data,
      id: path,
    };
    try { next(snap); } catch (e) {}
  }, 0);

  return () => {
    const set = listeners.get(path);
    if (set) { set.delete(next); }
  };
}
