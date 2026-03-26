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

// ══════════════════════════════════════════════════
// CSV IMPORT
// ══════════════════════════════════════════════════

let importBroker = "wealthsimple";
let importAccount = "TFSA";
let pendingTrades = [];

const BROKER_INSTRUCTIONS = {
  wealthsimple: `<strong>How to export from Wealthsimple:</strong><br>
    1. Go to <strong>wealthsimple.com</strong> → log in<br>
    2. Click your account → go to <strong>Activity</strong> tab<br>
    3. Click <strong>Download CSV</strong> (top right corner)<br>
    4. Upload the file here — deposits & dividends are skipped automatically`,

  questrade: `<strong>How to export from Questrade:</strong><br>
    1. Log in to Questrade → go to <strong>Reports</strong><br>
    2. Select <strong>Order History</strong> or <strong>Trade Confirmation</strong><br>
    3. Set your date range → click <strong>Export to CSV</strong><br>
    4. Upload the downloaded file here`,

  generic: `<strong>Generic CSV format — your file needs these columns:</strong><br>
    <strong>Date, Symbol, Type (buy/sell), Quantity, Price</strong><br>
    Column names are flexible — we'll try to detect them automatically.`
};

function openImportModal() {
  pendingTrades = [];
  importBroker = "wealthsimple";
  importAccount = "TFSA";
  document.getElementById("csv-file-input").value = "";
  document.getElementById("import-preview").style.display = "none";
  document.getElementById("import-confirm-btn").style.display = "none";
  document.getElementById("csv-dropzone").querySelector(".csv-dropzone-text").textContent = "Click to choose CSV file";
  buildImportAccountGrid();
  setBroker("wealthsimple");
  document.getElementById("import-modal").classList.add("open");
  setupDropZone();
}

function closeImportModal() {
  document.getElementById("import-modal").classList.remove("open");
}

function setBroker(broker) {
  importBroker = broker;
  ["wealthsimple","questrade","generic"].forEach(b => {
    const btn = document.getElementById("broker-" + (b === "wealthsimple" ? "ws" : b === "questrade" ? "qt" : "generic"));
    btn.classList.toggle("active", b === broker);
    btn.style.background = b === broker ? "var(--text)" : "";
    btn.style.color = b === broker ? "var(--bg)" : "";
  });
  document.getElementById("import-instructions").innerHTML = BROKER_INSTRUCTIONS[broker];
  // reset preview if broker changes
  pendingTrades = [];
  document.getElementById("import-preview").style.display = "none";
  document.getElementById("import-confirm-btn").style.display = "none";
}

function buildImportAccountGrid() {
  const grid = document.getElementById("import-account-grid");
  grid.innerHTML = "";
  ACCOUNTS.forEach(acc => {
    const col = ACCOUNT_COLORS[acc] || ACCOUNT_COLORS.Cash;
    const btn = document.createElement("button");
    btn.className = "cat-chip" + (acc === importAccount ? " selected" : "");
    btn.textContent = acc;
    if (acc === importAccount) {
      btn.style.borderColor = col.border;
      btn.style.color = col.text;
      btn.style.background = col.bg;
    }
    btn.onclick = () => { importAccount = acc; buildImportAccountGrid(); };
    grid.appendChild(btn);
  });
  grid.style.marginBottom = "20px";
}

function setupDropZone() {
  const zone = document.getElementById("csv-dropzone");
  zone.ondragover = e => { e.preventDefault(); zone.classList.add("drag-over"); };
  zone.ondragleave = () => zone.classList.remove("drag-over");
  zone.ondrop = e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  };
}

function handleCSVFile(file) {
  if (!file || !file.name.endsWith(".csv")) {
    alert("Please upload a .csv file.");
    return;
  }
  document.getElementById("csv-dropzone").querySelector(".csv-dropzone-text").textContent = "✓ " + file.name;
  const reader = new FileReader();
  reader.onload = e => parseCSV(e.target.result);
  reader.readAsText(file);
}

// ── CSV Parsers ────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) { showImportError("File appears to be empty."); return; }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/['"]/g, ""));

  let parsed = [];
  let errors = 0;

  if (importBroker === "wealthsimple") {
    parsed = parseWealthsimple(headers, lines.slice(1));
  } else if (importBroker === "questrade") {
    parsed = parseQuestrade(headers, lines.slice(1));
  } else {
    parsed = parseGeneric(headers, lines.slice(1));
  }

  // Filter out failed rows
  const valid   = parsed.filter(t => t && !t.error);
  const invalid = parsed.filter(t => t && t.error);

  pendingTrades = valid;
  showImportPreview(valid, invalid);
}

