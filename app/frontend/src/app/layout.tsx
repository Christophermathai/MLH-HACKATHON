import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZoomOut · Whisper Evidence Desk",
  description: "A focused usability lab for Malayalam Whisper Large v3 transcription.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
