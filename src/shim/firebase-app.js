// firebase/app shim — 本地實作，不依賴 Firebase SDK
// 原始碼 import firebase/app，但分享出來的憑證是佔位符（apiKey: '' / mock.firebaseapp.com），
// 永遠無法連線。這裡提供最小相容 API，讓 App 走自己的 fallback 分支。
let _app = null;

export function initializeApp(config) {
  _app = { name: '[DEFAULT]', options: config || {} };
  return _app;
}

export function getApps() {
  return _app ? [_app] : [];
}

export function getApp() {
  if (!_app) return initializeApp({});
  return _app;
}
