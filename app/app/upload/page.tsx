import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import UploadForm from "./upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function statusTone(status?: string | null) {
  const s = String(status ?? "queued").toLowerCase();
  if (s === "done") return { label: "Ready", variant: "default" as const };
  if (s === "failed") return { label: "Needs attention", variant: "destructive" as const };
  if (s === "processing") return { label: "Working", variant: "secondary" as const };
  return { label: "Getting started", variant: "secondary" as const };
}

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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export default async function UploadPage() {
  const supabase = await supabaseServer();

   return (
    <div className="mx-auto max-w-6xl">
      
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Upload tender document</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload a PDF or DOCX to create a tender kit with requirements, risks, clarifications, and a short draft outline.
            </p>
          </CardHeader>

          <CardContent className="pt-0 space-y-4">
            <div className="rounded-2xl border bg-background/60 p-4">
              <p className="text-sm font-medium">For your first tender review</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload the final tender version you plan to respond to. Results appear automatically on the next page.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Drafting support only. Always verify requirements against the original tender documents.
              </p>
            </div>

            <UploadForm />
          </CardContent>
        

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What happens next</CardTitle>
              <p className="text-sm text-muted-foreground">A clean tender kit is created automatically.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm font-semibold">1. Upload</p>
                  <p className="mt-1 text-sm text-muted-foreground">Your file is stored in your workspace.</p>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm font-semibold">2. Tender kit is prepared</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Requirements, risks, clarifications, and a draft outline are extracted.
                  </p>
                </div>

                <div className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-sm font-semibold">3. Review and export</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review Go/No-Go, Requirements, Risks, Clarifications, Draft, and Source text. Export when ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Best practices</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                  <span>Upload the final version you plan to respond to.</span>
                </li>
                <li className="flex gap-3 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                  <span>Start with MUST items to reduce the risk of missing mandatory requirements.</span>
                </li>
                <li className="flex gap-3 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                  <span>Use Clarifications early during the Q&amp;A window.</span>
                </li>
              </ul>

              <Separator className="my-5" />

              <p className="text-xs text-muted-foreground leading-relaxed">
                Drafting support only. Always verify requirements against the original tender documents.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
