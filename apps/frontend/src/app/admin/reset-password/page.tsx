import ResetPasswordForm from "./ResetPasswordForm";
import { Suspense } from "react";

export const metadata = {
  title: "Set New Password | Social Funnel",
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Social Funnel</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Acquisition OS</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-[var(--text-muted)]">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
