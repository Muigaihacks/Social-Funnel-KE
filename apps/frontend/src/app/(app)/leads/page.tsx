import Link from "next/link";
import { getJsonNoStore } from "@/lib/dashboard-api";
import { PIPELINE_STAGES } from "@/lib/pipeline-stages";
import { CHANNELS, CHANNEL_LABELS } from "@/lib/lead-channels";

type LeadsListResponse = {
  ok: boolean;
  total?: number;
  offset?: number;
  limit?: number;
  items?: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string | null;
    email: string | null;
    phone: string;
    source: string | null;
    channel: string;
    leadType: string | null;
    budget: string | null;
    pipelineStage: string;
    leadScore: number | null;
    lastContactDate: string | null;
  }>;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const PAGE_SIZE = 50;

type SearchParams = {
  q?: string;
  stage?: string;
  channel?: string;
  minScore?: string;
  maxScore?: string;
  page?: string;
};

function buildLeadsQuery(sp: SearchParams): string {
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  params.set("offset", String((page - 1) * PAGE_SIZE));

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  if (q) params.set("q", q);
  if (sp.stage && PIPELINE_STAGES.includes(sp.stage as (typeof PIPELINE_STAGES)[number])) {
    params.set("stage", sp.stage);
  }
  if (sp.channel && CHANNELS.includes(sp.channel as (typeof CHANNELS)[number])) {
    params.set("channel", sp.channel);
  }
  const minScore = sp.minScore?.trim();
  const maxScore = sp.maxScore?.trim();
  if (minScore) params.set("minScore", minScore);
  if (maxScore) params.set("maxScore", maxScore);

  return params.toString();
}

