"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function joinWaitlistAction(email: string, source: string) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // IMPORTANT: keep cookies readable by the browser Supabase client
            // so client-side RLS writes (job_work_items overlays) keep working.
            cookieStore.set(name, value, { ...options, httpOnly: false });
          });
        },
      },
    }
  );

  const { error } = await supabase.from("waitlist").insert({
    email,
    source,
  });

  if (error) {
    console.error("Waitlist error:", error);
    return { success: false, message: "Could not join. Please try again." };
  }

  return { success: true, message: "You're on the list!" };
}