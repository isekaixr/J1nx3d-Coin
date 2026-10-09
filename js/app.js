let socket;
let currentPair = "btcusdt";

const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const stateEl = document.getElementById("state");
const flowEl = document.getElementById("flow");
const select = document.getElementById("pairSelect");

// 📊 state
let candles = [];
let currentCandle = null;

// 🧠 tracking
let lastMoveTime = Date.now();
let lastCloseIndex = -1;

// 🐋 smart money tracking
let buyVolume = 0;
let sellVolume = 0;
let totalVolume = 0;

let bigTrades = [];

const BIG_TRADE_THRESHOLD = 0.5;

// ⚖️ risk management state
let activeHorizon = "court";
let riskLevels = null; // { entry, sl, tp, horizon, direction }
const HORIZON_CONFIG = {
  court: { period: 5, rrId: "rrCourt", boxId: "riskCourt" },
  moyen: { period: 20, rrId: "rrMoyen", boxId: "riskMoyen" },
  long: { period: 50, rrId: "rrLong", boxId: "riskLong" },
};

// 🔌 connect Binance
function connect(pair) {

  if (socket) socket.close();

  candles = [];
  currentCandle = null;
  buyVolume = 0;
  sellVolume = 0;
  totalVolume = 0;
  bigTrades = [];

  statusEl.innerText = "⏳ Connexion à " + pair.toUpperCase();

  socket = new WebSocket(
    `wss://stream.binance.com:9443/ws/${pair}@trade`
  );

  socket.onopen = () => {
    statusEl.innerText = "🟢 Connecté à " + pair.toUpperCase();
  };

  socket.onmessage = (event) => {

    const data = JSON.parse(event.data);
    const price = parseFloat(data.p);
    const qty = parseFloat(data.q);

    // 🐋 volume tracking
    totalVolume += qty;

    if (data.m === false) buyVolume += qty;
    else sellVolume += qty;

    // 🐋 gros trades
    if (qty > BIG_TRADE_THRESHOLD) {
      bigTrades.push({
        price,
        time: data.T, // ✅ timestamp réel Binance
        side: data.m ? "sell" : "buy"
      });

      if (bigTrades.length > 50) bigTrades.shift();
    }

    // 🧠 init candle
    if (!currentCandle) {
      currentCandle = {
        time: data.T, // ✅ temps réel
        open: price,
        high: price,
        low: price,
        close: price
      };

      lastMoveTime = Date.now();
      return;
    }

    // 🔥 update
    currentCandle.close = price;
    currentCandle.high = Math.max(currentCandle.high, price);
    currentCandle.low = Math.min(currentCandle.low, price);

    lastMoveTime = Date.now();

    updateFlow();
    draw();
  };
}

// 🧠 market state
function updateMarketState() {

  if (candles.length < 5) {
    stateEl.innerText = "📊 Market state: warming up";
    return;
  }

  const last = candles.slice(-5);

  let total = 0;
  for (let c of last) {
    total += Math.abs(c.close - c.open);
  }

  const avg = total / 5;

  if (avg < 0.3) stateEl.innerText = "📊 Market state: calm 😴";
  else if (avg < 1.5) stateEl.innerText = "📊 Market state: normal 🌊";
  else stateEl.innerText = "📊 Market state: impulsion 🔥";
}

// 🐋 flow humain
function updateFlow() {

  if (totalVolume === 0) return;

  const buyRatio = buyVolume / totalVolume;
  const sellRatio = sellVolume / totalVolume;

  let text = "";

  if (buyRatio > 0.65) {
    text = "🐂 Forte pression acheteuse";
  } else if (sellRatio > 0.65) {
    text = "🐻 Forte pression vendeuse";
  } else {
    text = "⚖️ Marché équilibré / accumulation";
  }

  flowEl.innerText =
    `📈 Flow: ${text} (${(buyRatio * 100).toFixed(0)}% buy)`;
}

// ⏱️ candle lifecycle
setInterval(() => {

  if (!currentCandle) return;

  const move = Math.abs(currentCandle.close - currentCandle.open);

  if (Date.now() - lastMoveTime > 1200) {

    if (move > 0.2) {
      candles.push(currentCandle);

      if (candles.length > 100) candles.shift();

      lastCloseIndex = candles.length - 1;

      updateMarketState();
    }

    currentCandle = null;
  }

}, 300);

