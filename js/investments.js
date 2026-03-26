/* ══════════════════════════════════════════════════
   FINTRAK — Investments Module
   ══════════════════════════════════════════════════ */

// ── Constants ─────────────────────────────────────
const ASSET_TYPES = ["Stock", "ETF", "Crypto", "Mutual Fund", "Bond", "Other"];

const ASSET_ICONS = {
  Stock: "📈", ETF: "🗂️", Crypto: "₿", "Mutual Fund": "🏦", Bond: "📄", Other: "💼"
};

const ACCOUNTS = ["TFSA", "RRSP", "FHSA", "RESP", "RRIF", "Cash", "Margin", "Crypto Wallet"];

const ACCOUNT_COLORS = {
  TFSA:          { bg: "#10b98122", border: "#10b981", text: "#10b981" },
  RRSP:          { bg: "#3b82f622", border: "#3b82f6", text: "#3b82f6" },
  FHSA:          { bg: "#8b5cf622", border: "#8b5cf6", text: "#8b5cf6" },
  RESP:          { bg: "#f59e0b22", border: "#f59e0b", text: "#f59e0b" },
  RRIF:          { bg: "#ec489922", border: "#ec4899", text: "#ec4899" },
  Cash:          { bg: "#6b728022", border: "#6b7280", text: "#6b7280" },
  Margin:        { bg: "#ef444422", border: "#ef4444", text: "#ef4444" },
  "Crypto Wallet": { bg: "#f9731622", border: "#f97316", text: "#f97316" },
};

// ── State ──────────────────────────────────────────
let trades = [];
let currentPrices = {}; // symbol → current price per unit
let tradeType = "buy";
let assetType = "Stock";
let accountType = "TFSA";
let valuingSymbol = null;

// ── Storage ────────────────────────────────────────
function invSave() {
  localStorage.setItem("fintrak_trades",  JSON.stringify(trades));
  localStorage.setItem("fintrak_prices",  JSON.stringify(currentPrices));
}

function invLoad() {
  try {
    const t = localStorage.getItem("fintrak_trades");
    if (t) trades = JSON.parse(t);
    const p = localStorage.getItem("fintrak_prices");
    if (p) currentPrices = JSON.parse(p);
  } catch(e) { console.warn("Investment storage load failed", e); }
}

// ── Helpers ────────────────────────────────────────
function fmtCAD(n) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function fmtDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// generate a coloured abbreviation for a symbol
function symbolBadge(symbol, assetType) {
  const colors = {
    Stock: ["#3b82f633","#3b82f6"], ETF: ["#8b5cf633","#8b5cf6"],
    Crypto: ["#f9731633","#f97316"], "Mutual Fund": ["#10b98133","#10b981"],
    Bond: ["#6b728033","#6b7280"], Other: ["#ec489933","#ec4899"],
  };
  const [bg, color] = colors[assetType] || colors.Other;
  const label = symbol.slice(0,3).toUpperCase();
  return `<div class="inv-holding-icon" style="background:${bg};color:${color}">${label}</div>`;
}

// ── Compute portfolio ──────────────────────────────
function computePortfolio() {
  // Build holdings: symbol → { shares, costBasis, account, assetType }
  const holdings = {};

  trades.forEach(t => {
    if (!holdings[t.symbol]) {
      holdings[t.symbol] = { shares: 0, costBasis: 0, assetType: t.assetType, accounts: {} };
    }
    const h = holdings[t.symbol];
    if (t.tradeType === "buy") {
      h.costBasis += t.shares * t.price;
      h.shares    += t.shares;
    } else {
      // sell — reduce proportionally
      const avgCost = h.shares > 0 ? h.costBasis / h.shares : 0;
      h.shares    -= t.shares;
      h.costBasis -= avgCost * t.shares;
      if (h.shares < 0) h.shares = 0;
      if (h.costBasis < 0) h.costBasis = 0;
    }
    // account tracking
    if (!h.accounts[t.account]) h.accounts[t.account] = 0;
    h.accounts[t.account] += t.tradeType === "buy"
      ? t.shares * t.price
      : -(t.shares * t.price);
  });

  // Remove zeroed-out holdings
  Object.keys(holdings).forEach(k => { if (holdings[k].shares <= 0.00001) delete holdings[k]; });

  return holdings;
}

function computeSummary(holdings) {
  let totalInvested = 0, currentValue = 0;

  Object.entries(holdings).forEach(([symbol, h]) => {
    totalInvested += h.costBasis;
    const curPrice = currentPrices[symbol] ?? (h.shares > 0 ? h.costBasis / h.shares : 0);
    currentValue  += h.shares * curPrice;
  });

  return { totalInvested, currentValue, gainLoss: currentValue - totalInvested };
}

