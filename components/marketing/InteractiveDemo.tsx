"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, ScanLine, Sparkles, ShieldAlert } from "lucide-react";

// ─── Data ──────────────────────────────────────────────────────────────────

const PDF_LINES = [
  { id: "h1", text: "SECTION 5 — SERVICE DELIVERY", bold: true, reqId: null },
  { id: "l1", text: "5.3  General performance obligations as outlined in Schedule B apply.", reqId: null },
  { id: "l2", text: "5.4  The bidder MUST provide 24/7 incident intake and response", reqId: "r1" },
  { id: "l3", text: "     capability with a maximum initial response time of 4 hours.", reqId: "r1" },
  { id: "h2", text: "SECTION 7 — SUBCONTRACTING", bold: true, reqId: null },
  { id: "l4", text: "7.1  The bidder SHALL NOT subcontract more than 30% of the", reqId: "r2" },
  { id: "l5", text: "     contract value without prior written approval from the Authority.", reqId: "r2" },
  { id: "h3", text: "SECTION 9 — PERSONNEL & SECURITY", bold: true, reqId: null },
  { id: "l6", text: "9.2  All staff MUST hold valid ISO 27001 security clearance", reqId: "r3" },
  { id: "l7", text: "     before project commencement.", reqId: "r3" },
];

const REQUIREMENTS = [
  { id: "r1", clause: "§ 5.4", type: "MUST" as const, color: "emerald" as const, text: "24/7 incident intake & response — max 4-hour response time.", revealMs: 1800 },
  { id: "r2", clause: "§ 7.1", type: "SHALL NOT" as const, color: "red" as const, text: "Subcontract >30% of contract value without written approval.", revealMs: 2700 },
  { id: "r3", clause: "§ 9.2", type: "MUST" as const, color: "emerald" as const, text: "All staff must hold valid ISO 27001 security clearance.", revealMs: 3600 },
];

const SCAN_MS = 1600;
const TOTAL_MS = 3600 + 1800; // last reveal + hold

const C = {
  emerald: {
    badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    card: "border-emerald-500/25 bg-emerald-500/5",
    active: "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_18px_-4px_rgba(52,211,153,0.35)]",
    hl: "bg-emerald-500/15 border-l-2 border-emerald-400 text-zinc-100",
  },
  red: {
    badge: "bg-red-500/20 text-red-300 border border-red-500/30",
    card: "border-red-500/25 bg-red-500/5",
    active: "border-red-400/60 bg-red-500/10 shadow-[0_0_18px_-4px_rgba(248,113,113,0.35)]",
    hl: "bg-red-500/15 border-l-2 border-red-400 text-zinc-100",
  },
};

// ─── Component ─────────────────────────────────────────────────────────────

