import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345',
  });
  console.log('Result:', { session: !!data?.session, error: error?.message, user: data?.user?.email });
}
check();
