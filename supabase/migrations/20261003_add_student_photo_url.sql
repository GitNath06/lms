-- Add photo_url to students table for visual identity & avatars
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.students.photo_url IS 'Base64 data URL or storage URI for student face avatar';
