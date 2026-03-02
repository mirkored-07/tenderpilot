"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

import { SideNav } from "./side-nav";

import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
  );
}

export function MobileNavDrawer({
  creditsBalance,
}: {
  creditsBalance: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastActive = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevBodyOverflow = useRef<string>("");

  const creditsText = useMemo(
    () => (typeof creditsBalance === "number" ? String(creditsBalance) : "—"),
    [creditsBalance]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    lastActive.current = document.activeElement as HTMLElement | null;
    prevBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button first (best for keyboard + screen readers).
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusable(panel);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // If focus somehow escaped the dialog, pull it back.
      if (active && !panel.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevBodyOverflow.current;
      // Restore focus to whatever was active before opening.
      lastActive.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/70 shadow-sm backdrop-blur hover:opacity-90 transition"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted
        ? createPortal(
            (
      <div
        className={cn(
          "fixed inset-0 z-[999] md:hidden isolate",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        {/* Overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-black/85 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />

        {/* Panel */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={cn(
            "absolute inset-y-0 left-0 w-[85vw] max-w-[320px]",
            "bg-slate-950 text-white",
            "shadow-2xl ring-1 ring-white/10",
            "transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-16 px-4 flex items-center justify-between bg-gradient-to-r from-teal-600 via-cyan-700 to-sky-800 border-b border-white/10">
            <Link
              href="/app/jobs"
              onClick={() => setOpen(false)}
              className="font-semibold text-base tracking-tight"
            >
              TenderPilot
            </Link>
            <button
              ref={closeBtnRef}
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 h-[calc(100dvh-4rem)] flex flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SideNav onNavigate={() => setOpen(false)} />
            </div>

            <div className="border-t border-white/10 p-4 space-y-4">
              <div className="rounded-2xl bg-white/20 p-4 ring-1 ring-white/20">
                <p className="text-xs font-medium text-white/80">Credits</p>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="secondary" className="rounded-full">
                    {creditsText}
                  </Badge>
                  <span className="text-xs font-medium text-white/80">
                    remaining
                  </span>
                </div>
                <p className="mt-3 text-xs text-white/75 leading-relaxed">
                  Each tender review consumes 1 credit. Exports are gated on the
                  free tier.
                </p>
              </div>

              <div className="flex w-full items-center justify-between px-2">
                <span className="text-xs font-medium text-white/80">Theme</span>
                <div className="[&_button]:text-white [&_svg]:text-white">
                  <ModeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>            ),
            document.body
          )
        : null}

    </>
  );
}
