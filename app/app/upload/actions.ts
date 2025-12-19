"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type SourceType = "pdf" | "docx";

async function supabaseServer() {
  // In your Next version, cookies() is async
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

export async function createJobAction(input: {
  fileName: string;
  filePath: string;
  sourceType: SourceType;
}) {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      file_name: input.fileName,
      file_path: input.filePath,
      source_type: input.sourceType,
      status: "queued",
      credits_used: 0,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("Failed to create job", error);
    throw new Error(error?.message ?? "Failed to create job");
  }

  redirect(`/app/jobs/${data.id}`);
}
