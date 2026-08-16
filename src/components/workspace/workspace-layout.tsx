'use client';

import { AgentPipeline } from "./agent-pipeline";
import { CenterCanvas } from "./center-canvas";
import { LogPanel } from "./log-panel";

export function WorkspaceLayout() {
  return (
    <div className="flex h-full">
      {/* Left sidebar: Agent pipeline */}
      <aside className="w-[240px] shrink-0 border-r border-black/[0.06] bg-[#f9f9fb] overflow-y-auto hide-scrollbar">
        <AgentPipeline />
      </aside>

      {/* Center: Tabbed content */}
      <main className="flex-1 min-w-0 overflow-y-auto hide-scrollbar bg-[#f5f5f7]">
        <CenterCanvas />
      </main>

      {/* Right sidebar: Logs */}
      <aside className="w-[320px] shrink-0 border-l border-black/[0.06] bg-[#f9f9fb] overflow-hidden hidden xl:flex xl:flex-col">
        <LogPanel />
      </aside>
    </div>
  );
}