export function InteractiveDemo() {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      setTick((ts - startRef.current) % TOTAL_MS);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const scanFrac = Math.min(tick / SCAN_MS, 1);
  const revealedIds = new Set(REQUIREMENTS.filter((r) => tick >= r.revealMs).map((r) => r.id));
  const latestId = [...REQUIREMENTS].reverse().find((r) => tick >= r.revealMs)?.id ?? null;

  return (
    <div className="relative w-full select-none">
      {/* Ambient glow */}
      <div className="absolute -inset-8 bg-teal-500/8 blur-3xl rounded-3xl pointer-events-none" />

      {/* Outer frame */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_28px_60px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/5">

        {/* Chrome bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 border-b border-white/8">
          <div className="flex gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-zinc-700" />
            <span className="w-3 h-3 rounded-full bg-zinc-700" />
            <span className="w-3 h-3 rounded-full bg-zinc-700" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-zinc-800/80 rounded-md px-3 py-1 text-[11px] text-zinc-400">
              <ScanLine className="w-3 h-3 text-teal-400" />
              <span>TenderPilot — Live Analysis</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3 h-3 text-teal-400" />
            <span className="text-[10px] text-teal-400 font-semibold">AI Active</span>
          </div>
        </div>

        {/* ── TOP: PDF Source ─── */}
        <div className="relative bg-[#18181b] border-b border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/5 bg-zinc-900/60">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Source document</span>
            <span className="ml-auto font-mono text-[9px] text-zinc-600">tender_spec_v3.pdf</span>
          </div>
          <div className="relative px-5 py-3 font-mono text-[10.5px] leading-[1.8] overflow-hidden">
            {PDF_LINES.map((line) => {
              const hl = line.reqId ? revealedIds.has(line.reqId) : false;
              const req = line.reqId ? REQUIREMENTS.find((r) => r.id === line.reqId) : null;
              return (
                <div
                  key={line.id}
                  className={[
                    "px-1.5 -mx-1.5 rounded-sm transition-all duration-500",
                    line.bold ? "font-bold text-zinc-300 tracking-wide mt-1.5 first:mt-0" : "",
                    hl && req ? C[req.color].hl : "text-zinc-500",
                  ].join(" ")}
                >
                  {line.text || <>&nbsp;</>}
                </div>
              );
            })}

            {/* Scan beam */}
            <div
              className="absolute inset-x-0 pointer-events-none"
              style={{ top: `${scanFrac * 100}%`, opacity: scanFrac < 0.97 ? 1 : 0, transition: "opacity 0.4s" }}
            >
              <div className="h-[2px] bg-teal-400 shadow-[0_0_14px_4px_rgba(45,212,191,0.8)]" />
              <div className="h-10 -mt-10 bg-gradient-to-t from-teal-400/15 to-transparent" />
            </div>
          </div>
          <div className="px-4 py-1.5 flex items-center gap-1.5 border-t border-white/5 bg-zinc-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[9px] text-zinc-600">AI scanning…</span>
          </div>
        </div>

        {/* ── BOTTOM: Extracted Requirements ─── */}
        <div className="bg-zinc-950">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/5 bg-zinc-900/60">
            <ShieldAlert className="w-3 h-3 text-zinc-500" />
            <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Extracted Requirements</span>
            <span className="ml-auto text-[9px] text-zinc-600">{revealedIds.size} / {REQUIREMENTS.length} found</span>
          </div>

          <div className="px-4 py-3 space-y-2">
            {REQUIREMENTS.map((req) => {
              const revealed = revealedIds.has(req.id);
              const isLatest = req.id === latestId;
              const c = C[req.color];
              return (
                <div
                  key={req.id}
                  className={[
                    "rounded-lg border p-2.5 transition-all duration-500 ease-out",
                    revealed ? (isLatest ? c.active : c.card) : "border-white/5 bg-white/[0.02]",
                    revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                  ].join(" ")}
                >
                  {revealed ? (
                    <>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${c.badge}`}>
                          {req.type}
                        </span>
                        <span className="font-mono text-[9px] text-zinc-500">{req.clause}</span>
                        <span className="ml-auto flex items-center gap-1 text-[8px] text-teal-400/80 border border-teal-500/20 bg-teal-500/5 px-1.5 py-0.5 rounded-full">
                          <Link2 className="w-2 h-2" />Traced
                        </span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-zinc-300">{req.text}</p>
                    </>
                  ) : (
                    <div className="space-y-1.5 animate-pulse">
                      <div className="flex gap-2">
                        <div className="h-3.5 w-12 rounded bg-zinc-800" />
                        <div className="h-3.5 w-8 rounded bg-zinc-800" />
                      </div>
                      <div className="h-2 w-full rounded bg-zinc-800/70" />
                      <div className="h-2 w-3/4 rounded bg-zinc-800/70" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-white/5 bg-zinc-900/40 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${revealedIds.size === REQUIREMENTS.length ? "bg-emerald-400" : "bg-teal-400 animate-pulse"}`} />
            <span className="text-[9px] text-zinc-500">
              {revealedIds.size === REQUIREMENTS.length ? "Analysis complete" : "Extraction in progress…"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
