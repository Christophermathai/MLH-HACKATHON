"use client";

import { useState } from "react";
import { ModelLab } from "@/components/ModelLab";
import { SessionView } from "@/features/session/SessionView";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"court" | "lab">("court");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Application Switcher Bar */}
      <nav className="border-b bg-card px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold tracking-tight text-sm text-primary">ZoomOut</span>
          <span className="text-muted-foreground">· Petty Dispute Court</span>
        </div>

        <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab("court")}
            className={`py-1 px-3 rounded-md font-semibold transition ${
              activeTab === "court"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Court Session (Live Flow)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lab")}
            className={`py-1 px-3 rounded-md font-semibold transition ${
              activeTab === "lab"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Speech Model Lab
          </button>
        </div>
      </nav>

      {/* Main Surface */}
      <div className="flex-1">
        {activeTab === "court" ? <SessionView /> : <ModelLab />}
      </div>
    </div>
  );
}
