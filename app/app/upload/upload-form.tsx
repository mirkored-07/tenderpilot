"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createJobAction } from "./actions";
import { track } from "@/lib/telemetry";

type SourceType = "pdf" | "docx";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }, []);

  function pickFile() {
    inputRef.current?.click();
  }

  function validateAndSet(f: File | null) {
    setError(null);
    setNeedsSignIn(false);

    if (!f) {
      setFile(null);
      return;
    }

    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setFile(null);
      setError("Only PDF or DOCX files are supported");
      track("upload_file_rejected", { reason: "unsupported_type" });
      return;
    }

    setFile(f);
    track("upload_file_selected", { ext, size: f.size });
  }

  async function handleUpload() {
    if (!file) return;

    setLoading(true);
    setError(null);
    setNeedsSignIn(false);

    try {
      // ✅ Gate BEFORE upload/job creation (prevents late RLS errors)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        setNeedsSignIn(true);
        setLoading(false);
        track("upload_requires_signin");
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "pdf" && ext !== "docx") {
        throw new Error("Only PDF or DOCX files are supported");
      }

      const sourceType: SourceType = ext as SourceType;
      const filePath = `${crypto.randomUUID()}.${ext}`;

      track("upload_started", { ext: sourceType, size: file.size });

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      track("upload_storage_completed", { sourceType });

      // Server action will create job + redirect to the new job page
      await createJobAction({
        fileName: file.name,
        filePath,
        sourceType,
      });

      track("job_created", { sourceType });
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
      track("upload_failed", { message: String(err?.message ?? err) });
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0] ?? null)}
      />

      <Card
        className={[
          "rounded-2xl border bg-card/60 p-5 shadow-sm transition",
          dragOver ? "ring-2 ring-foreground/20" : "",
        ].join(" ")}
        onClick={pickFile}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0] ?? null;
          validateAndSet(f);
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              PDF or DOCX
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              One file per bid
            </Badge>
          </div>

          <div>
            <p className="text-sm font-semibold">Drag &amp; drop your tender file here</p>
            <p className="mt-1 text-sm text-muted-foreground">Or click to browse your computer.</p>
          </div>

          {file ? (
            <div className="rounded-2xl border bg-background/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    validateAndSet(null);
                  }}
                  disabled={loading}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Supported: .pdf, .docx</div>
          )}
        </div>
      </Card>

      {needsSignIn && (
        <div className="rounded-2xl border bg-muted/40 p-4">
          <p className="text-sm font-medium">Sign in to create your bid review</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your file is ready. Sign in via magic link, then click “Create bid review”.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setNeedsSignIn(false)}
            >
              Not now
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          You’ll be redirected to your bid kit after upload.
        </p>

        <Button onClick={handleUpload} disabled={!file || loading} className="rounded-full">
          {loading ? "Preparing…" : "Create bid review"}
        </Button>
      </div>
    </div>
  );
}
