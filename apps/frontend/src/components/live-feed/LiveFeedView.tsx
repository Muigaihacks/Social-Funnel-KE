"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sortStagesForDisplay } from "@/config/pipeline";

type FunnelLiveResponse = {
  ok: boolean;
  draft?: boolean;
  note?: string;
  period: { from: string; to: string; days: number; mode: string };
  newLeadsInPeriod: number;
  stages: { stage: string; count: number }[];
  anomalies: Array<{ id: string; severity: "warning" | "critical"; message: string }>;
};

type LeadItem = {
  id: string;
  name: string | null;
  phone: string;
  channel: string;
  pipelineStage: string;
  leadScore: number | null;
  updatedAt: string;
};

type LeadsResponse = { ok: boolean; items?: LeadItem[] };

const POLL_MS = 15_000;

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  return raw.replace(/\/$/, "");
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-4);
  return d.length ? `•••• ${d}` : "—";
}

export function LiveFeedView() {
  const [summary, setSummary] = useState<FunnelLiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/v1/automation/funnel-live?days=7`, { cache: "no-store" });
      const body = (await res.json()) as FunnelLiveResponse & { error?: string };
      if (!res.ok || !body.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }
      setSummary(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load funnel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
    const id = window.setInterval(() => void fetchSummary(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchSummary]);

  const sortedStages = useMemo(
    () => (summary?.stages?.length ? sortStagesForDisplay(summary.stages) : []),
    [summary?.stages],
  );

  const maxCount = useMemo(() => Math.max(1, ...sortedStages.map((s) => s.count)), [sortedStages]);

  const loadLeads = useCallback(async (stage: string) => {
    setLeadsLoading(true);
    try {
      const q = new URLSearchParams({ stage, limit: "40" });
      const res = await fetch(`${apiBase()}/api/v1/automation/leads?${q}`, { cache: "no-store" });
      const body = (await res.json()) as LeadsResponse & { error?: string };
      if (!res.ok || !body.ok || !body.items) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }
      setLeads(body.items);
    } catch {
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStage) void loadLeads(selectedStage);
    else setLeads([]);
  }, [selectedStage, loadLeads]);

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <header className="mb-8 border-b border-white/10 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Live funnel</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Cohort view by <code className="rounded bg-white/10 px-1 text-xs">pipeline_stage</code> — counts
          refresh every {POLL_MS / 1000}s. Tap a stage to list who is there now. Formal stage buckets + branch
          metrics (booked vs nurture) and anomaly rules will land after product sign-off; this page shape stays the
          same.
        </p>
        <p className="mt-3 font-mono text-xs text-white/40">
          {loading
            ? "Loading…"
            : summary
              ? `${summary.period.mode} · ${summary.period.days}d window · ${summary.newLeadsInPeriod} new in period`
              : "—"}
        </p>
      </header>

      {error ? (
        <div
          className="mb-8 rounded-2xl border border-semantic-warning/35 bg-semantic-warning/10 px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium text-semantic-warning">Feed offline</p>
          <p className="mt-1 text-white/70">{error}</p>
        </div>
      ) : null}

      <section className="mb-10" aria-label="Stage counts">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/40">Stages (snapshot)</h2>
        {loading && !summary ? (
          <p className="text-sm text-white/40">Loading stage distribution…</p>
        ) : sortedStages.length === 0 ? (
          <p className="text-sm text-white/45">No leads in database yet.</p>
        ) : (
          <ul className="space-y-4">
            {sortedStages.map((row) => {
              const active = selectedStage === row.stage;
              const widthPct = (row.count / maxCount) * 100;
              return (
                <li key={row.stage}>
                  <button
                    type="button"
                    onClick={() => setSelectedStage(active ? null : row.stage)}
                    className={[
                      "group w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-sf-teal/50 bg-sf-teal/10"
                        : "border-white/10 bg-sf-navy-deep/50 hover:border-white/20",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium capitalize text-white">
                        {row.stage.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-lg font-semibold tabular-nums text-sf-teal">
                        {row.count}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="funnel-live-bar h-full rounded-full bg-gradient-to-r from-sf-teal to-sf-brand transition-[width] duration-700 ease-out"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-white/35">
                      {active ? "Click again to collapse" : "Click for leads in this stage"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedStage ? (
        <section className="mb-10 rounded-2xl border border-white/10 bg-sf-navy-deep/40 p-4 md:p-5" aria-label="Leads in stage">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
              In stage: <span className="text-sf-teal">{selectedStage.replace(/_/g, " ")}</span>
            </h2>
            {leadsLoading ? <span className="text-xs text-white/45">Loading…</span> : null}
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {leads.length === 0 && !leadsLoading ? (
              <li className="text-sm text-white/45">No rows returned.</li>
            ) : null}
            {leads.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2"
              >
                <span className="text-sm text-white">{l.name?.trim() || "Unnamed"}</span>
                <span className="text-xs text-white/45">
                  {maskPhone(l.phone)} · {l.channel}
                  {l.leadScore != null ? ` · ${l.leadScore}/10` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="rounded-2xl border border-dashed border-white/15 bg-sf-navy-deep/30 px-4 py-6 md:px-6"
        aria-label="Funnel health"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Funnel health monitor</h2>
        <p className="mt-2 text-sm text-white/50">
          Rule-based anomalies (conversion drops, no-show rate vs threshold, etc.) will appear here after you lock
          stages and thresholds with Lewis. Polling-friendly — lead stages rarely change by the second.
        </p>
        {summary?.anomalies && summary.anomalies.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {summary.anomalies.map((a) => (
              <li
                key={a.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  a.severity === "critical"
                    ? "border-semantic-danger/40 bg-semantic-danger/10 text-semantic-danger"
                    : "border-semantic-warning/40 bg-semantic-warning/10 text-semantic-warning"
                }`}
              >
                {a.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-center text-sm text-white/35">No anomalies flagged — rules not configured yet.</p>
        )}
      </section>

      {summary?.note ? (
        <p className="mt-6 text-center text-xs text-white/35" title="API note">
          API: {summary.note}
        </p>
      ) : null}

      <p className="mt-8 text-center text-sm text-white/40">
        Command Centre ·{" "}
        <Link href="/" className="text-sf-teal hover:underline">
          Overview
        </Link>{" "}
        ·{" "}
        <Link href="/leads" className="text-sf-teal hover:underline">
          Lead Profiles
        </Link>
      </p>
    </div>
  );
}
