"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createLeadAction, type LeadFormState } from "../actions";
import { CHANNELS, CHANNEL_LABELS } from "@/lib/lead-channels";

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus:border-sf-teal/50 focus:outline-none";
const labelClass = "block text-xs text-[var(--text-dim)]";

export function CreateLeadForm() {
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(createLeadAction, null);

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6">
      {state?.ok === false && state.error ? (
        <div className="rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 px-4 py-3 text-sm text-sf-off">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          Phone <span className="text-semantic-danger">*</span>
          <input name="phone" type="tel" required placeholder="e.g. 0712 345 678 or +254712345678" className={inputClass} />
        </label>
        <label className={labelClass}>
          Full name
          <input name="name" type="text" autoComplete="name" placeholder="Jane Doe" className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" autoComplete="email" placeholder="jane@company.co.ke" className={inputClass} />
        </label>
        <label className={labelClass}>
          Channel
          <select name="channel" defaultValue="web" className={inputClass}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Source / campaign tag
          <input name="source" type="text" placeholder="e.g. referral, event_march_2026" className={inputClass} />
          <span className="mt-1 block text-[10px] text-[var(--text-faint)]">Defaults to dashboard_manual if empty</span>
        </label>
        <label className={labelClass}>
          Lead type / summary
          <input name="leadType" type="text" placeholder="e.g. Construction · KES 50k/mo ads" className={inputClass} />
        </label>
        <label className={labelClass}>
          Budget (optional)
          <input name="budget" type="text" placeholder="e.g. 30k–80k KES/mo" className={inputClass} />
        </label>
        <label className={labelClass}>
          Timeline (optional)
          <input name="timeline" type="text" placeholder="e.g. Start in 2 weeks" className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2 flex items-center gap-2`}>
          <input name="whatsappOptIn" type="checkbox" className="h-4 w-4 rounded border-[var(--card-border)]" />
          <span className="text-sm text-[var(--text-soft)]">WhatsApp opt-in recorded</span>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Internal note (optional)
          <textarea name="notes" rows={3} placeholder="How you met them, context for the team…" className={inputClass} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-[var(--card-border)] pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--sf-teal)] px-5 py-2.5 text-sm font-semibold text-sf-off disabled:opacity-60"
        >
          {pending ? "Creating…" : "Add to pipeline"}
        </button>
        <Link
          href="/leads"
          className="rounded-full border border-[var(--card-border)] px-5 py-2.5 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--row-bg-hover)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
