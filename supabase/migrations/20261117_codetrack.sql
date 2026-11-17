-- ============================================================================
-- CodeTrack AI: Personal DSA & LeetCode Tracker Tables & RLS Policies
-- ============================================================================

-- 1. DSA Profiles table
CREATE TABLE IF NOT EXISTS public.dsa_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    preferred_difficulty TEXT DEFAULT 'Mixed Practice',
    streak INT DEFAULT 0,
    last_active_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DSA User Problem Progress table
CREATE TABLE IF NOT EXISTS public.dsa_user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    status TEXT NOT NULL CHECK (status IN ('unsolved', 'solved', 'attempted', 'practice')),
    attempts INT DEFAULT 1,
    notes TEXT,
    independence TEXT CHECK (independence IN ('independent', 'small_hint', 'substantial_help', 'unsolved')),
    challenge_faced TEXT,
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    preferred_next TEXT,
    ai_feedback TEXT,
    last_attempted_at TIMESTAMPTZ DEFAULT NOW(),
    solved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, problem_id)
);

-- 3. DSA AI Mentor Recommendations / Chat History table
CREATE TABLE IF NOT EXISTS public.dsa_ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    problem_id TEXT,
    topic_id TEXT,
    recommendation_reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Official LeetCode Daily Challenge Cache Table
CREATE TABLE IF NOT EXISTS public.dsa_daily_challenges (
    challenge_date DATE PRIMARY KEY,
    frontend_question_id TEXT NOT NULL,
    title TEXT NOT NULL,
    title_slug TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    ac_rate DECIMAL(5,2),
    topic_tags JSONB DEFAULT '[]'::jsonb,
    official_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_dsa_user_progress_user ON public.dsa_user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_dsa_user_progress_topic ON public.dsa_user_progress(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_dsa_user_progress_status ON public.dsa_user_progress(user_id, status);

-- Enable RLS
ALTER TABLE public.dsa_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsa_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsa_ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsa_daily_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view and manage only their own personal DSA progress
CREATE POLICY "Users can manage own DSA profile"
    ON public.dsa_profiles
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own DSA progress"
    ON public.dsa_user_progress
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own AI recommendations"
    ON public.dsa_ai_recommendations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read daily challenges"
    ON public.dsa_daily_challenges
    FOR SELECT
    TO authenticated, anon
    USING (true);
