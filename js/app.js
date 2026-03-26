/* ══════════════════════════════════════════════════
   FINTRAK — App Logic
   ══════════════════════════════════════════════════ */

// ── Constants ────────────────────────────────────────────────────
const CATEGORIES = ["Food","Transport","Housing","Health","Entertainment","Shopping","Savings","Other"];

const CAT_ICONS = {
  Food:"🍔", Transport:"🚗", Housing:"🏠", Health:"💊",
  Entertainment:"🎬", Shopping:"🛍️", Savings:"💰", Other:"📦"
};

const CAT_COLORS = {
  Food:"#f97316", Transport:"#3b82f6", Housing:"#8b5cf6",
  Health:"#10b981", Entertainment:"#f59e0b", Shopping:"#ec4899",
  Savings:"#14b8a6", Other:"#6b7280"
};

// ── State ─────────────────────────────────────────────────────────
let transactions = [];
let budget = 3000;
let currentType = "expense";
let currentCat  = "Food";
let filterCat   = "All";

// ── Storage ───────────────────────────────────────────────────────
function save() {
  localStorage.setItem("fintrak_txns",   JSON.stringify(transactions));
  localStorage.setItem("fintrak_budget", String(budget));
}

function load() {
  try {
    const t = localStorage.getItem("fintrak_txns");
    if (t) transactions = JSON.parse(t);
    const b = localStorage.getItem("fintrak_budget");
    if (b) budget = parseFloat(b);
  } catch(e) { console.warn("Storage load failed", e); }
}

// ── Formatting ────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(n);
}

function fmtDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-CA",{month:"short",day:"numeric"});
}

// ── Page Routing ──────────────────────────────────────────────────
function showApp() {
  document.getElementById("landing-page").classList.remove("active");
  document.getElementById("app-page").classList.add("active");
  window.scrollTo(0,0);
  render();
}

function showLanding() {
  document.getElementById("app-page").classList.remove("active");
  document.getElementById("landing-page").classList.add("active");
  window.scrollTo(0,0);
}

// ── Tab Switching ─────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".app-nav-btn").forEach(el => el.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  btn.classList.add("active");
  if (name === "history") renderHistory();
  if (name === "investments" && typeof renderInvestments === "function") renderInvestments();
}

// ── Budget ────────────────────────────────────────────────────────
function editBudget() {
  document.getElementById("budget-input").value = budget;
  document.getElementById("budget-modal").classList.add("open");
  setTimeout(() => document.getElementById("budget-input").focus(), 50);
}

function closeBudgetModal() {
  document.getElementById("budget-modal").classList.remove("open");
}

function saveBudget() {
  const v = parseFloat(document.getElementById("budget-input").value);
  if (!isNaN(v) && v > 0) {
    budget = v;
    save();
    render();
  }
  closeBudgetModal();
}

// ── Add Transaction ───────────────────────────────────────────────
function setType(type) {
  currentType = type;
  document.getElementById("type-expense").classList.toggle("active", type === "expense");
  document.getElementById("type-income").classList.toggle("active",  type === "income");
  document.getElementById("category-picker").style.display = type === "expense" ? "block" : "none";
}

function addTransaction() {
  const desc   = document.getElementById("desc-input").value.trim();
  const amount = parseFloat(document.getElementById("amount-input").value);
  const date   = document.getElementById("date-input").value;

  if (!desc || isNaN(amount) || amount <= 0 || !date) {
    alert("Please fill in all fields with valid values.");
    return;
  }

  transactions.unshift({
    id: Date.now(),
    description: desc,
    amount: Math.abs(amount),
    category: currentType === "income" ? "Other" : currentCat,
    type: currentType,
    date
  });

  // Reset form
  document.getElementById("desc-input").value   = "";
  document.getElementById("amount-input").value = "";

  save();
  render();
  switchTab("overview", document.querySelector("[data-tab=overview]"));
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
  renderHistory();
}

// ── Category Picker ───────────────────────────────────────────────
function buildCatGrid() {
  const grid = document.getElementById("cat-grid");
  grid.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "cat-chip" + (cat === currentCat ? " selected" : "");
    btn.textContent = CAT_ICONS[cat] + " " + cat;
    if (cat === currentCat) {
      btn.style.borderColor = CAT_COLORS[cat];
      btn.style.color = CAT_COLORS[cat];
    }
    btn.onclick = () => {
      currentCat = cat;
      buildCatGrid();
    };
    grid.appendChild(btn);
  });
}

