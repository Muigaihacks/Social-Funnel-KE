import Link from "next/link";
import { getJsonNoStore } from "@/lib/dashboard-api";
import { markBookingNoShowAction, markBookingClosedAction } from "./actions";

type BookingEventsResponse = {
  ok: boolean;
  items?: Array<{
    id: string;
    action: string;
    createdAt: string;
    payload: unknown;
    lead: {
      id: string;
      name: string | null;
      email: string | null;
      phone: string;
      pipelineStage: string;
    };
  }>;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case "booked":
      return "Booked";
    case "no_show":
      return "No-show";
    case "booking_canceled":
      return "Cancelled";
    default:
      return action;
  }
}

function payloadExtras(p: unknown): string {
  if (typeof p !== "object" || p === null) return "";
  const o = p as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.startsAt === "string") {
    try {
      parts.push(`Start ${formatWhen(o.startsAt)}`);
    } catch {
      parts.push(`Start ${String(o.startsAt)}`);
    }
  }
  if (typeof o.eventId === "string" && o.eventId) parts.push(`Event ${o.eventId}`);
  return parts.join(" · ");
}

function canMarkManualNoShow(row: {
  action: string;
  lead: { pipelineStage: string };
}): boolean {
  if (row.action !== "booked") return false;
  const s = row.lead.pipelineStage;
  return s !== "no_show" && s !== "dead" && s !== "client" && s !== "closed";
}

function canMarkClosed(row: {
  action: string;
  lead: { pipelineStage: string };
}): boolean {
  if (row.action !== "booked") return false;
  const s = row.lead.pipelineStage;
  return s !== "closed" && s !== "dead" && s !== "client";
}

export default async function BookingsPage() {
  let items: NonNullable<BookingEventsResponse["items"]> = [];
  let error: string | null = null;

  try {
    const data = await getJsonNoStore<BookingEventsResponse>("/api/v1/automation/booking-events?limit=100");
    if (data.ok && data.items) items = data.items;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load booking events";
  }

  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-[var(--card-border)] pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">Bookings</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Timeline from Cal.com webhooks hitting{" "}
            <code className="rounded bg-[var(--chart-grid)] px-1 text-xs">POST /api/v1/automation/calendly-event</code> — booked,
            cancelled, and no-show activity per matched lead. If a no-show was never sent from Cal.com, use{" "}
            <strong className="text-[var(--text-muted)]">Mark no-show</strong> on a booked row (dashboard backfill).
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-semantic-danger/40 bg-semantic-danger/10 px-4 py-3 text-sm text-sf-off">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] px-6 py-14 text-center text-sm text-[var(--text-dim)]">
            No booking events in the log yet. When invitee.created / cancel / no_show payloads land, rows appear here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)] text-xs uppercase tracking-wider text-[var(--text-dim)]">
                    <th className="px-4 py-3 font-medium whitespace-nowrap">When</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Event</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Lead</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Details</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--chart-grid)] text-[var(--text-soft)] last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">{formatWhen(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.action === "booked"
                              ? "rounded-full bg-sf-teal/20 px-2 py-0.5 text-xs font-medium text-sf-teal"
                              : row.action === "no_show"
                                ? "rounded-full bg-semantic-danger/20 px-2 py-0.5 text-xs font-medium text-semantic-danger/90"
                                : "rounded-full bg-[var(--chart-grid)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]"
                          }
                        >
                          {actionLabel(row.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${row.lead.id}`} className="font-medium text-sf-teal hover:underline">
                          {row.lead.name?.trim() || "Unnamed"}
                        </Link>
                        <div className="mt-0.5 font-mono text-xs text-[var(--text-dim)]">{row.lead.phone}</div>
                        <div className="text-xs capitalize text-[var(--text-faint)]">
                          Stage: {row.lead.pipelineStage.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs text-[var(--text-muted)]">
                        {payloadExtras(row.payload) || "—"}
                      </td>
                      <td className="min-w-[11rem] px-4 py-3 text-right">
                        {canMarkManualNoShow(row) || canMarkClosed(row) ? (
                          <div className="ml-auto flex max-w-xs flex-col items-stretch gap-2">
                            {canMarkClosed(row) && (
                              <form action={markBookingClosedAction} className="flex w-full">
                                <input type="hidden" name="leadId" value={row.lead.id} />
                                <button
                                  type="submit"
                                  className="w-full rounded-full border border-semantic-success/45 bg-semantic-success/15 px-3 py-1 text-xs font-medium text-semantic-success hover:bg-semantic-success/25"
                                >
                                  Mark Closed/Won
                                </button>
                              </form>
                            )}
                            {canMarkManualNoShow(row) && (
                              <form action={markBookingNoShowAction} className="flex w-full flex-col gap-2">
                                <input type="hidden" name="leadId" value={row.lead.id} />
                                <input
                                  name="note"
                                  type="text"
                                  placeholder="Optional note"
                                  className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-1.5 text-[11px] text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus:border-sf-teal/50 focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  className="w-full rounded-full border border-semantic-danger/45 bg-semantic-danger/15 px-3 py-1 text-xs font-medium text-semantic-danger/95 hover:bg-semantic-danger/25"
                                >
                                  Mark no-show
                                </button>
                              </form>
                            )}
                          </div>
                        ) : row.action === "booked" ? (
                          <span className="text-[11px] text-[var(--text-faint)]">No action (closed stage)</span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-faint)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
