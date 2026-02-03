"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function LanguageFixer() {
  const pathname = usePathname();

  useEffect(() => {
    // 1. Get the first part of the URL (e.g., "de" from "/de/how-it-works")
    const segment = pathname?.split("/")[1];
    
    // 2. List of languages you support
    const supported = ["en", "de", "it", "fr", "es"];

    // 3. Update the <html> tag
    if (segment && supported.includes(segment)) {
      document.documentElement.lang = segment;
    } else {
      document.documentElement.lang = "en"; // Fallback
    }
  }, [pathname]);

  return null; // This component renders nothing visually
}