// 📊 DRAW
function draw() {

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!candles.length && !currentCandle) return;

  const width = canvas.width;
  const height = canvas.height;

  const all = [...candles];
  if (currentCandle) all.push(currentCandle);

  const prices = all.flatMap(c => [c.high, c.low]);
  const max = Math.max(...prices);
  const min = Math.min(...prices);

  const padding = 40;
  const chartHeight = height - padding * 2;
  const scale = chartHeight / (max - min || 1);

  const candleWidth = (width - 60) / 60;

  // GRID
  ctx.font = "12px Arial";

  for (let i = 0; i <= 6; i++) {
    const price = min + (max - min) * (i / 6);
    const y = height - padding - (price - min) * scale;

    ctx.strokeStyle = "#1f2937";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(price.toFixed(2), width - 60, y + 4);
  }

  // 🕯️ candles
  all.forEach((c, i) => {

    const x = i * candleWidth + 20;

    const openY = height - padding - (c.open - min) * scale;
    const closeY = height - padding - (c.close - min) * scale;
    const highY = height - padding - (c.high - min) * scale;
    const lowY = height - padding - (c.low - min) * scale;

    const color = c.close >= c.open ? "#22c55e" : "#ef4444";

    const isLive = i === all.length - 1 && currentCandle !== null;
    const isClosed = i === lastCloseIndex;

    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.abs(openY - closeY);

    if (isLive) {
      ctx.shadowColor = "rgba(255,255,255,0.25)";
      ctx.shadowBlur = 8;
    }

    if (isClosed) {
      ctx.shadowColor = "rgba(255,255,255,0.5)";
      ctx.shadowBlur = 12;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x - 3, bodyTop, 6, bodyHeight || 1);

    ctx.shadowBlur = 0;
  });

  // 🐋 draw whales
  bigTrades.forEach(trade => {

    const index = all.findIndex(c => Math.abs(c.time - trade.time) < 2000);
    if (index === -1) return;

    const x = index * candleWidth + 20;
    const y = height - padding - (trade.price - min) * scale;

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);

    ctx.fillStyle = trade.side === "buy"
      ? "#3b82f6"
      : "#f97316";

    ctx.fill();
  });

  // 🕒 TIME labels
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Arial";

  for (let i = 0; i < candles.length; i++) {

    if (i % 2 !== 0) continue; // évite surcharge visuelle

    const c = candles[i];
    const x = i * candleWidth + 20;

    const time = new Date(c.time);
    const label =
      String(time.getHours()).padStart(2, "0") +
      ":" +
      String(time.getMinutes()).padStart(2, "0");

    const y = canvas.height - 10;

    ctx.fillText(label, x - 10, y);
  }

  // 📈 EMA + RSI overlay
  try { drawIndicators(all, candleWidth, width, height, padding, min, scale); } catch { /* silencieux */ }

  // ⚖️ risk overlay (Entry/SL/TP horizon actif)
  if (riskLevels) {
    const levels = [
      { price: riskLevels.entry, color: "#e2e8f0", label: "ENTRY", dash: [6, 4] },
      { price: riskLevels.sl, color: "#ef4444", label: "SL", dash: [4, 4] },
      { price: riskLevels.tp, color: "#22c55e", label: "TP", dash: [4, 4] },
    ];
    ctx.font = "bold 11px Arial";
    levels.forEach((lv) => {
      if (lv.price < min || lv.price > max) return;
      const y = height - padding - (lv.price - min) * scale;
      ctx.strokeStyle = lv.color;
      ctx.setLineDash(lv.dash);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 60, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lv.color;
      ctx.fillText(`${lv.label} ${lv.price.toFixed(2)}`, width - 150, y - 5);
    });

    // zone de risque (entry -> SL) teintée rouge léger
    const entryY = height - padding - (riskLevels.entry - min) * scale;
    const slY = height - padding - (riskLevels.sl - min) * scale;
    ctx.fillStyle = "rgba(239,68,68,0.08)";
    ctx.fillRect(0, Math.min(entryY, slY), width - 60, Math.abs(slY - entryY));
  }

  // base line
  ctx.strokeStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(0, height - padding);
  ctx.lineTo(width, height - padding);
  ctx.stroke();
}

// 🎯 switch pair
select.addEventListener("change", (e) => {
  currentPair = e.target.value;
  connect(currentPair);
});

// ⚖️ RISK MANAGEMENT
const riskBtn = document.getElementById("riskBtn");
const riskPanel = document.getElementById("riskPanel");
const capitalEl = document.getElementById("capital");
const riskPctEl = document.getElementById("riskPct");
const leverageEl = document.getElementById("leverage");
const directionEl = document.getElementById("direction");

