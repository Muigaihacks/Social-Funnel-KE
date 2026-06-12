import type { ReactNode } from "react";
import { getJson } from "@/lib/dashboard-api";

/** API may omit fields until backend is redeployed — normalize after fetch. */
type PipelineStatsApi = {
  totalLeads: number;
  newThisWeek: number;
  followUpsSentThisWeek: number;
  byScore?: { hot: number; warm: number; cold: number };
  byStage?: Record<string, number>;
  averageLeadScore?: number | null;
  noShowsThisWeek?: number;
  workflowHealth?: {
    lastPingAt: string | null;
    lastWorkflowKey: string | null;
    lastStatus: string | null;
    pings24h: number;
    errors24h: number;
  };
};

type PipelineStatsResponse = {
  ok: boolean;
  period?: { from: string; to: string };
  stats?: PipelineStatsApi;
};

const EMPTY_WORKFLOW_HEALTH: NonNullable<PipelineStatsApi["workflowHealth"]> = {
  lastPingAt: null,
  lastWorkflowKey: null,
  lastStatus: null,
  pings24h: 0,
  errors24h: 0,
};

type NormalizedPipelineStats = Omit<
  PipelineStatsApi,
  "byScore" | "byStage" | "averageLeadScore" | "noShowsThisWeek" | "workflowHealth"
> & {
  byStage: Record<string, number>;
  byScore: { hot: number; warm: number; cold: number };
  averageLeadScore: number | null;
  noShowsThisWeek: number;
  workflowHealth: NonNullable<PipelineStatsApi["workflowHealth"]>;
};

function normalizePipelineStats(raw: PipelineStatsApi): NormalizedPipelineStats {
  return {
    ...raw,
    byStage: raw.byStage ?? {},
    byScore: raw.byScore ?? { hot: 0, warm: 0, cold: 0 },
    averageLeadScore: raw.averageLeadScore ?? null,
    noShowsThisWeek: raw.noShowsThisWeek ?? 0,
    workflowHealth: raw.workflowHealth ?? EMPTY_WORKFLOW_HEALTH,
  };
}

type HeartbeatsResponse = {
  ok: boolean;
  items?: Array<{
    id: string;
    workflowKey: string;
    status: string;
    message: string | null;
    createdAt: string;
  }>;
};

const BAR_CLASS: Record<number, string> = {
  0: "bg-sf-sky",
  1: "bg-semantic-info",
  2: "bg-semantic-success",
  3: "bg-semantic-hot",
  4: "bg-sf-teal",
  5: "bg-sf-brand",
  6: "bg-sf-sky/80",
  7: "bg-semantic-warning/90",
};

