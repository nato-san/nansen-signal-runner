import Phaser from "phaser";
import "./style.css";
import { setStage, stage, type Gate, type Token } from "./data/stage";
import { GameState } from "./game/GameState";
import { RunnerScene } from "./game/RunnerScene";

const shell = document.querySelector<HTMLElement>("#game-shell")!;
const intro = document.querySelector<HTMLElement>("#intro")!;
const signalPanel = document.querySelector<HTMLElement>("#signal-panel")!;
const signalList = document.querySelector<HTMLElement>("#signal-list")!;
const signalDate = document.querySelector<HTMLElement>("#signal-date")!;
const choicePanel = document.querySelector<HTMLElement>("#choice-panel")!;
const leftButton = document.querySelector<HTMLButtonElement>("#choice-left")!;
const rightButton = document.querySelector<HTMLButtonElement>("#choice-right")!;
const timer = document.querySelector<HTMLElement>("#timer")!;
const progress = document.querySelector<HTMLElement>("#gate-progress")!;
const reveal = document.querySelector<HTMLElement>("#reveal")!;
const revealList = document.querySelector<HTMLElement>("#reveal-list")!;
const portfolioTotal = document.querySelector<HTMLElement>("#portfolio-total")!;
const startButton = document.querySelector<HTMLButtonElement>("#start-button")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart-button")!;
const languageEn = document.querySelector<HTMLButtonElement>("#lang-en")!;
const languageJa = document.querySelector<HTMLButtonElement>("#lang-ja")!;
const asOfBanner = document.querySelector<HTMLElement>("#as-of-banner")!;
const asOfLabel = document.querySelector<HTMLElement>("#as-of-label")!;
const asOfDate = document.querySelector<HTMLElement>("#as-of-date")!;
const liveStatus = document.querySelector<HTMLElement>("#live-status")!;
const fallbackActions = document.querySelector<HTMLElement>("#fallback-actions")!;
const fallbackTitle = document.querySelector<HTMLElement>("#fallback-title")!;
const fallbackBody = document.querySelector<HTMLElement>("#fallback-body")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry-button")!;
const fallbackButton = document.querySelector<HTMLButtonElement>("#fallback-button")!;

type Locale = "en" | "ja";
type ValuationMode = "live" | "fallback";
type PriceSnapshot = {
  mode: ValuationMode;
  asOf: string;
  prices: Record<string, number>;
  cacheHit: boolean;
  creditsUsed: number;
};

const copy = {
  en: {
    languageLabel: "Language",
    signalKicker: "NANSEN HISTORICAL SIGNAL",
    pointInTime: "POINT-IN-TIME",
    choiceLabel: "Choose a token",
    left: "LEFT",
    right: "RIGHT",
    buy: "BUY $10",
    gate: "GATE",
    goal: "GOAL",
    dataAsOf: "DATA AS OF",
    valuationDate: "VALUATION DATE",
    liveValuation: "LIVE NANSEN PRICE",
    fallbackValuation: "HISTORICAL FALLBACK",
    introEyebrow: "REAL DATA. BAD DECISIONS.",
    introBody: "Read the signal. Pick a token. Do not ask what happens next.",
    start: "START RUN",
    connecting: "CONNECTING TO NANSEN...",
    liveReady: "LIVE PRICES LOCKED",
    cacheReady: "LIVE PRICES LOCKED · CACHE HIT",
    fallbackReady: "LIVE PRICE UNAVAILABLE · HISTORICAL DEMO",
    fallbackTitle: "LIVE PRICE CHECK FAILED",
    fallbackBody: "This run has not started. Retry Nansen or continue with a clearly labeled historical demo.",
    retry: "RETRY LIVE PRICE",
    continueFallback: "PLAY HISTORICAL DEMO",
    liveHint: "3 API calls max · 10 minute server cache",
    controls: "Arrow keys or tap a gate",
    revealKicker: "GOAL / AUG 31",
    revealHeading: "LET'S SEE WHAT YOU BOUGHT.",
    portfolio: "PORTFOLIO",
    bossCounter: "BOSS COUNTERATTACK",
    bossTrouble: "BOSS IN TROUBLE",
    market: "THE MARKET",
    restart: "RUN IT BACK",
    dataStamp: "POINT-IN-TIME DATA VIA NANSEN API"
  },
  ja: {
    languageLabel: "言語",
    signalKicker: "NANSEN 過去シグナル",
    pointInTime: "当時点データ",
    choiceLabel: "トークンを選択",
    left: "左",
    right: "右",
    buy: "$10 購入",
    gate: "ゲート",
    goal: "ゴール",
    dataAsOf: "データ基準日",
    valuationDate: "評価日",
    liveValuation: "NANSEN ライブ価格",
    fallbackValuation: "過去価格フォールバック",
    introEyebrow: "実データ。最悪の判断。",
    introBody: "シグナルを読め。トークンを選べ。その先は聞くな。",
    start: "走り出す",
    connecting: "NANSENに接続中...",
    liveReady: "ライブ価格を固定しました",
    cacheReady: "ライブ価格を固定 · キャッシュ使用",
    fallbackReady: "ライブ価格を取得できません · 過去デモ",
    fallbackTitle: "ライブ価格を確認できません",
    fallbackBody: "ゲームはまだ始まっていません。Nansenへの接続を再試行するか、過去価格デモとして続けてください。",
    retry: "ライブ価格を再試行",
    continueFallback: "過去価格デモで続ける",
    liveHint: "最大3 API calls · サーバーで10分キャッシュ",
    controls: "矢印キー、またはゲートをタップ",
    revealKicker: "ゴール / 8月31日",
    revealHeading: "買ったものを見てみよう。",
    portfolio: "ポートフォリオ",
    bossCounter: "ボスの反撃",
    bossTrouble: "ボス大ピンチ",
    market: "マーケット",
    restart: "もう一度走る",
    dataStamp: "NANSEN API 当時点データ"
  }
} as const;

