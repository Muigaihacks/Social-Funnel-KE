import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
