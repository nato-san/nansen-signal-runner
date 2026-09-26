import "./admin.css";

type AdminStatus = {
  historicalWindow: {
    earliestDate: string | null;
    latestDate: string | null;
    ageDays: number | null;
    stale: boolean;
  };
  generatedAt: string | null;
  inventory: {
    files: number;
    snapshotDates: number;
    eligibleTokens: number;
    chains: string[];
  };
  api: {
    historicalSuccessfulCalls: number;
    livePricingConfigured: boolean;
    historicalEndpoint: string;
    liveEndpoint: string;
  };
};

function setText(id: string, value: string): void {
  document.querySelector<HTMLElement>(`#${id}`)!.textContent = value;
}

function formatDate(value: string | null): string {
  if (!value) return "データなし";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

async function loadStatus(): Promise<void> {
  const banner = document.querySelector<HTMLElement>("#freshness-banner")!;
  try {
    const response = await fetch("/api/admin-status", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("status unavailable");
    const status = await response.json() as AdminStatus;
    const { historicalWindow, inventory, api } = status;

    setText("date-range", `${formatDate(historicalWindow.earliestDate)} - ${formatDate(historicalWindow.latestDate)}`);
    setText("snapshot-dates", `${inventory.snapshotDates}日`);
    setText("eligible-tokens", `${inventory.eligibleTokens}銘柄`);
    setText("data-files", `${inventory.files}件`);
    setText("generated-at", status.generatedAt ? new Date(status.generatedAt).toLocaleString("ja-JP") : "不明");
    setText("chains", inventory.chains.map((chain) => chain.toUpperCase()).join(" / "));
    setText("historical-calls", `${api.historicalSuccessfulCalls} calls`);
    setText("live-pricing", api.livePricingConfigured ? "設定済み" : "未設定（フォールバック）");
    setText("historical-endpoint", api.historicalEndpoint);
    setText("live-endpoint", api.liveEndpoint);

    banner.className = `status-banner ${historicalWindow.stale ? "stale" : "fresh"}`;
    const latestDataDate = formatDate(historicalWindow.latestDate);
    banner.textContent = historicalWindow.stale
      ? `更新推奨：最新データ基準日 ${latestDataDate}（${historicalWindow.ageDays ?? "?"}日前）`
      : `正常：最新データ基準日 ${latestDataDate}（${historicalWindow.ageDays ?? 0}日前）`;
  } catch {
    banner.className = "status-banner stale";
    banner.textContent = "データ状況を取得できません";
  }
}

void loadStatus();
