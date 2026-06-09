"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="dark" storageKey="sf-acquisition-theme">
      {children}
    </NextThemesProvider>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="4" strokeLinecap="round" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useNextTheme();

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder button with the same dimensions to prevent layout shift
    return <div className="h-9 w-9 shrink-0 rounded-lg border border-transparent" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
        isDark
          ? "border-[var(--card-border)] bg-[var(--card-surface)] text-[var(--foreground)] hover:bg-[var(--row-bg-hover)]"
          : "border-[var(--sf-teal)]/35 bg-[var(--sf-teal)]/18 text-[var(--sf-teal)] hover:bg-[var(--sf-teal)]/25",
      ].join(" ")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunIcon className="h-[1.125rem] w-[1.125rem]" /> : <MoonIcon className="h-[1.125rem] w-[1.125rem]" />}
    </button>
  );
}
