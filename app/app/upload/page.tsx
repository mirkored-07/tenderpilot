import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import UploadForm from "./upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">New bid</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a PDF or DOCX. We’ll generate a decision cockpit with evidence.
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <UploadForm />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Drafting support only. Always verify requirements against the original tender documents.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