function computeByAccount(holdings) {
  const accounts = {};
  Object.entries(holdings).forEach(([symbol, h]) => {
    Object.entries(h.accounts).forEach(([acc, contributed]) => {
      if (!accounts[acc]) accounts[acc] = { invested: 0, holdings: 0 };
      accounts[acc].invested  += Math.max(contributed, 0);
      accounts[acc].holdings  += 1;
    });
  });
  return accounts;
}

// ── Render Investments Tab ─────────────────────────
function renderInvestments() {
  const holdings = computePortfolio();
  const { totalInvested, currentValue, gainLoss } = computeSummary(holdings);
  const byAccount = computeByAccount(holdings);

  // Summary cards
  document.getElementById("inv-total-invested").textContent = fmtCAD(totalInvested);
  document.getElementById("inv-current-value").textContent  = fmtCAD(currentValue);
  const glEl = document.getElementById("inv-gain-loss");
  glEl.textContent  = (gainLoss >= 0 ? "+" : "") + fmtCAD(gainLoss);
  glEl.className    = "inv-summary-amount " + (gainLoss >= 0 ? "positive" : "negative");

  // Accounts
  const accEl = document.getElementById("inv-accounts-list");
  if (Object.keys(byAccount).length === 0) {
    accEl.innerHTML = '<div class="empty-state">No investments yet.<br/><span>Tap "+ Log a Trade" below.</span></div>';
  } else {
    accEl.innerHTML = Object.entries(byAccount).map(([acc, data]) => {
      const col = ACCOUNT_COLORS[acc] || ACCOUNT_COLORS.Cash;
      return `
        <div class="inv-account-row">
          <div class="inv-account-left">
            <span class="inv-account-badge" style="background:${col.bg};border-color:${col.border};color:${col.text}">${escHtml(acc)}</span>
            <span style="font-size:13px;color:var(--text-mid)">${data.holdings} holding${data.holdings !== 1 ? "s" : ""}</span>
          </div>
          <div>
            <div class="inv-account-amount">${fmtCAD(data.invested)}</div>
            <div class="inv-account-sub">contributed</div>
          </div>
        </div>`;
    }).join("");
  }

  // Holdings
  const holdEl = document.getElementById("inv-holdings-list");
  if (Object.keys(holdings).length === 0) {
    holdEl.innerHTML = "";
    return;
  }

  holdEl.innerHTML = Object.entries(holdings).map(([symbol, h]) => {
    const curPrice  = currentPrices[symbol] ?? (h.shares > 0 ? h.costBasis / h.shares : 0);
    const curValue  = h.shares * curPrice;
    const gain      = curValue - h.costBasis;
    const gainPct   = h.costBasis > 0 ? (gain / h.costBasis * 100) : 0;
    const gainClass = gain >= 0 ? "positive" : "negative";
    const gainSign  = gain >= 0 ? "+" : "";

    return `
      <div class="inv-holding-row">
        ${symbolBadge(symbol, h.assetType)}
        <div class="inv-holding-info">
          <div class="inv-holding-symbol">${escHtml(symbol)}</div>
          <div class="inv-holding-meta">${h.assetType} · ${h.shares.toLocaleString("en-CA", {maximumFractionDigits:4})} units</div>
        </div>
        <div class="inv-holding-right">
          <div class="inv-holding-value">${fmtCAD(curValue)}</div>
          <div class="inv-holding-gain ${gainClass}">${gainSign}${fmtCAD(gain)} (${gainSign}${gainPct.toFixed(1)}%)</div>
        </div>
        <button class="inv-update-btn" onclick="openValueModal('${escHtml(symbol)}')">Update ✎</button>
      </div>`;
  }).join("");

  // Trade history
  renderTradeHistory();
}

function renderTradeHistory() {
  const el = document.getElementById("inv-trade-history");
  if (trades.length === 0) {
    el.innerHTML = '<div class="empty-state">No trades logged yet.</div>';
    return;
  }
  el.innerHTML = [...trades].reverse().map(t => {
    const col = ACCOUNT_COLORS[t.account] || ACCOUNT_COLORS.Cash;
    const total = t.shares * t.price;
    return `
      <div class="txn-row">
        ${symbolBadge(t.symbol, t.assetType)}
        <div class="txn-info">
          <div class="txn-desc">
            <span style="color:${t.tradeType === 'buy' ? 'var(--green)' : 'var(--red)'}; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-right:6px">${t.tradeType}</span>
            ${escHtml(t.symbol)}
            <span class="inv-account-badge" style="margin-left:6px;background:${col.bg};border-color:${col.border};color:${col.text};padding:2px 7px;font-size:10px;border-radius:10px;border:1px solid">${escHtml(t.account)}</span>
          </div>
          <div class="txn-meta">${fmtDate(t.date)} · ${t.shares} units @ ${fmtCAD(t.price)}${t.notes ? " · " + escHtml(t.notes) : ""}</div>
        </div>
        <div class="txn-amount ${t.tradeType === 'sell' ? 'income' : ''}">${t.tradeType === 'sell' ? '+' : '−'}${fmtCAD(total)}</div>
        <button class="txn-delete" onclick="deleteTrade(${t.id})" title="Delete">×</button>
      </div>`;
  }).join("");
}

