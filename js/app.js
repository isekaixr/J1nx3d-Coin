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

// 🚀 init
connect(currentPair);