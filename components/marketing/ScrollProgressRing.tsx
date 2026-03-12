"use client";
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Fixed bottom-right scroll progress ring indicator.
 * Inspired by the CTC Feed scroll progress element.
 *
 * - Fades in after scrolling past 4% of the page
 * - SVG circle stroke fills from 0 → 100% as you scroll
 * - Shows numeric percentage in the center
 */
export function ScrollProgressRing() {
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      setPct(p);
      setVisible(p > 3);
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  const size = 56;
  const strokeW = 3.5;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-8 right-8 z-50 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.7)",
        pointerEvents: "none",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          className="text-white/10 dark:text-white/15"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-teal-400 scroll-progress-ring"
        />
      </svg>
      {/* Percent label */}
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-teal-400"
        style={{ transform: "none" }}
      >
        {pct}
      </span>
    </div>
  );
}