riskBtn.addEventListener("click", () => {
  riskPanel.hidden = !riskPanel.hidden;
  if (!riskPanel.hidden) updateRisk();
});

document.querySelectorAll(".horizon-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".horizon-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeHorizon = btn.dataset.horizon;
    highlightRiskCard();
    updateRisk();
  });
});

document.querySelectorAll(".risk-card").forEach((card) => {
  card.addEventListener("click", () => {
    activeHorizon = card.dataset.horizon;
    document.querySelectorAll(".horizon-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.horizon === activeHorizon)
    );
    highlightRiskCard();
    updateRisk();
  });
});

[capitalEl, riskPctEl, leverageEl, directionEl].forEach((el) =>
  el.addEventListener("input", updateRisk)
);
["rrCourt", "rrMoyen", "rrLong"].forEach((id) =>
  document.getElementById(id).addEventListener("input", updateRisk)
);

function highlightRiskCard() {
  document.querySelectorAll(".risk-card").forEach((c) =>
    c.classList.toggle("selected", c.dataset.horizon === activeHorizon)
  );
}

function avgRange(n) {
  if (candles.length < 2) return 0;
  const slice = candles.slice(-n);
  let sum = 0;
  for (let c of slice) sum += Math.abs(c.high - c.low) || Math.abs(c.close - c.open);
  return sum / slice.length;
}

function getLivePrice() {
  if (currentCandle) return currentCandle.close;
  if (candles.length) return candles[candles.length - 1].close;
  return 0;
}

function updateRisk() {
  const price = getLivePrice();
  if (!price || candles.length < 2) return;

  const capital = parseFloat(capitalEl.value) || 0;
  const riskPct = parseFloat(riskPctEl.value) || 0;
  const levier = parseFloat(leverageEl.value) || 1;
  let direction = directionEl.value; // auto | long | short
  if (direction === "auto") direction = window.__signalDir || "long";
  const riskAmount = (capital * riskPct) / 100;
  const dirMult = direction === "short" ? -1 : 1;

  Object.entries(HORIZON_CONFIG).forEach(([name, cfg]) => {
    const rr = parseFloat(document.getElementById(cfg.rrId).value) || 1.5;
    const atr = avgRange(cfg.period);
    const box = document.getElementById(cfg.boxId);
    if (!atr) {
      box.innerText = "Pas assez de bougies…";
      return;
    }
    const slDist = atr;
    const tpDist = atr * rr;
    const sl = price - dirMult * slDist;
    const tp = price + dirMult * tpDist;
    const size = slDist > 0 ? riskAmount / slDist : 0; // qty crypto
    const notional = size * price;
    const maxNotional = capital * levier;
    const warn = notional > maxNotional ? "\n⚠️ Dépasse levier max !" : "";

    box.innerText =
      `Entry: ${price.toFixed(2)}\n` +
      `SL: ${sl.toFixed(2)} (-${slDist.toFixed(2)})\n` +
      `TP: ${tp.toFixed(2)} (+${tpDist.toFixed(2)})\n` +
      `Risque: ${riskAmount.toFixed(2)}€ | Size: ${size.toFixed(5)}\n` +
      `Notionnel: ${notional.toFixed(2)}€ (max ${maxNotional.toFixed(0)}€)${warn}`;

    if (name === activeHorizon) {
      riskLevels = { entry: price, sl, tp, horizon: name, direction };
    }
  });

  highlightRiskCard();
  draw();
}

// refresh risk toutes les 2s quand panneau ouvert
setInterval(() => {
  if (!riskPanel.hidden) updateRisk();
}, 2000);

// ☩ NOVA SIGNAL ENGINE — START/STOP/TARGET live + patterns
// Logique : gros achats répétés (clients/banques) → prix monte, puis prise de profit → redescend.
// On lit : pression buy/sell, baleines, vitesse. Pédagogique, pas un conseil financier.
window.__signalDir = "long";

function whaleBias() {
  if (!bigTrades.length) return 0;
  let b = 0, s = 0;
  for (const t of bigTrades) (t.side === "buy" ? b++ : s++);
  return (b - s) / bigTrades.length; // -1..1
}

function momentum() {
  if (candles.length < 5) return 0;
  const last = candles.slice(-5);
  const first = last[0].close;
  const end = last[last.length - 1].close;
  const atr = avgRange(5) || 1;
  return (end - first) / atr; // en unités ATR
}

