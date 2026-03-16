import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acquisition OS — Social Funnel",
  description: "Lead-to-Booking Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
