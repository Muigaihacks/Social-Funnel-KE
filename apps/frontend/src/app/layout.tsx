import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Acquisition OS — Social Funnel",
  description: "Lead-to-Booking Operating System",
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased font-sans">
        <SiteHeader />
        <div className="pt-[7.25rem] md:pt-[5.5rem]">{children}</div>
      </body>
    </html>
  );
}
