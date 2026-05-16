export default function BookingsPage() {
  return (
    <main className="min-h-screen px-4 pb-20 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-white md:text-3xl">Bookings</h1>
        <p className="mt-3 text-sm text-white/55">
          Cal.com-powered calendar — bookings will be stored when S5 posts to the existing{" "}
          <code className="rounded bg-white/10 px-1 text-xs">POST /api/v1/automation/calendly-event</code> route
          (Cal.com payloads; name unchanged).
        </p>
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-sf-navy-deep/30 px-6 py-16 text-center text-white/40">
          Calendar UI + booking list next.
        </div>
      </div>
    </main>
  );
}
