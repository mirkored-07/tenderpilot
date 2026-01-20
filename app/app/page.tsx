"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AppRootPage() {
  const router = useRouter();

  useEffect(() => {
    async function go() {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.replace("/login");
        return;
      }

      const uid = data.user.id;

      const res = await supabase
        .from("user_settings")
        .select("default_start_page")
        .eq("user_id", uid)
        .maybeSingle();

      // Self-heal for older users (no settings row yet)
      if (!res.error && !res.data) {
        await supabase.from("user_settings").insert({ user_id: uid });
      }

      const start = (res.data?.default_start_page ?? "jobs") as "upload" | "jobs";
      router.replace(start === "upload" ? "/app/upload" : "/app/jobs");
    }

    go();
  }, [router]);

  return <div className="py-16 text-sm text-muted-foreground">Loading…</div>;
}