function parseWealthsimple(headers, rows) {
  // Actual Wealthsimple columns (as of 2026):
  // transaction_date, settlement_date, account_id, account_type, activity_type,
  // activity_sub_type, direction, symbol, name, currency, quantity, unit_price,
  // commission, net_cash_amount
  const col = h => {
    // exact match first, then partial
    let idx = headers.indexOf(h);
    if (idx === -1) idx = headers.findIndex(hh => hh.includes(h));
    return idx;
  };

  return rows.map((row, i) => {
    try {
      const cells = parseCSVLine(row);

      const activityType    = (cells[col("activity_type")]     || cells[col("activity type")] || "").toLowerCase().trim();
      const activitySubType = (cells[col("activity_sub_type")] || cells[col("activity sub type")] || "").toLowerCase().trim();
      const direction       = (cells[col("direction")]         || "").toLowerCase().trim();
      const symbol          = (cells[col("symbol")]            || "").trim().toUpperCase();
      const qty             = parseFloat(cells[col("quantity")]   || 0);
      const price           = parseFloat((cells[col("unit_price")] || cells[col("price")] || "0").replace(/[$,]/g,""));
      const dateRaw         = cells[col("transaction_date")]   || cells[col("transaction date")] || cells[col("date")] || "";
      const date            = normalizeDate(dateRaw);

      // Skip non-trade rows: deposits, withdrawals, dividends, fees etc.
      // We only want rows where activity_type is "Trade" or "Buy"/"Sell"
      const isTrade = activityType === "trade"
        || activityType === "buy"
        || activityType === "sell"
        || activitySubType === "buy"
        || activitySubType === "sell"
        || direction === "buy"
        || direction === "sell";

      if (!isTrade) return null; // skip MoneyMovement, Dividend, etc.
      if (!symbol)  return null; // skip rows with no symbol
      if (!date || isNaN(qty) || qty <= 0) return { error: true, row: i+2, reason: "Missing date or quantity" };

      // Determine buy vs sell
      let tradeType = "buy";
      if (direction === "sell" || activityType === "sell" || activitySubType === "sell") {
        tradeType = "sell";
      } else if (direction === "buy" || activityType === "buy" || activitySubType === "buy") {
        tradeType = "buy";
      }

      // Use unit_price; if missing, derive from net_cash_amount / quantity
      let unitPrice = price;
      if (isNaN(unitPrice) || unitPrice === 0) {
        const netCash = parseFloat((cells[col("net_cash_amount")] || "0").replace(/[$,]/g,""));
        unitPrice = qty > 0 ? Math.abs(netCash) / qty : 0;
      }

      return {
        id: Date.now() + Math.random(),
        tradeType,
        symbol,
        shares: Math.abs(qty),
        price: Math.abs(unitPrice),
        date,
        account: importAccount,
        assetType: detectAssetType(symbol),
        notes: "Imported from Wealthsimple"
      };
    } catch(e) { return { error: true, row: i+2, reason: e.message }; }
  }).filter(Boolean);
}

function parseQuestrade(headers, rows) {
  // Questrade columns: Transaction Date, Settlement Date, Action, Symbol, Description, Quantity, Price, Gross Amount, Commission, Net Amount, Currency, Account #
  const col = h => {
    const idx = headers.findIndex(hh => hh.includes(h));
    return idx;
  };
  return rows.map((row, i) => {
    try {
      const cells = parseCSVLine(row);
      const action = (cells[col("action")] || "").toLowerCase().trim();
      const symbol = (cells[col("symbol")] || "").trim().toUpperCase();
      const qty    = parseFloat(cells[col("quantity")] || 0);
      const price  = parseFloat((cells[col("price")] || "0").replace(/[$,]/g,""));
      const dateRaw = cells[col("transaction date")] || cells[col("date")] || "";
      const date   = normalizeDate(dateRaw);

      if (!symbol || !date || isNaN(qty) || qty <= 0) return { error: true, row: i+2, reason: "Missing data" };

      const tradeType = action === "buy" ? "buy" : action === "sell" ? "sell" : null;
      if (!tradeType) return null;

      return {
        id: Date.now() + Math.random(),
        tradeType,
        symbol,
        shares: Math.abs(qty),
        price: Math.abs(price),
        date,
        account: importAccount,
        assetType: detectAssetType(symbol),
        notes: "Imported from Questrade"
      };
    } catch(e) { return { error: true, row: i+2, reason: e.message }; }
  }).filter(Boolean);
}

