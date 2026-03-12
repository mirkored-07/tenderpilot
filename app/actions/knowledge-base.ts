"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Helper function to call OpenAI's embedding model.
 * Returns an array of 1536 numbers, or null if it fails.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.warn("No OPENAI_API_KEY found in environment variables. Skipping embedding generation.");
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenAI API error:", response.status, errorBody);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Failed to generate embedding due to a network or parsing error:", error);
    return null;
  }
}

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

  // 2. Generate the AI vector embedding
  // We combine the question and answer to give the AI maximum context for similarity matching
  const embeddingInput = `Question: ${questionText}\nAnswer: ${answerText}`;
  const embedding = await generateEmbedding(embeddingInput);

  // 3. Insert the raw text AND the vector embedding (embedding will gracefully be null if generation failed)
  const { error: insertError } = await supabase.from("answer_library").insert({
    user_id: user.id,
    question_text: questionText,
    answer_text: answerText,
    tags: tags,
    embedding: embedding, 
  });

  if (insertError) {
    console.error("Knowledge base insert error:", insertError);
    return { success: false, message: "Could not save to library. Please try again." };
  }

  return { success: true, message: "Saved to Answer Library successfully!" };
}