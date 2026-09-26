# Nansen Signal Runner

> Nansen signals are clues, not the future.  
> Nansenのシグナルは手がかりであり、未来の答えではありません。

Nansen Signal Runner is a replayable hypercasual game built for the Nansen Meridian Buildathon. Read a point-in-time onchain signal, choose one of two tokens under time pressure, then reveal what each $10 purchase is worth at the latest Nansen price.

Nansen Signal Runnerは、Nansen Meridian Buildathon向けに開発した、繰り返し遊べるハイパーカジュアルゲームです。特定時点のオンチェーンシグナルを読み、制限時間内に2つのトークンから1つを選び、各10ドルの購入がNansenの最新価格でいくらになったかを最後に確認します。

**Live demo / 公開デモ:** [nansen-signal-runner.vercel.app](https://nansen-signal-runner.vercel.app)

**Dataset status / データセット状況:** [nansen-signal-runner.vercel.app/admin](https://nansen-signal-runner.vercel.app/admin)

Every run changes the purchase dates, tokens, signal focus, and left/right placement. Historical Nansen data generates the stage; live Nansen OHLCV prices determine the result and boss outcome.

プレイするたびに購入日、トークン、注目するシグナル、左右の配置が変わります。Nansenの過去データがステージを生成し、NansenのライブOHLCV価格が最終結果とボス戦の勝敗を決めます。

## Current Build Status / 現在の開発状況

- End-to-end five-gate gameplay: working / 5ゲートの一連のゲームプレイ：動作済み
- Live Nansen valuation at run start: verified / ゲーム開始時のNansenライブ価格評価：検証済み
- Rolling 183-day historical library: implemented / 直近183日間の履歴ライブラリ：実装済み
- Read-only dataset status page at `/admin`: working / `/admin`の読み取り専用データ状況ページ：動作済み
- Automated Stage Generator and dataset tests: passing / Stage Generatorとデータセットの自動テスト：合格
- Public Vercel deployment with live Nansen valuation: verified / Nansenライブ価格を使うVercel公開版：検証済み

## How Nansen Drives the Game / Nansenがゲームを動かす仕組み

Nansen data is part of the game logic, not decorative UI:

Nansenデータは単なる画面上の飾りではなく、ゲームロジックそのものに使われます。

1. Historical Token Screener snapshots provide eligible tokens, purchase dates, historical prices, liquidity, market cap, netflow, trader type, and price momentum.  
   Historical Token Screenerのスナップショットから、候補トークン、購入日、過去価格、流動性、時価総額、ネットフロー、トレーダー種別、価格モメンタムを取得します。
2. The server filters unsafe or unsuitable candidates and builds a multi-date token pool.  
   サーバーが安全性やゲーム適性に欠ける候補を除外し、複数日付にまたがるトークンプールを作ります。
3. Five gates are generated from that pool with no duplicate token in a run.  
   そのプールから、1回のプレイ内でトークンが重複しない5つのゲートを生成します。
4. The signal shown before each gate comes from the selected token's point-in-time Nansen snapshot.  
   各ゲート直前のシグナルには、そのトークンの当時のNansenスナップショットだけを使います。
5. At run start, the server fetches current prices from Nansen Token OHLCV.  
   ゲーム開始時に、サーバーがNansen Token OHLCVから現在価格を取得します。
6. Each $10 position, portfolio result, runner reaction, and boss outcome is calculated from the historical buy price versus the live Nansen price.  
   各10ドルのポジション、ポートフォリオ結果、ランナーの反応、ボス戦の勝敗は、過去の購入価格とNansenライブ価格の比較から計算します。

Without Nansen historical data there is no stage, and without Nansen live prices there is no live result.

Nansenの過去データがなければステージは生成できず、Nansenのライブ価格がなければリアルタイムの結果も成立しません。

## Nansen Endpoints / 使用するNansenエンドポイント

Stage discovery and verification / ステージ候補の発見と検証:

- `POST /api/v1beta1/token-screener/historical`
- `POST /api/v1beta1/tgm/historical-token-ohlcv`
- `POST /api/v1beta1/tgm/historical-token-flow-summary`

Live game evaluation / ゲームのライブ評価:

- `POST /api/v1/tgm/token-ohlcv`

The browser never receives the API key. `server.mjs` reads `NANSEN_API_KEY` and calls Nansen server-side.

ブラウザへAPIキーを渡すことはありません。`server.mjs`が`NANSEN_API_KEY`を読み取り、サーバー側からNansen APIを呼び出します。

## Run Locally / ローカルでの起動

Requirements / 必要なもの:

- Node.js 20 or newer / Node.js 20以上
- A Nansen API key / Nansen APIキー

```bash
npm install
npm run build
export NANSEN_API_KEY="your_nansen_api_key"
npm start
```

Open the URL printed in the terminal, normally [http://127.0.0.1:4173](http://127.0.0.1:4173).

ターミナルに表示されたURLを開きます。通常は[http://127.0.0.1:4173](http://127.0.0.1:4173)です。

Use the left/right arrow keys or tap a token gate. Japanese and English are available from the language control.

左右の矢印キー、またはトークンゲートのタップで操作します。言語切り替えから日本語と英語を選択できます。

The read-only data status page is available at `/admin`. It reports the historical window, candidate inventory, snapshot freshness, recorded historical API calls, and whether live pricing is configured. Dataset updates remain terminal-only; the page has no write controls and never receives the API key.

読み取り専用のデータ状況ページは`/admin`です。履歴期間、候補数、スナップショットの更新状況、記録済みの過去APIコール数、ライブ価格設定の有無を確認できます。データセットの更新はターミナルからのみ行い、このページに書き込み機能やAPIキーはありません。

## Tests / テスト

Run the deterministic Stage Generator checks / 再現可能なStage Generatorテストを実行:

```bash
npm test
```

The tests enforce the core replay rules: five distinct historical dates, ten unique tokens, chronological gates, point-in-time signal direction, rolling-window selection, and replay diversity across the bundled Nansen snapshots.

テストでは、異なる5つの購入日、10種類の重複しないトークン、時系列順のゲート、当時のシグナル方向、ローリング期間の選択、同梱されたNansenスナップショットからのリプレイ多様性を検証します。

To use another port / 別のポートを使う場合:

```bash
PORT=4174 npm start
```

Never commit your real API key. `.env` and `.env.local` are ignored by Git.

実際のAPIキーをコミットしないでください。`.env`と`.env.local`はGitの管理対象外です。

## Replay And Credit Use / リプレイとクレジット消費

The server loads the included historical discovery datasets and prepares a pool of up to 24 eligible tokens. The first run fetches the pool's current prices in chain-level batches, normally at most three Nansen calls, and prepares 20 randomized stages from that price snapshot.

サーバーは同梱された過去の探索データセットを読み込み、最大24件の有効なトークンプールを作ります。最初のプレイ時にチェーン単位のバッチで現在価格を取得します。通常は最大3回のNansen APIコールで、その価格スナップショットからランダムな20ステージを準備します。

On Vercel, the price snapshot and stage set are cached at the CDN for ten minutes. Each browser randomly selects one of the 20 stages, so replays can differ without another Nansen price call. Local development also keeps a ten-minute in-memory price cache. When the cache expires, a new pool and current-price snapshot are fetched.

Vercelでは価格スナップショットとステージ一式をCDNに10分間キャッシュします。各ブラウザは20ステージからランダムに1つを選ぶため、Nansen APIを毎回呼び出さなくても異なるプレイを提供できます。ローカル開発でも10分間のメモリキャッシュを使い、期限切れ後に新しいプールと現在価格を取得します。

If live prices are unavailable, the interface explicitly labels the result as a historical fallback. It never presents fallback data as live.

ライブ価格を取得できない場合は、過去データへのフォールバックであることを画面に明示します。フォールバックデータをライブ価格として表示することはありません。

## Stage Generator / ステージ生成

The reproducible data PoC is included at `scripts/nansen_runner_data_poc.py`. It:

再現可能なデータPoCは`scripts/nansen_runner_data_poc.py`にあります。このスクリプトは次を行います。

- Discovers historical candidates across supported chains. / 対応チェーンを横断して過去の候補を探索します。
- Verifies selected candidates with historical OHLCV and flow summaries. / 過去OHLCVとフロー概要で候補を検証します。
- Classifies useful game drama such as signal-aligned wins, signal reversals, conflicting flows, and crashes. / シグナル通りの勝利、シグナルの裏切り、フローの矛盾、暴落などのゲーム向け展開を分類します。
- Estimates API calls before spending credits. / クレジット消費前にAPIコール数を見積もります。
- Requires `--yes-spend` before making requests. / リクエスト実行前に`--yes-spend`を必須とします。
- Writes checkpoints so completed dates survive a timeout. / タイムアウト後も完了済み日付を再利用できるチェックポイントを保存します。
- Retries transient network, rate-limit, and server errors. / 一時的な通信、レート制限、サーバーエラーを再試行します。

Example dry run / APIを呼ばない実行例:

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

見積もりを確認した後にだけ`--yes-spend`を追加してください。

### Administrator Snapshot Refresh / 管理者によるスナップショット更新

Historical purchase data is a maintained snapshot library, not a per-play API expense. The server recursively loads JSON files under `data/` and automatically limits gameplay to the 183 days ending at the newest available snapshot. Adding a newer file therefore moves the playable window forward; a 2028 refresh can include 2027-2028 purchases without changing the game code.

過去の購入データは管理者が保守するスナップショットライブラリであり、プレイごとにAPI費用を発生させません。サーバーは`data/`以下のJSONを再帰的に読み込み、利用可能な最新スナップショットを終点とする183日間にゲーム対象を自動制限します。新しいファイルを追加すればプレイ可能期間も前進するため、ゲームコードを変更せずに、2028年の更新で2027年から2028年の購入日を含められます。

Preview a six-month refresh at two-week intervals without making API calls / APIを呼ばず、2週間間隔の6か月更新をプレビュー:

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

APIコール数とクレジットの見積もりを確認し、`--yes-spend`を追加して管理者更新を実行します。生成されたスナップショットJSONはコミットしますが、APIキーは絶対にコミットしません。次回以降の更新には新しい日付の出力ディレクトリを使います。

## Look-Ahead Bias / 未来情報の混入防止

Gate signals and buy prices come only from the historical snapshot assigned to that gate. No data after the gate date is shown before the player chooses. The later price is used only during the final reveal.

ゲートのシグナルと購入価格には、そのゲートに割り当てられた過去スナップショットだけを使います。プレイヤーが選択する前に、ゲート日より未来のデータを表示しません。後日の価格は最終リザルトでのみ使用します。

The production game evaluates positions against the current Nansen price. Historical verification can instead use a fixed goal date to test whether signals create varied outcomes before a stage is admitted into the game.

本番ゲームではNansenの現在価格でポジションを評価します。過去検証では固定の評価日を使い、シグナルから多様な結果が生まれるかを確認してからステージ候補へ採用できます。

## Tech / 技術構成

- Phaser 3
- TypeScript
- Vite
- Node.js server / Node.jsサーバー
- Nansen API

## Deploy To Vercel / Vercelへのデプロイ

The repository includes Vercel Functions for `/api/run-data` and `/api/admin-status`, plus a rewrite for the multi-page `/admin` route.

このリポジトリには`/api/run-data`と`/api/admin-status`用のVercel Functions、および複数ページ構成の`/admin`ルート用rewrite設定が含まれます。

1. Import the GitHub repository into Vercel. / GitHubリポジトリをVercelへインポートします。
2. Keep the detected framework as Vite, build command as `npm run build`, and output directory as `dist`. / フレームワークはVite、ビルドコマンドは`npm run build`、出力先は`dist`のままにします。
3. Add `NANSEN_API_KEY` as a Production environment variable in Vercel. Do not prefix it with `VITE_`. / VercelのProduction環境変数に`NANSEN_API_KEY`を追加します。`VITE_`を付けないでください。
4. Deploy, then verify `/admin` reports live pricing as configured. / デプロイ後、`/admin`でライブ価格が設定済みと表示されることを確認します。
5. Start one run and confirm the result is labeled as a live Nansen valuation. / ゲームを1回開始し、結果にNansenライブ評価と表示されることを確認します。

`vercel.json` includes the historical JSON library in both serverless functions. Live run payloads use a ten-minute Vercel CDN cache so a warm price snapshot can serve randomized replays without repeatedly spending Nansen credits.

`vercel.json`は、両方のサーバーレス関数に過去JSONライブラリを含めます。ライブ実行データはVercel CDNで10分間キャッシュされるため、キャッシュ済みの価格スナップショットからNansenクレジットを繰り返し消費せずにランダムなリプレイを提供できます。

## Security / セキュリティ

- API keys stay in environment variables. / APIキーは環境変数だけで管理します。
- No API key is sent to the browser or stored in the repository. / APIキーをブラウザへ送信したり、リポジトリへ保存したりしません。
- Live responses are requested server-side. / ライブデータはサーバー側から取得します。
- Historical datasets contain market data only. / 過去データセットには市場データだけを保存します。

## Disclaimer / 免責事項

This is a game and a historical data experiment, not financial advice.

これはゲームおよび過去データを使った実験であり、金融アドバイスではありません。