const savedLocale = window.localStorage.getItem("nansen-runner-locale");
let locale: Locale = savedLocale === "en" || savedLocale === "ja"
  ? savedLocale
  : navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";

const state = new GameState();
let gateIndex = 0;
let acceptingInput = false;
let countdownHandle = 0;
let valuationSnapshot: PriceSnapshot = createFallbackSnapshot();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-canvas",
  backgroundColor: "#090a0c",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  render: { antialias: true, pixelArt: false },
  scene: [RunnerScene]
});

const getScene = (): RunnerScene => game.scene.getScene("runner") as RunnerScene;

function formatSignal(signal: string): string {
  if (locale === "ja") {
    const labels: Record<string, string> = {
      SMART_MONEY_BUY: "スマートマネー 買い",
      SMART_MONEY_SELL: "スマートマネー 売り",
      WHALE_BUY: "クジラ 買い",
      WHALE_SELL: "クジラ 売り",
      EXCHANGE_INFLOW_SELL_PRESSURE: "取引所へ流入",
      EXCHANGE_OUTFLOW_ACCUMULATION: "取引所から流出",
      MARKET_NETFLOW_POSITIVE: "市場ネットフロー プラス",
      PRICE_MOMENTUM_UP: "価格モメンタム 上昇",
      PRICE_MOMENTUM_DOWN: "価格モメンタム 低下",
      MARKET_NETFLOW_NEGATIVE: "市場ネットフロー マイナス"
    };
    return labels[signal] ?? signal.replaceAll("_", " ");
  }
  return signal
    .replace("SMART_MONEY", "SMART MONEY")
    .replace("EXCHANGE_INFLOW_SELL_PRESSURE", "EXCHANGE INFLOW")
    .replace("EXCHANGE_OUTFLOW_ACCUMULATION", "EXCHANGE OUTFLOW")
    .replaceAll("_", " ");
}

function setChoice(button: HTMLButtonElement, token: Token): void {
  button.querySelector<HTMLElement>(".choice-symbol")!.textContent = token.symbol;
  button.querySelector<HTMLElement>(".choice-price")!.textContent = `${copy[locale].buy}  /  $${formatPrice(token.buyPriceUsd)}`;
  button.dataset.scene = token.sceneType;
  button.classList.toggle("long-symbol", token.symbol.length > 7);
}

function formatPrice(value: number): string {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.1) return value.toFixed(3);
  return value.toFixed(4);
}

function formatDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  if (locale === "ja") return `${year}年${month}月${day}日`;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[month - 1]} ${day}, ${year}`;
}

function formatValuationTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  const datePart = locale === "ja"
    ? `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
    : formatDate(date.toISOString());
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
  return `${datePart} · ${time}`;
}

