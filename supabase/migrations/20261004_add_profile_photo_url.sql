-- Add photo_url and avatar_url to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.profiles.photo_url IS 'Base64 data URL or storage URI for user profile avatar';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Alias/fallback storage URI for user profile avatar';
