// =====================================================
// portfolio.js — 股票持倉追蹤儀表板核心邏輯
// =====================================================

// ── 初始持倉設定（從對帳單匯入，可自行修改）──────────────────
let PORTFOLIO = [
  // 個股
  { code: '1503', name: '士電',     type: 'stock', shares: 1,  cost: 179.5,   ma20: 174 },
  { code: '1604', name: '聲寶',     type: 'stock', shares: 1,  cost: 30.7,    ma20: 25  },
  { code: '4923', name: '力士',     type: 'stock', shares: 1,   cost: 64.5,    ma20: 33  },
  { code: '6732', name: '昇佳電子', type: 'stock', shares: 1,   cost: 250,     ma20: 178 },
  { code: '5299', name: '杰力',     type: 'stock', shares: 1,   cost: 128.67,  ma20: 80  },
  { code: '2545', name: '皇翔',     type: 'stock', shares: 1,  cost: 57.44,   ma20: 37  },
  { code: '5425', name: '台半',     type: 'stock', shares: 1,  cost: 89.37,   ma20: 59  },
  { code: '2548', name: '華固',     type: 'stock', shares: 1,  cost: 105.71,  ma20: 107 },
  { code: '2890', name: '永豐金',   type: 'stock', shares: 1, cost: 21.66,   ma20: 31  },
  { code: '2308', name: '台達電',   type: 'stock', shares: 1,   cost: 1182.5,  ma20: 1580},
  { code: '2801', name: '彰銀',     type: 'stock', shares: 1, cost: 17.43,   ma20: null },
  { code: '2834', name: '臺企銀',   type: 'stock', shares: 1, cost: 14.5,    ma20: null },
  { code: '2812', name: '台中銀',   type: 'stock', shares: 1, cost: 16.21,   ma20: 20.5},
  // ETF
  { code: '00712', name: '復華富時不動產',  type: 'etf',  shares: 1, cost: 9.3,   ma20: null },
  { code: '00929', name: '復華台灣科技優息',type: 'etf',  shares: 1, cost: 18,    ma20: null },
  { code: '0050',  name: '元大台灣50',      type: 'etf',  shares: 1,  cost: 60.18, ma20: null },
  { code: '00939', name: '統一台灣高息動能',type: 'etf',  shares: 1, cost: 15,    ma20: null },
  { code: '00927', name: '群益半導體收益',  type: 'etf',  shares: 1,  cost: 21.33, ma20: null },
  { code: '00918', name: '大華優利高填息30',type: 'etf',  shares: 1,  cost: 24.63, ma20: null },
  { code: '00923', name: '群益台ESG低碳50', type: 'etf',  shares: 1, cost: 18.81, ma20: null },
  { code: '00881', name: '國泰台灣科技龍頭',type: 'etf',  shares: 1, cost: 23.12, ma20: null },
  { code: '00935', name: '野村臺灣新科技50',type: 'etf',  shares: 1, cost: 20.13, ma20: null },
  { code: '00878', name: '國泰永續高股息',  type: 'etf',  shares: 1, cost: 20.46, ma20: null },
  { code: '0056',  name: '元大高股息',      type: 'etf',  shares: 1, cost: 37.07, ma20: null },
  { code: '00919', name: '群益台灣精選高息',type: 'etf',  shares: 1, cost: 23.49, ma20: null },
  // 債券ETF
  { code: '00937B', name: '群益ESG投等債20+', type: 'bond', shares: 1,  cost: 16.17, ma20: null },
  { code: '00786B', name: '元大10年IG銀行債', type: 'bond', shares: 1,  cost: 34.54, ma20: null },
];

// ── 狀態 ────────────────────────────────────────────
let priceCache = {};           // { code: { price, change, changePct, prevClose, updated } }
let updateInterval = null;
let countdownInterval = null;
let isPaused = false;
let nextUpdate = Date.now();
let updateLog = [];
const INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘

