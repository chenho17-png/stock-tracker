# 📊 股票持倉追蹤儀表板

個人股票持倉追蹤工具，每 5 分鐘自動更新股價，支援 MA20 警示。

## 功能特色

- ✅ 每 5 分鐘自動抓取 Yahoo Finance 股價（免費）
- ✅ 顯示當日漲跌、買入成本、報酬率
- ✅ MA20 跌破警示（橘色標示）
- ✅ 台股交易時間自動偵測
- ✅ 支援個股 / ETF / 債券ETF 分類篩選
- ✅ 持倉資料存於瀏覽器（LocalStorage），重開不遺失
- ✅ 可新增 / 刪除標的
- ✅ 深色模式自動適配

## 快速部署（GitHub Pages）

### 步驟 1：建立 GitHub 帳號
前往 https://github.com 免費註冊

### 步驟 2：建立新 Repository
1. 點右上角「＋」→「New repository」
2. 名稱填：`stock-tracker`
3. 設為 **Public**（GitHub Pages 免費版需公開）
4. 點「Create repository」

### 步驟 3：上傳檔案
方法 A（網頁上傳，最簡單）：
1. 進入你的 repository 頁面
2. 點「uploading an existing file」
3. 同時拖曳 `index.html` 和 `portfolio.js` 兩個檔案
4. 點「Commit changes」

方法 B（git 指令）：
```bash
git init
git add .
git commit -m "init stock tracker"
git remote add origin https://github.com/你的帳號/stock-tracker.git
git push -u origin main
```

### 步驟 4：開啟 GitHub Pages
1. 進入 repository 的「Settings」
2. 左側點「Pages」
3. Source 選「Deploy from a branch」→ Branch: `main` / `/ (root)`
4. 點「Save」

### 步驟 5：等待部署完成（約 1~2 分鐘）
網址格式：`https://你的帳號.github.io/stock-tracker/`

---

## 修改自己的持倉

打開 `portfolio.js`，找到 `PORTFOLIO` 陣列，修改成你自己的股票：

```javascript
let PORTFOLIO = [
  { code: '2330', name: '台積電', type: 'stock', shares: 1000, cost: 750, ma20: 900 },
  { code: '0050',  name: '元大台灣50', type: 'etf', shares: 100, cost: 180, ma20: null },
  // ... 依此類推
];
```

| 欄位 | 說明 |
|------|------|
| code | 股票代號（台股格式，勿加 .TW） |
| name | 股票名稱 |
| type | `stock`（個股）/ `etf`（ETF）/ `bond`（債券ETF） |
| shares | 持有股數 |
| cost | 買入均價 |
| ma20 | 20日均線價位（填 null 則不警示） |

---

## 注意事項

- 股價來源：Yahoo Finance（延遲約 15 分鐘，非即時）
- 透過 allorigins.win CORS proxy 抓取，為免費公共服務
- 僅供個人非商業用途
- 資料儲存於瀏覽器 LocalStorage，不上傳任何資料
- 台股代號：上市加 `.TW`，上櫃加 `.TWO`（程式自動判斷）

## 常見問題

**Q：股價顯示「載入中」怎麼辦？**
A：可能是 CORS proxy 暫時繁忙，等 5 分鐘後自動重試，或點「立即更新」。

**Q：上櫃股票抓不到？**
A：在 `portfolio.js` 的 `toYahooSymbol` 函數的 `otc` 陣列中加入該代號。

**Q：想改成 1 分鐘更新？**
A：修改 `portfolio.js` 中的 `INTERVAL_MS = 1 * 60 * 1000`。

**Q：可以設密碼保護嗎？**
A：GitHub Pages 免費版不支援，需升級到 Vercel + 帳號登入功能。
