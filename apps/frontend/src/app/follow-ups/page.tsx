"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type FollowUpItem = {
  followUpId: string;
  leadId: string;
  touchIndex: number;
  channel: string;
  scheduledFor: string;
  isDue: boolean;
  lead: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    pipelineStage: string;
  };
};

type FollowUpsResponse = {
  ok: boolean;
  items?: FollowUpItem[];
  error?: string;
};

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  return raw.replace(/\/$/, "");
}

function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      const absDays = Math.abs(diffDays);
      const absHours = Math.abs(diffHours);
      if (absDays > 0) return `${absDays}d overdue`;
      if (absHours > 0) return `${absHours}h overdue`;
      return "Overdue";
    }

    if (diffDays > 0) return `in ${diffDays}d`;
    if (diffHours > 0) return `in ${diffHours}h`;
    return "Soon";
  } catch {
    return "";
  }
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-4);
  return d.length ? `•••• ${d}` : phone;
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "due">("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const fetchFollowUps = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: "200",
        ...(filter === "due" ? { dueOnly: "true" } : {}),
        ...(channelFilter !== "all" ? { channel: channelFilter } : {}),
      });

      const res = await fetch(`${apiBase()}/api/v1/automation/follow-up-queue?${params}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as FollowUpsResponse;

      if (!res.ok || !body.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setFollowUps(body.items || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, [filter, channelFilter]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    void fetchFollowUps();
  }, [fetchFollowUps]);

  const handleMarkSkipped = useCallback(async (followUpId: string) => {
    try {
      const res = await fetch(`${apiBase()}/api/v1/automation/follow-up/${followUpId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) throw new Error("Failed to skip follow-up");
      
      // Refresh the list
      void fetchFollowUps();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to skip follow-up");
    }
  }, [fetchFollowUps]);

  const handleBump = useCallback(async (followUpId: string) => {
    try {
      const res = await fetch(`${apiBase()}/api/v1/automation/follow-up/${followUpId}/bump`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: 24 }), // Bump by 24 hours
      });
      
      if (!res.ok) throw new Error("Failed to bump follow-up");
      
      // Refresh the list
      void fetchFollowUps();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to bump follow-up");
    }
  }, [fetchFollowUps]);

  useEffect(() => {
    void fetchFollowUps();
  }, [fetchFollowUps]);

  const dueCount = followUps.filter((f) => f.isDue).length;
  const upcomingCount = followUps.filter((f) => !f.isDue).length;

  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-[var(--card-border)] pb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-[var(--sf-teal)] to-emerald-600 text-xs shadow-inner">
              📅
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--sf-teal)]">
              Acquisition OS Follow-Up Engine
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
            Follow-Up Queue
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Scheduled touches from n8n workflows (S4 7-touch sequence, S6 no-show recovery, S7 dormant reactivation).
            Queue updates as n8n creates follow-up tasks.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-3">
              <p className="text-xs text-[var(--text-muted)]">Total Queued</p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">{followUps.length}</p>
            </div>
            <div className="rounded-xl border border-semantic-danger/30 bg-semantic-danger/10 px-4 py-3">
              <p className="text-xs text-semantic-danger">Due Now</p>
              <p className="text-2xl font-semibold tabular-nums text-semantic-danger">{dueCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-3">
              <p className="text-xs text-[var(--text-muted)]">Upcoming</p>
              <p className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">{upcomingCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-surface)] px-4 py-3">
              <button
                onClick={() => void fetchFollowUps()}
                className="w-full text-left"
                disabled={loading}
              >
                <p className="text-xs text-[var(--sf-teal)]">Refresh</p>
                <p className="text-sm font-medium text-[var(--sf-teal)]">{loading ? "Loading..." : "↻ Update"}</p>
              </button>
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-[var(--sf-teal)] text-[var(--foreground)]"
                  : "border border-[var(--card-border)] text-[var(--text-muted)] hover:border-[var(--sf-teal)]"
              }`}
            >
              All ({followUps.length})
            </button>
            <button
              onClick={() => setFilter("due")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === "due"
                  ? "bg-semantic-danger text-white"
                  : "border border-[var(--card-border)] text-[var(--text-muted)] hover:border-semantic-danger"
              }`}
            >
              Due Now ({dueCount})
            </button>
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)]"
          >
            <option value="all">All Channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </div>

        {error ? (
          <div
            className="mb-6 rounded-2xl border border-semantic-warning/35 bg-semantic-warning/10 px-4 py-3 text-sm"
            role="alert"
          >
            <p className="font-medium text-semantic-warning">Error loading follow-ups</p>
            <p className="mt-1 text-[var(--text-muted)]">{error}</p>
          </div>
        ) : null}

        {loading && followUps.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--text-muted)]">Loading follow-ups...</p>
          </div>
        ) : followUps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--card-surface)] px-6 py-12 text-center">
            <p className="text-lg font-medium text-[var(--foreground)]">No follow-ups in queue</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {filter === "due"
                ? "No follow-ups are due right now. Check 'All' to see upcoming scheduled touches."
                : "n8n workflows (S4, S6, S7) will populate this queue as they create follow-up tasks."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followUps.map((item) => (
              <div
                key={item.followUpId}
                className={`rounded-xl border p-4 transition-colors ${
                  item.isDue
                    ? "border-semantic-danger/40 bg-semantic-danger/5"
                    : "border-[var(--card-border)] bg-[var(--card-surface)] hover:border-[var(--sf-teal)]/50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/leads/${item.lead.id}`}
                        className="text-base font-medium text-[var(--foreground)] hover:text-[var(--sf-teal)] hover:underline"
                      >
                        {item.lead.name || "Unnamed Lead"}
                      </Link>
                      {item.isDue ? (
                        <span className="rounded-full bg-semantic-danger px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                          Due
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span>{maskPhone(item.lead.phone)}</span>
                      {item.lead.email ? <span>• {item.lead.email}</span> : null}
                      <span className="capitalize">• {item.lead.pipelineStage.replace(/_/g, " ")}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">Touch:</span>{" "}
                        <span className="font-medium text-[var(--foreground)]">#{item.touchIndex}</span>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">Channel:</span>{" "}
                        <span className="font-medium capitalize text-[var(--foreground)]">{item.channel}</span>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">Scheduled:</span>{" "}
                        <span className="font-mono text-xs text-[var(--foreground)]">
                          {formatDateTime(item.scheduledFor)}
                        </span>
                        <span
                          className={`ml-2 text-xs ${item.isDue ? "text-semantic-danger font-medium" : "text-[var(--text-muted)]"}`}
                        >
                          ({formatRelativeTime(item.scheduledFor)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.isDue && (
                      <>
                        <button
                          onClick={() => handleMarkSkipped(item.followUpId)}
                          className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-500 hover:bg-amber-500/25"
                        >
                          Mark Skipped
                        </button>
                        <button
                          onClick={() => handleBump(item.followUpId)}
                          className="rounded-lg border border-blue-500/50 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-500 hover:bg-blue-500/25"
                        >
                          Bump +24h
                        </button>
                      </>
                    )}
                    <Link
                      href={`/leads/${item.lead.id}`}
                      className="rounded-lg border border-[var(--sf-teal)]/50 bg-[var(--sf-teal)]/15 px-3 py-2 text-xs font-medium text-[var(--sf-teal)] hover:bg-[var(--sf-teal)]/25"
                    >
                      View Lead →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            n8n manages follow-up execution. This queue shows pending touches; n8n marks them as sent/skipped after
            delivery.
          </p>
          <p className="mt-2 text-xs text-[var(--text-dim)]">
            <Link href="/" className="text-[var(--sf-teal)] hover:underline">
              ← Back to Command Centre
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
