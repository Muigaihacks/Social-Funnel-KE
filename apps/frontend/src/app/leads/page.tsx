import Link from "next/link";
import { getJson } from "@/lib/dashboard-api";

type LeadsListResponse = {
  ok: boolean;
  total?: number;
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

export default async function LeadProfilesPage() {
  let leads: LeadsListResponse["items"] = [];
  let leadsTotal = 0;
  let error: string | null = null;

  try {
    const leadsRes = await getJson<LeadsListResponse>("/api/v1/automation/leads?limit=50&offset=0");
    if (leadsRes.ok && leadsRes.items) {
      leads = leadsRes.items;
      leadsTotal = leadsRes.total ?? leads.length;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load leads";
  }

  return (
    <main className="min-h-screen px-4 pb-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-white/10 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Lead Profiles</h1>
          <p className="mt-1 text-sm text-white/55">
            Searchable table — detail pages and actions ship next.{" "}
            <span className="tabular-nums text-white/70">{leadsTotal}</span> leads in view.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-semantic-danger/40 bg-semantic-danger/10 px-4 py-3 text-sm text-sf-off">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-sf-navy-deep/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Updated</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Email</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Stage</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Score</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-white/45">
                        No leads yet — runs through S1 will populate this list.
                      </td>
                    </tr>
                  ) : (
                    leads.map((row) => (
                      <tr key={row.id} className="text-white/80 hover:bg-white/[0.04]">
                        <td className="px-4 py-3 whitespace-nowrap text-white/50 tabular-nums text-xs">
                          {formatDate(row.updatedAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-white max-w-[160px] truncate">
                          {row.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap max-w-[200px] truncate text-white/70">
                          {row.email ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs capitalize text-white/85">
                            {row.pipelineStage.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-white/60">{row.leadScore ?? "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap max-w-[140px] truncate text-xs text-white/50">
                          {row.source ?? row.channel}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-white/35">
          Tip: Live Feed will animate S1→S2→scored→contacted; this page stays the stable directory.
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
