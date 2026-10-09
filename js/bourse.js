// 🏛️ Bourse — portefeuille Europe (Yahoo Finance, sans clé)
// Yahoo symbols: MC.PA, AIR.PA, SAN.PA, TTE.PA, ^FCHI (CAC40)
// API: https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>?interval=1d&range=3mo

const LS_KEY = "bourseHoldings_v1";

const bBody = () => document.getElementById("bBody");
const bTotalEl = () => document.getElementById("bTotal");

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-crypto").hidden = tab !== "crypto";
    document.getElementById("tab-bourse").hidden = tab !== "bourse";
  });
});

function loadHoldings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}
function saveHoldings(h) {
  localStorage.setItem(LS_KEY, JSON.stringify(h));
}

async function fetchJsonWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function parseYahoo(j) {
  const r = j?.chart?.result?.[0];
  if (!r) {
    const err = j?.chart?.error?.description || "ticker inconnu";
    throw new Error(err);
  }
  const q = r.indicators.quote[0];
  const closes = (q.close || []).filter((x) => x != null);
  const highs = (q.high || []).filter((x) => x != null);
  const lows = (q.low || []).filter((x) => x != null);
  const price = r.meta.regularMarketPrice ?? closes[closes.length - 1];
  if (!price) throw new Error("pas de prix");
  const ranges = highs.map((h, i) => Math.abs(h - (lows[i] ?? h)));
  const atr = (n) => {
    const s = ranges.slice(-n);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : price * 0.02;
  };
  return {
    price,
    currency: r.meta.currency || "EUR",
    atrCourt: atr(5),
    atrMoyen: atr(20),
    atrLong: atr(50),
    source: "Yahoo",
  };
}

// Yahoo bloque le navigateur en 2026 (CORS + 401 crumb) — tentative unique silencieuse,
// fallback manuel immédiat. Ne spamme plus le Network.
async function fetchYahoo(ticker) {
  const path = `${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${path}`;
  try {
    const j = await fetchJsonWithTimeout(url, 6000);
    return parseYahoo(j);
  } catch (e) {
    console.warn("[bourse] Yahoo indisponible, mode manuel :", e?.message || e);
    const err = new Error("Yahoo indisponible (CORS/401) — mode manuel");
    err.silent = true;
    throw err;
  }
}

function manualLevels(price) {
  return {
    price,
    currency: "EUR",
    atrCourt: price * 0.015,
    atrMoyen: price * 0.02,
    atrLong: price * 0.03,
    source: "manuel",
  };
}

function rrOf(id, fallback) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) || fallback : fallback;
}

