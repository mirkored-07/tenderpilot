"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTheme } from "next-themes";

export function UiDensityInit() {
  const { setTheme } = useTheme(); // ✅ hook at top-level

  useEffect(() => {
    async function run() {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) return;

      const res = await supabase
        .from("user_settings")
        .select("ui_density,theme")
        .eq("user_id", u.id)
        .maybeSingle();

      // self-heal older users
      if (!res.error && !res.data) {
        await supabase.from("user_settings").insert({ user_id: u.id });
      }

      const density = (res.data?.ui_density ?? "comfortable") as
        | "comfortable"
        | "compact";

      document.documentElement.classList.toggle(
        "tp-density-compact",
        density === "compact"
      );

      const theme = (res.data?.theme ?? "system") as "system" | "light" | "dark";

      // Apply theme for the session (reflects DB)
      setTheme(theme);
    }

    run();
  }, [setTheme]);

  return null;
}
