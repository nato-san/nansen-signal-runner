import assert from "node:assert/strict";
import test from "node:test";

test("serverless runtime builds 20 stages from a mocked live Nansen snapshot", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.NANSEN_API_KEY;
  process.env.NANSEN_API_KEY = "test-only-placeholder";
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    return new Response(JSON.stringify({
      tokens: request.token_addresses.map((tokenAddress, index) => ({
        token_address: tokenAddress,
        data: [{ close: 1 + index / 100 }]
      }))
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "x-nansen-credits-used": "5" }
    });
  };

  try {
    const { getRunData } = await import(`../lib/runtime.mjs?test=${Date.now()}`);
    const result = await getRunData();
    assert.equal(result.mode, "live");
    assert.equal(result.stages.length, 20);
    assert.ok(result.stages.every((stage) => stage.gates.length === 5));
    assert.ok(result.creditsUsed > 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.NANSEN_API_KEY;
    else process.env.NANSEN_API_KEY = originalKey;
  }
});

test("public live-price failures do not expose internal error details", async () => {
  const { getPublicRunError } = await import(`../lib/runtime.mjs?error=${Date.now()}`);
  const payload = getPublicRunError(new Error("secret upstream detail"));
  assert.deepEqual(payload, {
    mode: "unavailable",
    code: "LIVE_PRICE_UNAVAILABLE",
    message: "Live Nansen prices are temporarily unavailable.",
    retryable: true
  });
  assert.doesNotMatch(JSON.stringify(payload), /secret upstream detail/);
});