// ── Modal: Trade ───────────────────────────────────
function openTradeModal() {
  document.getElementById("trade-date").value = new Date().toISOString().slice(0,10);
  document.getElementById("trade-symbol").value = "";
  document.getElementById("trade-shares").value = "";
  document.getElementById("trade-price").value  = "";
  document.getElementById("trade-notes").value  = "";
  buildAssetTypeGrid();
  buildAccountGrid();
  setTradeType("buy");
  document.getElementById("trade-modal").classList.add("open");
  setTimeout(() => document.getElementById("trade-symbol").focus(), 80);
}

function closeTradeModal() {
  document.getElementById("trade-modal").classList.remove("open");
}

function setTradeType(type) {
  tradeType = type;
  document.getElementById("trade-type-buy").classList.toggle("active", type === "buy");
  document.getElementById("trade-type-sell").classList.toggle("active", type === "sell");
  // green for buy, red for sell
  const buyBtn  = document.getElementById("trade-type-buy");
  const sellBtn = document.getElementById("trade-type-sell");
  buyBtn.style.background  = type === "buy"  ? "var(--green)" : "";
  sellBtn.style.background = type === "sell" ? "var(--red)"   : "";
  buyBtn.style.color  = type === "buy"  ? "#fff" : "";
  sellBtn.style.color = type === "sell" ? "#fff" : "";
}

function buildAssetTypeGrid() {
  const grid = document.getElementById("asset-type-grid");
  grid.innerHTML = "";
  ASSET_TYPES.forEach(type => {
    const btn = document.createElement("button");
    btn.className = "cat-chip" + (type === assetType ? " selected" : "");
    btn.textContent = ASSET_ICONS[type] + " " + type;
    if (type === assetType) {
      btn.style.borderColor = "#f97316";
      btn.style.color = "#f97316";
    }
    btn.onclick = () => { assetType = type; buildAssetTypeGrid(); };
    grid.appendChild(btn);
  });
  // add bottom margin after chips
  grid.style.marginBottom = "20px";
}

function buildAccountGrid() {
  const grid = document.getElementById("account-grid");
  grid.innerHTML = "";
  ACCOUNTS.forEach(acc => {
    const col = ACCOUNT_COLORS[acc] || ACCOUNT_COLORS.Cash;
    const btn = document.createElement("button");
    btn.className = "cat-chip" + (acc === accountType ? " selected" : "");
    btn.textContent = acc;
    if (acc === accountType) {
      btn.style.borderColor = col.border;
      btn.style.color = col.text;
      btn.style.background = col.bg;
    }
    btn.onclick = () => { accountType = acc; buildAccountGrid(); };
    grid.appendChild(btn);
  });
  grid.style.marginBottom = "20px";
}

function addTrade() {
  const symbol = document.getElementById("trade-symbol").value.trim().toUpperCase();
  const shares = parseFloat(document.getElementById("trade-shares").value);
  const price  = parseFloat(document.getElementById("trade-price").value);
  const date   = document.getElementById("trade-date").value;
  const notes  = document.getElementById("trade-notes").value.trim();

  if (!symbol || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0 || !date) {
    alert("Please fill in symbol, shares, price, and date.");
    return;
  }

  trades.push({ id: Date.now(), tradeType, assetType, account: accountType, symbol, shares, price, date, notes });
  invSave();
  closeTradeModal();
  renderInvestments();
}

function deleteTrade(id) {
  trades = trades.filter(t => t.id !== id);
  invSave();
  renderInvestments();
}

// ── Modal: Update Value ────────────────────────────
function openValueModal(symbol) {
  valuingSymbol = symbol;
  document.getElementById("value-modal-symbol").textContent = symbol;
  document.getElementById("value-input").value = currentPrices[symbol] ?? "";
  document.getElementById("value-modal").classList.add("open");
  setTimeout(() => document.getElementById("value-input").focus(), 80);
}

function closeValueModal() {
  document.getElementById("value-modal").classList.remove("open");
  valuingSymbol = null;
}

function saveCurrentValue() {
  const v = parseFloat(document.getElementById("value-input").value);
  if (isNaN(v) || v < 0) { alert("Please enter a valid price."); return; }
  if (valuingSymbol) {
    currentPrices[valuingSymbol] = v;
    invSave();
    renderInvestments();
  }
  closeValueModal();
}

// ── Init ───────────────────────────────────────────
(function invInit() {
  invLoad();

  // Close modals on Escape
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeTradeModal(); closeValueModal(); }
  });

  // Enter key in value modal
  document.getElementById("value-input").addEventListener("keydown", e => {
    if (e.key === "Enter") saveCurrentValue();
  });

  renderInvestments();
})();
