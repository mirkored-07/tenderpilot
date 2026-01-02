"use client";

import { useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createJobAction } from "./actions";

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

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Use @supabase/ssr browser client (works with cookie-based auth + middleware refresh)
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
    if (!f) {
      setFile(null);
      return;
    }

    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setFile(null);
      setError("Only PDF or DOCX files are allowed");
      return;
    }

    setFile(f);
  }

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
      {/* Hidden input (keeps native selection + accepts) */}
      <Input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0] ?? null)}
      />

      {/* Dropzone */}
      <Card
        className={[
          "rounded-2xl border bg-background/60 p-5 transition",
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
              PDF preferred
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              DOCX supported
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              One file per bid
            </Badge>
          </div>

          <div>
            <p className="text-sm font-semibold">
              Drag &amp; drop your tender file here
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Or click to browse your computer.
            </p>
          </div>

          {file ? (
            <div className="rounded-2xl border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
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
            <div className="text-xs text-muted-foreground">
              Supported: .pdf, .docx
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          After upload, you’ll be redirected to your bid kit.
        </p>

        <Button
          onClick={handleUpload}
          disabled={!file || loading}
          className="rounded-full"
        >
          {loading ? "Uploading..." : "Create bid review"}
        </Button>
      </div>
    </div>
  );
}
