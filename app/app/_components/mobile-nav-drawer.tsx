"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { useTheme } from "next-themes";

import { SideNav } from "./side-nav";
import { useAppI18n } from "./app-i18n-provider";

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

export function MobileNavDrawer({ creditsBalance }: { creditsBalance: number | null }) {
  const { t } = useAppI18n();
  const { resolvedTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastActive = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevBodyOverflow = useRef<string>("");

  const isDark = resolvedTheme === "dark";

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
      lastActive.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={t("app.nav.openMenu")}
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
                    "absolute inset-0 transition-opacity",
                    "bg-black/45 dark:bg-black/80",
                    open ? "opacity-100" : "opacity-0"
                  )}
                  onClick={() => setOpen(false)}
                />

                {/* Panel */}
                <div
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("app.nav.menu")}
                  className={cn(
                    "absolute inset-y-0 left-0 w-[85vw] max-w-[320px]",
                    "bg-background text-foreground",
                    "shadow-2xl ring-1 ring-border",
                    "transition-transform duration-200 ease-out",
                    open ? "translate-x-0" : "-translate-x-full"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={cn(
                      "h-16 px-4 flex items-center justify-between border-b border-border",
                      isDark
                        ? "bg-gradient-to-r from-teal-600 via-cyan-700 to-sky-800 border-white/10 text-white"
                        : "bg-background"
                    )}
                  >
                    <Link
                      href="/app/jobs"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "font-semibold text-base tracking-tight",
                        isDark ? "text-white" : "text-foreground"
                      )}
                    >
                      TenderPilot
                    </Link>
                    <button
                      ref={closeBtnRef}
                      type="button"
                      aria-label={t("app.nav.closeMenu")}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-xl transition",
                        isDark
                          ? "bg-white/10 hover:bg-white/15 text-white"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      )}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="min-h-0 h-[calc(100dvh-4rem)] flex flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <SideNav onNavigate={() => setOpen(false)} tone={isDark ? "inverted" : "default"} />
                    </div>

                    <div className={cn("border-t p-4 space-y-4", isDark ? "border-white/10" : "border-border")}>
                      <div
                        className={cn(
                          "rounded-2xl p-4 ring-1",
                          isDark
                            ? "bg-white/20 ring-white/20 text-white"
                            : "bg-muted/40 ring-border"
                        )}
                      >
                        <p className={cn("text-xs font-medium", isDark ? "text-white/80" : "text-muted-foreground")}>
                          {t("app.credits.title")}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <Badge variant="secondary" className="rounded-full">
                            {creditsText}
                          </Badge>
                          <span className={cn("text-xs font-medium", isDark ? "text-white/80" : "text-muted-foreground")}>
                            {t("app.credits.left")}
                          </span>
                        </div>
                        <p className={cn("mt-3 text-xs leading-relaxed", isDark ? "text-white/75" : "text-muted-foreground")}>
                          {t("app.credits.help")}
                        </p>
                      </div>

                      <div className="flex w-full items-center justify-between px-2">
                        <span className={cn("text-xs font-medium", isDark ? "text-white/80" : "text-muted-foreground")}>
                          {t("app.common.theme")}
                        </span>
                        <div className={cn(isDark ? "[&_button]:text-white [&_svg]:text-white" : "[&_button]:text-foreground") }>
                          <ModeToggle
                            labels={{
                              toggleTheme: t("app.common.theme"),
                              light: t("app.common.light"),
                              dark: t("app.common.dark"),
                              system: t("app.common.system"),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ),
            document.body
          )
        : null}
    </>
  );
}
