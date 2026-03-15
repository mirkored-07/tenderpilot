"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

type MarketingMobileMenuItem = {
  href: string;
  label: string;
  active?: boolean;
  accent?: boolean;
};

type PanelPosition = {
  top: number;
  right: number;
};

export function MarketingMobileMenu({
  menuLabel,
  items,
  languageLabel,
  themeLabel,
  widthClassName = "w-64",
}: {
  menuLabel: string;
  items: MarketingMobileMenuItem[];
  languageLabel: string;
  themeLabel: string;
  widthClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 72, right: 16 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current) return;
      const target = event.target as Node;
      const clickedInsideTrigger = rootRef.current.contains(target);
      const clickedInsidePanel = panelRef.current?.contains(target) ?? false;

      if (!clickedInsideTrigger && !clickedInsidePanel) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePanelPosition() {
      if (!buttonRef.current || typeof window === "undefined") return;

      const rect = buttonRef.current.getBoundingClientRect();
      const right = Math.max(16, window.innerWidth - rect.right);
      const top = Math.max(16, rect.bottom + 8);

      setPanelPosition({ top, right });
    }

    updatePanelPosition();

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const menuOverlay = mounted && open
    ? createPortal(
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[999] bg-transparent md:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            ref={panelRef}
            role="menu"
            className={cn(
              "fixed z-[1000] rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl ring-1 ring-black/5 md:hidden dark:border-white/10 dark:bg-zinc-900",
              widthClassName,
            )}
            style={{ top: panelPosition.top, right: panelPosition.right }}
          >
            {items.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-xl px-3 py-2 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-white/5",
                  item.active
                    ? "text-foreground"
                    : item.accent
                      ? "font-medium text-teal-400"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}

            <div className="mt-2 space-y-3 border-t border-zinc-200 px-3 pb-1 pt-3 dark:border-white/10">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">{languageLabel}</span>
                <LanguageSwitcher />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">{themeLabel}</span>
                <ModeToggle />
              </div>
            </div>
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className="relative z-[80] md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menuLabel}
        onClick={() => setOpen((current) => !current)}
        className="cursor-pointer rounded-full border border-zinc-200 bg-zinc-100/80 px-3 py-2 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900/50 dark:hover:bg-zinc-900/80"
      >
        {menuLabel}
      </button>

      {menuOverlay}
    </div>
  );
}