function renderDateBanner(date: string, mode: "signal" | "live" | "fallback"): void {
  asOfLabel.textContent = mode === "signal"
    ? copy[locale].dataAsOf
    : mode === "live" ? copy[locale].liveValuation : copy[locale].fallbackValuation;
  asOfDate.textContent = mode === "signal" ? formatDate(date) : formatValuationTimestamp(date);
  asOfBanner.classList.remove("is-hidden");
}

function createFallbackSnapshot(): PriceSnapshot {
  const prices: Record<string, number> = {};
  for (const gate of stage.gates) {
    prices[gate.left.symbol] = gate.left.goalPriceUsd;
    prices[gate.right.symbol] = gate.right.goalPriceUsd;
  }
  return {
    mode: "fallback",
    asOf: `${stage.goalDate}T00:00:00Z`,
    prices,
    cacheHit: false,
    creditsUsed: 0
  };
}

function tokenValuation(token: Token): { price: number; value: number; roi: number } {
  const price = valuationSnapshot.prices[token.symbol] ?? token.goalPriceUsd;
  const value = token.buyPriceUsd > 0 ? 10 * price / token.buyPriceUsd : 0;
  return { price, value, roi: value / 10 - 1 };
}

function portfolioValuation(): { value: number; rate: number } {
  const value = state.selections.reduce((sum, pick) => sum + tokenValuation(pick.token).value, 0);
  return { value, rate: state.invested > 0 ? value / state.invested - 1 : 0 };
}

function showGate(gate: Gate): void {
  renderGateCopy(gate);
  signalPanel.classList.remove("is-hidden");
  choicePanel.classList.add("is-hidden");
  getScene().setGateLabels(gate.left.symbol, gate.right.symbol);

  window.setTimeout(() => {
    signalPanel.classList.add("is-hidden");
    choicePanel.classList.remove("is-hidden");
    startCountdown();
  }, 1450);
}

function createSignalItem(signal: string): HTMLElement {
  const item = document.createElement("div");
    item.className = signal.includes("SELL") || signal.includes("INFLOW") || signal.includes("DOWN") || signal.includes("NEGATIVE")
      ? "signal danger"
      : "signal positive";
  item.textContent = formatSignal(signal);
  return item;
}

function renderGateCopy(gate: Gate): void {
  renderDateBanner(gate.date, "signal");
  progress.textContent = `${copy[locale].gate} ${gateIndex + 1} / ${stage.gates.length}`;
  const context = gate.featuredContext;
  const traderLabel = context
    ? context.traderType === "sm" ? "SMART MONEY" : context.traderType === "whale" ? "WHALE" : "ALL TRADERS"
    : copy[locale].pointInTime;
  const metrics = context
    ? `NETFLOW ${formatCompactUsd(context.netflowUsd)} / PRICE ${formatSignedPercent(context.priceChangePercent)}`
    : copy[locale].pointInTime;
  signalDate.textContent = `${gate.date} / ${gate.featuredSymbol} / ${traderLabel} / ${metrics}`;
  signalList.replaceChildren(...gate.featuredSignals.slice(0, 3).map((signal) => {
    return createSignalItem(signal);
  }));
  setChoice(leftButton, gate.left);
  setChoice(rightButton, gate.right);
}