function computeSignal() {
  const price = getLivePrice();
  const box = document.getElementById("signal");
  if (!box || !price || candles.length < 3) return;

  const buyRatio = totalVolume ? buyVolume / totalVolume : 0.5;
  const sellRatio = 1 - buyRatio;
  const wb = whaleBias();
  const mom = momentum();
  const atr = avgRange(5) || price * 0.0005;
  const volPct = (atr / price) * 100;

  const capital = parseFloat(capitalEl.value) || 1000;
  const riskPct = parseFloat(riskPctEl.value) || 1;
  const riskAmount = (capital * riskPct) / 100;

  let action = "WAIT", cls = "wait", pattern = "", why = "", conf = 20, dir = "long";

  if (volPct < 0.01) {
    pattern = "😴 Calme plat — personne ne mise";
    why = "Range minuscule : les gros attendent. Ne paie pas le spread pour rien.";
    conf = 15;
  } else if (buyRatio > 0.68 && wb > 0.2 && mom > 0.5) {
    const pump = volPct > 0.15;
    action = "LONG 🟢"; cls = "long"; dir = "long";
    pattern = pump ? "⚠️ Pump (clients banque achètent fort)" : "🐂 Pression acheteuse + baleines";
    why = pump
      ? "Gros clients achètent en masse → prix monte vite. Ça peut continuer… puis dumper quand ils prennent leurs gains. TP court, STOP strict."
      : "Achats > ventes + baleines côté buy + bougies qui montent : le flow pousse. Entrée START, STOP sous le bruit, TARGET sur RR.";
    conf = Math.min(88, 55 + buyRatio * 30 + wb * 10);
  } else if (sellRatio > 0.65 && wb < -0.1 && mom < -0.5) {
    action = "SHORT 🔴"; cls = "short"; dir = "short";
    pattern = "🐻 Distribution / dump — les gros vendent";
    why = "Ventes > achats + baleines sell : le prix glisse. Soit tu SHORT (levier, risqué), soit tu ATTENDS le bas pour acheter moins cher.";
    conf = Math.min(85, 50 + sellRatio * 30);
  } else if (Math.abs(buyRatio - 0.5) < 0.07 && volPct < 0.08) {
    pattern = "🐋 Accumulation — les gros ramassent doucement";
    why = "Équilibre buy/sell + petit range : les portefeuilles se remplissent sans faire monter le prix. Prépare ton START, n'entre pas encore.";
    conf = 40;
  } else {
    pattern = "🌊 Marché hésitant — pas de pattern clair";
    why = `Buy ${(buyRatio * 100).toFixed(0)}% / baleines ${wb >= 0 ? "+" : ""}${wb.toFixed(2)} / élan ${mom.toFixed(2)} ATR. Attends une vraie pression.`;
    conf = 30;
  }

  window.__signalDir = dir;
  const dm = dir === "short" ? -1 : 1;
  const sl = price - dm * atr;
  const tp1 = price + dm * atr * 1.5;
  const tp2 = price + dm * atr * 2.5;
  const size = atr > 0 ? riskAmount / atr : 0;

  document.getElementById("signalAction").innerText =
    action === "WAIT" ? "⏸️ ATTENDRE" : `▶️ ${action} — START ${price.toFixed(2)}`;
  box.className = "signal glass " + cls;
  document.getElementById("signalPattern").innerText = pattern;
  document.getElementById("sEntry").innerText = price.toFixed(2);
  document.getElementById("sStop").innerText = sl.toFixed(2) + ` (−${atr.toFixed(2)})`;
  document.getElementById("sTp1").innerText = tp1.toFixed(2);
  document.getElementById("sTp2").innerText = tp2.toFixed(2);
  document.getElementById("sSize").innerText = `${size.toFixed(5)} (≈${(size * price).toFixed(0)}€, risque ${riskAmount.toFixed(2)}€)`;
  document.getElementById("signalWhy").innerText = why;
  document.getElementById("confBar").style.width = conf + "%";
  document.getElementById("confTxt").innerText = `confiance ${conf.toFixed(0)}%`;

  // pousse aussi vers le chart (horizon actif)
  riskLevels = { entry: price, sl, tp: tp1, horizon: activeHorizon, direction: dir };
}

setInterval(() => { try { computeSignal(); } catch {} }, 2000);

