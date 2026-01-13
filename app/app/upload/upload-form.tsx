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

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

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

function getFileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isSupportedExt(ext: string): ext is SourceType {
  return ext === "pdf" || ext === "docx";
}

type UploadPhase = "idle" | "checking_session" | "uploading" | "creating_job" | "redirecting";

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [phase, setPhase] = useState<UploadPhase>("idle");
  const loading = phase !== "idle";

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

    if (!f.name) {
      setFile(null);
      setError("This file could not be read. Please try another file.");
      track("upload_file_rejected", { reason: "missing_name" });
      return;
    }

    if (!Number.isFinite(f.size) || f.size <= 0) {
      setFile(null);
      setError("This file appears to be empty. Please choose a valid PDF or DOCX.");
      track("upload_file_rejected", { reason: "empty_file" });
      return;
    }

    if (f.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(`File is too large. Please upload a file up to ${formatBytes(MAX_FILE_BYTES)}.`);
      track("upload_file_rejected", { reason: "too_large", size: f.size });
      return;
    }

    const ext = getFileExt(f.name);
    if (!isSupportedExt(ext)) {
      setFile(null);
      setError("Only PDF or DOCX files are supported.");
      track("upload_file_rejected", { reason: "unsupported_type" });
      return;
    }

    setFile(f);
    track("upload_file_selected", { ext, size: f.size });
  }

  function phaseLabel(p: UploadPhase) {
    if (p === "checking_session") return "Checking your session…";
    if (p === "uploading") return "Uploading your file…";
    if (p === "creating_job") return "Creating your bid review…";
    if (p === "redirecting") return "Redirecting to your bid kit…";
    return "";
  }

  async function handleUpload() {
    if (!file || loading) return;

    setPhase("checking_session");
    setError(null);
    setNeedsSignIn(false);

    try {
      // Gate BEFORE upload/job creation (prevents late RLS errors)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        setNeedsSignIn(true);
        setPhase("idle");
        track("upload_requires_signin");
        return;
      }

      const ext = getFileExt(file.name);
      if (!isSupportedExt(ext)) {
        throw new Error("Only PDF or DOCX files are supported.");
      }

      const sourceType: SourceType = ext;
      const filePath = `${crypto.randomUUID()}.${ext}`;

      track("upload_started", { ext: sourceType, size: file.size });

      setPhase("uploading");
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw new Error("Upload failed. Please try again.");
      }

      track("upload_storage_completed", { sourceType });

      // Server action will create job + redirect to the new job page
      setPhase("creating_job");
      await createJobAction({
        fileName: file.name,
        filePath,
        sourceType,
      });

      // In normal flow the server action redirects. If it does not, show a safe state.
      setPhase("redirecting");
      track("job_created", { sourceType });
    } catch (err: any) {
      const message = String(err?.message ?? "Upload failed");
      setError(message);
      track("upload_failed", { message });
      setPhase("idle");
    }
  }

  const primaryCtaLabel = loading ? phaseLabel(phase) || "Preparing…" : "Create bid review";

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
          loading ? "opacity-90" : "",
        ].join(" ")}
        onClick={() => {
          if (!loading) pickFile();
        }}
        onKeyDown={(e) => {
          if (loading) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickFile();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!loading) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!loading) setDragOver(true);
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
          if (loading) return;
          const f = e.dataTransfer.files?.[0] ?? null;
          validateAndSet(f);
        }}
        role="button"
        tabIndex={0}
        aria-disabled={loading}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              PDF or DOCX
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              One file per bid
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              Up to {formatBytes(MAX_FILE_BYTES)}
            </Badge>
          </div>

          <div>
            <p className="text-sm font-semibold">Drag and drop your tender file here</p>
            <p className="mt-1 text-sm text-muted-foreground">Or click to browse your computer.</p>
          </div>

          {!file ? (
            <div className="rounded-2xl border bg-background/70 p-4">
              <p className="text-sm font-medium">What you will get</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Executive summary, requirements checklist, risks, clarifications, and a draft outline.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Drafting support only. Always verify requirements against the original tender documents.
              </p>
            </div>
          ) : (
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
          )}

          {!file ? <div className="text-xs text-muted-foreground">Supported: .pdf, .docx</div> : null}
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
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setError(null);
              }}
              disabled={loading}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={handleUpload}
              disabled={!file || loading || needsSignIn}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          You will be redirected to your bid kit after upload.
        </p>

        <Button
          onClick={handleUpload}
          disabled={!file || loading || needsSignIn}
          className="rounded-full"
        >
          {primaryCtaLabel}
        </Button>
      </div>
    </div>
  );
}
