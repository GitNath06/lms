'use client'

import React, { useState } from 'react'
import { FlaskConical, Shield, UserCheck, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'
import { signIn, signUp } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ThemeToggle from '@/components/ui/theme-toggle'

export default function LoginPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAuthAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    formData.set('role', role)

    try {
      if (tab === 'signin') {
        const result = await signIn(formData)
        if (result?.error) {
          setError(result.error)
        }
      } else {
        const result = await signUp(formData)
        if (result?.error) {
          setError(result.error)
        }
      }
    } catch (e: any) {
      if (!e?.message?.includes('NEXT_REDIRECT')) {
        setError('An unexpected error occurred during authentication.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200 relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-lg">
            <FlaskConical className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          LabSync Academic LIMS
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
          Laboratory Management & Practical Log Register
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="border border-zinc-200/80 dark:border-zinc-800 shadow-xl backdrop-blur-md bg-white/90 dark:bg-zinc-900/90">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-t-xl border-b border-zinc-200/60 dark:border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTab('signin')
                setError(null)
              }}
              className={`py-2 text-center rounded-lg transition-all ${
                tab === 'signin'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup')
                setError(null)
              }}
              className={`py-2 text-center rounded-lg transition-all ${
                tab === 'signup'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Register Faculty / Admin
            </button>
          </div>

          <CardContent className="p-6">
            {error && (
              <div className="mb-5 flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-mono">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAuthAction} className="space-y-4">
              {tab === 'signup' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Full Name
                    </label>
                    <Input
                      required
                      name="full_name"
                      type="text"
                      placeholder="e.g. Dr. Rajesh Sharma"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Department
                    </label>
                    <Input
                      required
                      name="department"
                      type="text"
                      placeholder="e.g. Computer Science / Physics"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Institutional Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('teacher')}
                        className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                          role === 'teacher'
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Teacher / Faculty</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                          role === 'admin'
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>Lab In-Charge</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Institutional Email
                </label>
                <Input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="faculty@college.edu.np"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                <Input
                  required
                  name="password"
                  type="password"
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full justify-center gap-1.5 text-xs font-semibold shadow-xs"
                >
                  <span>{loading ? 'Authenticating...' : tab === 'signin' ? 'Sign In to Portal' : 'Complete Registration'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>

            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
              <a
                href="/"
                className="text-[11px] font-mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              >
                ← Back to Live Overview Feed
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
