# Buildathon Roadmap / Buildathonロードマップ

**Deadline / 締切:** September 27, 2026 at 23:59 UTC / 2026年9月28日 08:59 JST

## Completed / 完了済み

- [x] Build a playable five-gate runner prototype. / 5ゲートのプレイ可能なRunnerプロトタイプを構築する。
- [x] Generate stages from point-in-time Nansen historical screener data. / 当時のNansen Historical Screenerデータからステージを生成する。
- [x] Evaluate every $10 choice with current Nansen OHLCV prices. / 各10ドルの選択をNansenの現在OHLCV価格で評価する。
- [x] Keep the Nansen API key on the server and outside Git. / Nansen APIキーをサーバー側で管理し、Gitの外に置く。
- [x] Add Japanese and English UI. / 日本語・英語UIを追加する。
- [x] Expand the candidate set across multiple historical dates and chains. / 複数の過去日付とチェーンへ候補を拡張する。
- [x] Require five distinct purchase dates and ten distinct tokens per run. / 1回のプレイで異なる5つの購入日と10種類のトークンを必須にする。
- [x] Show signal provenance, netflow, and price momentum at each gate. / 各ゲートでシグナルの出典、ネットフロー、価格モメンタムを表示する。
- [x] Skip tokens without a recent live price instead of failing the whole run. / 最新価格がないトークンだけを除外し、ゲーム全体の失敗を防ぐ。
- [x] Add automated tests for core stage-generation rules. / ステージ生成の主要ルールへ自動テストを追加する。
- [x] Verify replay diversity across 100 generated stages. / 生成した100ステージでリプレイの多様性を検証する。
- [x] Add a rolling 183-day historical snapshot library. / 直近183日間の過去スナップショットライブラリを追加する。
- [x] Add a read-only `/admin` dataset health dashboard. / 読み取り専用の`/admin`データセット状況画面を追加する。
- [x] Verify live Nansen valuation end to end in the local game. / ローカルゲームでNansenライブ評価を一連で検証する。

## Before Publishing / 公開前

- [x] Playtest repeated runs on desktop and mobile widths. / デスクトップ幅とモバイル幅で繰り返しプレイテストする。
- [x] Verify candidate diversity and date spread across at least 20 generated stages. / 20以上の生成ステージで候補の多様性と日付の広がりを検証する。
- [ ] Improve the fallback screen and API error messaging. / フォールバック画面とAPIエラー表示を改善する。
- [x] Review all public files for secrets and private local paths. / すべての公開ファイルに秘密情報やローカルの個人パスがないか確認する。
- [x] Run the complete test and production build checks. / 全テストと本番ビルド確認を実行する。

## Publishing / 公開

- [x] Push the reviewed commit history to the public GitHub repository. / 確認済みのコミット履歴を公開GitHubリポジトリへ反映する。
- [x] Adapt the Node endpoint for Vercel serverless deployment. / NodeエンドポイントをVercelのサーバーレス構成へ対応させる。
- [x] Configure `NANSEN_API_KEY` only in Vercel environment variables. / `NANSEN_API_KEY`をVercel環境変数だけに設定する。
- [x] Deploy and verify the public end-to-end demo. / 公開デモをデプロイし、一連の動作を検証する。
- [x] Confirm that the browser bundle and public repository contain no API key. / ブラウザバンドルと公開リポジトリにAPIキーが含まれないことを確認する。

## Submission / 提出

- [ ] Record a 30-60 second screen demo showing historical signals and live valuation. / 過去シグナルとライブ評価が分かる30〜60秒の画面収録を作る。
- [ ] Publish the demo on X with `@nansen_ai` and the GitHub URL. / `@nansen_ai`とGitHub URLを含めてデモをXへ投稿する。
- [ ] Submit the email address, X post URL, and GitHub repository URL through the official form. / メールアドレス、X投稿URL、GitHubリポジトリURLを公式フォームから提出する。
