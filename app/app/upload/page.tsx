import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import UploadPageClient from "./upload-page-client";

async function supabaseServer() {
  // ✅ Matches your repo pattern: in your Next version, cookies() is async
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // IMPORTANT:
          // In Next.js (App Router), Server Components (pages/layouts)
          // are NOT allowed to mutate cookies.
          // Cookies are refreshed/propagated in middleware + route handlers.
          void cookiesToSet;
        },
      },
    }
  );
}

export default async function UploadPage() {
  await supabaseServer();

  return <UploadPageClient />;
}
