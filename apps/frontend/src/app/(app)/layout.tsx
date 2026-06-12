import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="pt-[7.25rem] md:pt-[5.5rem]">{children}</div>
    </>
  );
}