// 🏆 TOP PICK — sur quoi miser = les 3 plus chaudes du moment (score 24h, tout le spot)
const STABLES = ["USDT", "USDC", "FDUSD", "TUSD", "DAI", "USDD", "BUSD"];
async function refreshTopPick() {
  const el = document.getElementById("pickChips");
  if (!el) return;
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arr = await res.json();
    const scored = arr
      .filter((t) => t.symbol.endsWith("USDT") && !STABLES.some((s) => t.symbol.startsWith(s)))
      .map((t) => {
        const chg = parseFloat(t.priceChangePercent);
        const vol = parseFloat(t.quoteVolume);
        return { s: t.symbol, chg, vol, score: Math.abs(chg) * Math.log10(vol + 10) };
      })
      .filter((t) => isFinite(t.chg) && isFinite(t.vol) && t.vol > 1000000 && t.chg > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const medalsPick = ["🥇", "🥈", "🥉"];
    el.innerHTML = scored.map((x, i) => {
      const cur = x.s.toLowerCase() === currentPair;
      return `<button class="chip ${i === 0 ? "pick" : ""}" data-p="${x.s.toLowerCase()}">${i === 0 ? "⭐ " : medalsPick[i] + " "}${x.s.replace("USDT", "")} <small>${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%${cur ? " • live" : ""}</small></button>`;
    }).join(" ") + `<small class="hint"> + live : ${currentPair.toUpperCase()}</small>`;
    el.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      loadPair(c.dataset.p);
    }));
  } catch (e) {
    el.innerText = "top indisponible (réseau) — reste sur " + currentPair.toUpperCase();
  }
}
setInterval(refreshTopPick, 30000);
refreshTopPick();

// 🫧 BUBBLE SCREENER — top USDT 24h façon crypto-bubble (clic = charger)
async function refreshBubble() {
  const el = document.getElementById("bubble");
  if (!el) return;
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arr = await res.json();
    const spot = arr
      .filter((t) => t.symbol.endsWith("USDT") && !STABLES.some((s) => t.symbol.startsWith(s)))
      .map((t) => ({ s: t.symbol, chg: parseFloat(t.priceChangePercent), vol: parseFloat(t.quoteVolume) }))
      .filter((t) => isFinite(t.chg) && isFinite(t.vol) && t.vol > 1000000)
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 40)
      .sort((a, b) => b.chg - a.chg);
    const vols = spot.map((x) => Math.log10(x.vol));
    const vMin = Math.min(...vols), vMax = Math.max(...vols);
    // 🏆 TOP 5 à miser : score = mouvement × volume, gainers d'abord
    const scored = spot.map((x) => ({ ...x, score: Math.abs(x.chg) * Math.log10(x.vol + 10) }));
    const gainers = scored.filter((x) => x.chg > 0).sort((a, b) => b.score - a.score);
    const pool = (gainers.length >= 7 ? gainers : scored.sort((a, b) => b.score - a.score)).slice(0, 7);
    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
    const pickEl = document.getElementById("bubblePick");
    if (pickEl) {
      pickEl.innerText = "⭐ Top 7 : " + pool.map((x, i) => `${medals[i]} ${x.s.replace("USDT", "")} ${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%`).join("  ");
    }
    el.innerHTML = "";
    spot.forEach((x) => {
      const size = 12 + ((Math.log10(x.vol) - vMin) / (vMax - vMin || 1)) * 22;
      const rank = pool.findIndex((p) => p.s === x.s);
      const isTop = rank !== -1;
      const b = document.createElement("button");
      b.className = "bub" + (isTop ? " top" : "");
      b.style.fontSize = size + "px";
      b.style.background = `hsl(${x.chg >= 0 ? 140 : 0} 70% ${x.chg >= 0 ? 45 + Math.min(20, x.chg) : 60}%)`;
      const flame = rank >= 0 && rank < 3 ? "🔥 " : "";
      b.innerHTML = `${flame}${isTop ? medals[rank] + " " : ""}${x.s.replace("USDT", "")}<small>${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%${rank === 0 ? " — À MISER" : ""}</small>`;
      b.title = `${isTop ? "TOP " + (rank + 1) + " à miser — " : ""}${x.s} : ${x.chg.toFixed(2)}% / vol ${(x.vol / 1e6).toFixed(1)}M — clic = charger`;
      b.addEventListener("click", () => loadPair(x.s.toLowerCase()));
      el.appendChild(b);
    });
    // 7j en différé (ne bloque pas l'affichage 24h)
    (async () => {
      try {
        const w7 = await Promise.all(pool.map(async (x) => {
          try {
            const k = await fetch(`https://api.binance.com/api/v3/klines?symbol=${x.s}&interval=1d&limit=8`).then((r) => r.json());
            const now = parseFloat(k[k.length - 1][4]), old = parseFloat(k[0][4]);
            return ((now - old) / old) * 100;
          } catch { return null; }
        }));
        const pe = document.getElementById("bubblePick");
        if (pe) pe.innerText = "⭐ Top 7 : " + pool.map((x, i) =>
          `${medals[i]} ${x.s.replace("USDT", "")} ${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%${w7[i] == null ? "" : ` (${w7[i] >= 0 ? "+" : ""}${w7[i].toFixed(0)}% 7j)`}`
        ).join("  ");
      } catch { /* silencieux */ }
    })();
  } catch (e) {
    el.innerText = "bubble indisponible (réseau) — réessaie 🔄";
  }
}
function loadPair(p) {
  currentPair = p;
  // ajoute l'option au select si absente (n'importe quel spot Binance marche en WS)
  if (![...select.options].some((o) => o.value === p)) {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p.replace("usdt", "").toUpperCase() + "/USDT";
    select.appendChild(o);
  }
  select.value = p;
  connect(p);
  refreshTopPick();
}
document.getElementById("bubbleRefresh")?.addEventListener("click", refreshBubble);
setInterval(refreshBubble, 60000);
refreshBubble();