function formatCompactUsd(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(value))}`;
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function startCountdown(): void {
  acceptingInput = true;
  let remaining = 3;
  timer.textContent = String(remaining);
  window.clearInterval(countdownHandle);
  countdownHandle = window.setInterval(() => {
    remaining -= 1;
    timer.textContent = remaining > 0 ? String(remaining) : "!";
    if (remaining <= 0) {
      window.clearInterval(countdownHandle);
      choose(Math.random() < 0.5 ? "left" : "right");
    }
  }, 700);
}

function choose(side: "left" | "right"): void {
  if (!acceptingInput) return;
  acceptingInput = false;
  window.clearInterval(countdownHandle);
  const gate = stage.gates[gateIndex];
  const pick = state.choose(gate, side);
  choicePanel.classList.add("is-hidden");
  getScene().runThrough(side, tokenValuation(pick.token).roi, () => {
    gateIndex += 1;
    if (gateIndex < stage.gates.length) showGate(stage.gates[gateIndex]);
    else beginReveal();
  });
}

function beginReveal(): void {
  progress.textContent = copy[locale].goal;
  renderDateBanner(valuationSnapshot.asOf, valuationSnapshot.mode);
  document.querySelector<HTMLElement>("#reveal-kicker")!.textContent = valuationSnapshot.mode === "live"
    ? copy[locale].liveValuation
    : copy[locale].fallbackValuation;
  revealList.replaceChildren();
  portfolioTotal.classList.add("is-hidden");
  restartButton.classList.add("is-hidden");
  reveal.classList.remove("is-boss");
  reveal.classList.remove("is-hidden");
  let index = 0;

  const revealNext = () => {
    const pick = state.selections[index];
    const valuation = tokenValuation(pick.token);
    const row = document.createElement("div");
    row.className = `reveal-row ${valuation.roi >= 0 ? "win" : "loss"}`;
    row.innerHTML = `
      <span class="reveal-token">${pick.token.symbol}</span>
      <span class="reveal-money">$10.00 <b>→</b> $${valuation.value.toFixed(2)}</span>
      <strong>${valuation.roi >= 0 ? "+" : ""}${(valuation.roi * 100).toFixed(1)}%</strong>
    `;
    revealList.append(row);
    window.setTimeout(() => row.classList.add("is-visible"), 20);
    index += 1;
    if (index < state.selections.length) window.setTimeout(revealNext, 620);
    else window.setTimeout(showTotal, 760);
  };

  window.setTimeout(revealNext, 420);
}

function showTotal(): void {
  const { value, rate } = portfolioValuation();
  portfolioTotal.innerHTML = `
    <span>${copy[locale].portfolio}</span>
    <strong>$${state.invested.toFixed(0)} → $${value.toFixed(2)}</strong>
    <em>${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(1)}%</em>
    <small>${rate < 0 ? copy[locale].bossCounter : copy[locale].bossTrouble}</small>
  `;
  portfolioTotal.classList.remove("is-hidden");
  shell.dataset.outcome = rate < 0 ? "loss" : "win";
  window.setTimeout(() => {
    reveal.classList.add("is-boss");
    getScene().bossFinish(rate, copy[locale].market);
  }, 1100);
  window.setTimeout(() => restartButton.classList.remove("is-hidden"), 2450);
}

function applyLocale(nextLocale: Locale): void {
  locale = nextLocale;
  const text = copy[locale];
  window.localStorage.setItem("nansen-runner-locale", locale);
  document.documentElement.lang = locale;
  document.querySelector<HTMLElement>(".language-switch")!.setAttribute("aria-label", text.languageLabel);
  languageEn.setAttribute("aria-pressed", String(locale === "en"));
  languageJa.setAttribute("aria-pressed", String(locale === "ja"));
  document.querySelector<HTMLElement>("#signal-kicker")!.textContent = text.signalKicker;
  choicePanel.setAttribute("aria-label", text.choiceLabel);
  document.querySelector<HTMLElement>("#direction-left")!.textContent = text.left;
  document.querySelector<HTMLElement>("#direction-right")!.textContent = text.right;
  document.querySelector<HTMLElement>("#intro-eyebrow")!.textContent = text.introEyebrow;
  document.querySelector<HTMLElement>("#intro-body")!.textContent = text.introBody;
  startButton.textContent = text.start;
  document.querySelector<HTMLElement>("#controls-hint")!.textContent = text.controls;
  document.querySelector<HTMLElement>("#reveal-kicker")!.textContent = text.revealKicker;
  document.querySelector<HTMLElement>("#reveal-heading")!.textContent = text.revealHeading;
  restartButton.textContent = text.restart;
  fallbackTitle.textContent = text.fallbackTitle;
  fallbackBody.textContent = text.fallbackBody;
  retryButton.textContent = text.retry;
  fallbackButton.textContent = text.continueFallback;
  const showingFallbackPrompt = !fallbackActions.classList.contains("is-hidden");
  if (showingFallbackPrompt) {
    liveStatus.className = "live-status fallback";
    liveStatus.textContent = text.fallbackReady;
  }
  document.querySelector<HTMLElement>("#data-stamp")!.textContent = showingFallbackPrompt
    ? text.fallbackReady
    : intro.classList.contains("is-hidden")
    ? valuationSnapshot.mode === "live"
      ? valuationSnapshot.cacheHit ? text.cacheReady : text.liveReady
      : text.fallbackReady
    : text.dataStamp;

  if (!reveal.classList.contains("is-hidden")) {
    progress.textContent = text.goal;
    renderDateBanner(valuationSnapshot.asOf, valuationSnapshot.mode);
    document.querySelector<HTMLElement>("#reveal-kicker")!.textContent = valuationSnapshot.mode === "live"
      ? text.liveValuation
      : text.fallbackValuation;
    if (!portfolioTotal.classList.contains("is-hidden")) showTotalCopyOnly();
  } else if (intro.classList.contains("is-hidden")) {
    renderGateCopy(stage.gates[gateIndex]);
  } else {
    progress.textContent = `${text.gate} 1 / ${stage.gates.length}`;
    asOfBanner.classList.add("is-hidden");
  }
  if (game.scene.isActive("runner")) getScene().setBossLabel(text.market);
}

function showTotalCopyOnly(): void {
  const { value, rate } = portfolioValuation();
  portfolioTotal.innerHTML = `
    <span>${copy[locale].portfolio}</span>
    <strong>$${state.invested.toFixed(0)} → $${value.toFixed(2)}</strong>
    <em>${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(1)}%</em>
    <small>${rate < 0 ? copy[locale].bossCounter : copy[locale].bossTrouble}</small>
  `;
}

function startRun(): void {
  state.reset();
  gateIndex = 0;
  delete shell.dataset.outcome;
  intro.classList.add("is-hidden");
  reveal.classList.add("is-hidden");
  showGate(stage.gates[0]);
}

async function loadValuationSnapshot(): Promise<boolean> {
  fallbackActions.classList.add("is-hidden");
  startButton.classList.remove("is-hidden");
  startButton.disabled = true;
  retryButton.disabled = true;
  startButton.textContent = copy[locale].connecting;
  liveStatus.className = "live-status loading";
  liveStatus.textContent = copy[locale].liveHint;
  try {
    const response = await fetch("/api/run-data", { headers: { Accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok || payload.mode !== "live") throw new Error(payload.message || "Live prices unavailable");
    const stages = Array.isArray(payload.stages) && payload.stages.length ? payload.stages : [payload.stage];
    setStage(stages[Math.floor(Math.random() * stages.length)]);
    valuationSnapshot = {
      mode: "live",
      asOf: payload.asOf,
      prices: payload.prices,
      cacheHit: Boolean(payload.cacheHit),
      creditsUsed: Number(payload.creditsUsed || 0)
    };
    liveStatus.className = "live-status live";
    liveStatus.textContent = valuationSnapshot.cacheHit ? copy[locale].cacheReady : `${copy[locale].liveReady} · ${valuationSnapshot.creditsUsed} CREDITS`;
    document.querySelector<HTMLElement>("#data-stamp")!.textContent = valuationSnapshot.cacheHit
      ? copy[locale].cacheReady
      : copy[locale].liveReady;
    return true;
  } catch {
    valuationSnapshot = createFallbackSnapshot();
    startButton.classList.add("is-hidden");
    liveStatus.className = "live-status fallback";
    liveStatus.textContent = copy[locale].fallbackReady;
    document.querySelector<HTMLElement>("#data-stamp")!.textContent = copy[locale].fallbackReady;
    fallbackActions.classList.remove("is-hidden");
    return false;
  } finally {
    startButton.disabled = false;
    retryButton.disabled = false;
    startButton.textContent = copy[locale].start;
  }
}

async function prepareAndStart(): Promise<void> {
  if (await loadValuationSnapshot()) window.setTimeout(startRun, 900);
}

function startHistoricalFallback(): void {
  valuationSnapshot = createFallbackSnapshot();
  fallbackActions.classList.add("is-hidden");
  liveStatus.className = "live-status fallback";
  liveStatus.textContent = copy[locale].fallbackReady;
  document.querySelector<HTMLElement>("#data-stamp")!.textContent = copy[locale].fallbackReady;
  window.setTimeout(startRun, 100);
}

async function restart(): Promise<void> {
  getScene().resetWorld();
  reveal.classList.add("is-hidden");
  intro.classList.remove("is-hidden");
  if (await loadValuationSnapshot()) window.setTimeout(startRun, 100);
}

leftButton.addEventListener("click", () => choose("left"));
rightButton.addEventListener("click", () => choose("right"));
startButton.addEventListener("click", prepareAndStart);
restartButton.addEventListener("click", () => void restart());
retryButton.addEventListener("click", () => void prepareAndStart());
fallbackButton.addEventListener("click", startHistoricalFallback);
languageEn.addEventListener("click", () => applyLocale("en"));
languageJa.addEventListener("click", () => applyLocale("ja"));
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") choose("left");
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") choose("right");
});

applyLocale(locale);
