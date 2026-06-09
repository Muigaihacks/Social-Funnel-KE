"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { PIPELINE_STAGES } from "@/lib/pipeline-stages";
import { updateLeadPriorityAction } from "./actions";

type Props = {
  leadId: string;
  pipelineStage: string;
  leadScore: number | null;
  scoreReason: string | null;
};

function labelStage(s: string): string {
  return s.replace(/_/g, " ");
}

export function LeadPriorityEditor({ leadId, pipelineStage, leadScore, scoreReason }: Props) {
  const router = useRouter();
  const [state, action] = useActionState(updateLeadPriorityAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Priority &amp; pipeline</h2>
      <p className="mb-4 text-xs text-[var(--text-dim)]">
        Updates <code className="rounded bg-[var(--chart-grid)] px-1">POST /leads/:id/update-priority</code> — score, score reason,
        and/or pipeline stage (stage change logs a transition when it actually moves).
      </p>
      <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="leadId" value={leadId} />
        <label className="text-xs text-[var(--text-dim)] sm:col-span-2 lg:col-span-1">
          Pipeline stage
          <select
            name="pipelineStage"
            defaultValue={pipelineStage}
            className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none capitalize"
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s} className="bg-[var(--input-bg)] text-[var(--foreground)]">
                {labelStage(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--text-dim)]">
          Lead score (1–10)
          <select
            name="score"
            defaultValue={leadScore != null ? String(leadScore) : ""}
            className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none"
          >
            <option value="">Leave score unchanged</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n} className="bg-[var(--input-bg)] text-[var(--foreground)]">
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--text-dim)] sm:col-span-2">
          Score reason (optional)
          <input
            name="reason"
            type="text"
            defaultValue={scoreReason ?? ""}
            className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus:border-sf-teal/50 focus:outline-none"
            placeholder="e.g. Strong fit — pushed timeline forward"
          />
        </label>
        <div className="flex flex-col justify-end sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="rounded-full border border-sf-teal/40 bg-sf-teal/15 px-4 py-2 text-sm font-medium text-sf-teal hover:bg-sf-teal/25"
          >
            Save changes
          </button>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          {state?.ok === false ? <p className="text-xs text-semantic-danger">{state.error}</p> : null}
          {state?.ok ? <p className="text-xs text-sf-teal/90">Updated.</p> : null}
        </div>
      </form>
    </section>
  );
}
