"use client";
import { useEffect, useRef } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  direction?: "up" | "left" | "right";
  /** Extra class to pass through to wrapper div */
  as?: "div" | "section" | "article";
}

/**
 * Wraps children in a div that fades + slides into view when
 * scrolled into the viewport (powered by IntersectionObserver).
 *
 * Uses CSS classes defined in globals.css:
 *   .reveal-on-scroll  (initial hidden state)
 *   .is-visible        (visible state — triggered here)
 *   .reveal-left / .reveal-right  (direction variants)
 *   .reveal-delay-{0..5}          (stagger delays)
 */
export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el); // fire once
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dirClass =
    direction === "left"
      ? "reveal-left"
      : direction === "right"
      ? "reveal-right"
      : "";

  return (
    <div
      ref={ref}
      className={`reveal-on-scroll reveal-delay-${delay} ${dirClass} ${className}`}
    >
      {children}
    </div>
  );
}