// 🌍 MARKET BAR — Fear & Greed (gratuit) + BTC 24h
async function refreshMarketBar() {
  try {
    const f = await fetch("https://api.alternative.me/fng/?limit=1&format=json").then((r) => r.json());
    const v = f?.data?.[0];
    if (v) {
      const label = { "Extreme Fear": "Peur extrême", Fear: "Peur", Neutral: "Neutre", Greed: "Gourmandise", "Extreme Greed": "Euphorie" }[v.value_classification] || v.value_classification;
      const mood = v.value >= 55 ? "pos" : v.value <= 45 ? "neg" : "";
      document.getElementById("fng").innerHTML = `<span class="${mood}">${v.value}</span><span class="sub">${label}</span>`;
    }
  } catch { document.getElementById("fng").innerText = "n/a"; }
  try {
    const b = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then((r) => r.json());
    const chg = parseFloat(b.priceChangePercent);
    document.getElementById("btcDom").innerHTML = `${parseFloat(b.lastPrice).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}$<span class="sub ${chg >= 0 ? "pos" : "neg"}">${chg >= 0 ? "+" : ""}${chg.toFixed(1)}% / 24h</span>`;
  } catch { /* silencieux */ }
}
setInterval(refreshMarketBar, 60000);
refreshMarketBar();

// 💱 DEVISES chaudes — forex ECB via Frankfurter (gratuit, CORS OK)
async function refreshFx() {
  const el = document.getElementById("fxStrip");
  if (!el) return;
  try {
    const to = "USD,GBP,JPY,CHF";
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const j = await fetch(`https://api.frankfurter.app/${start}..${end}?from=EUR&to=${to}`).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    const days = Object.keys(j.rates).sort();
    if (days.length < 2) throw new Error("pas d'historique");
    const last = j.rates[days[days.length - 1]], prev = j.rates[days[days.length - 2]];
    const flags = { USD: "$", GBP: "£", JPY: "¥", CHF: "₣" };
    el.innerHTML = '<div class="mrow">' + ["USD", "GBP", "JPY", "CHF"].map((k) => {
      const v = last[k], chg = ((v - prev[k]) / prev[k]) * 100;
      return `<span>EUR/${k} <b>${v.toFixed(k === "JPY" ? 1 : 4)}</b> <small class="${chg >= 0 ? "pos" : "neg"}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</small></span>`;
    }).join("") + "</div>";
  } catch (e) {
    el.innerText = "n/a (réseau)";
  }
}
setInterval(refreshFx, 300000);
refreshFx();

