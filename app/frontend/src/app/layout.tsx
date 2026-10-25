import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZoomOut · Petty Dispute Court",
  description: "Big feelings. Small problems. Calm perspectives. Everyday petty dispute mediation in Malayalam.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