// ── Yahoo Finance 代號轉換（台股加 .TW 或 .TWO）───────────────
function toYahooSymbol(code) {
  // 上市（.TW）或上櫃（.TWO）判斷
  // 上櫃代號通常：5碼、以 4、5、6 開頭較多；上市以 0、1、2、3 開頭
  // ETF 代號含 B 結尾者為債券ETF，Yahoo 用 .TW
  if (code.endsWith('B')) return code + '.TW';
  const n = parseInt(code);
  // 上市：00xx ETF、0050、0056、1xxx、2xxx（部分）、3xxx
  // 上櫃：4xxx、5xxx（部分）、6xxx（部分）
  const otc = ['4923', '5299', '5425', '6732', '00712', '00929', '00939',
                '00927', '00918', '00923', '00881', '00935', '00878',
                '0056', '00919', '00937B', '00786B'];
  if (otc.includes(code)) return code + '.TWO';
  return code + '.TW';
}

// ── 取得股價（Yahoo Finance CORS Proxy）──────────────────────
async function fetchPrice(code) {
  const symbol = toYahooSymbol(code);
  // 使用 Yahoo Finance v8 API（免費、非商業用途）
  // 透過 allorigins CORS proxy 繞過瀏覽器同源限制
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

  try {
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const wrapper = await resp.json();
    const data = JSON.parse(wrapper.contents);
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('無資料');

    const price = meta.regularMarketPrice ?? meta.previousClose;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    return { price, prevClose, change, changePct, updated: new Date() };
  } catch (e) {
    // 備援：嘗試 v7 API
    try {
      const url2 = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
      const proxyUrl2 = `https://api.allorigins.win/get?url=${encodeURIComponent(url2)}`;
      const resp2 = await fetch(proxyUrl2, { signal: AbortSignal.timeout(8000) });
      const wrapper2 = await resp2.json();
      const data2 = JSON.parse(wrapper2.contents);
      const q = data2?.quoteResponse?.result?.[0];
      if (!q) throw new Error('無資料');
      return {
        price: q.regularMarketPrice,
        prevClose: q.regularMarketPreviousClose,
        change: q.regularMarketChange,
        changePct: q.regularMarketChangePercent,
        updated: new Date()
      };
    } catch (e2) {
      throw new Error(e2.message || '查詢失敗');
    }
  }
}

