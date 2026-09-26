# Buildathon Roadmap

## English

**Deadline:** September 27, 2026 at 23:59 UTC (September 28 at 08:59 JST)

### Completed

- [x] Build a playable five-gate runner prototype.
- [x] Generate stages from point-in-time Nansen historical screener data.
- [x] Evaluate every $10 choice with current Nansen OHLCV prices.
- [x] Keep the Nansen API key on the server and outside Git.
- [x] Add Japanese and English UI.
- [x] Expand the candidate set across multiple historical dates and chains.
- [x] Require five distinct purchase dates and ten distinct tokens per run.
- [x] Show signal provenance, netflow, and price momentum at each gate.
- [x] Skip tokens without a recent live price instead of failing the whole run.
- [x] Add automated tests for core stage-generation rules.
- [x] Verify replay diversity across 100 generated stages.
- [x] Add a rolling 183-day historical snapshot library.
- [x] Add a read-only `/admin` dataset health dashboard.
- [x] Verify live Nansen valuation end to end in the local game.

### Before Publishing

- [x] Playtest repeated runs on desktop and mobile widths.
- [x] Verify candidate diversity and date spread across at least 20 generated stages.
- [x] Improve the fallback screen and API error messaging.
- [x] Review all public files for secrets and private local paths.
- [x] Run the complete test and production build checks.

### Publishing

- [x] Push the reviewed commit history to the public GitHub repository.
- [x] Adapt the Node endpoint for Vercel serverless deployment.
- [x] Configure `NANSEN_API_KEY` only in Vercel environment variables.
- [x] Deploy and verify the public end-to-end demo.
- [x] Confirm that the browser bundle and public repository contain no API key.

### Submission

- [ ] Record a 30-60 second screen demo showing historical signals and live valuation.
- [ ] Publish the demo on X with `@nansen_ai` and the GitHub URL.
- [ ] Submit the email address, X post URL, and GitHub repository URL through the official form.

---

## 日本語

**締切:** 2026年9月28日 08:59 JST（2026年9月27日 23:59 UTC）

### 完了済み

- [x] 5ゲートのプレイ可能なRunnerプロトタイプを構築する。
- [x] 当時のNansen Historical Screenerデータからステージを生成する。
- [x] 各10ドルの選択をNansenの現在OHLCV価格で評価する。
- [x] Nansen APIキーをサーバー側で管理し、Gitの外に置く。
- [x] 日本語・英語UIを追加する。
- [x] 複数の過去日付とチェーンへ候補を拡張する。
- [x] 1回のプレイで異なる5つの購入日と10種類のトークンを必須にする。
- [x] 各ゲートでシグナルの出典、ネットフロー、価格モメンタムを表示する。
- [x] 最新価格がないトークンだけを除外し、ゲーム全体の失敗を防ぐ。
- [x] ステージ生成の主要ルールへ自動テストを追加する。
- [x] 生成した100ステージでリプレイの多様性を検証する。
- [x] 直近183日間の過去スナップショットライブラリを追加する。
- [x] 読み取り専用の`/admin`データセット状況画面を追加する。
- [x] ローカルゲームでNansenライブ評価を一連で検証する。

### 公開前

- [x] デスクトップ幅とモバイル幅で繰り返しプレイテストする。
- [x] 20以上の生成ステージで候補の多様性と日付の広がりを検証する。
- [x] フォールバック画面とAPIエラー表示を改善する。
- [x] すべての公開ファイルに秘密情報やローカルの個人パスがないか確認する。
- [x] 全テストと本番ビルド確認を実行する。

### 公開

- [x] 確認済みのコミット履歴を公開GitHubリポジトリへ反映する。
- [x] NodeエンドポイントをVercelのサーバーレス構成へ対応させる。
- [x] `NANSEN_API_KEY`をVercel環境変数だけに設定する。
- [x] 公開デモをデプロイし、一連の動作を検証する。
- [x] ブラウザバンドルと公開リポジトリにAPIキーが含まれないことを確認する。

### 提出

- [ ] 過去シグナルとライブ評価が分かる30〜60秒の画面収録を作る。
- [ ] `@nansen_ai`とGitHub URLを含めてデモをXへ投稿する。
- [ ] メールアドレス、X投稿URL、GitHubリポジトリURLを公式フォームから提出する。