function parseGeneric(headers, rows) {
  // Try to auto-detect columns
  const find = (...names) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateCol   = find("date","time","traded");
  const symbolCol = find("symbol","ticker","asset","stock","coin");
  const typeCol   = find("type","action","side","direction","activity");
  const qtyCol    = find("quantity","qty","shares","units","amount");
  const priceCol  = find("price","rate","cost");

  return rows.map((row, i) => {
    try {
      const cells = parseCSVLine(row);
      const symbol = symbolCol >= 0 ? (cells[symbolCol] || "").trim().toUpperCase() : "";
      const type   = typeCol   >= 0 ? (cells[typeCol]   || "").toLowerCase().trim() : "";
      const qty    = qtyCol    >= 0 ? parseFloat((cells[qtyCol]   || "0").replace(/[$,]/g,"")) : 0;
      const price  = priceCol  >= 0 ? parseFloat((cells[priceCol] || "0").replace(/[$,]/g,"")) : 0;
      const date   = dateCol   >= 0 ? normalizeDate(cells[dateCol] || "") : "";

      if (!symbol || !date || isNaN(qty) || qty <= 0) return { error: true, row: i+2, reason: "Could not parse row" };

      const tradeType = type.includes("buy") || type.includes("purchase") ? "buy"
                      : type.includes("sell") ? "sell" : "buy"; // default to buy

      return {
        id: Date.now() + Math.random(),
        tradeType,
        symbol,
        shares: Math.abs(qty),
        price: Math.abs(price),
        date,
        account: importAccount,
        assetType: detectAssetType(symbol),
        notes: "Imported via CSV"
      };
    } catch(e) { return { error: true, row: i+2, reason: e.message }; }
  }).filter(Boolean);
}

// ── Utilities ──────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { result.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

function normalizeDate(raw) {
  if (!raw) return "";
  raw = raw.replace(/['"]/g,"").trim();
  // Try various formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().slice(0,10);
  return "";
}

function detectAssetType(symbol) {
  const cryptoSymbols = ["BTC","ETH","SOL","XRP","ADA","DOGE","DOT","AVAX","MATIC","LINK","LTC","BCH","XLM","USDC","USDT"];
  if (cryptoSymbols.includes(symbol)) return "Crypto";
  if (symbol.endsWith(".TO") || symbol.includes("ETF") || ["XEQT","VEQT","XGRO","VFV","ZSP","XIU","HXT"].includes(symbol)) return "ETF";
  return "Stock";
}

function showImportPreview(valid, invalid) {
  const preview = document.getElementById("import-preview");
  preview.style.display = "block";

  document.getElementById("import-preview-count").textContent =
    `${valid.length} trade${valid.length !== 1 ? "s" : ""} ready to import`;
  document.getElementById("import-preview-errors").textContent =
    invalid.length > 0 ? `${invalid.length} row${invalid.length !== 1 ? "s" : ""} skipped` : "";

  const list = document.getElementById("import-preview-list");

  if (valid.length === 0) {
    list.innerHTML = `<div class="import-preview-row error">No valid trades found. Check that you selected the correct broker and CSV file.</div>`;
    document.getElementById("import-confirm-btn").style.display = "none";
    return;
  }

  list.innerHTML = valid.slice(0, 30).map(t => `
    <div class="import-preview-row">
      <span class="import-preview-symbol" style="color:${t.tradeType === 'buy' ? 'var(--green)' : 'var(--red)'}">${escHtml(t.tradeType.toUpperCase())} ${escHtml(t.symbol)}</span>
      <span class="import-preview-meta">${t.shares} units · ${fmtDate(t.date)}</span>
      <span class="import-preview-amount">${fmtCAD(t.shares * t.price)}</span>
    </div>
  `).join("") + (valid.length > 30 ? `<div class="import-preview-row" style="color:var(--text-muted);justify-content:center">+ ${valid.length - 30} more trades</div>` : "");

  document.getElementById("import-confirm-btn").style.display = "inline-block";
}

function showImportError(msg) {
  document.getElementById("import-preview").style.display = "block";
  document.getElementById("import-preview-count").textContent = "Error";
  document.getElementById("import-preview-errors").textContent = msg;
  document.getElementById("import-preview-list").innerHTML = `<div class="import-preview-row error">${escHtml(msg)}</div>`;
  document.getElementById("import-confirm-btn").style.display = "none";
}

function confirmImport() {
  if (pendingTrades.length === 0) return;
  // Avoid duplicates by checking existing trades
  const existingKeys = new Set(trades.map(t => `${t.symbol}_${t.date}_${t.shares}_${t.tradeType}`));
  let added = 0;
  pendingTrades.forEach(t => {
    const key = `${t.symbol}_${t.date}_${t.shares}_${t.tradeType}`;
    if (!existingKeys.has(key)) {
      trades.push({ ...t, id: Date.now() + Math.random() });
      existingKeys.add(key);
      added++;
    }
  });
  invSave();
  closeImportModal();
  renderInvestments();
  alert(`✓ Successfully imported ${added} trade${added !== 1 ? "s" : ""}!${added < pendingTrades.length ? ` (${pendingTrades.length - added} duplicates skipped)` : ""}`);
}