// 🛢️ BARIL — Brent/WTI : Yahoo tente en direct, sinon valeur seed manuelle (éditable)
const OIL_SEED = {
  brent: { ticker: "BZ=F", price: 104.09, date: "09/10/2026" },
  wti: { ticker: "CL=F", price: 91.49, date: "09/10/2026" },
};
function oilManual() {
  try { return JSON.parse(localStorage.getItem("oilManual") || "{}"); } catch { return {}; }
}
async function refreshOil() {
  const el = document.getElementById("oilStrip");
  if (!el) return;
  const man = oilManual();
  const out = {};
  for (const [key, seed] of Object.entries(OIL_SEED)) {
    let price = man[key] || seed.price, src = man[key] ? "manuel" : `seed ${seed.date}`;
    try {
      const j = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${seed.ticker}?interval=1d&range=5d`).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      const m = j?.chart?.result?.[0]?.meta;
      if (m?.regularMarketPrice) { price = m.regularMarketPrice; src = "Yahoo live"; }
    } catch { /* fallback seed/manuel, silencieux */ }
    out[key] = { price, src };
  }
  el.innerHTML = `<div class="mrow"><span>Brent <b>${out.brent.price.toFixed(2)}$</b></span><span>WTI <b>${out.wti.price.toFixed(2)}$</b></span></div><span class="sub">${out.brent.src} <button id="oilEdit" title="mettre à jour manuellement">✏️</button></span>`;
  document.getElementById("oilEdit")?.addEventListener("click", () => {
    const b = prompt("Brent $ ?", String(out.brent.price));
    const w = prompt("WTI $ ?", String(out.wti.price));
    const m = oilManual();
    if (b && isFinite(parseFloat(b))) m.brent = parseFloat(b);
    if (w && isFinite(parseFloat(w))) m.wti = parseFloat(w);
    localStorage.setItem("oilManual", JSON.stringify(m));
    refreshOil();
  });
}
setInterval(refreshOil, 300000);
refreshOil();

// 🏦 ETF — IBIT (BTC), ETHA (ETH), CAC.PA (CAC40) : Yahoo live ou seed 09/10/2026, éditable
const ETF_SEED = [
  { ticker: "IBIT", name: "BTC", price: 46.805, ccy: "$", date: "09/10/26" },
  { ticker: "ETHA", name: "ETH", price: 56.295, ccy: "$", date: "09/10/26" },
  { ticker: "CAC.PA", name: "CAC40", price: 78.96, ccy: "€", date: "09/10/26" },
];
function etfManual() {
  try { return JSON.parse(localStorage.getItem("etfManual") || "{}"); } catch { return {}; }
}
async function refreshEtf() {
  const el = document.getElementById("etfStrip");
  if (!el) return;
  const man = etfManual();
  const rows = [];
  for (const e of ETF_SEED) {
    let price = man[e.ticker] ?? e.price, chg = null, src = man[e.ticker] != null ? "manuel" : e.date;
    try {
      const j = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(e.ticker)}?interval=1d&range=5d`).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      const m = j?.chart?.result?.[0]?.meta;
      if (m?.regularMarketPrice) { price = m.regularMarketPrice; chg = m.regularMarketChangePercent; src = "live"; }
    } catch { /* seed/manuel */ }
    rows.push({ ...e, price, chg, src });
  }
  el.innerHTML = `<div class="mrow">` + rows.map((r) =>
    `<span>${r.name} <b>${r.price.toFixed(2)}${r.ccy}</b> ${r.chg == null ? `<small>${r.src}</small>` : `<small class="${r.chg >= 0 ? "pos" : "neg"}">${r.chg >= 0 ? "+" : ""}${r.chg.toFixed(1)}%</small>`}</span>`
  ).join("") + `</div><span class="sub"><button id="etfEdit">✏️ prix</button></span>`;
  document.getElementById("etfEdit")?.addEventListener("click", () => {
    const m = etfManual();
    for (const e of ETF_SEED) {
      const v = prompt(`${e.ticker} (${e.ccy}) ?`, String(m[e.ticker] ?? e.price));
      if (v && isFinite(parseFloat(v))) m[e.ticker] = parseFloat(v);
    }
    localStorage.setItem("etfManual", JSON.stringify(m));
    refreshEtf();
  });
}
setInterval(refreshEtf, 300000);
refreshEtf();

