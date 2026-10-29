// firebase/auth shim — 本地實作（localStorage 持久化的假使用者）
import { getApp } from './firebase-app.js';

const USER_KEY = 'jam_water_tank_user';

function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveUser(u) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) {}
}

const listeners = new Set();
let currentUser = loadUser();

function notify() {
  listeners.forEach((cb) => {
    try { cb(currentUser); } catch (e) {}
  });
}

export function getAuth(app) {
  return { app: app || getApp(), _kind: 'auth-shim' };
}

export async function signInAnonymously(auth) {
  if (!currentUser) {
    currentUser = {
      uid: 'local_' + Math.random().toString(36).slice(2, 10),
      email: 'guest@example.com',
      isAnonymous: true,
    };
    saveUser(currentUser);
    notify();
  }
  return currentUser;
}

export async function signInWithCustomToken(auth, token) {
  return signInAnonymously(auth);
}

export function onAuthStateChanged(auth, cb) {
  listeners.add(cb);
  // 非同步觸發，跟真實 SDK 行為一致（避免在 render 期間 setState）
  setTimeout(() => {
    try { cb(currentUser); } catch (e) {}
  }, 0);
  return () => listeners.delete(cb);
}

export async function signOut(auth) {
  currentUser = null;
  try { localStorage.removeItem(USER_KEY); } catch (e) {}
  notify();
}
