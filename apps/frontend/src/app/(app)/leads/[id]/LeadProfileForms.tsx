"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { addLeadNoteAction, terminateLeadAction } from "./actions";

function NoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [state, action] = useActionState(addLeadNoteAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="block text-xs text-[var(--text-dim)]">
        Add a team note (internal, newest first below)
        <textarea
          name="text"
          rows={3}
          className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus:border-sf-teal/50 focus:outline-none"
          placeholder="Call outcome, objection, next step…"
          required
        />
      </label>
      {state?.ok === false ? <p className="text-xs text-semantic-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs text-sf-teal/90">Saved.</p> : null}
      <button
        type="submit"
        className="rounded-full border border-[var(--card-border)] bg-[var(--chart-grid)] px-4 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--row-bg-hover)]"
      >
        Save note
      </button>
    </form>
  );
}

function TerminateForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [state, action] = useActionState(terminateLeadAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <form action={action} className="space-y-2 rounded-xl border border-semantic-danger/35 bg-semantic-danger/[0.07] p-4">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-xs font-medium text-semantic-danger/90">Terminate lead</p>
      <p className="text-xs text-[var(--text-dim)]">
        Sets pipeline to <span className="font-mono text-[var(--text-muted)]">dead</span>, skips pending follow-ups, logs an audit
        event.
      </p>
      <label className="block text-xs text-[var(--text-dim)]">
        Reason (optional)
        <input
          name="reason"
          type="text"
          className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus:border-sf-teal/50 focus:outline-none"
          placeholder="e.g. Unresponsive, not ICP, bad fit"
        />
      </label>
      {state?.ok === false ? <p className="text-xs text-semantic-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs text-sf-teal/90">Lead terminated.</p> : null}
      <button
        type="submit"
        className="rounded-full border border-semantic-danger/50 bg-semantic-danger/20 px-4 py-1.5 text-xs font-medium text-sf-off hover:bg-semantic-danger/30"
      >
        Terminate lead
      </button>
    </form>
  );
}

export function LeadProfileForms({ leadId, canTerminate }: { leadId: string; canTerminate: boolean }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-4 md:p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Team notes</h2>
        <NoteForm leadId={leadId} />
      </div>
      {canTerminate ? (
        <div>
          <TerminateForm leadId={leadId} />
        </div>
      ) : (
        <p className="text-center text-xs text-[var(--text-faint)]">This lead is already in the dead stage.</p>
      )}
    </div>
  );
}