// 🤪 MÈMES — les coins à la con, 24h + 7j (Binance, gratuit)
// Oui on les voit déjà dans la bubble (PEPE, DOGE…) — ici c'est leur coin réservé avec la varia 7j.
const MEMES = ["DOGEUSDT", "SHIBUSDT", "PEPEUSDT", "BONKUSDT", "WIFUSDT", "FLOKIUSDT", "PUMPUSDT"];
async function refreshMeme() {
  const el = document.getElementById("memeStrip");
  if (!el) return;
  try {
    const sym = encodeURIComponent(JSON.stringify(MEMES));
    const arr = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${sym}`).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    const w7 = await Promise.all(arr.map(async (t) => {
      try {
        const k = await fetch(`https://api.binance.com/api/v3/klines?symbol=${t.symbol}&interval=1d&limit=8`).then((r) => r.json());
        const old = parseFloat(k[0][4]), now = parseFloat(t.lastPrice);
        return ((now - old) / old) * 100;
      } catch { return null; }
    }));
    el.innerHTML = `<div class="mrow">` + arr.map((t, i) => {
      const c24 = parseFloat(t.priceChangePercent), c7 = w7[i];
      return `<button class="chip" data-p="${t.symbol.toLowerCase()}">${t.symbol.replace("USDT", "")} <small class="${c24 >= 0 ? "pos" : "neg"}">${c24 >= 0 ? "+" : ""}${c24.toFixed(1)}%</small><small> / ${c7 == null ? "7j n/a" : `${c7 >= 0 ? "+" : ""}${c7.toFixed(1)}% 7j`}</small></button>`;
    }).join("") + "</div>";
    el.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => loadPair(c.dataset.p)));
  } catch {
    el.innerText = "n/a (réseau)";
  }
}
setInterval(refreshMeme, 600000);
refreshMeme();

// 🖼️ NFT — floors ETH des œuvres revendues une folie (CoinGecko gratuit, best-effort)
const NFTS = [
  { id: "bored-ape-yacht-club", name: "BAYC" },
  { id: "cryptopunks", name: "Punks" },
  { id: "pudgy-penguins", name: "Pudgy" },
];
async function refreshNft() {
  const el = document.getElementById("nftStrip");
  if (!el) return;
  try {
    const rows = [];
    for (const n of NFTS) {
      const j = await fetch(`https://api.coingecko.com/api/v3/nfts/${n.id}`).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      rows.push(`<span>${n.name} <b>${Number(j.floor_price.native_currency).toFixed(1)}Ξ</b> <small>vol ${Number(j.volume_24h?.native_currency || 0).toFixed(0)}Ξ/24h</small></span>`);
    }
    el.innerHTML = `<div class="mrow">${rows.join("")}</div>`;
  } catch {
    el.innerHTML = `<span class="sub">limite gratuite atteinte — réessaie dans 1 min (les floors bougent peu de toute façon)</span>`;
  }
}
setInterval(refreshNft, 1800000);
refreshNft();

// 📈 INDICATEURS — EMA12/26 + RSI14 (façon TradingView, light)
function emaArr(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out = [];
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
  return out;
}
function rsi14(closes) {
  if (closes.length < 15) return null;
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  const rs = (g / 14) / (l / 14);
  return 100 - 100 / (1 + rs);
}
function drawIndicators(all, candleWidth, width, height, padding, min, scale) {
  const closes = all.map((c) => c.close);
  const e12 = emaArr(closes, 12), e26 = emaArr(closes, 26);
  const line = (arr, offset, color) => {
    if (!arr.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    arr.forEach((v, j) => {
      const i = j + offset;
      const x = i * candleWidth + 20;
      const y = height - padding - (v - min) * scale;
      j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke(); ctx.lineWidth = 1;
  };
  line(e12, closes.length - e12.length, "#38bdf8");
  line(e26, closes.length - e26.length, "#facc15");
  const rsi = rsi14(closes);
  if (rsi != null) {
    ctx.fillStyle = rsi > 70 ? "#ef4444" : rsi < 30 ? "#22c55e" : "#94a3b8";
    ctx.font = "bold 12px Arial";
    ctx.fillText(`RSI14 ${rsi.toFixed(0)}${rsi > 70 ? " ⚠️ suracheté" : rsi < 30 ? " 💎 survendu" : ""}  |  EMA12/26`, 12, 18);
  }
  return rsi;
}
const _origCompute = computeSignal;
computeSignal = function () {
  _origCompute();
  try {
    const all = currentCandle ? [...candles, currentCandle] : [...candles];
    if (all.length < 15) return;
    const rsi = rsi14(all.map((c) => c.close));
    if (rsi == null) return;
    const why = document.getElementById("signalWhy");
    const tag = rsi > 70 ? " — RSI suracheté : pump fatigué, méfiance." : rsi < 30 ? " — RSI survendu : dump fatigué, rebond possible." : "";
    if (tag && !why.innerText.includes("RSI")) why.innerText += tag;
  } catch { /* silencieux */ }
};

// 🚀 init
connect(currentPair);
highlightRiskCard();