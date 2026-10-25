"use client";

import Link from "next/link";
import { SessionView } from "@/features/session/SessionView";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Application Header */}
      <header className="border-b bg-card/60 backdrop-blur px-6 py-2.5 flex items-center justify-between text-xs sticky top-0 z-20">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold tracking-tight text-base text-primary">ZoomOut</span>
          <span className="text-muted-foreground font-medium">· Malayalam Petty Dispute Court</span>
        </div>

        <div className="flex items-center space-x-4">
          <Link
            href="/lab"
            className="text-muted-foreground hover:text-foreground text-xs font-medium underline underline-offset-4 transition"
          >
            Model Usability Lab →
          </Link>
        </div>
      </header>

      {/* Main Surface: Full ZoomOut Court App */}
      <main className="flex-1">
        <SessionView />
      </main>
    </div>
  );
}
