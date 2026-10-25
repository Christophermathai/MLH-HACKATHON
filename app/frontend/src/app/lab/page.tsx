"use client";

import Link from "next/link";
import { ModelLab } from "@/components/ModelLab";

export default function LabPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b bg-card px-6 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Link href="/" className="font-bold text-primary hover:underline">
            ← Back to ZoomOut Court
          </Link>
          <span className="text-muted-foreground">· Speech Model Usability Lab</span>
        </div>
      </header>

      <main className="flex-1">
        <ModelLab />
      </main>
    </div>
  );
}
