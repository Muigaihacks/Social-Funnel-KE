"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";
import { SocialFunnelLogoMark } from "@/components/SocialFunnelLogoMark";
import { SignOutButton } from "@/components/SignOutButton";

const MAIN_NAV = [
  { href: "/", label: "Overview" },
  { href: "/admin", label: "Admin" },
  { href: "/live-feed", label: "Live funnel" },
  { href: "/leads", label: "Lead Profiles" },
  { href: "/bookings", label: "Bookings" },
  { href: "/follow-ups", label: "Follow-Up" },
] as const;

const SECONDARY_NAV = [
  { href: "/analytics", label: "Analytics" },
] as const;

function navLinkClass(active: boolean) {
  return [
    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors md:text-sm",
    active
      ? "bg-[var(--sf-teal)]/15 text-[var(--sf-teal)]"
      : "text-[var(--foreground)]/85 hover:bg-[var(--chart-grid)] hover:text-[var(--foreground)]",
  ].join(" ");
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center px-3 pt-4 md:px-6">
      <div className="pointer-events-auto flex w-full max-w-6xl flex-col items-stretch gap-2 rounded-[2rem] border border-[var(--card-border)] bg-[var(--nav-surface)] px-3 py-2 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:flex-row md:items-center md:gap-4 md:px-5 md:py-2.5">
        <div className="flex items-center justify-between gap-3 md:justify-start">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <SocialFunnelLogoMark className="h-9 w-9 text-[var(--sf-teal)] md:h-10 md:w-10" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight text-[var(--sf-teal)] md:text-lg">Social Funnel</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] md:text-[11px]">
                Acquisition OS
              </span>
            </div>
          </Link>
          <span className="hidden rounded-full border border-[var(--card-border)] bg-[var(--card-surface)] px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)] md:inline">
            Internal
          </span>
        </div>

        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto pb-1 md:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Primary"
        >
          {MAIN_NAV.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={navLinkClass(!!active)}>
                {label}
              </Link>
            );
          })}
          <span className="mx-1 hidden h-4 w-px bg-[var(--card-border)] md:inline" aria-hidden />
          {SECONDARY_NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} className={navLinkClass(!!active)}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-center gap-2 md:justify-end">
          <ThemeToggle />
          <Link
            href="/profile"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--chart-grid)]"
            title="My Profile"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
