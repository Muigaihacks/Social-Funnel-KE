"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";

const AUTH_SHELL_PATHS = ["/admin/login", "/admin/change-password"];

export function ConditionalSiteHeader() {
  const pathname = usePathname();
  if (AUTH_SHELL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return <SiteHeader />;
}
