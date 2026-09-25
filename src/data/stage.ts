export type Token = {
  symbol: string;
  chain: "solana" | "ethereum" | "base";
  address: string;
  buyPriceUsd: number;
  goalPriceUsd: number;
  goalValueUsd: number;
  roi: number;
  sceneType: "D_WIN" | "D_LOSE" | "PANIC_CRASH";
  signals: string[];
};

export type Gate = {
  date: string;
  left: Token;
  right: Token;
  featuredSymbol: string;
  featuredSignals: string[];
};

function discoveredToken(
  symbol: string,
  chain: Token["chain"],
  address: string,
  buyPriceUsd: number,
  signals: string[],
  sceneType: Token["sceneType"] = "D_WIN"
): Token {
  return {
    symbol,
    chain,
    address,
    buyPriceUsd,
    goalPriceUsd: buyPriceUsd,
    goalValueUsd: 10,
    roi: 0,
    sceneType,
    signals
  };
}

const tokens: Record<string, Token> = {
  VVV: discoveredToken(
    "VVV",
    "base",
    "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf",
    17.1972767698716,
    ["SMART_MONEY_BUY", "PRICE_MOMENTUM_UP"]
  ),
  CYBERLEEK: {
    symbol: "CYBERLEEK",
    chain: "solana",
    address: "ApZuxdpzMrbEYTGEzeY9afh5pj9d6qPRJCTgQYiipbKg",
    buyPriceUsd: 0.014478633192711386,
    goalPriceUsd: 0.002774472602492125,
    goalValueUsd: 1.9162531197273565,
    roi: -0.8083746880272644,
    sceneType: "PANIC_CRASH",
    signals: ["MARKET_NETFLOW_POSITIVE", "PRICE_MOMENTUM_UP"]
  },
  ZEC: discoveredToken(
    "ZEC",
    "solana",
    "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    783.6760894609039,
    ["MARKET_NETFLOW_POSITIVE", "PRICE_MOMENTUM_DOWN"],
    "D_LOSE"
  ),
  PUMP: {
    symbol: "PUMP",
    chain: "solana",
    address: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
    buyPriceUsd: 0.004883464488994915,
    goalPriceUsd: 0.004458989855147397,
    goalValueUsd: 9.130792012916059,
    roi: -0.08692079870839409,
    sceneType: "D_LOSE",
    signals: ["SMART_MONEY_BUY", "WHALE_BUY", "EXCHANGE_INFLOW_SELL_PRESSURE"]
  },
  LINK: discoveredToken(
    "LINK",
    "ethereum",
    "0x514910771af9ca656af840dff83e8264ecf986ca",
    11.7743377182574,
    ["MARKET_NETFLOW_POSITIVE", "PRICE_MOMENTUM_UP"]
  ),
  FONE: discoveredToken(
    "FONE",
    "solana",
    "CTPoyCwkjMvoJwU4xvZZqoD8tiYk6yDchySiN5gGpump",
    0.005295860498611846,
    ["SMART_MONEY_BUY"]
  ),
  GIVE: discoveredToken(
    "GIVE",
    "ethereum",
    "0x95669a6589a81a6704bab1020722d0c405841885",
    0.0224577204575634,
    ["SMART_MONEY_BUY", "PRICE_MOMENTUM_UP"]
  ),
  BOME: {
    symbol: "BOME",
    chain: "solana",
    address: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",
    buyPriceUsd: 0.0010150485147259248,
    goalPriceUsd: 0.0008802522860039371,
    goalValueUsd: 8.672021812096496,
    roi: -0.13279781879035046,
    sceneType: "D_LOSE",
    signals: ["SMART_MONEY_BUY", "WHALE_SELL", "EXCHANGE_OUTFLOW_ACCUMULATION"]
  },
  UNI: {
    symbol: "UNI",
    chain: "ethereum",
    address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    buyPriceUsd: 4.680893162426809,
    goalPriceUsd: 5.20662047619721,
    goalValueUsd: 11.123134614544027,
    roi: 0.11231346145440257,
    sceneType: "D_WIN",
    signals: ["SMART_MONEY_BUY", "EXCHANGE_INFLOW_SELL_PRESSURE"]
  },
  ANTFUN: {
    symbol: "ANTFUN",
    chain: "solana",
    address: "CWZ6BsdnjkDVTGkmL6bGbJXXig6ceef12KvyGQW14cMt",
    buyPriceUsd: 0.052389912659656805,
    goalPriceUsd: 0.057714152933428756,
    goalValueUsd: 11.01627202709042,
    roi: 0.10162720270904191,
    sceneType: "D_WIN",
    signals: ["SMART_MONEY_BUY", "WHALE_BUY", "EXCHANGE_INFLOW_SELL_PRESSURE"]
  }
};

export let stage = {
  goalDate: "2026-08-31",
  source: "Nansen API historical screener and backtesting PoC",
  gates: [
    { date: "2026-08-25", left: tokens.VVV, right: tokens.CYBERLEEK, featuredSymbol: "VVV", featuredSignals: tokens.VVV.signals },
    { date: "2026-08-26", left: tokens.ZEC, right: tokens.PUMP, featuredSymbol: "PUMP", featuredSignals: tokens.PUMP.signals },
    { date: "2026-08-27", left: tokens.LINK, right: tokens.FONE, featuredSymbol: "FONE", featuredSignals: tokens.FONE.signals },
    { date: "2026-08-28", left: tokens.GIVE, right: tokens.BOME, featuredSymbol: "BOME", featuredSignals: tokens.BOME.signals },
    { date: "2026-08-29", left: tokens.UNI, right: tokens.ANTFUN, featuredSymbol: "ANTFUN", featuredSignals: tokens.ANTFUN.signals }
  ] satisfies Gate[]
};

export function setStage(nextStage: typeof stage): void {
  stage = nextStage;
}
