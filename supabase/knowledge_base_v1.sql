-- 1. Enable the pgvector extension (required for storing OpenAI/Gemini embeddings)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Create the answer_library table
CREATE TABLE IF NOT EXISTS public.answer_library (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_text text NOT NULL,
    answer_text text NOT NULL,
    tags text[] DEFAULT '{}',
    embedding vector(1536), -- 1536 dimensions matches standard OpenAI text-embedding-3-small/ada-002
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.answer_library ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies (Strict Isolation: Users can only access their own data)
CREATE POLICY "Users can view their own answers"
    ON public.answer_library FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own answers"
    ON public.answer_library FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own answers"
    ON public.answer_library FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own answers"
    ON public.answer_library FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Create an HNSW index to make AI vector similarity searches lightning fast
CREATE INDEX IF NOT EXISTS answer_library_embedding_idx
    ON public.answer_library
    USING hnsw (embedding vector_cosine_ops);