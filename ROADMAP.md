# Buildathon Roadmap

Deadline: September 27, 2026 at 23:59 UTC (September 28 at 08:59 JST)

## Completed

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

## Before Publishing

- [ ] Playtest repeated runs on desktop and mobile widths.
- [x] Verify candidate diversity and date spread across at least 20 generated stages.
- [ ] Improve the fallback screen and API error messaging.
- [ ] Review all public files for secrets and private local paths.
- [x] Run the complete test and production build checks.

## Publishing

- [ ] Push the reviewed commit history to the public GitHub repository.
- [ ] Adapt the Node endpoint for Vercel serverless deployment.
- [ ] Configure `NANSEN_API_KEY` only in Vercel environment variables.
- [ ] Deploy and verify the public end-to-end demo.
- [ ] Confirm that the browser bundle and public repository contain no API key.

## Submission

- [ ] Record a 30-60 second screen demo showing historical signals and live valuation.
- [ ] Publish the demo on X with `@nansen_ai` and the GitHub URL.
- [ ] Submit the Email, X post URL, and GitHub repository URL through the official form.
