"use client";

const PALETTE = [
  "#00d1c1",
  "#38bdf8",
  "#6d8cff",
  "#22c55e",
  "#f97316",
  "#a78bfa",
  "#f472b6",
  "#facc15",
];

export type AttributionPayload = {
  period: { from: string; to: string; days: number };
  totalNewLeads: number;
  unscoredCount: number;
  leadsByChannel: Array<{ label: string; count: number }>;
  topUtmSources: Array<{ source: string; count: number }>;
  leadsPerDay: Array<{ date: string; count: number }>;
  scoreHistogram: Array<{ score: number; count: number }>;
  bookingRateByChannel: Array<{
    channel: string;
    newLeads: number;
    bookedLike: number;
    rate: number;
  }>;
};

function Donut({ segments }: { segments: Array<{ label: string; count: number }> }) {
  const total = segments.reduce((a, s) => a + s.count, 0) || 1;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 72;
  let angle = -Math.PI / 2;
  const paths = segments.map((s, i) => {
    const frac = s.count / total;
    const portion = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += portion;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = portion > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return <path key={`${s.label}-${i}`} d={d} fill={PALETTE[i % PALETTE.length]} stroke="var(--background)" strokeWidth={1} />;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {paths}
    </svg>
  );
}

function LineChart({ points }: { points: Array<{ date: string; count: number }> }) {
  if (points.length === 0) return <p className="text-sm text-[var(--text-muted)]">No data in range.</p>;
  const w = 560;
  const h = 160;
  const pad = 24;
  const maxY = Math.max(...points.map((p) => p.count), 1);
  const stepX = (w - pad * 2) / Math.max(points.length - 1, 1);
  const scaleY = (n: number) => h - pad - (n / maxY) * (h - pad * 2);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${scaleY(p.count)}`)
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="max-h-48" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--sf-teal)" strokeWidth={2} />
      {points.map((p, i) =>
        i % Math.ceil(points.length / 8) === 0 || i === points.length - 1 ? (
          <text
            key={p.date}
            x={pad + i * stepX}
            y={h - 6}
            textAnchor="middle"
            className="fill-[var(--text-muted)] text-[8px]"
          >
            {p.date.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function RollingCharts({ data }: { data: AttributionPayload }) {
  const donutSegments = [...data.leadsByChannel].sort((a, b) => b.count - a.count).slice(0, 8);
  const utmSegments = [...data.topUtmSources].filter((s) => s.source).slice(0, 8);

  const maxBook = Math.max(...data.bookingRateByChannel.map((b) => b.rate), 0.01);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Leads by channel</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Ingest channel (Facebook, web, WhatsApp, LinkedIn).</p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Donut segments={donutSegments} />
          <ul className="min-w-0 flex-1 space-y-1 text-sm">
            {donutSegments.map((s, i) => (
              <li key={s.label} className="flex justify-between gap-2">
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="capitalize text-[var(--foreground)]">{s.label}</span>
                </span>
                <span className="tabular-nums text-[var(--text-muted)]">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Top UTM / source strings
        </h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">First 14 distinct `source` values in the window.</p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Donut segments={utmSegments.map((u) => ({ label: u.source || "(empty)", count: u.count }))} />
          <ul className="min-w-0 flex-1 space-y-1 text-sm">
            {utmSegments.map((s, i) => (
              <li key={s.source + i} className="flex justify-between gap-2">
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="text-[var(--foreground)]">{s.source || "—"}</span>
                </span>
                <span className="tabular-nums text-[var(--text-muted)]">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5 lg:col-span-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">New leads per day</h3>
        <div className="mt-4">
          <LineChart points={data.leadsPerDay} />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Booking proxy by channel
        </h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Share of new leads in window whose stage is <code className="text-[10px]">audit_booked</code> or{" "}
          <code className="text-[10px]">client</code>.
        </p>
        <div className="mt-4 space-y-3">
          {data.bookingRateByChannel.map((row) => (
            <div key={row.channel}>
              <div className="mb-1 flex justify-between text-xs capitalize">
                <span>{row.channel}</span>
                <span className="tabular-nums text-[var(--text-muted)]">
                  {(row.rate * 100).toFixed(1)}% · {row.bookedLike}/{row.newLeads}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--chart-grid)]">
                <div
                  className="h-full rounded-full bg-[var(--sf-teal)]"
                  style={{ width: `${(row.rate / maxBook) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          AI score distribution (1–10)
        </h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Leads created in window. Unscored in period: {data.unscoredCount}.
        </p>
        <div className="mt-4 flex h-40 items-end gap-1.5">
          {data.scoreHistogram.map((b) => {
            const maxC = Math.max(...data.scoreHistogram.map((x) => x.count), 1);
            const h = Math.max((b.count / maxC) * 100, b.count > 0 ? 4 : 0);
            return (
              <div key={b.score} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] tabular-nums text-[var(--text-faint)]">{b.count}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-[var(--sf-sky)] to-[var(--sf-teal)] opacity-90"
                    style={{ height: `${h}%`, minHeight: b.count > 0 ? '8px' : '0' }}
                    title={`Score ${b.score}: ${b.count} leads`}
                  />
                </div>
                <span className="text-[10px] tabular-nums font-medium text-[var(--text-muted)]">{b.score}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
