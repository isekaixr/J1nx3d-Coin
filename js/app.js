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

setInterval(computeSignal, 2000);

// 🏆 TOP PICK — sur quoi miser (score 24h Binance)
const PAIRS24 = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
async function refreshTopPick() {
  const el = document.getElementById("pickChips");
  if (!el) return;
  try {
    const sym = encodeURIComponent(JSON.stringify(PAIRS24));
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${sym}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arr = await res.json();
    const scored = arr.map((t) => {
      const chg = Math.abs(parseFloat(t.priceChangePercent));
      const vol = parseFloat(t.quoteVolume);
      const score = chg * Math.log10(vol + 10);
      return { s: t.symbol, chg: parseFloat(t.priceChangePercent), vol, score, last: parseFloat(t.lastPrice) };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    el.innerHTML = scored.map((x) => {
      const cur = x.s.toLowerCase() === currentPair;
      const isBest = x.s === best.s;
      return `<button class="chip ${isBest ? "pick" : ""}" data-p="${x.s.toLowerCase()}">${isBest ? "⭐ " : ""}${x.s.replace("USDT", "")} <small>${x.chg >= 0 ? "+" : ""}${x.chg.toFixed(1)}%${cur ? " • live" : ""}</small></button>`;
    }).join(" ");
    el.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      select.value = c.dataset.p;
      currentPair = c.dataset.p;
      connect(currentPair);
      refreshTopPick();
    }));
  } catch (e) {
    el.innerText = "top indisponible (réseau) — reste sur " + currentPair.toUpperCase();
  }
}
setInterval(refreshTopPick, 30000);
refreshTopPick();

// 🚀 init
connect(currentPair);
highlightRiskCard();