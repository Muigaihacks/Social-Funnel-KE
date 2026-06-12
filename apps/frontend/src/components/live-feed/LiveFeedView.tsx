"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sortStagesForDisplay } from "@/config/pipeline";
import { FunnelCanvas } from "./FunnelCanvas";

type FunnelLiveResponse = {
  ok: boolean;
  draft?: boolean;
  note?: string;
  period: { from: string; to: string; days: number; mode: string };
  newLeadsInPeriod: number;
  stages: { stage: string; count: number }[];
  metrics?: {
    nurtureConversionRate: number;
    nurturedLeads: number;
    nurturedThenBooked: number;
    touchpointBreakdown: Record<string, number>;
    touchpointPercentages: Record<string, number>;
    totalTouchpointBookings: number;
    noShowRate: number;
    totalBooked: number;
    noShowCount: number;
    scoreMovements: {
      coldToWarm: number;
      coldToHot: number;
      warmToHot: number;
      warmToCold: number;
      hotToCold: number;
      hotToWarm: number;
    };
    avgLeadsPerDay: number;
  };
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
      const res = await fetch(`${apiBase()}/api/v1/automation/funnel-live?days=7`, { 
        cache: "no-store",
        headers: { 'ngrok-skip-browser-warning': '1' }
      });
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
    <div className="mx-auto max-w-7xl pb-24">
      <header className="mb-8 border-b border-[var(--card-border)] pb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-[var(--sf-teal)] to-emerald-600 text-xs shadow-inner">
            📊
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--sf-teal)]">
            Acquisition OS Business Intelligence Hub
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">Live funnel</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
          Real-time pipeline visualization showing lead flow through stages. Click any stage to view leads.
          Counts refresh every {POLL_MS / 1000}s.
        </p>
        <p className="mt-3 font-mono text-xs text-[var(--text-dim)]">
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
          <p className="mt-1 text-[var(--text-muted)]">{error}</p>
        </div>
      ) : null}

      <section className="mb-10" aria-label="Pipeline canvas">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
          Pipeline flow visualization
        </h2>
        {loading && !summary ? (
          <div className="flex h-96 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[#1a1a1a]">
            <p className="text-sm text-[var(--text-dim)]">Loading pipeline…</p>
          </div>
        ) : sortedStages.length === 0 ? (
          <div className="flex h-96 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[#1a1a1a]">
            <p className="text-sm text-[var(--text-dim)]">No leads in database yet.</p>
          </div>
        ) : (
          <FunnelCanvas
            stages={sortedStages}
            selectedStage={selectedStage}
            onSelectStage={setSelectedStage}
          />
        )}
      </section>

      {selectedStage ? (
        <section className="mb-10 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5" aria-label="Leads in stage">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              In stage: <span className="text-sf-teal">{selectedStage.replace(/_/g, " ")}</span>
            </h2>
            {leadsLoading ? <span className="text-xs text-[var(--text-dim)]">Loading…</span> : null}
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {leads.length === 0 && !leadsLoading ? (
              <li className="text-sm text-[var(--text-dim)]">No rows returned.</li>
            ) : null}
            {leads.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--chart-grid)] bg-[var(--row-bg)] px-3 py-2"
              >
                <span className="text-sm text-[var(--foreground)]">{l.name?.trim() || "Unnamed"}</span>
                <span className="text-xs text-[var(--text-dim)]">
                  {maskPhone(l.phone)} · {l.channel}
                  {l.leadScore != null ? ` · ${l.leadScore}/10` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary?.metrics && (
        <>
          <section className="mb-10 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5" aria-label="Funnel metrics">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Performance metrics</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--chart-grid)] bg-[var(--row-bg)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Avg leads/day</p>
                <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {summary.metrics.avgLeadsPerDay?.toFixed(1) ?? "0.0"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--chart-grid)] bg-[var(--row-bg)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Nurture → Booking</p>
                <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {summary.metrics.nurtureConversionRate?.toFixed(1) ?? "0.0"}%
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  {summary.metrics.nurturedThenBooked ?? 0}/{summary.metrics.nurturedLeads ?? 0} leads
                </p>
              </div>
              <div className="rounded-xl border border-[var(--chart-grid)] bg-[var(--row-bg)] p-3">
                <p className="text-xs text-[var(--text-muted)]">No-show rate</p>
                <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {summary.metrics.noShowRate?.toFixed(1) ?? "0.0"}%
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  {summary.metrics.noShowCount ?? 0}/{summary.metrics.totalBooked ?? 0} bookings
                </p>
              </div>
              <div className="rounded-xl border border-[var(--chart-grid)] bg-[var(--row-bg)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Score movements</p>
                <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {(summary.metrics.scoreMovements?.coldToWarm ?? 0) + (summary.metrics.scoreMovements?.coldToHot ?? 0) + (summary.metrics.scoreMovements?.warmToHot ?? 0)}
                  <span className="text-sm text-semantic-success"> ↑</span> / 
                  {(summary.metrics.scoreMovements?.hotToCold ?? 0) + (summary.metrics.scoreMovements?.hotToWarm ?? 0) + (summary.metrics.scoreMovements?.warmToCold ?? 0)}
                  <span className="text-sm text-semantic-warning"> ↓</span>
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">upgrades / downgrades</p>
              </div>
            </div>
          </section>

          {summary.metrics.totalTouchpointBookings > 0 && (
            <section className="mb-10 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5" aria-label="Touchpoint analysis">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Booking touchpoint breakdown</h2>
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                At which touchpoint in the nurture sequence did leads book? Based on {summary.metrics.totalTouchpointBookings} tracked bookings.
              </p>
              <div className="space-y-3">
                {Object.entries(summary.metrics.touchpointBreakdown)
                  .sort(([a], [b]) => {
                    const numA = parseInt(a.replace('touch', ''));
                    const numB = parseInt(b.replace('touch', ''));
                    return numA - numB;
                  })
                  .map(([touchpoint, count]) => {
                    const percentage = summary.metrics!.touchpointPercentages[touchpoint] || 0;
                    const touchNum = touchpoint.replace('touch', '');
                    return (
                      <div key={touchpoint}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-[var(--foreground)]">Touch {touchNum}</span>
                          <span className="tabular-nums text-[var(--text-muted)]">
                            {percentage.toFixed(1)}% ({count} bookings)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--chart-grid)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--sf-teal)] to-emerald-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </>
      )}

      <section
        className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--row-bg)] px-4 py-6 md:px-6"
        aria-label="Funnel health"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Anomaly detection</h2>
        <p className="mt-2 text-sm text-[var(--text-dim)]">
          Automated alerts for conversion drops, no-show rate spikes, and score downgrades.
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
          <p className="mt-4 text-center text-sm text-[var(--text-faint)]">✓ No anomalies detected — all metrics within expected ranges</p>
        )}
      </section>

      {summary?.note ? (
        <p className="mt-6 text-center text-xs text-[var(--text-faint)]" title="API note">
          API: {summary.note}
        </p>
      ) : null}

      <p className="mt-8 text-center text-sm text-[var(--text-dim)]">
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
