"use client";

import { usePathname } from "next/navigation";

const AUTH_PATH_PREFIXES = ["/admin/login", "/admin/change-password"];

function isAuthShell(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function MainContentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = isAuthShell(pathname);

  return (
    <div className={auth ? "min-h-screen" : "pt-[7.25rem] md:pt-[5.5rem]"}>{children}</div>
  );
}
