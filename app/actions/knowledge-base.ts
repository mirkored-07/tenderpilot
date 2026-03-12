"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function saveToAnswerLibrary(
  questionText: string,
  answerText: string,
  tags: string[] = []
) {
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
            // so client-side RLS writes keep working.
            cookieStore.set(name, value, { ...options, httpOnly: false });
          });
        },
      },
    }
  );

  // 1. Verify the user is authenticated securely on the server
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Knowledge base auth error:", authError);
    return { success: false, message: "Unauthorized. Please log in." };
  }

  // 2. Insert the raw text (skipping embeddings for this first iteration)
  const { error: insertError } = await supabase.from("answer_library").insert({
    user_id: user.id,
    question_text: questionText,
    answer_text: answerText,
    tags: tags,
  });

  if (insertError) {
    console.error("Knowledge base insert error:", insertError);
    return { success: false, message: "Could not save to library. Please try again." };
  }

  return { success: true, message: "Saved to Answer Library successfully!" };
}