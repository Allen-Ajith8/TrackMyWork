-- ============================================================================
-- TrackMyWork - Database permission & profile repair
-- ============================================================================
-- Run this once in the Supabase Dashboard -> SQL Editor.
--
-- It fixes:
--   1. "permission denied for table ..." / 403 errors from the REST API.
--   2. "Could not find the table 'public.xxx' in the schema cache".
--   3. Missing public.users rows for OAuth / email sign-ups.
--   4. Allows a signed-in user to create their own public.users profile row.
--
-- Safe to run multiple times.
-- ============================================================================

-- 1. Schema + table privileges -------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Apply the same privileges to tables created in the future.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- 2. Let users create their own profile row -----------------------------------
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Create a public.users row automatically for every new auth user ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'username',
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill profile rows for users who signed up before the trigger ---------
INSERT INTO public.users (id, email, username, display_name, avatar_url)
SELECT
  u.id,
  COALESCE(u.email, ''),
  u.raw_user_meta_data->>'username',
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name'
  ),
  COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture'
  )
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = COALESCE(users.display_name, EXCLUDED.display_name),
  avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
  updated_at = NOW();

-- 5. Storage policies ---------------------------------------------------------
-- The artifacts bucket is private; uploads and reads are limited to room members.
DROP POLICY IF EXISTS "Artifacts upload" ON storage.objects;
CREATE POLICY "Artifacts upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artifacts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Artifacts read own room" ON storage.objects;
CREATE POLICY "Artifacts read own room" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'artifacts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.rooms
      WHERE public.is_room_member(auth.uid(), id)
    )
  );

DROP POLICY IF EXISTS "Avatar upload" ON storage.objects;
CREATE POLICY "Avatar upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatar update" ON storage.objects;
CREATE POLICY "Avatar update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Room assets upload" ON storage.objects;
CREATE POLICY "Room assets upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'room-assets' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Room assets read" ON storage.objects;
CREATE POLICY "Room assets read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'room-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.rooms
      WHERE public.is_room_member(auth.uid(), id)
    )
  );

-- 6. Ask PostgREST to reload its schema cache ---------------------------------
NOTIFY pgrst, 'reload schema';