function buildFilterBar() {
  const bar = document.getElementById("filter-bar");
  bar.innerHTML = "";
  ["All", ...CATEGORIES].forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "filter-chip" + (cat === filterCat ? " active" : "");
    btn.textContent = cat === "All" ? "All" : CAT_ICONS[cat] + " " + cat;
    btn.onclick = () => {
      filterCat = cat;
      buildFilterBar();
      renderHistory();
    };
    bar.appendChild(btn);
  });
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  const income   = transactions.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0);
  const balance  = income - expenses;
  const pct      = Math.min((expenses / budget) * 100, 100);

  // Header numbers
  document.getElementById("budget-display").innerHTML = fmt(budget) + ' <span class="edit-hint">✎</span>';
  const balEl = document.getElementById("balance-display");
  balEl.textContent = fmt(balance);
  balEl.className   = "balance-amount " + (balance >= 0 ? "positive" : "negative");

  // Budget bar
  const bar = document.getElementById("budget-bar");
  bar.style.width      = pct + "%";
  bar.style.background = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e";

  document.getElementById("spent-label").textContent = "Spent " + fmt(expenses);
  document.getElementById("pct-label").textContent   = Math.round(pct) + "% used";

  // Summary cards
  document.getElementById("total-income").textContent   = fmt(income);
  document.getElementById("total-expenses").textContent = fmt(expenses);

  // Category breakdown
  const catDiv = document.getElementById("category-breakdown");
  const byCat  = CATEGORIES.map(cat => ({
    cat,
    total: transactions.filter(t => t.type === "expense" && t.category === cat).reduce((s,t) => s + t.amount, 0)
  })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);

  if (byCat.length === 0) {
    catDiv.innerHTML = '<div class="empty-state">No expenses yet.<br/><span>Tap "+ Add" to log your first transaction.</span></div>';
  } else {
    catDiv.innerHTML = byCat.map(({cat, total}) => `
      <div class="cat-row">
        <div class="cat-row-meta">
          <span>${CAT_ICONS[cat]} ${cat}</span>
          <span>${fmt(total)}</span>
        </div>
        <div class="cat-row-track">
          <div class="cat-row-fill" style="width:${(total/expenses*100).toFixed(1)}%;background:${CAT_COLORS[cat]}"></div>
        </div>
      </div>
    `).join("");
  }

  // Recent transactions (top 5)
  const recentDiv = document.getElementById("recent-list");
  if (transactions.length === 0) {
    recentDiv.innerHTML = '<div class="empty-state">Nothing here yet.</div>';
  } else {
    recentDiv.innerHTML = transactions.slice(0,5).map(t => txnHTML(t)).join("");
    attachDeleteListeners(recentDiv);
  }

  // If history tab is visible, re-render it too
  if (document.getElementById("tab-history").classList.contains("active")) {
    renderHistory();
  }
}

function renderHistory() {
  buildFilterBar();
  const list = document.getElementById("history-list");
  const items = filterCat === "All" ? transactions : transactions.filter(t => t.category === filterCat);
  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">No transactions found.</div>';
    return;
  }
  list.innerHTML = items.map(t => txnHTML(t)).join("");
  attachDeleteListeners(list);
}

function txnHTML(t) {
  const iconBg = CAT_COLORS[t.category] + "22";
  return `
    <div class="txn-row">
      <div class="txn-icon" style="background:${iconBg}">${CAT_ICONS[t.category]}</div>
      <div class="txn-info">
        <div class="txn-desc">${escapeHTML(t.description)}</div>
        <div class="txn-meta">${fmtDate(t.date)} · ${t.category}</div>
      </div>
      <div class="txn-amount ${t.type === "income" ? "income" : ""}">
        ${t.type === "income" ? "+" : "−"}${fmt(t.amount)}
      </div>
      <button class="txn-delete" data-id="${t.id}" title="Delete">×</button>
    </div>
  `;
}

function attachDeleteListeners(container) {
  container.querySelectorAll(".txn-delete").forEach(btn => {
    btn.addEventListener("click", () => deleteTransaction(Number(btn.dataset.id)));
  });
}

function escapeHTML(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Export CSV ────────────────────────────────────────────────────
function exportCSV() {
  if (transactions.length === 0) { alert("No transactions to export."); return; }
  const header = ["Date","Description","Category","Type","Amount (CAD)"];
  const rows   = transactions.map(t => [
    t.date, `"${t.description.replace(/"/g,'""')}"`, t.category, t.type, t.amount.toFixed(2)
  ]);
  const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "fintrak-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Init ──────────────────────────────────────────────────────────
(function init() {
  load();

  // Set today's date in form
  document.getElementById("date-input").value = new Date().toISOString().slice(0,10);

  // Build category picker
  buildCatGrid();
  buildFilterBar();

  // Set initial type
  setType("expense");

  // Enter key on budget modal
  document.getElementById("budget-input").addEventListener("keydown", e => {
    if (e.key === "Enter") saveBudget();
  });

  render();
})();
