import Link from "next/link";
import { notFound } from "next/navigation";
import { backendBaseUrl } from "@/lib/backend";
import { LeadPriorityEditor } from "./LeadPriorityEditor";
import { LeadProfileForms } from "./LeadProfileForms";
import { TeamNotesList } from "./TeamNotesList";

export const dynamic = "force-dynamic";

type LeadDetailJson = {
  ok: boolean;
  error?: string;
  lead?: {
    id: string;
    createdAt: string;
    updatedAt: string;
    phone: string;
    name: string | null;
    email: string | null;
    source: string | null;
    channel: string;
    sources: string[];
    leadType: string | null;
    budget: string | null;
    timeline: string | null;
    leadScore: number | null;
    scoreReason: string | null;
    followUpCount: number;
    pipelineStage: string;
    lastContactDate: string | null;
    whatsappOptIn: boolean;
    tenantId: string | null;
  };
  activityLogs?: Array<{ id: string; action: string; payload: unknown; createdAt: string }>;
  messageLogs?: Array<{
    id: string;
    channel: string;
    direction: string;
    body: string | null;
    externalId: string | null;
    sentAt: string;
  }>;
  stageTransitions?: Array<{ id: string; fromStage: string | null; toStage: string; at: string }>;
  followUpQueue?: Array<{
    id: string;
    touchIndex: number;
    channel: string;
    scheduledFor: string;
    sentAt: string | null;
    status: string;
  }>;
  conversationContexts?: Array<{
    id: string;
    createdAt: string;
    summary: string;
    topics: unknown;
    rawExcerpt: string | null;
    channel: string;
    s11Action: string | null;
    externalMessageId: string | null;
  }>;
  latestConversation?: {
    id: string;
    createdAt: string;
    summary: string;
    topics: unknown;
    rawExcerpt: string | null;
    channel: string;
    s11Action: string | null;
    externalMessageId: string | null;
  } | null;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = backendBaseUrl();
  const res = await fetch(`${base}/api/v1/automation/leads/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Failed to load lead (${res.status})`);
  }

  const data = (await res.json()) as LeadDetailJson;
  if (!data.ok || !data.lead) notFound();

  const { lead, activityLogs = [], messageLogs = [], stageTransitions = [], followUpQueue = [], conversationContexts = [] } = data;

  const teamNotes = activityLogs.filter((a) => a.action === "dashboard_note");
  const activityWithoutNotes = activityLogs.filter((a) => a.action !== "dashboard_note");

  return (
    <main className="min-h-screen px-4 pb-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 text-sm">
          <Link href="/leads" className="text-sf-teal hover:underline">
            ← Lead Profiles
          </Link>
        </nav>

        <header className="mb-8 border-b border-[var(--card-border)] pb-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
                {lead.name?.trim() || "Unnamed lead"}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--row-bg)] px-2 py-0.5 text-xs capitalize text-[var(--text-soft)]">
                  {lead.pipelineStage.replace(/_/g, " ")}
                </span>
                <span className="mx-2 text-[var(--text-faint)]">·</span>
                <span className="font-mono text-xs text-[var(--text-dim)]">{lead.id}</span>
              </p>
            </div>
            <div className="text-right text-xs text-[var(--text-dim)]">
              <div>Created {formatWhen(lead.createdAt)}</div>
              <div>Updated {formatWhen(lead.updatedAt)}</div>
            </div>
          </div>
        </header>

        <div className="mb-6">
          <LeadPriorityEditor
            leadId={lead.id}
            pipelineStage={lead.pipelineStage}
            leadScore={lead.leadScore}
            scoreReason={lead.scoreReason}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Contact</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Phone</dt>
                <dd className="font-mono text-[var(--foreground)]">{lead.phone}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Email</dt>
                <dd className="truncate text-[var(--foreground)]">{lead.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Channel</dt>
                <dd className="capitalize text-[var(--foreground)]">{lead.channel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Source (UTM)</dt>
                <dd className="truncate text-[var(--text-soft)]">{lead.source ?? "—"}</dd>
              </div>
              {lead.sources?.length ? (
                <div>
                  <dt className="text-[var(--text-dim)] mb-1">Sources history</dt>
                  <dd className="flex flex-wrap gap-1">
                    {lead.sources.map((s) => (
                      <span key={s} className="rounded-md bg-[var(--chart-grid)] px-2 py-0.5 text-xs text-[var(--text-soft)]">
                        {s}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Qualification &amp; score</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Lead type</dt>
                <dd className="text-[var(--foreground)]">{lead.leadType ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Budget</dt>
                <dd className="text-[var(--foreground)]">{lead.budget ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Timeline</dt>
                <dd className="text-[var(--foreground)]">{lead.timeline ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Score</dt>
                <dd className="tabular-nums text-sf-teal">{lead.leadScore ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-dim)] mb-1">Score reason</dt>
                <dd className="text-[var(--text-soft)] leading-snug">{lead.scoreReason ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Engagement</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Follow-ups sent</dt>
                <dd className="tabular-nums text-[var(--foreground)]">{lead.followUpCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">Last contact</dt>
                <dd className="text-[var(--foreground)]">{formatWhen(lead.lastContactDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--text-dim)]">WhatsApp opt-in</dt>
                <dd className="text-[var(--foreground)]">{lead.whatsappOptIn ? "Yes" : "No"}</dd>
              </div>
              {lead.tenantId ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-dim)]">Tenant</dt>
                  <dd className="font-mono text-xs text-[var(--text-muted)]">{lead.tenantId}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Stage history</h2>
            {stageTransitions.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">No stage transitions recorded.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {stageTransitions.map((t) => (
                  <li key={t.id} className="rounded-lg border border-[var(--chart-grid)] bg-[var(--row-bg)] px-3 py-2">
                    <span className="text-[var(--text-soft)]">
                      {(t.fromStage ?? "—").replace(/_/g, " ")} → {t.toStage.replace(/_/g, " ")}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--text-dim)]">{formatWhen(t.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Team notes timeline</h2>
            <TeamNotesList notes={teamNotes} />
          </section>
          <LeadProfileForms leadId={lead.id} canTerminate={lead.pipelineStage !== "dead"} />
        </div>

        <section className="mt-6 rounded-2xl border border-dashed border-sf-teal/25 bg-sf-teal/[0.06] p-4 md:p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            Inbound conversation context
          </h2>
          <p className="mb-4 text-xs text-[var(--text-dim)]">
            Summaries from S11 (and future channels), newest first. S4b should use the latest entry when generating
            touches so copy stays coherent with what the lead already said.
          </p>
          {conversationContexts.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No stored context yet — wire S11 → POST conversation-context after GPT parse.</p>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
              {conversationContexts.map((c) => (
                <li key={c.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-surface)] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                    <span>{formatWhen(c.createdAt)}</span>
                    {c.s11Action ? (
                      <span className="rounded-full bg-[var(--chart-grid)] px-2 py-0.5 font-mono text-[10px] text-sf-teal/90">
                        {c.s11Action}
                      </span>
                    ) : null}
                    <span className="capitalize">{c.channel}</span>
                  </div>
                  <p className="mt-2 text-[var(--text-soft)] leading-snug">{c.summary}</p>
                  {c.rawExcerpt ? (
                    <p className="mt-2 border-l-2 border-[var(--card-border)] pl-2 text-xs text-[var(--text-dim)] italic">{c.rawExcerpt}</p>
                  ) : null}
                  {c.topics != null && Object.keys(c.topics as object).length > 0 ? (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-[var(--code-bg)] p-2 text-[10px] text-[var(--text-muted)]">
                      {JSON.stringify(c.topics, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Activity log</h2>
          <p className="mb-3 text-xs text-[var(--text-dim)]">Team notes are listed above; this feed hides duplicate note rows.</p>
          {activityWithoutNotes.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No activity rows yet.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
              {activityWithoutNotes.map((a) => (
                <li key={a.id} className="rounded-lg border border-[var(--chart-grid)] bg-[var(--row-bg)] px-3 py-2">
                  <span className="font-mono text-sf-teal/90">{a.action}</span>
                  <span className="ml-2 text-xs text-[var(--text-dim)]">{formatWhen(a.createdAt)}</span>
                  {a.payload != null ? (
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-[var(--code-bg)] p-2 text-[11px] text-[var(--text-muted)]">
                      {JSON.stringify(a.payload, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Messages</h2>
            {messageLogs.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">No message log rows.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {messageLogs.map((m) => (
                  <li key={m.id} className="rounded-lg border border-[var(--chart-grid)] bg-[var(--row-bg)] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                      <span className="capitalize">{m.channel}</span>
                      <span>·</span>
                      <span>{m.direction}</span>
                      <span>·</span>
                      <span>{formatWhen(m.sentAt)}</span>
                    </div>
                    {m.body ? <p className="mt-2 whitespace-pre-wrap text-[var(--foreground)]/75">{m.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Follow-up queue</h2>
            {followUpQueue.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">No follow-up rows.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {followUpQueue.map((q) => (
                  <li key={q.id} className="rounded-lg border border-[var(--chart-grid)] bg-[var(--row-bg)] px-3 py-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-[var(--text-soft)]">
                        Touch {q.touchIndex} · {q.channel}
                      </span>
                      <span className="rounded-full bg-[var(--chart-grid)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{q.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-dim)]">
                      Scheduled {formatWhen(q.scheduledFor)}
                      {q.sentAt ? ` · Sent ${formatWhen(q.sentAt)}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-[var(--text-faint)]">
          Data from <code className="rounded bg-[var(--chart-grid)] px-1">GET /api/v1/automation/leads/:id</code> — same source as
          the list, with related audit tables.
        </p>
      </div>
    </main>
  );
}
