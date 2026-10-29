# 風雨無阻的創造大小水庫計劃 (中分紅模型)

PWA 化的房貸 × 基金配置 × 財富現金流永續工程試算工具。

來源：Gemini 分享 <https://share.gemini.google/Zk37mCr6cPx5>（share id `62aeb89e3232`）產出的 React App。

## 功能

- **貸款設定** — 目前年齡、自備款、房貸金額、房貸年期、寬限期、年利率
- **基金項目** — 三檔基金欄位（名稱 / 年化配息率 / 投資比例，加總鎖定 100%）
- **試算結果** — 月配息、房貸成本、PF65 小水庫現金流、30~90 歲逐年模擬表
- **圖表分析** — 資產累積曲線、净值變動情境切換
- 30 秒注水動畫開場（僅首次）、7 頁互動簡報、PDF 匯出

## 本機持久化

試算條件會寫入瀏覽器的 `localStorage`，**重新整理或關閉再開都不會遺失**：

| Key | 內容 |
|---|---|
| `jam_water_tank_v1:currentAge` | 目前年齡 |
| `jam_water_tank_v1:downPayment` | 自備款（萬） |
| `jam_water_tank_v1:mortgageAmount` | 房貸金額（萬） |
| `jam_water_tank_v1:loanYears` | 房貸年期 |
| `jam_water_tank_v1:gracePeriod` | 寬限期年數 |
| `jam_water_tank_v1:interestRate` | 房貸年利率 |
| `jam_water_tank_v1:reinvestRatio` | 月配息再投資比例 |
| `jam_water_tank_v1:navChangePercent` | 净值變動情境 |
| `jam_water_tank_v1:funds` | 基金配置（名稱 / 配息率 / 權重） |
| `jam_water_tank_v1:chartMetric` | 圖表指標 |
| `jam_water_tank_v1:activeTab` | 目前頁籤 |
| `jam_water_tank_v1:splashSeen` | 是否已看過開場動畫 |

App 首頁有「本機記憶已開啟」狀態與「重設」按鈕，可清空並還原預設值。

> 原始碼把這些欄位放在 `useState`，只存在記憶體 —— 重新整理就全部歸零。
> 本專案改用 `usePersistentState` hook 寫入 localStorage。

## 離線可用

Service Worker 策略：

- App shell（index.html / manifest / icons）：cache-first
- 建置產物 `/assets/*`（檔名含 hash）：cache-first
- 導航請求：network-first → 失敗回退 cache 的 index.html

## 開發

```bash
npm install
npm run dev      # 本機開發
npm run build    # 產出 dist/
npm run preview  # 預覽 build 結果
```

Firebase SDK 被替換為 `src/shim/` 下的本地實作（原始碼匯入的是佔位憑證，永遠無法連線）。

## 部署

GitHub Actions（`.github/workflows/deploy.yml`）自動 build + 部署到 GitHub Pages。

線上：<https://travisebill.github.io/water-tank-calc/>

## 免責聲明

本試算結果與數據僅供參考與輔助規劃之用，不代表最終實際獲利或保證收益。
實際財務狀況仍應以個人資產現況與各金融機構公告為準。