function filterQueryString(sp: SearchParams, overrides: Partial<SearchParams> = {}): string {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  const q = typeof merged.q === "string" ? merged.q.trim() : "";
  if (q) params.set("q", q);
  if (merged.stage) params.set("stage", merged.stage);
  if (merged.channel) params.set("channel", merged.channel);
  if (merged.minScore) params.set("minScore", merged.minScore);
  if (merged.maxScore) params.set("maxScore", merged.maxScore);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export default async function LeadProfilesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const stage =
    sp.stage && PIPELINE_STAGES.includes(sp.stage as (typeof PIPELINE_STAGES)[number]) ? sp.stage : "";
  const channel = sp.channel && CHANNELS.includes(sp.channel as (typeof CHANNELS)[number]) ? sp.channel : "";
  const minScore = typeof sp.minScore === "string" ? sp.minScore.trim() : "";
  const maxScore = typeof sp.maxScore === "string" ? sp.maxScore.trim() : "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  let leads: LeadsListResponse["items"] = [];
  let leadsTotal = 0;
  let error: string | null = null;

  try {
    const leadsRes = await getJsonNoStore<LeadsListResponse>(`/api/v1/automation/leads?${buildLeadsQuery(sp)}`);
    if (leadsRes.ok && leadsRes.items) {
      leads = leadsRes.items;
      leadsTotal = leadsRes.total ?? leads.length;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load leads";
  }

  const totalPages = Math.max(1, Math.ceil(leadsTotal / PAGE_SIZE));
  const showingFrom = leadsTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, leadsTotal);

  return (
    <main className="min-h-screen px-4 pb-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 border-b border-[var(--card-border)] pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">Lead Profiles</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                <span className="tabular-nums">{leadsTotal}</span> matching lead{leadsTotal === 1 ? "" : "s"}
                {leadsTotal > 0 ? (
                  <>
                    {" "}
                    · showing <span className="tabular-nums">{showingFrom}</span>–<span className="tabular-nums">{showingTo}</span>
                  </>
                ) : null}
                . Click a name for full profile, history, and messages.
              </p>
            </div>
            <Link
              href="/leads/new"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--sf-teal)] px-5 py-2.5 text-sm font-semibold text-sf-off hover:opacity-90"
            >
              + Add lead
            </Link>
          </div>
        </header>

        <form
          method="get"
          action="/leads"
          className="mb-6 flex flex-col gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="block min-w-[200px] flex-1 text-xs text-[var(--text-dim)]">
            Search (name, email, phone)
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="e.g. 2547… or kara@"
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus:border-sf-teal/50 focus:outline-none"
            />
          </label>
          <label className="block w-full text-xs text-[var(--text-dim)] sm:w-40">
            Stage
            <select
              name="stage"
              defaultValue={stage}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none"
            >
              <option value="">All stages</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block w-full text-xs text-[var(--text-dim)] sm:w-44">
            Channel
            <select
              name="channel"
              defaultValue={channel}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none"
            >
              <option value="">All channels</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block w-full text-xs text-[var(--text-dim)] sm:w-24">
            Min score
            <input
              name="minScore"
              type="number"
              min={1}
              max={10}
              defaultValue={minScore}
              placeholder="1"
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none"
            />
          </label>
          <label className="block w-full text-xs text-[var(--text-dim)] sm:w-24">
            Max score
            <input
              name="maxScore"
              type="number"
              min={1}
              max={10}
              defaultValue={maxScore}
              placeholder="10"
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--sf-teal)] px-4 py-2 text-sm font-semibold text-sf-off hover:opacity-90"
            >
              Apply filters
            </button>
            <Link
              href="/leads"
              className="rounded-full border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--row-bg-hover)]"
            >
              Clear
            </Link>
          </div>
        </form>

        {error ? (
          <div className="rounded-2xl border border-semantic-danger/40 bg-semantic-danger/10 px-4 py-3 text-sm text-sf-off">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)] text-xs uppercase tracking-wider text-[var(--text-dim)]">
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Updated</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Phone</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Email</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Stage</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Score</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Channel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--chart-grid)]">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-dim)]">
                        {q || stage || channel || minScore || maxScore
                          ? "No leads match these filters."
                          : "No leads yet — ingest or add one manually."}
                      </td>
                    </tr>
                  ) : (
                    leads.map((row) => (
                      <tr key={row.id} className="group relative text-[var(--text-soft)] hover:bg-[var(--row-bg-hover)] transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-[var(--text-dim)] tabular-nums text-xs">
                          {formatDate(row.updatedAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-[var(--foreground)] max-w-[160px] truncate">
                          <Link href={`/leads/${row.id}`} className="before:absolute before:inset-0 text-sf-teal group-hover:underline">
                            {row.name ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-xs text-[var(--text-muted)]">
                          {row.phone}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap max-w-[180px] truncate text-[var(--text-muted)]">
                          {row.email ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="rounded-full border border-[var(--card-border)] bg-[var(--row-bg)] px-2.5 py-0.5 text-xs capitalize text-[var(--text-soft)]">
                            {row.pipelineStage.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-[var(--text-muted)]">
                          {row.leadScore ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs capitalize text-[var(--text-dim)]">
                          {row.channel}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && !error ? (
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm" aria-label="Pagination">
            {page > 1 ? (
              <Link
                href={`/leads${filterQueryString(sp, { page: String(page - 1) })}`}
                className="rounded-full border border-[var(--card-border)] px-4 py-2 text-[var(--text-soft)] hover:bg-[var(--row-bg-hover)]"
              >
                ← Previous
              </Link>
            ) : (
              <span className="rounded-full border border-transparent px-4 py-2 text-[var(--text-faint)]">← Previous</span>
            )}
            <span className="tabular-nums text-[var(--text-muted)]">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={`/leads${filterQueryString(sp, { page: String(page + 1) })}`}
                className="rounded-full border border-[var(--card-border)] px-4 py-2 text-[var(--text-soft)] hover:bg-[var(--row-bg-hover)]"
              >
                Next →
              </Link>
            ) : (
              <span className="rounded-full border border-transparent px-4 py-2 text-[var(--text-faint)]">Next →</span>
            )}
          </nav>
        ) : null}

        <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
          Tip: Live Feed animates S1→S2→scored→contacted; this page stays the stable directory.
        </p>
        <p className="mt-2 text-center">
          <Link href="/live-feed" className="text-sm text-sf-teal hover:underline">
            Go to Live Feed →
          </Link>
        </p>
      </div>
    </main>
  );
}
