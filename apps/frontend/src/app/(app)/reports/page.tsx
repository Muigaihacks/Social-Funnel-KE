import { getJson } from "@/lib/dashboard-api";

type WeeklyListResponse = {
  ok: boolean;
  items?: Array<{
    id: string;
    weekStart: string;
    weekEnd: string;
    metrics: Record<string, unknown>;
    commentary: string | null;
    createdAt: string;
  }>;
};

function formatWeek(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function WeeklyReportsPage() {
  let items: WeeklyListResponse["items"] = [];
  let error: string | null = null;

  try {
    const res = await getJson<WeeklyListResponse>("/api/v1/automation/weekly-reports?limit=52");
    if (res.ok && res.items) items = res.items;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load reports";
  }

  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-white md:text-3xl">Weekly Report</h1>
        <p className="mt-3 text-sm text-white/55">
          S10 posts snapshots with{" "}
          <code className="rounded bg-white/10 px-1 text-xs">POST /automation/weekly-reports</code> + header{" "}
          <code className="rounded bg-white/10 px-1 text-xs">x-internal-secret</code> (when{" "}
          <code className="rounded bg-white/10 px-1 text-xs">INTERNAL_AUTOMATION_SECRET</code> is set). History here
          powers week-over-week comparisons.
        </p>

        {error ? (
          <div className="mt-8 rounded-2xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-sm text-sf-off">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-sf-navy-deep/30 px-6 py-12 text-center text-white/45">
            No saved weeks yet. After the first S10 ingest, rows appear newest-first.
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-white/10 bg-sf-navy-deep/40 px-4 py-4 md:px-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-white">
                    Week of {formatWeek(row.weekStart)} — {formatWeek(row.weekEnd)}
                  </span>
                  <span className="text-xs text-white/40">{new Date(row.createdAt).toLocaleString("en-KE")}</span>
                </div>
                {row.commentary ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-white/70">{row.commentary}</p>
                ) : (
                  <p className="mt-3 text-xs text-white/35">No commentary stored for this week.</p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-sf-teal hover:underline">Metrics JSON</summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-white/60">
                    {JSON.stringify(row.metrics, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