// ── 批次更新所有股價 ─────────────────────────────────────────
async function fetchAll() {
  setStatus('更新中...', false);
  document.getElementById('last-update-text').textContent = '更新中...';
  const errors = [];
  const success = [];

  // 分批查詢（每批 5 個，避免觸發 rate limit）
  const BATCH = 5;
  for (let i = 0; i < PORTFOLIO.length; i += BATCH) {
    const batch = PORTFOLIO.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async (s) => {
      try {
        const result = await fetchPrice(s.code);
        priceCache[s.code] = result;
        success.push(s.code);
      } catch (e) {
        errors.push(s.code);
        // 如果已有快取，保留舊資料
      }
    }));
    // 批次間稍微等待
    if (i + BATCH < PORTFOLIO.length) await sleep(300);
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 更新 log
  addLog(timeStr, success.length, errors);

  renderMetrics();
  renderTable();
  checkMarketHours();

  const lastText = `上次更新：${now.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  document.getElementById('last-update-text').textContent = lastText;

  if (errors.length === 0) {
    setStatus('即時更新中', false);
    hideError();
  } else if (success.length === 0) {
    setStatus('連線失敗', true);
    showError(`⚠ 無法取得股價資料（共 ${errors.length} 檔失敗）。可能原因：網路問題 / Yahoo API 暫時限流。頁面將持續自動重試。`);
  } else {
    setStatus(`部分更新（${success.length}/${PORTFOLIO.length}）`, false);
    hideError();
  }

  nextUpdate = Date.now() + INTERVAL_MS;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 計時器 ───────────────────────────────────────────────────
function startAutoUpdate() {
  if (updateInterval) clearInterval(updateInterval);
  if (countdownInterval) clearInterval(countdownInterval);

  updateInterval = setInterval(() => {
    if (!isPaused) fetchAll();
  }, INTERVAL_MS);

  countdownInterval = setInterval(() => {
    if (isPaused) {
      document.getElementById('countdown-text').textContent = '已暫停';
      return;
    }
    const remaining = Math.max(0, Math.ceil((nextUpdate - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    document.getElementById('countdown-text').textContent =
      `下次更新：${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function togglePause() {
  isPaused = !isPaused;
  const btn = document.getElementById('pause-btn');
  const dot = document.getElementById('status-dot');
  if (isPaused) {
    btn.textContent = '▶ 繼續更新';
    dot.classList.add('paused');
    setStatus('已暫停', false);
  } else {
    btn.textContent = '⏸ 暫停更新';
    dot.classList.remove('paused');
    setStatus('即時更新中', false);
    nextUpdate = Date.now() + INTERVAL_MS;
    fetchAll();
  }
}

// ── 渲染指標卡 ───────────────────────────────────────────────
function renderMetrics() {
  let totalCost = 0, totalValue = 0, warnCount = 0;
  let bestRet = -Infinity, worstRet = Infinity;
  let bestCode = '', worstCode = '';

  PORTFOLIO.forEach(s => {
    const p = priceCache[s.code];
    const costTotal = s.cost * s.shares;
    totalCost += costTotal;
    if (p) {
      const val = p.price * s.shares;
      totalValue += val;
      const ret = (p.price - s.cost) / s.cost * 100;
      if (ret > bestRet) { bestRet = ret; bestCode = `${s.code} ${s.name}`; }
      if (ret < worstRet) { worstRet = ret; worstCode = `${s.code} ${s.name}`; }
      if (s.ma20 && p.price < s.ma20) warnCount++;
    } else {
      totalValue += costTotal;
    }
  });

  const pnl = totalValue - totalCost;
  const pnlPct = totalCost ? (pnl / totalCost * 100) : 0;
  const valPct = totalCost ? ((totalValue - totalCost) / totalCost * 100) : 0;

  setText('m-cost', `NT$${fmt(totalCost)}`);
  setText('m-cnt', `共 ${PORTFOLIO.length} 檔`);
  setText('m-value', `NT$${fmt(totalValue)}`);
  setText('m-value-sub', `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% vs 成本`);
  document.getElementById('m-value').className = `val ${valPct >= 0 ? 'c-green' : 'c-red'}`;

  setText('m-pnl', `${pnl >= 0 ? '+' : ''}NT$${fmt(Math.abs(pnl))}`);
  setText('m-pnl-pct', `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`);
  document.getElementById('m-pnl').className = `val ${pnl >= 0 ? 'c-green' : 'c-red'}`;

  setText('m-warn', `${warnCount} 檔`);
  document.getElementById('m-warn').className = `val ${warnCount > 0 ? 'c-amber' : 'c-green'}`;

  if (bestCode) {
    setText('m-best', `${bestRet >= 0 ? '+' : ''}${bestRet.toFixed(1)}%`);
    setText('m-best-name', bestCode);
  }
  if (worstCode) {
    setText('m-worst', `${worstRet.toFixed(1)}%`);
    setText('m-worst-name', worstCode);
  }
}

// ── 渲染持倉表格 ─────────────────────────────────────────────
function renderTable() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const typeFilter = document.getElementById('type-filter').value;
  const sort = document.getElementById('sort-select').value;

  let data = PORTFOLIO.filter(s => {
    if (typeFilter && s.type !== typeFilter) return false;
    if (q && !s.code.toLowerCase().includes(q) && !s.name.includes(q)) return false;
    return true;
  });

  data.sort((a, b) => {
    if (sort === 'ret-desc') return retOf(b) - retOf(a);
    if (sort === 'ret-asc') return retOf(a) - retOf(b);
    if (sort === 'code') return a.code.localeCompare(b.code);
    return b.cost * b.shares - a.cost * a.shares; // cost-desc
  });

  const tbody = document.getElementById('holdings-body');
  if (data.length === 0) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="11" style="color:var(--text2)">無符合條件的標的</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => {
    const p = priceCache[s.code];
    const costTotal = s.cost * s.shares;
    const idx = PORTFOLIO.indexOf(s);

    let priceCell = `<span style="font-size:11px;color:var(--text2)">載入中</span>`;
    let changeCell = '—';
    let retCell = '—';
    let barCell = '';
    let ma20Cell = s.ma20 ? `<span style="font-size:11px;color:var(--text2)">NT$${s.ma20}</span>` : '—';

    if (p) {
      const ret = (p.price - s.cost) / s.cost * 100;
      const retStr = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%';
      const retBadgeClass = ret >= 0 ? 'b-gain' : (ret > -15 ? 'b-warn' : 'b-loss');

      priceCell = `<strong>NT$${p.price.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>`;
      const changeStr = (p.change >= 0 ? '+' : '') + p.change.toFixed(2) + ` (${p.changePct >= 0 ? '+' : ''}${p.changePct.toFixed(2)}%)`;
      changeCell = `<span style="color:${p.change >= 0 ? 'var(--green)' : 'var(--red)'};font-size:12px">${changeStr}</span>`;
      retCell = `<span class="badge ${retBadgeClass}">${retStr}</span>`;

      const barW = Math.round(Math.min(Math.abs(ret), 50) / 50 * 100);
      barCell = `<div class="bar-wrap"><div class="bar-fill" style="width:${barW}%;background:${ret >= 0 ? 'var(--green)' : 'var(--red)'}"></div></div>`;

      if (s.ma20) {
        if (p.price < s.ma20) {
          ma20Cell = `<span class="b-ma-warn">⚠ 跌破 ${s.ma20}</span>`;
        } else {
          const abovePct = ((p.price - s.ma20) / s.ma20 * 100).toFixed(1);
          ma20Cell = `<span style="font-size:11px;color:var(--text2)">+${abovePct}%</span>`;
        }
      }
    }

    const typeBadgeClass = s.type === 'etf' ? 'b-etf' : s.type === 'bond' ? 'b-bond' : '';
    const typeBadgeLabel = s.type === 'etf' ? 'ETF' : s.type === 'bond' ? '債券' : '';

    return `<tr>
      <td><strong>${s.code}</strong></td>
      <td>${s.name}</td>
      <td>${typeBadgeLabel ? `<span class="badge ${typeBadgeClass}">${typeBadgeLabel}</span>` : '<span style="font-size:11px;color:var(--text2)">個股</span>'}</td>
      <td>NT$${s.cost.toLocaleString()}</td>
      <td>${s.shares.toLocaleString()}</td>
      <td style="font-size:12px">NT$${fmt(costTotal)}</td>
      <td>${priceCell}</td>
      <td>${changeCell}</td>
      <td>${retCell} ${barCell}</td>
      <td>${ma20Cell}</td>
      <td>
        <button class="btn btn-sm" onclick="editMA20(${idx})" style="font-size:11px;padding:3px 8px">MA20</button>
        <button class="btn btn-sm" onclick="removeStock(${idx})" style="font-size:11px;padding:3px 8px;color:var(--red)">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function retOf(s) {
  const p = priceCache[s.code];
  return p ? (p.price - s.cost) / s.cost * 100 : 0;
}

// ── 新增/刪除標的 ─────────────────────────────────────────────
function toggleAddForm() {
  const f = document.getElementById('add-form');
  f.classList.toggle('open');
}

function addStock() {
  const code = document.getElementById('f-code').value.trim().toUpperCase();
  const name = document.getElementById('f-name').value.trim();
  const type = document.getElementById('f-type').value;
  const shares = parseInt(document.getElementById('f-shares').value) || 0;
  const cost = parseFloat(document.getElementById('f-cost').value) || 0;
  const ma20 = parseFloat(document.getElementById('f-ma20').value) || null;

  if (!code || !shares || !cost) { alert('請填寫必要欄位（代號、股數、均價）'); return; }

  const existing = PORTFOLIO.findIndex(s => s.code === code);
  const entry = { code, name: name || code, type, shares, cost, ma20 };
  if (existing >= 0) PORTFOLIO[existing] = entry;
  else PORTFOLIO.push(entry);

  ['f-code','f-name','f-shares','f-cost','f-ma20'].forEach(id => document.getElementById(id).value = '');
  toggleAddForm();
  savePortfolio();
  fetchAll();
}

function removeStock(idx) {
  const s = PORTFOLIO[idx];
  if (confirm(`確定移除 ${s.code} ${s.name}？`)) {
    PORTFOLIO.splice(idx, 1);
    savePortfolio();
    renderMetrics();
    renderTable();
  }
}

function editMA20(idx) {
  const s = PORTFOLIO[idx];
  const val = prompt(`設定 ${s.code} ${s.name} 的 MA20 值：`, s.ma20 || '');
  if (val !== null) {
    PORTFOLIO[idx].ma20 = parseFloat(val) || null;
    savePortfolio();
    renderTable();
  }
}

// ── LocalStorage 持久化 ──────────────────────────────────────
function savePortfolio() {
  try { localStorage.setItem('portfolio_v2', JSON.stringify(PORTFOLIO)); } catch(e) {}
}

function loadPortfolio() {
  try {
    const saved = localStorage.getItem('portfolio_v2');
    if (saved) PORTFOLIO = JSON.parse(saved);
  } catch(e) {}
}

// ── 市場狀態判斷 ─────────────────────────────────────────────
function checkMarketHours() {
  const now = new Date();
  const tw = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const h = tw.getHours(), m = tw.getMinutes();
  const day = tw.getDay(); // 0=日, 6=六
  const banner = document.getElementById('market-banner');

  if (day === 0 || day === 6) {
    banner.className = 'market-banner closed';
    banner.textContent = '📅 今日為週末，台股休市。顯示最後收盤價。';
  } else if (h < 9 || (h === 8 && m < 30)) {
    banner.className = 'market-banner closed';
    banner.textContent = '🕘 台股尚未開盤（09:00 開盤）。';
  } else if (h < 13 || (h === 13 && m <= 30)) {
    banner.className = 'market-banner open';
    banner.textContent = '🟢 台股交易中（09:00–13:30）。';
  } else {
    banner.className = 'market-banner closed';
    banner.textContent = '🔔 台股已收盤（13:30）。顯示今日收盤價。';
  }
}

// ── 更新日誌 ─────────────────────────────────────────────────
function addLog(time, successCount, errors) {
  const logEl = document.getElementById('update-log');
  const entry = document.createElement('span');
  if (errors.length === 0) {
    entry.className = 'ok';
    entry.textContent = `✓ ${time} 全部 ${successCount} 檔更新成功`;
  } else if (successCount === 0) {
    entry.className = 'err';
    entry.textContent = `✗ ${time} 更新失敗（網路問題）`;
  } else {
    entry.className = 'ok';
    entry.textContent = `△ ${time} ${successCount} 檔成功，${errors.length} 檔失敗(${errors.join(',')})`;
  }
  updateLog.unshift(entry.outerHTML);
  if (updateLog.length > 10) updateLog.pop();
  logEl.innerHTML = updateLog.join(' ');
}

// ── 工具函數 ─────────────────────────────────────────────────
function fmt(n) { return Math.round(n).toLocaleString('zh-TW'); }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setStatus(text, isError) {
  setText('status-text', text);
  const dot = document.getElementById('status-dot');
  dot.style.background = isError ? 'var(--red)' : (isPaused ? 'var(--amber)' : 'var(--green)');
}
function showError(msg) {
  const el = document.getElementById('error-notice');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('error-notice').style.display = 'none';
}

// ── 初始化 ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadPortfolio();
  checkMarketHours();
  renderTable();
  renderMetrics();
  fetchAll().then(() => {
    nextUpdate = Date.now() + INTERVAL_MS;
    startAutoUpdate();
  });
});
