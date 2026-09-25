# Nansen Signal Runner

> Nansen signals are clues, not the future.

Nansen Signal Runner is a replayable hypercasual game built for the Nansen Meridian Buildathon. Read a point-in-time onchain signal, choose one of two tokens under time pressure, then reveal what each $10 purchase is worth at the latest Nansen price.

Every run changes the purchase dates, tokens, signal focus, and left/right placement. Historical Nansen data generates the stage; live Nansen OHLCV prices determine the result and boss outcome.

## Current Build Status

- End-to-end five-gate gameplay: working
- Live Nansen valuation at run start: verified locally
- Rolling 183-day historical library: implemented
- Read-only dataset status page at `/admin`: working
- Automated Stage Generator and dataset tests: passing
- Public deployment: pending

## How Nansen Drives the Game

Nansen data is part of the game logic, not decorative UI:

1. Historical Token Screener snapshots provide eligible tokens, purchase dates, historical prices, liquidity, market cap, netflow, trader type, and price momentum.
2. The server filters unsafe or unsuitable candidates and builds a multi-date token pool.
3. Five gates are generated from that pool with no duplicate token in a run.
4. The signal shown before each gate comes from the selected token's point-in-time Nansen snapshot.
5. At run start, the server fetches current prices from Nansen Token OHLCV.
6. Each $10 position, portfolio result, runner reaction, and boss outcome is calculated from the historical buy price versus the live Nansen price.

Without Nansen historical data there is no stage, and without Nansen live prices there is no live result.

## Nansen Endpoints

Stage discovery and verification:

- `POST /api/v1beta1/token-screener/historical`
- `POST /api/v1beta1/tgm/historical-token-ohlcv`
- `POST /api/v1beta1/tgm/historical-token-flow-summary`

Live game evaluation:

- `POST /api/v1/tgm/token-ohlcv`

The browser never receives the API key. `server.mjs` reads `NANSEN_API_KEY` and calls Nansen server-side.

## Run Locally

Requirements:

- Node.js 20 or newer
- A Nansen API key

```bash
npm install
npm run build
export NANSEN_API_KEY="your_nansen_api_key"
npm start
```

Open the URL printed in the terminal, normally [http://127.0.0.1:4173](http://127.0.0.1:4173).

Use the left/right arrow keys or tap a token gate. Japanese and English are available from the language control.

The read-only data status page is available at `/admin`. It reports the historical window, candidate inventory, snapshot freshness, recorded historical API calls, and whether live pricing is configured. Dataset updates remain terminal-only; the page has no write controls and never receives the API key.

## Tests

Run the deterministic Stage Generator checks:

```bash
npm test
```

The tests enforce the core replay rules: five distinct historical dates, ten unique tokens, chronological gates, point-in-time signal direction, rolling-window selection, and replay diversity across the bundled Nansen snapshots.

To use another port:

```bash
PORT=4174 npm start
```

Never commit your real API key. `.env` and `.env.local` are ignored by Git.

## Replay And Credit Use

The server loads the included historical discovery datasets and prepares a pool of up to 24 eligible tokens. The first run fetches the pool's current prices in chain-level batches, normally at most three Nansen calls. Prices are cached for ten minutes.

During that cache window, replaying generates a different five-gate stage from the pool without another price call. When the cache expires, a new pool and current-price snapshot are fetched.

If live prices are unavailable, the interface explicitly labels the result as a historical fallback. It never presents fallback data as live.

## Stage Generator

The reproducible data PoC is included at `scripts/nansen_runner_data_poc.py`. It:

- discovers historical candidates across supported chains;
- verifies selected candidates with historical OHLCV and flow summaries;
- classifies useful game drama such as signal-aligned wins, signal reversals, conflicting flows, and crashes;
- estimates API calls before spending credits;
- requires `--yes-spend` before making requests;
- writes checkpoints so completed dates survive a timeout;
- retries transient network, rate-limit, and server errors.

Example dry run:

```bash
python3 scripts/nansen_runner_data_poc.py \
  --mode discover \
  --gate-dates 2026-07-01,2026-07-15,2026-08-12 \
  --trader-types all \
  --chains solana,base,ethereum \
  --per-page 10 \
  --out-dir data/generated
```

Add `--yes-spend` only after reviewing the estimate.

### Administrator Snapshot Refresh

Historical purchase data is a maintained snapshot library, not a per-play API expense. The server recursively loads JSON files under `data/` and automatically limits gameplay to the 183 days ending at the newest available snapshot. Adding a newer file therefore moves the playable window forward; a 2028 refresh can include 2027-2028 purchases without changing the game code.

Preview a six-month refresh at two-week intervals without making API calls:

```bash
python3 scripts/nansen_runner_data_poc.py \
  --mode discover \
  --rolling-days 183 \
  --interval-days 14 \
  --as-of-date 2026-09-25 \
  --trader-types all \
  --chains solana,base,ethereum \
  --per-page 10 \
  --out-dir data/snapshots/2026-09-25
```

Review the estimated calls and credits, then append `--yes-spend` to perform the administrator refresh. Commit the generated snapshot JSON, but never the API key. Future refreshes should use a new dated output directory.

## Look-Ahead Bias

Gate signals and buy prices come only from the historical snapshot assigned to that gate. No data after the gate date is shown before the player chooses. The later price is used only during the final reveal.

The production game evaluates positions against the current Nansen price. Historical verification can instead use a fixed goal date to test whether signals create varied outcomes before a stage is admitted into the game.

## Tech

- Phaser 3
- TypeScript
- Vite
- Node.js server
- Nansen API

## Security

- API keys stay in environment variables.
- No API key is sent to the browser or stored in the repository.
- Live responses are requested server-side.
- Historical datasets contain market data only.

## Disclaimer

This is a game and a historical data experiment, not financial advice.
