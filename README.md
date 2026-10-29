# 風雨無阻的大小水庫計劃

房貸試算 × 基金配置 × 水庫累積引擎 — **PWA 版本，可安裝、可離線使用**。

> 原始碼由 [Gemini](https://gemini.google.com/) 生成，原始分享對話：
> <https://share.gemini.google/iW40sSNOC6F8>

## 功能

- **貸款設定** — 年齡、首付、房貸金額、貸款年限、寬限期、利率
- **基金項目** — 預設 6 檔月配息基金（年化配息率 > 5%），可自訂
- **試算結果** — 大水庫 / 小水庫累積引擎試算
- **圖表分析** — 淨值走勢與現金流圖表

資料保存在瀏覽器本機（localStorage），不會上傳任何伺服器。

## PWA

| 項目 | 說明 |
|------|------|
| Manifest | `manifest.webmanifest`（standalone、深藍主題、3 種 icon 含 maskable） |
| Service Worker | `sw.js` — app shell cache-first、導航 network-first、建置產物 cache-first |
| 離線 | ✅ 全部資源本地打包，無外部 CDN 請求 |
| 安裝 | iOS：Safari 分享 → 加入主畫面；Android Chrome：選單 → 安裝應用程式 |

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產出 dist/
npm run preview
```

## 技術棧

React 18 · Vite 6 · Tailwind CSS 3 · lucide-react · localStorage

### Firebase shim

原始碼使用 Firebase 做設定同步，但分享出來的憑證是佔位符（`apiKey: ""`、`mock.firebaseapp.com`），
永遠無法連線。`src/shim/` 提供最小相容 API（`firebase/app`、`firebase/auth`、`firebase/firestore`），
以 localStorage 為儲存層，讓 App 完全離線可用。

## License

MIT
