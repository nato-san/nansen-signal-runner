#!/usr/bin/env python3
"""
Nansen Meridian Runner Game data PoC.

Reads the API key only from NANSEN_API_KEY and writes JSON/CSV outputs.
No UI, no game runtime, no embedded secrets.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


BASE_URL = "https://api.nansen.ai"
BUY_USD = 10.0
DEFAULT_CHAINS = ["solana", "base", "ethereum", "bnb"]


@dataclass(frozen=True)
class TokenRef:
    chain: str
    address: str
    symbol: str
    gate_date: str
    screener: dict[str, Any]


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def iso_day(d: date, end: bool = False) -> str:
    suffix = "23:59:59Z" if end else "00:00:00Z"
    return f"{d.isoformat()}T{suffix}"


class NansenClient:
    def __init__(self, api_key: str, sleep_s: float = 0.12) -> None:
        self.api_key = api_key
        self.sleep_s = sleep_s
        self.calls: list[dict[str, Any]] = []

    def post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{BASE_URL}{path}"
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "apikey": self.api_key,
            },
            method="POST",
        )
        for attempt in range(1, 4):
            started = time.time()
            try:
                with urllib.request.urlopen(req, timeout=90) as response:
                    raw = response.read().decode("utf-8")
                    headers = dict(response.headers.items())
                    elapsed_ms = int((time.time() - started) * 1000)
                    self.calls.append(
                        {
                            "path": path,
                            "status": response.status,
                            "credits_cost": headers.get("X-Nansen-Credits-Cost"),
                            "credits_used": headers.get("X-Nansen-Credits-Used"),
                            "credits_remaining": headers.get("X-Nansen-Credits-Remaining"),
                            "elapsed_ms": elapsed_ms,
                        }
                    )
                    time.sleep(self.sleep_s)
                    return json.loads(raw)
            except urllib.error.HTTPError as exc:
                raw = exc.read().decode("utf-8", errors="replace")
                if (exc.code == 429 or exc.code >= 500) and attempt < 3:
                    print(
                        f"[retry] HTTP {exc.code} {path} attempt={attempt + 1}/3",
                        file=sys.stderr,
                        flush=True,
                    )
                    time.sleep(attempt * 3)
                    continue
                raise RuntimeError(f"Nansen API error {exc.code} for {path}: {raw}") from exc
            except (socket.timeout, TimeoutError, urllib.error.URLError) as exc:
                if attempt == 3:
                    raise RuntimeError(f"Nansen request timed out after 3 attempts for {path}") from exc
                print(f"[retry] {path} attempt={attempt + 1}/3", file=sys.stderr, flush=True)
                time.sleep(attempt * 2)
        raise RuntimeError(f"Nansen request failed for {path}")


def historical_screener(
    client: NansenClient,
    gate_date: date,
    trader_type: str,
    chains: list[str],
    per_page: int,
) -> list[dict[str, Any]]:
    print(f"[screener] gate={gate_date.isoformat()} trader_type={trader_type}", file=sys.stderr, flush=True)
    payload = {
        "to_date": gate_date.isoformat(),
        "timeframe_days": 3,
        "chains": chains,
        "exclude_sectors": ["Stablecoin"],
        "trader_type": trader_type,
        "filters": {
            "liquidity_usd": {"min": 100000},
            "volume_usd": {"min": 50000},
            "market_cap_usd": {"min": 1000000},
        },
        "pagination": {"page": 1, "per_page": per_page},
        "order_by": [{"field": "netflow", "direction": "DESC"}],
        "apply_blacklist_filter": True,
    }
    return client.post("/api/v1beta1/token-screener/historical", payload).get("data", [])


def historical_ohlcv(
    client: NansenClient,
    token: TokenRef,
    from_date: date,
    as_of_date: date,
) -> list[dict[str, Any]]:
    print(
        f"[ohlcv] {token.chain}:{token.symbol} gate={from_date.isoformat()} goal={as_of_date.isoformat()}",
        file=sys.stderr,
        flush=True,
    )
    payload = {
        "chain": token.chain,
        "token_address": token.address,
        "date_from": from_date.isoformat(),
        "as_of_date": as_of_date.isoformat(),
        "timeframe": "1d",
        "apply_blacklist_filter": True,
    }
    return client.post("/api/v1beta1/tgm/historical-token-ohlcv", payload).get("data", [])


def flow_summary(client: NansenClient, token: TokenRef, gate_date: date) -> dict[str, Any]:
    print(f"[flows] {token.chain}:{token.symbol} gate={gate_date.isoformat()}", file=sys.stderr, flush=True)
    payload = {
        "chain": token.chain,
        "token_address": token.address,
        "date_range": {
            "from": iso_day(gate_date - timedelta(days=2)),
            "to": iso_day(gate_date, end=True),
        },
        "apply_blacklist_filter": True,
    }
    data = client.post("/api/v1beta1/tgm/historical-token-flow-summary", payload).get("data", [])
    return data[0] if data else {}


def pick_price(candles: list[dict[str, Any]], target: date) -> float | None:
    target_prefix = target.isoformat()
    selected = None
    for candle in candles:
        if str(candle.get("interval_start", "")).startswith(target_prefix):
            selected = candle
    if not selected:
        for candle in reversed(candles):
            try:
                candle_date = parse_date(str(candle.get("interval_start", ""))[:10])
            except ValueError:
                continue
            if candle_date <= target:
                selected = candle
                break
    close = selected.get("close") if selected else None
    return float(close) if close is not None else None


def net(value: Any) -> float:
    return float(value or 0)


def signal_tags(flow: dict[str, Any], screener: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    sm = net(flow.get("smart_trader_net_flow_usd") or screener.get("netflow"))
    whale = net(flow.get("whale_net_flow_usd"))
    exchange = net(flow.get("exchange_net_flow_usd"))
    if sm > 0:
        tags.append("SMART_MONEY_BUY")
    elif sm < 0:
        tags.append("SMART_MONEY_SELL")
    if whale > 0:
        tags.append("WHALE_BUY")
    elif whale < 0:
        tags.append("WHALE_SELL")
    if exchange > 0:
        tags.append("EXCHANGE_INFLOW_SELL_PRESSURE")
    elif exchange < 0:
        tags.append("EXCHANGE_OUTFLOW_ACCUMULATION")
    if sm > 0 and exchange > 0:
        tags.append("CONFLICT_SM_BUY_EXCHANGE_INFLOW")
    if whale > 0 and sm < 0:
        tags.append("CONFLICT_WHALE_BUY_SM_SELL")
    return tags


def drama_type(tags: list[str], roi: float, screener: dict[str, Any]) -> str:
    strong_signal = any(t in tags for t in ("SMART_MONEY_BUY", "WHALE_BUY"))
    all_bearish = (
        "SMART_MONEY_SELL" in tags
        and "WHALE_SELL" in tags
        and "EXCHANGE_OUTFLOW_ACCUMULATION" in tags
    )
    weak_signal = not strong_signal and abs(net(screener.get("netflow"))) < 10_000
    conflict = any(t.startswith("CONFLICT_") for t in tags)
    if conflict and roi > 0.08:
        return "D_WIN"
    if conflict and roi < -0.08:
        return "D_LOSE"
    if all_bearish and roi < -0.25:
        return "PANIC_CRASH"
    if strong_signal and roi > 0.08:
        return "A"
    if strong_signal and roi < -0.08:
        return "B"
    if weak_signal and roi > 0.25:
        return "C"
    return "OTHER"


def dedupe_candidates(rows_by_gate: dict[str, list[TokenRef]]) -> list[TokenRef]:
    seen: set[tuple[str, str]] = set()
    result: list[TokenRef] = []
    for tokens in rows_by_gate.values():
        for token in tokens:
            key = (token.chain, token.address.lower())
            if key not in seen:
                seen.add(key)
                result.append(token)
    return result


def build_candidates(
    client: NansenClient,
    gate_dates: list[date],
    chains: list[str],
    per_page: int,
    trader_types: list[str],
    checkpoint_dir: Path | None = None,
) -> list[TokenRef]:
    by_gate: dict[str, list[TokenRef]] = {}
    if checkpoint_dir is not None:
        checkpoint_path = checkpoint_dir / "nansen_runner_discovery.json"
        if checkpoint_path.exists():
            checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
            for row in checkpoint.get("rows", []):
                token = TokenRef(
                    chain=str(row["chain"]),
                    address=str(row["token_address"]),
                    symbol=str(row["token_symbol"]),
                    gate_date=str(row["gate_date"]),
                    screener=dict(row.get("screener") or {}),
                )
                by_gate.setdefault(token.gate_date, []).append(token)
            if by_gate:
                print(
                    f"[resume] loaded {len(dedupe_candidates(by_gate))} saved candidates",
                    file=sys.stderr,
                    flush=True,
                )
    for gate in gate_dates:
        rows: list[TokenRef] = []
        for trader_type in trader_types:
            for row in historical_screener(client, gate, trader_type, chains, per_page):
                address = row.get("token_address")
                chain = row.get("chain")
                if not address or chain not in {"solana", "base", "ethereum", "bnb"}:
                    continue
                rows.append(
                    TokenRef(
                        chain=chain,
                        address=str(address),
                        symbol=str(row.get("token_symbol") or ""),
                        gate_date=gate.isoformat(),
                        screener={**row, "source_trader_type": trader_type},
                    )
                )
        by_gate[gate.isoformat()] = rows
        if checkpoint_dir is not None:
            write_discovery_outputs(checkpoint_dir, dedupe_candidates(by_gate), client)
            print(
                f"[checkpoint] saved through {gate.isoformat()}",
                file=sys.stderr,
                flush=True,
            )
    return dedupe_candidates(by_gate)


def select_gates(evaluated: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chosen: list[dict[str, Any]] = []
    used_keys: set[tuple[str, str]] = set()
    for target in ("PANIC_CRASH", "D_WIN", "D_LOSE", "A", "B", "C"):
        for row in evaluated:
            key = (row["chain"], row["token_address"].lower())
            if row["drama_type"] == target and key not in used_keys:
                chosen.append(row)
                used_keys.add(key)
                break
    for row in sorted(evaluated, key=lambda r: abs(r["roi"]), reverse=True):
        if len(chosen) >= 5:
            break
        key = (row["chain"], row["token_address"].lower())
        if key not in used_keys:
            chosen.append(row)
            used_keys.add(key)
    return chosen[:5]


def interestingness_score(token: TokenRef) -> float:
    s = token.screener
    symbol = token.symbol.upper()
    score = 0.0
    score += min(abs(net(s.get("price_change"))) * 120.0, 80.0)
    score += min(abs(net(s.get("netflow"))) / 100_000.0, 50.0)
    score += min(net(s.get("volume")) / 1_000_000.0, 40.0)
    score += min(net(s.get("buy_volume")) / 1_000_000.0, 25.0)
    score += min(net(s.get("sell_volume")) / 1_000_000.0, 20.0)
    score += min(net(s.get("nof_traders")) / 10.0, 25.0)

    boring_fragments = (
        "USD",
        "USDC",
        "USDT",
        "WETH",
        "WEETH",
        "WBTC",
        "CBETH",
        "WSTETH",
        "JUPSOL",
        "CBBTC",
    )
    if any(fragment in symbol for fragment in boring_fragments):
        score -= 35.0
    if len(symbol) <= 5:
        score += 8.0
    if any(fragment in symbol for fragment in ("PEPE", "PUMP", "TRUMP", "FART", "DOG", "CAT", "BONK")):
        score += 30.0
    if token.screener.get("source_trader_type") in {"sm", "whale"}:
        score += 12.0
    return score


def ranked_candidates(candidates: list[TokenRef]) -> list[TokenRef]:
    return sorted(candidates, key=interestingness_score, reverse=True)


def write_discovery_outputs(out_dir: Path, candidates: list[TokenRef], client: NansenClient) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for token in ranked_candidates(candidates):
        rows.append(
            {
                "gate_date": token.gate_date,
                "chain": token.chain,
                "token_symbol": token.symbol,
                "token_address": token.address,
                "interestingness_score": interestingness_score(token),
                "source_trader_type": token.screener.get("source_trader_type"),
                "price_usd": token.screener.get("price_usd"),
                "price_change": token.screener.get("price_change"),
                "netflow": token.screener.get("netflow"),
                "volume": token.screener.get("volume"),
                "buy_volume": token.screener.get("buy_volume"),
                "sell_volume": token.screener.get("sell_volume"),
                "nof_traders": token.screener.get("nof_traders"),
                "liquidity": token.screener.get("liquidity"),
                "market_cap_usd": token.screener.get("market_cap_usd"),
                "fdv": token.screener.get("fdv"),
                "screener": token.screener,
            }
        )
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "discover",
        "rows": rows,
        "api_call_summary": client.calls,
        "note": "Discovery uses only historical token screener data. It intentionally does not call OHLCV or flow-summary endpoints.",
    }
    (out_dir / "nansen_runner_discovery.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    with (out_dir / "nansen_runner_discovery.csv").open("w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "rank",
            "gate_date",
            "chain",
            "token_symbol",
            "token_address",
            "interestingness_score",
            "source_trader_type",
            "price_usd",
            "price_change",
            "netflow",
            "volume",
            "buy_volume",
            "sell_volume",
            "nof_traders",
            "liquidity",
            "market_cap_usd",
            "fdv",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rank, row in enumerate(rows, start=1):
            out_row = {field: row.get(field) for field in fieldnames}
            out_row["rank"] = rank
            writer.writerow(out_row)


def load_discovery_candidates(path: Path, limit: int, symbols: list[str] | None = None) -> list[TokenRef]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    wanted = {symbol.upper() for symbol in symbols or []}
    tokens: list[TokenRef] = []
    for row in payload.get("rows", []):
        if wanted and str(row.get("token_symbol", "")).upper() not in wanted:
            continue
        tokens.append(
            TokenRef(
                chain=str(row["chain"]),
                address=str(row["token_address"]),
                symbol=str(row["token_symbol"]),
                gate_date=str(row["gate_date"]),
                screener=dict(row.get("screener") or {}),
            )
        )
        if len(tokens) >= limit:
            break
    return tokens


def assess_kill_criteria(rows: list[dict[str, Any]]) -> dict[str, Any]:
    types = {row["drama_type"] for row in rows}
    rois = [row["roi"] for row in rows]
    all_positive = all(roi > 0 for roi in rois)
    all_negative = all(roi < 0 for roi in rois)
    useful_types = {"A", "B", "C", "D_WIN", "D_LOSE", "PANIC_CRASH"}
    has_noise = len(types.intersection(useful_types)) >= 3
    has_meme_moment = any(row.get("token_symbol") in {"CYBERLEEK", "TRUMP", "ANTFUN", "FARTCOIN", "DOPAMEME", "PUMP"} for row in rows)
    return {
        "decision": "GO" if has_noise and has_meme_moment and not (all_positive or all_negative) else "NO-GO",
        "covered_drama_types": sorted(types),
        "reason": "動画化できるドラマが3種類以上あり、meme/異物感のあるTokenも含む" if has_noise and has_meme_moment else "ドラマ類型またはmeme性が不足",
        "all_positive": all_positive,
        "all_negative": all_negative,
        "has_meme_moment": has_meme_moment,
    }


def write_outputs(out_dir: Path, result: dict[str, Any]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "nansen_runner_poc_result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    with (out_dir / "nansen_runner_gates.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "gate_no",
                "drama_type",
                "gate_date",
                "chain",
                "token_symbol",
                "token_address",
                "buy_price_usd",
                "goal_price_usd",
                "goal_value_usd",
                "roi",
                "signals",
            ],
        )
        writer.writeheader()
        for i, row in enumerate(result["selected_gates"], start=1):
            writer.writerow(
                {
                    "gate_no": i,
                    "drama_type": row["drama_type"],
                    "gate_date": row["gate_date"],
                    "chain": row["chain"],
                    "token_symbol": row["token_symbol"],
                    "token_address": row["token_address"],
                    "buy_price_usd": row["buy_price_usd"],
                    "goal_price_usd": row["goal_price_usd"],
                    "goal_value_usd": row["goal_value_usd"],
                    "roi": row["roi"],
                    "signals": "|".join(row["signals"]),
                }
            )


def evaluate_candidates(
    client: NansenClient,
    candidates: list[TokenRef],
    goal_date: date,
) -> list[dict[str, Any]]:
    evaluated: list[dict[str, Any]] = []
    for index, token in enumerate(candidates, start=1):
        print(
            f"[evaluate] {index}/{len(candidates)} {token.chain}:{token.symbol}",
            file=sys.stderr,
            flush=True,
        )
        gate_date = parse_date(token.gate_date)
        try:
            candles = historical_ohlcv(client, token, gate_date, goal_date)
            buy_price = pick_price(candles, gate_date)
            goal_price = pick_price(candles, goal_date)
            if not buy_price or not goal_price or buy_price <= 0:
                continue
            flow = flow_summary(client, token, gate_date)
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            continue

        goal_value = BUY_USD * goal_price / buy_price
        roi = (goal_value / BUY_USD) - 1.0
        tags = signal_tags(flow, token.screener)
        evaluated.append(
            {
                "gate_date": token.gate_date,
                "goal_date": goal_date.isoformat(),
                "chain": token.chain,
                "token_symbol": token.symbol,
                "token_address": token.address,
                "buy_price_usd": buy_price,
                "goal_price_usd": goal_price,
                "buy_amount_usd": BUY_USD,
                "goal_value_usd": goal_value,
                "roi": roi,
                "signals": tags,
                "drama_type": drama_type(tags, roi, token.screener),
                "interestingness_score": interestingness_score(token),
                "screener_as_of_gate": token.screener,
                "flow_summary_gate_window": flow,
            }
        )
    return evaluated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["discover", "verify", "full"], default="discover")
    parser.add_argument("--goal-date", default="2026-08-31")
    parser.add_argument("--gate-dates", default="2026-08-25,2026-08-26,2026-08-27,2026-08-28,2026-08-29")
    parser.add_argument("--chains", default=",".join(DEFAULT_CHAINS))
    parser.add_argument("--per-page", type=int, default=20)
    parser.add_argument("--trader-types", default="sm,whale,all")
    parser.add_argument("--max-candidates", type=int, default=10)
    parser.add_argument(
        "--symbols",
        default="",
        help="Comma-separated symbols to verify from discovery output instead of taking the top-ranked rows.",
    )
    parser.add_argument("--discovery-json", default="outputs/nansen_runner_discovery.json")
    parser.add_argument("--yes-spend", action="store_true", help="Actually spend Nansen API credits.")
    parser.add_argument("--estimate-only", action="store_true", help="Print estimated API calls/credits and exit.")
    parser.add_argument("--out-dir", default="outputs")
    args = parser.parse_args()

    goal_date = parse_date(args.goal_date)
    gate_dates = [parse_date(item.strip()) for item in args.gate_dates.split(",") if item.strip()]
    chains = [item.strip() for item in args.chains.split(",") if item.strip()]
    trader_types = [item.strip() for item in args.trader_types.split(",") if item.strip()]
    symbols = [item.strip().upper() for item in args.symbols.split(",") if item.strip()]
    verify_count = min(args.max_candidates, len(symbols)) if symbols else args.max_candidates
    estimated_screener_calls = len(gate_dates) * len(trader_types)
    estimated_eval_calls = verify_count * 2
    if args.mode == "discover":
        estimated_calls = estimated_screener_calls
    elif args.mode == "verify":
        estimated_calls = estimated_eval_calls
    else:
        estimated_calls = estimated_screener_calls + estimated_eval_calls
    estimated_credits = estimated_calls * 5
    estimate = {
        "mode": args.mode,
        "estimated_calls": estimated_calls,
        "estimated_minimum_credits": estimated_credits,
        "screener_calls": estimated_screener_calls if args.mode in {"discover", "full"} else 0,
        "evaluation_calls": estimated_eval_calls if args.mode in {"verify", "full"} else 0,
        "per_page": args.per_page,
        "max_candidates": args.max_candidates,
        "symbols": symbols,
        "trader_types": trader_types,
        "note": "Historical beta endpoint pricing can vary by plan/endpoint; check Nansen dashboard before running.",
    }
    if args.estimate_only or not args.yes_spend:
        print(json.dumps(estimate, ensure_ascii=False, indent=2))
        if not args.yes_spend:
            print("Add --yes-spend to actually call the Nansen API.", file=sys.stderr)
        return 0

    api_key = os.environ.get("NANSEN_API_KEY")
    if not api_key:
        print("NANSEN_API_KEY is not set. Export it in the shell environment and rerun.", file=sys.stderr)
        return 2

    client = NansenClient(api_key)

    if args.mode in {"discover", "full"}:
        candidates = build_candidates(
            client,
            gate_dates,
            chains,
            args.per_page,
            trader_types,
            Path(args.out_dir),
        )
        print(f"[candidates] {len(candidates)} unique tokens found", file=sys.stderr, flush=True)
        write_discovery_outputs(Path(args.out_dir), candidates, client)
        print(f"[discovery] wrote {args.out_dir}/nansen_runner_discovery.csv", file=sys.stderr, flush=True)
        if args.mode == "discover":
            print(json.dumps({"mode": "discover", "candidates": len(candidates)}, ensure_ascii=False, indent=2))
            return 0
        candidates = ranked_candidates(candidates)[: args.max_candidates]
    else:
        candidates = load_discovery_candidates(Path(args.discovery_json), args.max_candidates, symbols)
        if symbols:
            found = {token.symbol.upper() for token in candidates}
            missing = [symbol for symbol in symbols if symbol not in found]
            if missing:
                print(
                    f"Symbols not found in discovery data: {', '.join(missing)}",
                    file=sys.stderr,
                )

    print(f"[candidates] verifying {len(candidates)} tokens", file=sys.stderr, flush=True)
    evaluated = evaluate_candidates(client, candidates, goal_date)

    selected = select_gates(evaluated)
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "goal_date": goal_date.isoformat(),
        "gate_dates": [d.isoformat() for d in gate_dates],
        "official_endpoints_used": [
            "POST /api/v1beta1/token-screener/historical",
            "POST /api/v1beta1/tgm/historical-token-ohlcv",
            "POST /api/v1beta1/tgm/historical-token-flow-summary",
        ],
        "selected_gates": selected,
        "evaluated_candidates": evaluated,
        "kill_criteria": assess_kill_criteria(selected),
        "api_call_summary": client.calls,
    }
    write_outputs(Path(args.out_dir), result)
    print(json.dumps(result["kill_criteria"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
