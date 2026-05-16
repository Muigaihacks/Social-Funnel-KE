export default function FollowUpsPage() {
  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-white md:text-3xl">Follow-Up Queue</h1>
        <p className="mt-3 text-sm text-white/55">
          Table wired to <code className="rounded bg-white/10 px-1 text-xs">GET /automation/due-followups</code> and
          mark/skip/trigger-now (reschedule to now) actions — next pass.
        </p>
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-sf-navy-deep/30 px-6 py-16 text-center text-white/40">
          Queue manager UI next.
        </div>
      </div>
    </main>
  );
}
