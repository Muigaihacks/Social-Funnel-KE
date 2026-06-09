/** Globe + broadcast arcs — matches Social Funnel marketing brand mark; use `text-[var(--sf-teal)]`. */
export function SocialFunnelLogoMark({ className = "h-9 w-9 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="22" cy="24" r="14" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="22" cy="24" rx="6.5" ry="14" stroke="currentColor" strokeWidth="1.6" opacity={0.9} />
      <path d="M8 24h28" stroke="currentColor" strokeWidth="1.6" opacity={0.9} strokeLinecap="round" />
      <path
        d="M22 10c-4.2 4.6-4.2 19.4 0 24"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={0.45}
        strokeLinecap="round"
      />
      <path
        d="M22 14c-3.2 3.9-3.2 15.1 0 19"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={0.45}
        strokeLinecap="round"
      />
      <path d="M38 16c5.2 3.3 5.2 12.7 0 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M43 12c7.2 4.6 7.2 15.4 0 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity={0.78} />
      <path d="M47 8c9.2 5.6 9.2 18.4 0 24" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity={0.55} />
    </svg>
  );
}
