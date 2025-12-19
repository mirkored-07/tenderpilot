"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createJobAction } from "./actions";

type SourceType = "pdf" | "docx";

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use @supabase/ssr browser client (works with cookie-based auth + middleware refresh)
  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }, []);

  async function handleUpload() {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext !== "pdf" && ext !== "docx") {
        throw new Error("Only PDF or DOCX files are allowed");
      }

      const sourceType = ext as SourceType;
      const filePath = `${crypto.randomUUID()}.${ext}`;

      // 🔍 QUICK PROOF: confirm the browser client has a session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      // eslint-disable-next-line no-console
      console.log("SESSION CHECK", {
        hasSession: !!sessionData?.session,
        userId: sessionData?.session?.user?.id ?? null,
        sessionError: sessionError?.message ?? null,
      });

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      await createJobAction({
        fileName: file.name,
        filePath,
        sourceType,
      });
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        type="file"
        accept=".pdf,.docx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleUpload} disabled={!file || loading}>
        {loading ? "Uploading..." : "Upload & Continue"}
      </Button>
    </div>
  );
}
