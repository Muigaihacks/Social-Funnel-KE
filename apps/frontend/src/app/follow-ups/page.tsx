export default function FollowUpsPage() {
  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Follow-Up Queue</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Table wired to <code className="rounded bg-[var(--card-surface)] border border-[var(--card-border)] px-1 text-xs">GET /automation/due-followups</code> and
          mark/skip/trigger-now (reschedule to now) actions — next pass.
        </p>
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--card-surface)] px-6 py-16 text-center text-[var(--text-muted)]">
          Queue manager UI next.
        </div>
      </div>
    </main>
  );
}
