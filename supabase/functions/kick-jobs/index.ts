/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  try {
    // Scheduler will call with GET; we accept both.
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const SUPABASE_URL = requiredEnv("TP_SUPABASE_URL");
    const SERVICE_ROLE = requiredEnv("TP_SERVICE_ROLE_KEY");
    const CRON_SECRET = requiredEnv("TP_CRON_SECRET");
    const PROJECT_REF = requiredEnv("TP_PROJECT_REF");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Pick a few queued jobs
    const { data: jobs, error } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("status", "queued")
      .not("file_path", "is", null)
      .order("created_at", { ascending: true })
      .limit(3);

    if (error) {
      return new Response(`DB error: ${error.message}`, { status: 500 });
    }

    const url = `https://${PROJECT_REF}.functions.supabase.co/process-job`;

    let ok = 0;
    let failed = 0;

    for (const j of jobs ?? []) {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenderpilot-secret": CRON_SECRET,
        },
        body: JSON.stringify({ job_id: j.id }),
      });

      if (resp.ok) ok++;
      else failed++;
    }

    return new Response(JSON.stringify({ ok, failed, count: jobs?.length ?? 0 }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
});
