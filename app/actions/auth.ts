'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (!isSupabaseConfigured()) {
    // Development fallback
    revalidatePath('/', 'layout')
    redirect('/')
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = (formData.get('role') as 'admin' | 'teacher') || 'teacher'
  const department = (formData.get('department') as string) || 'Computer Science'

  if (!email || !password || !fullName) {
    return { error: 'Please provide name, email, and password.' }
  }

  if (!isSupabaseConfigured()) {
    // Development fallback
    revalidatePath('/', 'layout')
    redirect('/')
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
        department: department,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Create initial profile record if user created
  if (data.user) {
    await (supabase.from('profiles') as any).upsert({
      id: data.user.id,
      full_name: fullName,
      role: role,
      department: department,
    })
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getCurrentUserProfile() {
  if (!isSupabaseConfigured()) {
    return {
      id: 'local-admin',
      full_name: 'Dr. Rajesh Sharma',
      role: 'admin' as const,
      department: 'Computer Science & Engineering',
      created_at: new Date().toISOString(),
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return profile || {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Faculty Member',
      role: user.user_metadata?.role || 'teacher',
      department: user.user_metadata?.department || 'Science Department',
      created_at: user.created_at,
    }
  } catch (e) {
    return {
      id: 'local-user',
      full_name: 'Faculty Member',
      role: 'teacher' as const,
      department: 'Science Department',
      created_at: new Date().toISOString(),
    }
  }
}
