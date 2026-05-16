"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN_NAV = [
  { href: "/", label: "Overview" },
  { href: "/live-feed", label: "Live funnel" },
  { href: "/leads", label: "Lead Profiles" },
  { href: "/bookings", label: "Bookings" },
  { href: "/follow-ups", label: "Follow-Up" },
] as const;

const REPORT_NAV = [
  { href: "/analytics", label: "Analytics" },
  { href: "/reports", label: "Weekly Report" },
] as const;

function navLinkClass(active: boolean) {
  return [
    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors md:text-sm",
    active
      ? "bg-sf-teal/15 text-sf-teal"
      : "text-white/85 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center px-3 pt-4 md:px-6">
      <div className="pointer-events-auto flex w-full max-w-6xl flex-col items-stretch gap-2 rounded-[2rem] border border-white/10 bg-sf-navy-deep/78 px-3 py-2 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:flex-row md:items-center md:gap-4 md:px-5 md:py-2.5">
        <div className="flex items-center justify-between gap-3 md:justify-start">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sf-teal to-emerald-600 text-lg shadow-inner"
              aria-hidden
            >
              🌐
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-white md:text-base">Social Funnel</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-sf-teal/90 md:text-[11px]">
                Acquisition OS
              </span>
            </div>
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-white/50 md:inline">
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
          <span className="mx-1 hidden h-4 w-px bg-white/15 md:inline" aria-hidden />
          {REPORT_NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={navLinkClass(!!active)}>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