export default async function OverviewPage() {
  let stats: NormalizedPipelineStats | undefined;
  let byStageEntries: [string, number][] = [];
  let heartbeats: NonNullable<HeartbeatsResponse["items"]> = [];
  let error: string | null = null;

  try {
    const [statsRes, hbRes] = await Promise.all([
      getJson<PipelineStatsResponse>("/api/v1/automation/pipeline-stats"),
      getJson<HeartbeatsResponse>("/api/v1/automation/workflow-heartbeats?limit=10").catch(() => ({
        ok: false as const,
        items: [] as NonNullable<HeartbeatsResponse["items"]>,
      })),
    ]);
    if (statsRes.ok && statsRes.stats) {
      stats = normalizePipelineStats(statsRes.stats);
      byStageEntries = Object.entries(stats.byStage ?? {}).sort((a, b) => b[1] - a[1]);
    }
    if (hbRes.ok && hbRes.items) heartbeats = hbRes.items;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load dashboard";
  }

  const maxStage = Math.max(1, ...byStageEntries.map(([, n]) => n));

  return (
    <main className="min-h-screen px-4 pb-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-1 border-b border-[var(--card-border)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">Command Centre</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Snapshot from the API rolling window (last 7 days for new leads & follow-ups).
            </p>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--sf-teal)]">
            {new Intl.DateTimeFormat("en-KE", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </p>
        </header>

        {error ? (
          <div
            className="rounded-2xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-4 text-sm"
            role="alert"
          >
            <p className="font-medium text-semantic-warning">Backend unreachable or misconfigured</p>
            <p className="mt-2 text-[var(--text-muted)]">
              {error}. Set <code className="rounded bg-[var(--card-surface)] px-1 border border-[var(--card-border)]">NEXT_PUBLIC_API_URL</code> or{" "}
              <code className="rounded bg-[var(--card-surface)] px-1 border border-[var(--card-border)]">BACKEND_URL</code> in{" "}
              <code className="rounded bg-[var(--card-surface)] px-1 border border-[var(--card-border)]">apps/frontend/.env.local</code> if the API is not on{" "}
              <code className="rounded bg-[var(--card-surface)] px-1 border border-[var(--card-border)]">http://127.0.0.1:4000</code>.
            </p>
          </div>
        ) : (
          <>
            {stats && (
              <>
                <section className="mb-8" aria-label="Summary KPIs">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Summary</h2>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Total leads" value={stats.totalLeads} />
                    <StatCard label="New this week" value={stats.newThisWeek} accent="text-sf-teal" />
                    <StatCard label="Follow-ups sent (7d)" value={stats.followUpsSentThisWeek} />
                    <StatCard
                      label="Hot / warm / cold"
                      value={`${stats.byScore.hot} / ${stats.byScore.warm} / ${stats.byScore.cold}`}
                      small
                    />
                  </div>
                </section>

                <section className="mb-10" aria-label="Pipeline pulse">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                    Pipeline pulse
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCard
                      label="Avg lead score"
                      value={stats.averageLeadScore ?? "—"}
                      sub={stats.averageLeadScore == null ? "No scored leads yet" : "1–10, leads with a score"}
                    />
                    <StatCard
                      label="No-shows (7d)"
                      value={stats.noShowsThisWeek}
                      sub={<code className="text-[10px] text-[var(--text-muted)]">activity: no_show</code>}
                    />
                    <WorkflowHealthCard workflow={stats.workflowHealth} />
                  </div>
                </section>
              </>
            )}

            {heartbeats.length > 0 && (
              <section className="mb-10" aria-label="Workflow pings">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                  Latest workflow pings
                </h2>
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                  Rows from <code className="rounded bg-[var(--card-surface)] px-1 border border-[var(--card-border)]">workflow_heartbeats</code>. One HTTP POST per
                  successful (or error) run you wire in n8n — not on a fixed clock. For failures, configure n8n Error
                  Workflow notifications; optionally POST <code className="rounded bg-[var(--card-surface)] px-1 border border-[var(--card-border)]">status: error</code>{" "}
                  here.
                </p>
                <ul className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-3 scrollbar-thin md:p-4">
                  {heartbeats.map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center gap-2 border-b border-[var(--chart-grid)] py-2 last:border-0 last:pb-0"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          h.status === "error" ? "bg-semantic-danger" : "bg-semantic-success"
                        }`}
                        title={h.status}
                      />
                      <span className="font-mono text-xs text-[var(--sf-teal)]">{h.workflowKey}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Intl.DateTimeFormat("en-KE", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        }).format(new Date(h.createdAt))}
                      </span>
                      {h.message ? (
                        <span className="w-full text-xs text-[var(--text-muted)] md:ml-6 md:w-auto">{h.message}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {byStageEntries.length > 0 && (
              <section className="mb-6" aria-label="Pipeline funnel">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                  Pipeline funnel
                </h2>
                <div className="space-y-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-6">
                  {byStageEntries.map(([stage, count], i) => (
                    <div key={stage} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <span className="w-full min-w-[8rem] text-sm font-medium capitalize text-[var(--foreground)] sm:w-40">
                        {stage.replace(/_/g, " ")}
                      </span>
                      <div className="flex flex-1 items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--chart-grid)]">
                          <div
                            className={`h-full rounded-full transition-all ${BAR_CLASS[i % 8] ?? "bg-sf-teal"}`}
                            style={{ width: `${Math.max(8, (count / maxStage) * 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-sm font-semibold text-[var(--foreground)]">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Bars group leads by <code className="rounded bg-[var(--card-surface)] px-1 border border-[var(--card-border)]">pipeline_stage</code> using the exact
                  string stored in the DB. Match those labels in n8n so one real stage doesn’t appear as two bars.
                </p>
              </section>
            )}

            <p className="text-center text-sm text-[var(--text-muted)]">
              Live lead stream, animations, and full lead profiles live under{" "}
              <span className="text-[var(--sf-teal)]">Live Feed</span> and <span className="text-[var(--sf-teal)]">Lead Profiles</span>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  small,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  small?: boolean;
  accent?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-4 shadow-inner backdrop-blur-sm">
      <p className="text-xs text-[var(--text-dim)]">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums text-[var(--foreground)] ${small ? "text-lg" : "text-2xl"} ${accent ?? ""}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs leading-snug text-[var(--text-muted)]">{sub}</p> : null}
    </div>
  );
}

function WorkflowHealthCard({
  workflow,
}: {
  workflow: NonNullable<PipelineStatsApi["workflowHealth"]>;
}) {
  const w = workflow ?? EMPTY_WORKFLOW_HEALTH;
  const hasPing = w.lastPingAt != null;
  const healthy = w.errors24h === 0;
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-4 shadow-inner backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${hasPing ? (healthy ? "bg-semantic-success" : "bg-semantic-warning") : "bg-[var(--text-faint)]"}`}
          title={hasPing ? (healthy ? "No errors in 24h" : "Errors in last 24h") : "No pings yet"}
        />
        <p className="text-xs text-[var(--text-dim)]">Workflow health</p>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
        {hasPing
          ? `${w.pings24h} ping${w.pings24h === 1 ? "" : "s"} · ${w.errors24h} err (24h)`
          : "No heartbeats yet"}
      </p>
      {hasPing ? (
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--text-muted)]">
          Last: {w.lastWorkflowKey ?? "—"} ({w.lastStatus ?? "—"}) ·{" "}
          {new Intl.DateTimeFormat("en-KE", { dateStyle: "short", timeStyle: "short" }).format(
            new Date(w.lastPingAt!)
          )}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--text-muted)]">POST success/error pings from n8n to populate this card.</p>
      )}
    </div>
  );
}
