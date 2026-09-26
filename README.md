# Nansen Signal Runner

## English

> Nansen signals are clues, not the future.

Nansen Signal Runner is a replayable hypercasual game built for the Nansen Meridian Buildathon. Read a point-in-time onchain signal, choose one of two tokens under time pressure, then reveal what each $10 purchase is worth at the latest Nansen price.

**Live demo:** [nansen-signal-runner.vercel.app](https://nansen-signal-runner.vercel.app)

**Dataset status:** [nansen-signal-runner.vercel.app/admin](https://nansen-signal-runner.vercel.app/admin)

Every run changes the purchase dates, tokens, signal focus, and left/right placement. Historical Nansen data generates the stage; live Nansen OHLCV prices determine the result and boss outcome.

### Current Build Status

- End-to-end five-gate gameplay: working
- Live Nansen valuation at run start: verified
- Rolling 183-day historical library: implemented
- Read-only dataset status page at `/admin`: working
- Automated Stage Generator and dataset tests: passing
- Public Vercel deployment with live Nansen valuation: verified

### How Nansen Drives the Game

Nansen data is part of the game logic, not decorative UI:

1. Historical Token Screener snapshots provide eligible tokens, purchase dates, historical prices, liquidity, market cap, netflow, trader type, and price momentum.
2. The server filters unsafe or unsuitable candidates and builds a multi-date token pool.
3. Five gates are generated from that pool with no duplicate token in a run.
4. The signal shown before each gate comes from the selected token's point-in-time Nansen snapshot.
5. At run start, the server fetches current prices from Nansen Token OHLCV.
6. Each $10 position, portfolio result, runner reaction, and boss outcome is calculated from the historical buy price versus the live Nansen price.

Without Nansen historical data there is no stage, and without Nansen live prices there is no live result.

### Nansen Endpoints

Stage discovery and verification:

- `POST /api/v1beta1/token-screener/historical`
- `POST /api/v1beta1/tgm/historical-token-ohlcv`
- `POST /api/v1beta1/tgm/historical-token-flow-summary`

Live game evaluation:

- `POST /api/v1/tgm/token-ohlcv`

The browser never receives the API key. The server-side runtime reads `NANSEN_API_KEY` and calls Nansen through `server.mjs` locally or Vercel Functions in production.

### Run Locally

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

### Tests

Run the deterministic Stage Generator checks:

```bash
npm test
```

The tests enforce the core replay rules: five distinct historical dates, ten unique tokens, chronological gates, point-in-time signal direction, rolling-window selection, replay diversity, and safe public error responses.

To use another port:

```bash
PORT=4174 npm start
```

Never commit your real API key. `.env` and `.env.local` are ignored by Git.

### Replay And Credit Use

The server loads the included historical discovery datasets and prepares a pool of up to 24 eligible tokens. The first run fetches the pool's current prices in chain-level batches, normally at most three Nansen calls, and prepares 20 randomized stages from that price snapshot.

On Vercel, the price snapshot and stage set are cached at the CDN for ten minutes. Each browser randomly selects one of the 20 stages, so replays can differ without another Nansen price call. Local development also keeps a ten-minute in-memory price cache. When the cache expires, a new pool and current-price snapshot are fetched.

If live prices are unavailable, the game does not start automatically. The player can retry Nansen or explicitly continue with a clearly labeled historical fallback. Internal API errors are never exposed in the public response.

### Stage Generator

The reproducible data PoC is included at `scripts/nansen_runner_data_poc.py`. It:

- discovers historical candidates across supported chains;
- verifies selected candidates with historical OHLCV and flow summaries;
- classifies signal-aligned wins, signal reversals, conflicting flows, and crashes;
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

#### Administrator Snapshot Refresh

Historical purchase data is a maintained snapshot library, not a per-play API expense. The server recursively loads JSON files under `data/` and automatically limits gameplay to the 183 days ending at the newest available snapshot. Adding a newer file moves the playable window forward; a 2028 refresh can include 2027-2028 purchases without changing the game code.

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

### Look-Ahead Bias

Gate signals and buy prices come only from the historical snapshot assigned to that gate. No data after the gate date is shown before the player chooses. The later price is used only during the final reveal.

The production game evaluates positions against the current Nansen price. Historical verification can instead use a fixed goal date to test whether signals create varied outcomes before a stage is admitted into the game.

### Tech

- Phaser 3
- TypeScript
- Vite
- Node.js server
- Nansen API

### Deploy To Vercel

The repository includes Vercel Functions for `/api/run-data` and `/api/admin-status`, plus a rewrite for the multi-page `/admin` route.

1. Import the GitHub repository into Vercel.
2. Keep the detected framework as Vite, build command as `npm run build`, and output directory as `dist`.
3. Add `NANSEN_API_KEY` as a Production environment variable in Vercel. Do not prefix it with `VITE_`.
4. Deploy, then verify `/admin` reports live pricing as configured.
5. Start one run and confirm the result is labeled as a live Nansen valuation.

`vercel.json` includes the historical JSON library in both serverless functions. Live run payloads use a ten-minute Vercel CDN cache so a warm price snapshot can serve randomized replays without repeatedly spending Nansen credits.

### Security

- API keys stay in environment variables.
- No API key is sent to the browser or stored in the repository.
- Live responses are requested server-side.
- Public error responses never include internal upstream details.
- Historical datasets contain market data only.

### Development Disclosure

This project was developed with assistance from ChatGPT and Codex for planning, implementation, testing, and documentation. Product decisions, API credential management, data review, playtesting, and final submission responsibility remain with the project owner.

### Disclaimer

This is a game and a historical data experiment, not financial advice.

---

## 日本語

> Nansenのシグナルは手がかりであり、未来の答えではありません。

Nansen Signal Runnerは、Nansen Meridian Buildathon向けに開発した、繰り返し遊べるハイパーカジュアルゲームです。特定時点のオンチェーンシグナルを読み、制限時間内に2つのトークンから1つを選び、各10ドルの購入がNansenの最新価格でいくらになったかを最後に確認します。

**公開デモ:** [nansen-signal-runner.vercel.app](https://nansen-signal-runner.vercel.app)

**データセット状況:** [nansen-signal-runner.vercel.app/admin](https://nansen-signal-runner.vercel.app/admin)

プレイするたびに購入日、トークン、注目するシグナル、左右の配置が変わります。Nansenの過去データがステージを生成し、NansenのライブOHLCV価格が最終結果とボス戦の勝敗を決めます。

### 現在の開発状況

- 5ゲートの一連のゲームプレイ：動作済み
- ゲーム開始時のNansenライブ価格評価：検証済み
- 直近183日間の履歴ライブラリ：実装済み
- `/admin`の読み取り専用データ状況ページ：動作済み
- Stage Generatorとデータセットの自動テスト：合格
- Nansenライブ価格を使うVercel公開版：検証済み

### Nansenがゲームを動かす仕組み

Nansenデータは単なる画面上の飾りではなく、ゲームロジックそのものに使われます。

1. Historical Token Screenerのスナップショットから、候補トークン、購入日、過去価格、流動性、時価総額、ネットフロー、トレーダー種別、価格モメンタムを取得します。
2. サーバーが安全性やゲーム適性に欠ける候補を除外し、複数日付にまたがるトークンプールを作ります。
3. そのプールから、1回のプレイ内でトークンが重複しない5つのゲートを生成します。
4. 各ゲート直前のシグナルには、そのトークンの当時のNansenスナップショットだけを使います。
5. ゲーム開始時に、サーバーがNansen Token OHLCVから現在価格を取得します。
6. 各10ドルのポジション、ポートフォリオ結果、ランナーの反応、ボス戦の勝敗は、過去の購入価格とNansenライブ価格の比較から計算します。

Nansenの過去データがなければステージは生成できず、Nansenのライブ価格がなければリアルタイムの結果も成立しません。

### 使用するNansenエンドポイント

ステージ候補の発見と検証:

- `POST /api/v1beta1/token-screener/historical`
- `POST /api/v1beta1/tgm/historical-token-ohlcv`
- `POST /api/v1beta1/tgm/historical-token-flow-summary`

ゲームのライブ評価:

- `POST /api/v1/tgm/token-ohlcv`

ブラウザへAPIキーを渡すことはありません。サーバー側ランタイムが`NANSEN_API_KEY`を読み取り、ローカルでは`server.mjs`、本番ではVercel FunctionsからNansen APIを呼び出します。

### ローカルでの起動

必要なもの:

- Node.js 20以上
- Nansen APIキー

```bash
npm install
npm run build
export NANSEN_API_KEY="your_nansen_api_key"
npm start
```

ターミナルに表示されたURLを開きます。通常は[http://127.0.0.1:4173](http://127.0.0.1:4173)です。

左右の矢印キー、またはトークンゲートのタップで操作します。言語切り替えから日本語と英語を選択できます。

読み取り専用のデータ状況ページは`/admin`です。履歴期間、候補数、スナップショットの更新状況、記録済みの過去APIコール数、ライブ価格設定の有無を確認できます。データセットの更新はターミナルからのみ行い、このページに書き込み機能やAPIキーはありません。

### テスト

再現可能なStage Generatorテストを実行します。

```bash
npm test
```

テストでは、異なる5つの購入日、10種類の重複しないトークン、時系列順のゲート、当時のシグナル方向、ローリング期間の選択、リプレイ多様性、安全な公開エラー応答を検証します。

別のポートを使う場合:

```bash
PORT=4174 npm start
```

実際のAPIキーをコミットしないでください。`.env`と`.env.local`はGitの管理対象外です。

### リプレイとクレジット消費

サーバーは同梱された過去の探索データセットを読み込み、最大24件の有効なトークンプールを作ります。最初のプレイ時にチェーン単位のバッチで現在価格を取得します。通常は最大3回のNansen APIコールで、その価格スナップショットからランダムな20ステージを準備します。

Vercelでは価格スナップショットとステージ一式をCDNに10分間キャッシュします。各ブラウザは20ステージからランダムに1つを選ぶため、Nansen APIを毎回呼び出さなくても異なるプレイを提供できます。ローカル開発でも10分間のメモリキャッシュを使い、期限切れ後に新しいプールと現在価格を取得します。

ライブ価格を取得できない場合、ゲームは自動で始まりません。プレイヤーはNansenへの接続を再試行するか、過去価格デモで続けることを明示的に選択します。公開レスポンスに内部APIエラーを含めません。

### ステージ生成

再現可能なデータPoCは`scripts/nansen_runner_data_poc.py`にあります。このスクリプトは次を行います。

- 対応チェーンを横断して過去の候補を探索する
- 過去OHLCVとフロー概要で候補を検証する
- シグナル通りの勝利、シグナルの裏切り、フローの矛盾、暴落を分類する
- クレジット消費前にAPIコール数を見積もる
- リクエスト実行前に`--yes-spend`を必須にする
- タイムアウト後も完了済み日付を再利用できるチェックポイントを保存する
- 一時的な通信、レート制限、サーバーエラーを再試行する

APIを呼ばない実行例:

```bash
python3 scripts/nansen_runner_data_poc.py \
  --mode discover \
  --gate-dates 2026-07-01,2026-07-15,2026-08-12 \
  --trader-types all \
  --chains solana,base,ethereum \
  --per-page 10 \
  --out-dir data/generated
```

見積もりを確認した後にだけ`--yes-spend`を追加してください。

#### 管理者によるスナップショット更新

過去の購入データは管理者が保守するスナップショットライブラリであり、プレイごとにAPI費用を発生させません。サーバーは`data/`以下のJSONを再帰的に読み込み、利用可能な最新スナップショットを終点とする183日間にゲーム対象を自動制限します。新しいファイルを追加すればプレイ可能期間も前進するため、ゲームコードを変更せずに、2028年の更新で2027年から2028年の購入日を含められます。

APIを呼ばず、2週間間隔の6か月更新をプレビューします。

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

APIコール数とクレジットの見積もりを確認し、`--yes-spend`を追加して管理者更新を実行します。生成されたスナップショットJSONはコミットしますが、APIキーは絶対にコミットしません。次回以降の更新には新しい日付の出力ディレクトリを使います。

### 未来情報の混入防止

ゲートのシグナルと購入価格には、そのゲートに割り当てられた過去スナップショットだけを使います。プレイヤーが選択する前に、ゲート日より未来のデータを表示しません。後日の価格は最終リザルトでのみ使用します。

本番ゲームではNansenの現在価格でポジションを評価します。過去検証では固定の評価日を使い、シグナルから多様な結果が生まれるかを確認してからステージ候補へ採用できます。

### 技術構成

- Phaser 3
- TypeScript
- Vite
- Node.jsサーバー
- Nansen API

### Vercelへのデプロイ

このリポジトリには`/api/run-data`と`/api/admin-status`用のVercel Functions、および複数ページ構成の`/admin`ルート用rewrite設定が含まれます。

1. GitHubリポジトリをVercelへインポートします。
2. フレームワークはVite、ビルドコマンドは`npm run build`、出力先は`dist`のままにします。
3. VercelのProduction環境変数に`NANSEN_API_KEY`を追加します。`VITE_`を付けないでください。
4. デプロイ後、`/admin`でライブ価格が設定済みと表示されることを確認します。
5. ゲームを1回開始し、結果にNansenライブ評価と表示されることを確認します。

`vercel.json`は、両方のサーバーレス関数に過去JSONライブラリを含めます。ライブ実行データはVercel CDNで10分間キャッシュされるため、キャッシュ済みの価格スナップショットからNansenクレジットを繰り返し消費せずにランダムなリプレイを提供できます。

### セキュリティ

- APIキーは環境変数だけで管理する
- APIキーをブラウザへ送信したり、リポジトリへ保存したりしない
- ライブデータはサーバー側から取得する
- 公開エラー応答に上流の内部情報を含めない
- 過去データセットには市場データだけを保存する

### 開発情報

このプロジェクトでは、企画、実装、テスト、文書作成の支援にChatGPTおよびCodexを使用しました。製品上の判断、API認証情報の管理、データの確認、プレイテスト、最終提出の責任はプロジェクト所有者が担います。

### 免責事項

これはゲームおよび過去データを使った実験であり、金融アドバイスではありません。