function fmt(n, d = 2) {
  return (n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

async function renderBourse() {
  const holdings = loadHoldings();
  const body = bBody();
  if (!holdings.length) {
    body.innerHTML = `<tr><td colspan="11">Ajoute ta première ligne ☩ (ex MC.PA x10)</td></tr>`;
    bTotalEl().innerText = "💼 Total : —";
    return;
  }

  const rrC = rrOf("rrCourt", 1.5);
  const rrM = rrOf("rrMoyen", 2);
  const rrL = rrOf("rrLong", 3);

  let totalVal = 0;
  let totalPnl = 0;
  body.innerHTML = `<tr><td colspan="11">⏳ Chargement prix Yahoo…</td></tr>`;

  const rows = [];
  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    let y = null;
    let src = "manuel";
    // 1) prix manuel prioritaire si saisi
    if (h.manualPrice) {
      y = manualLevels(h.manualPrice);
    } else {
      // 2) tentative Yahoo silencieuse, sinon PRU/lastPrice
      try {
        y = await fetchYahoo(h.ticker);
        h.lastPrice = y.price;
        src = "Yahoo";
      } catch {
        const fallback = h.lastPrice || h.pru;
        if (!fallback) {
          rows.push(`<tr>
            <td><b>${h.ticker}</b></td><td>${h.qty}</td><td>${fmt(h.pru)}€</td>
            <td colspan="7" class="neg">⚠️ aucun prix — saisis un prix manuel ⬇️</td>
            <td><button class="del-btn" data-i="${i}">🗑️</button></td>
          </tr>`);
          continue;
        }
        y = manualLevels(fallback);
      }
    }

    const valeur = h.qty * y.price;
    const pnl = (y.price - h.pru) * h.qty;
    const pnlPct = h.pru ? ((y.price - h.pru) / h.pru) * 100 : 0;
    totalVal += valeur;
    totalPnl += pnl;

    const sltp = (atr, rr) => ({ sl: y.price - atr, tp: y.price + atr * rr });
    const c = sltp(y.atrCourt, rrC);
    const m = sltp(y.atrMoyen, rrM);
    const l = sltp(y.atrLong, rrL);

    const r = (h.rate ?? 7) / 100;
    const proj = (n) => valeur * Math.pow(1 + r, n);

    rows.push(`<tr>
      <td><b>${h.ticker}</b><br><small>${src} • ${h.rate ?? 7}%/an</small></td>
      <td>${h.qty}</td>
      <td>${fmt(h.pru)}€</td>
      <td><b>${fmt(y.price)}€</b><br><input class="manual-price" data-i="${i}" type="number" step="0.01" value="${y.price}" style="width:80px" title="prix manuel — écrase Yahoo"/></td>
      <td>${fmt(valeur)}€</td>
      <td class="${pnl >= 0 ? "pos" : "neg"}">${pnl >= 0 ? "+" : ""}${fmt(pnl)}€<br><small>${fmt(pnlPct, 1)}%</small></td>
      <td>SL ${fmt(c.sl)}<br>TP ${fmt(c.tp)}</td>
      <td>SL ${fmt(m.sl)}<br>TP ${fmt(m.tp)}</td>
      <td>SL ${fmt(l.sl)}<br>TP ${fmt(l.tp)}</td>
      <td>3a ${fmt(proj(3), 0)}€<br>6a ${fmt(proj(6), 0)}€<br>12a ${fmt(proj(12), 0)}€</td>
      <td><button class="del-btn" data-i="${i}">🗑️</button></td>
    </tr>`);
  }

  saveHoldings(holdings);
  body.innerHTML = rows.join("");
  bTotalEl().innerText = `💼 Total : ${fmt(totalVal)}€ | P&L latent : ${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}€`;

  body.querySelectorAll(".manual-price").forEach((inp) => {
    inp.addEventListener("change", () => {
      const h = loadHoldings();
      const i = parseInt(inp.dataset.i, 10);
      h[i].manualPrice = parseFloat(inp.value) || 0;
      h[i].lastPrice = h[i].manualPrice;
      saveHoldings(h);
      renderBourse();
    });
  });

  body.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const h = loadHoldings();
      h.splice(parseInt(btn.dataset.i, 10), 1);
      saveHoldings(h);
      renderBourse();
    });
  });
}

document.getElementById("bAdd").addEventListener("click", () => {
  const ticker = document.getElementById("bTicker").value.trim().toUpperCase() || "MC.PA";
  const qty = parseFloat(document.getElementById("bQty").value) || 0;
  const pru = parseFloat(document.getElementById("bPru").value) || 0;
  const rate = parseFloat(document.getElementById("bRate").value) || 7;
  const manualEl = document.getElementById("bManual");
  // Si prix actuel vide → on prend le PRU (P&L 0 au départ, logique)
  const rawManual = manualEl && manualEl.value ? parseFloat(manualEl.value) : NaN;
  const prixActuel = Number.isFinite(rawManual) ? rawManual : pru;
  if (!qty || !pru) return;
  const h = loadHoldings();
  h.push({ ticker, qty, pru, rate, manualPrice: prixActuel, lastPrice: prixActuel });
  saveHoldings(h);
  renderBourse();
});

document.getElementById("bRefresh").addEventListener("click", renderBourse);

// auto-render si holdings déjà sauvés
if (loadHoldings().length) renderBourse();
