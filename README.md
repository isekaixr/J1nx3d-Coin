# ☩ Nova Terminal — Smart Money

Radar crypto + portefeuille bourse Europe. Le tool te dit **START / STOP / TARGET** en direct,
repère **sur quoi miser** (top 3 + bubble top 7) et suit tes actifs détenus (PRU vs prix actuel).

🌐 **Live : https://isekaixr.github.io/J1nx3d-Coin/**
▶️ **Local :** `npx serve .` puis http://localhost:3000 (pas de build, pas de droits admin).

> Pédagogique uniquement — **pas un conseil financier**. Tu peux tout perdre, commence petit, levier 1.

## 🪙 Crypto live (Binance, gratuit sans clé)

| Bloc | Contenu | Fraîcheur |
|---|---|---|
| 🔥 Sur quoi miser | Top 3 chaudes du spot (score mouvement × volume), clic = charge dans le radar | 30 s |
| 🫧 Bubble map | Top 40 USDT (taille = volume, couleur = perf 24h), ⭐ top 7 + 🔥 top 3, 7j en différé | 60 s |
| 📡 Signal | LONG / SHORT / ATTENDRE + confiance %, START, STOP (−1 ATR), TARGET 1/2, SIZE depuis capital × risque % | 2 s |
| 📈 Chart | Bougies tick live, EMA12/26, RSI14, baleines (gros trades), lignes ENTRY/SL/TP | tick (~0,2–1 s) |
| 🌍 Marché | Fear & Greed, BTC 24h, devises BCE (EUR/USD, GBP, JPY, CHF), baril Brent/WTI, ETF (IBIT, ETHA, CAC40), mèmes 24h/7j (DOGE, SHIB, PEPE, BONK, WIF, FLOKI, PUMP), floors NFT (BAYC, Punks, Pudgy) | 1–30 min selon source |

**Logique du radar :** gros achats répétés → prix monte → prise de profit → ça redescend.
Patterns détectés : 🐋 accumulation, 🐂 pression acheteuse, ⚠️ pump (TP court), 🐻 distribution,
😴 calme. RSI > 70 = suracheté, < 30 = survendu.

**Limites connues :** Yahoo bloque le navigateur (CORS/401) → baril/ETF en seed daté + ✏️ manuel ;
CoinGecko gratuit coupe parfois (429) → message propre. Aucun paiement requis nulle part.

## 🏛️ Bourse — mes actifs (Euronext)

- Ligne = ticker (ex `AIR.PA`) + Qté + 💰 **PRU** (ce que tu as payé, fixe) + 🏷️ **prix actuel**
  (valeur aujourd'hui, éditable) + rendement annuel % pour les projections.
- Par ligne : valeur, P&L vs PRU, SL/TP court (5j) / moyen (20j) / long (50j), projections
  **3a / 6a / 12a** en intérêts composés. Persisté en `localStorage`.
- Exemple : `AIR.PA ×10, PRU 175 €, prix 187,96 € (09/10/2026)` → +129,60 €.

## ⚖️ Risk Management

Panneau détaillé (capital, risque %, levier, sens auto/long/short, RR par horizon 1.5/2/3) +
lignes SL/TP tracées sur le chart. Bourse au comptant : pas de levier, horizon long.

## 🗂️ Structure

```
index.html      → onglets Crypto / Bourse, dashboard, signal, chart
css/style.css   → thème Nova (cartes, bubble, signal)
js/app.js       → WS Binance, signaux, bubble top 7, dashboard (forex, oil, ETF, mèmes, NFT)
js/bourse.js    → portefeuille Europe (Yahoo best-effort + 100 % manuel)
```

## ☩ Devise

Le support change, **Nova demeure** — et Luna avec elle.
