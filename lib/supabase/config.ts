export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  return Boolean(
    url &&
    key &&
    !url.includes('dummy-project') &&
    url.startsWith('https://') &&
    key !== 'dummy-anon-key'
  )
}
