import { getJsonNoStore } from "@/lib/dashboard-api";
import { RollingCharts, type AttributionPayload } from "./RollingCharts";

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

function WowTable({
  current,
  previous,
}: {
  current: Record<string, unknown>;
  previous: Record<string, unknown> | null;
}) {
  const keys = [...new Set([...Object.keys(current), ...(previous ? Object.keys(previous) : [])])].sort();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)] text-xs text-[var(--text-muted)]">
            <th className="py-2 pr-4">Metric</th>
            <th className="py-2 pr-4">This week</th>
            <th className="py-2 pr-4">Prior week</th>
            <th className="py-2">Δ</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const a = current[k];
            const b = previous?.[k];
            const na = typeof a === "number" ? a : Number(a);
            const nb = typeof b === "number" ? b : Number(b);
            const bothNum = Number.isFinite(na) && Number.isFinite(nb);
            const delta = bothNum ? na - nb : null;
            return (
              <tr key={k} className="border-b border-[var(--chart-grid)]">
                <td className="py-2 pr-4 font-mono text-xs text-[var(--foreground)]">{k}</td>
                <td className="py-2 pr-4 text-[var(--text-muted)]">{a === undefined ? "—" : String(a)}</td>
                <td className="py-2 pr-4 text-[var(--text-muted)]">{b === undefined ? "—" : String(b)}</td>
                <td className="py-2 tabular-nums text-[var(--foreground)]">
                  {delta === null ? "—" : delta > 0 ? `+${delta}` : String(delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; weekStart?: string }>;
}) {
  const sp = await searchParams;
  const days = Math.min(Math.max(Number(sp.days ?? 30), 7), 365);

  let attribution: AttributionPayload | null = null;
  let attError: string | null = null;
  try {
    const raw = await getJsonNoStore<{ ok: boolean } & Partial<AttributionPayload>>(
      `/api/v1/automation/analytics/attribution?days=${days}`
    );
    if (raw.ok && Array.isArray(raw.leadsByChannel)) {
      attribution = raw as AttributionPayload;
    }
  } catch (e) {
    attError = e instanceof Error ? e.message : "Attribution failed";
  }

  let weekItems: NonNullable<WeeklyListResponse["items"]> = [];
  let weekError: string | null = null;
  try {
    const w = await getJsonNoStore<WeeklyListResponse>("/api/v1/automation/weekly-reports?limit=52");
    if (w.ok && w.items) weekItems = w.items;
  } catch (e) {
    weekError = e instanceof Error ? e.message : "Weekly list failed";
  }

  const sortedWeeks = [...weekItems].sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  const selectedStart = sp.weekStart ?? sortedWeeks[0]?.weekStart;
  const weekIdx = selectedStart
    ? sortedWeeks.findIndex((w) => w.weekStart.slice(0, 10) === selectedStart.slice(0, 10))
    : -1;
  const current = weekIdx >= 0 ? sortedWeeks[weekIdx] : sortedWeeks[0];
  const previous = weekIdx >= 0 && weekIdx + 1 < sortedWeeks.length ? sortedWeeks[weekIdx + 1] : sortedWeeks[1] ?? null;

  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 border-b border-[var(--card-border)] pb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-[var(--sf-teal)] to-emerald-600 text-xs shadow-inner">
              🧠
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--sf-teal)]">
              Acquisition OS Business Intelligence Hub
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Rolling attribution charts feed the same underlying facts as the weekly digest (S10 snapshots).
          </p>
        </header>

        <section aria-labelledby="rolling-heading" className="mb-14">
          <div className="mb-4 flex flex-col gap-3 border-b border-dashed border-[var(--card-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="rolling-heading" className="text-lg font-semibold text-[var(--foreground)]">
                Rolling attribution &amp; quality
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Fixed window (not tied to the selected report week). Default 30 days — adjust below.
              </p>
            </div>
            <form method="get" className="flex flex-wrap items-end gap-2">
              {selectedStart ? <input type="hidden" name="weekStart" value={selectedStart} /> : null}
              <label className="text-xs text-[var(--text-muted)]">
                Days
                <select
                  name="days"
                  defaultValue={String(days)}
                  className="mt-1 block rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)]"
                >
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-full border border-[var(--sf-teal)]/50 bg-[var(--sf-teal)]/15 px-4 py-2 text-xs font-medium text-[var(--sf-teal)]"
              >
                Apply
              </button>
            </form>
          </div>

          {attError ? (
            <div className="rounded-2xl border border-semantic-danger/40 bg-semantic-danger/10 px-4 py-3 text-sm">{attError}</div>
          ) : attribution ? (
            <RollingCharts data={attribution} />
          ) : null}
        </section>

        <section id="weekly-digest" aria-labelledby="weekly-heading" className="scroll-mt-24">
          <div className="mb-4 border-b border-dashed border-[var(--card-border)] pb-4">
            <h2 id="weekly-heading" className="text-lg font-semibold text-[var(--foreground)]">
              Weekly digest (S10 snapshots)
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Stored via <code className="rounded bg-[var(--chart-grid)] px-1">POST /api/v1/automation/weekly-reports</code>.
              Compare metrics to the prior saved week when available.
            </p>
          </div>

          {weekError ? (
            <div className="rounded-2xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-sm">{weekError}</div>
          ) : sortedWeeks.length === 0 ? (
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-6 py-12 text-center text-sm text-[var(--text-muted)]">
              No weekly snapshots yet. After S10 ingests, pick a week here for WoW tables.
            </div>
          ) : (
            <>
              <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
                <input type="hidden" name="days" value={String(days)} />
                <label className="text-xs text-[var(--text-muted)]">
                  Report week
                  <select
                    name="weekStart"
                    defaultValue={current?.weekStart}
                    className="mt-1 block min-w-[14rem] rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  >
                    {sortedWeeks.map((w) => (
                      <option key={w.id} value={w.weekStart}>
                        {formatWeek(w.weekStart)} — {formatWeek(w.weekEnd)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-full border border-[var(--sf-teal)]/50 bg-[var(--sf-teal)]/15 px-4 py-2 text-xs font-medium text-[var(--sf-teal)]"
                >
                  Load week
                </button>
              </form>

              {current ? (
                <div className="space-y-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-medium text-[var(--foreground)]">
                      Week of {formatWeek(current.weekStart)} — {formatWeek(current.weekEnd)}
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">
                      Saved {new Date(current.createdAt).toLocaleString("en-KE")}
                    </span>
                  </div>
                  {current.commentary ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Commentary</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{current.commentary}</p>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Week-over-week (numeric deltas where both weeks define the same key)
                    </p>
                    <div className="mt-3">
                      <WowTable current={current.metrics} previous={previous?.metrics ?? null} />
                    </div>
                  </div>

                  <details>
                    <summary className="cursor-pointer text-xs text-[var(--sf-teal)] hover:underline">Raw metrics JSON</summary>
                    <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-[var(--background)] p-3 text-[11px] text-[var(--text-muted)]">
                      {JSON.stringify(current.metrics, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : null}

              {previous && current ? (
                <div className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)]/80 p-4 md:p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Prior week (comparison baseline)</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {formatWeek(previous.weekStart)} — {formatWeek(previous.weekEnd)}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
