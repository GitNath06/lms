'use client'

import React, { useState, Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  FlaskConical,
  Shield,
  UserCheck,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Key,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Cpu,
  Atom,
  TestTube2,
  Activity,
  ChevronRight,
  Building2,
  Clock,
  Loader2,
  X,
  HelpCircle,
  Phone,
  Check,
  RotateCcw,
  KeyRound,
  ShieldCheck,
} from 'lucide-react'
import { signIn } from '@/app/actions/auth'
import {
  generateAndSendSignupOtp,
  verifySignupAndCreateAccount,
  generateAndSendPasswordResetOtp,
  verifyAndResetPassword,
} from '@/app/actions/otp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ThemeToggle from '@/components/ui/theme-toggle'

const DEMO_ACCOUNTS = [
  {
    roleLabel: 'Super Admin',
    name: 'System Admin',
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345',
    icon: '👑',
    accentColor: 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20',
    desc: 'Full institutional governance & user management',
  },
  {
    roleLabel: 'Lab Incharge',
    name: 'Dr. Rajesh Sharma',
    email: 'incharge@rrl.edu.np',
    password: 'Incharge@12345',
    icon: '🔬',
    accentColor: 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20',
    desc: 'Apparatus inventory, repairs & laboratory oversight',
  },
  {
    roleLabel: 'HOD',
    name: 'Head of Department',
    email: 'hod@rrl.edu.np',
    password: 'Hod@12345',
    icon: '🏛️',
    accentColor: 'border-purple-500/50 text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20',
    desc: 'Academic compliance & escalated incident review',
  },
  {
    roleLabel: 'Teacher (Phys)',
    name: 'Dr. Prakash Adhikari',
    email: 'p.adhikari@rrl.edu.np',
    password: 'Teacher@12345',
    icon: '👨‍🏫',
    accentColor: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20',
    desc: 'Physics practical session logging & syllabus tracking',
  },
  {
    roleLabel: 'Teacher (Comp)',
    name: 'Er. Anish Karki',
    email: 'a.karki@rrl.edu.np',
    password: 'Teacher@12345',
    icon: '👨‍🏫',
    accentColor: 'border-cyan-500/50 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20',
    desc: 'Computer lab exercises & attendance submission',
  },
  {
    roleLabel: 'Teacher (General)',
    name: 'General Faculty',
    email: 'teacher@rrl.edu.np',
    password: 'Teacher@12345',
    icon: '👨‍🏫',
    accentColor: 'border-teal-500/50 text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20',
    desc: 'General instructor practical logging profile',
  },
]

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get('redirect') || searchParams.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null)

  // Teacher Registration Modal with Email OTP State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [regStep, setRegStep] = useState<'form' | 'otp' | 'success'>('form')
  const [regName, setRegName] = useState('')
  const [regDept, setRegDept] = useState('Science Department')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regOtp, setRegOtp] = useState('')
  const [regDevOtp, setRegDevOtp] = useState<string | undefined>()
  const [regError, setRegError] = useState<string | null>(null)
  const [regLoading, setRegLoading] = useState(false)
  const [regTimer, setRegTimer] = useState(60)

  // Forgot Password Modal with Email OTP State
  const [isForgotOpen, setIsForgotOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'success'>('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPass, setForgotNewPass] = useState('')
  const [forgotDevOtp, setForgotDevOtp] = useState<string | undefined>()
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotLoading, setForgotLoading] = useState(false)

  // Countdown timer for OTP resends
  useEffect(() => {
    let interval: any
    if (regStep === 'otp' && regTimer > 0) {
      interval = setInterval(() => setRegTimer((t) => t - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [regStep, regTimer])

  useEffect(() => {
    const errParam = searchParams.get('error')
    if (errParam === 'account_deactivated') {
      setError('This institutional account has been deactivated by the Super Administrator.')
    } else if (errParam === 'unauthorized_admin_access') {
      setError('Administrative Command Center (/admin) requires Super Admin authorization.')
    }
  }, [searchParams])

  // Handle 1-Click Demo Select (auto-populates Email + Password)
  function handleSelectDemo(acc: (typeof DEMO_ACCOUNTS)[0]) {
    setEmail(acc.email)
    setPassword(acc.password)
    setSelectedDemo(acc.email)
    setError(null)
  }

  // Handle Instant 1-Click Demo Login
  async function handleInstantDemoLogin(acc: (typeof DEMO_ACCOUNTS)[0]) {
    setEmail(acc.email)
    setPassword(acc.password)
    setSelectedDemo(acc.email)
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set('email', acc.email)
    formData.set('password', acc.password)
    formData.set('redirect', redirectTarget)

    try {
      const res = await signIn(formData)
      if (res?.error) {
        setError(res.error)
        setLoading(false)
      }
    } catch (e: any) {
      if (!e?.message?.includes('NEXT_REDIRECT')) {
        setError('Authentication service error. Please try again.')
        setLoading(false)
      }
    }
  }

  // Standard Login Action
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('redirect', redirectTarget)

    try {
      const res = await signIn(formData)
      if (res?.error) {
        setError(res.error)
        setLoading(false)
      }
    } catch (e: any) {
      if (!e?.message?.includes('NEXT_REDIRECT')) {
        setError('Authentication service error. Please try again.')
        setLoading(false)
      }
    }
  }

  // --- Step 1: Send Signup OTP ---
  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(null)
    setRegLoading(true)

    try {
      const res = await generateAndSendSignupOtp(regEmail, regName)
      if (res.success) {
        setRegDevOtp(res.devOtp)
        setRegStep('otp')
        setRegTimer(60)
      } else {
        setRegError(res.error || 'Failed to dispatch verification code.')
      }
    } finally {
      setRegLoading(false)
    }
  }

  // --- Step 2: Verify Signup OTP & Register Pending Account ---
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(null)
    setRegLoading(true)

    try {
      const formData = new FormData()
      formData.set('email', regEmail)
      formData.set('full_name', regName)
      formData.set('phone', regPhone)
      formData.set('department', regDept)
      formData.set('password', regPass)

      const res = await verifySignupAndCreateAccount(formData, regOtp)
      if (res.success) {
        setRegStep('success')
      } else {
        setRegError(res.error || 'Verification code failed. Please try again.')
      }
    } finally {
      setRegLoading(false)
    }
  }

  // --- Step 1: Send Forgot Password OTP ---
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)
    setForgotLoading(true)

    try {
      const res = await generateAndSendPasswordResetOtp(forgotEmail)
      if (res.success) {
        setForgotDevOtp(res.devOtp)
        setForgotStep('otp')
      } else {
        setForgotError(res.error || 'Account not found or failed to send code.')
      }
    } finally {
      setForgotLoading(false)
    }
  }

  // --- Step 2: Verify Forgot Password OTP & Set New Password ---
  const handleVerifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)
    setForgotLoading(true)

    try {
      const res = await verifyAndResetPassword(forgotEmail, forgotOtp, forgotNewPass)
      if (res.success) {
        setForgotStep('success')
      } else {
        setForgotError(res.error || 'Invalid code or password reset failed.')
      }
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-5 animate-in fade-in zoom-in-95 duration-300">
      {/* Frosted Glass Card */}
      <div className="relative rounded-3xl p-7 sm:p-8 bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl backdrop-blur-2xl transition-all">
        {/* Glow ambient background aura */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 ring-4 ring-indigo-500/10 mb-1">
            <FlaskConical className="h-6 w-6 animate-pulse-subtle" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono">
              Academic Portal Login
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
              Enter your verified institutional credentials to authenticate
            </p>
          </div>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div
            className={`mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl text-xs font-mono animate-in slide-in-from-top-2 duration-200 border ${
              error.includes('pending') || error.includes('approval')
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {error.includes('pending') || error.includes('approval') ? (
              <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400 animate-pulse" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            )}
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Clean Standard Login Form: Email + Password Only (No role picking!) */}
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTarget} />

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Institutional Email</span>
              <span className="text-[10px] text-zinc-400 font-mono">e.g. @rrl.edu.np</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Mail className="h-4 w-4" />
              </div>
              <Input
                required
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@rrl.edu.np"
                autoComplete="email"
                className="pl-10 h-11 text-xs rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-sans"
              />
            </div>
          </div>

          {/* Password Field with Reveal Toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Account Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsForgotOpen(true)
                  setForgotStep('email')
                  setForgotEmail(email || '')
                  setForgotError(null)
                }}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-sans cursor-pointer font-medium"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                required
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="pl-10 pr-10 h-11 text-xs rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember Workstation checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
              />
              <span>Remember this lab terminal</span>
            </label>
          </div>

          {/* Primary Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all duration-200 gap-2 cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Laboratory Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Secondary Actions: Register Teacher Modal Trigger */}
        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-sans text-zinc-500">
          <span>New Faculty or Teacher?</span>
          <button
            type="button"
            onClick={() => {
              setIsRegisterOpen(true)
              setRegStep('form')
              setRegError(null)
            }}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-xs cursor-pointer"
          >
            Request Access (OTP Verified) →
          </button>
        </div>
      </div>

      {/* ⚡ Sleek 1-Click Evaluation / Demo Accounts Bar */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-800/70 shadow-sm backdrop-blur-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Key className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              1-Click Demo Evaluation (Fast Test)
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            Click to auto-fill & test
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((acc) => {
            const isSelected = selectedDemo === acc.email && email === acc.email
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleSelectDemo(acc)}
                onDoubleClick={() => handleInstantDemoLogin(acc)}
                title={`Double click for instant login as ${acc.roleLabel}`}
                className={`p-2 rounded-xl border text-left transition-all relative cursor-pointer ${acc.accentColor} ${
                  isSelected ? 'ring-2 ring-indigo-500 shadow-sm font-semibold' : 'opacity-85 hover:opacity-100'
                }`}
              >
                {isSelected && (
                  <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold truncate">
                  <span>{acc.icon}</span>
                  <span className="truncate">{acc.roleLabel}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {acc.email}
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono text-center pt-1">
          * Roles are resolved automatically by the server based on credentials.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 🛡️ MODAL 1: Email-OTP Verified Teacher Registration (3-Step Flow) */}
      {/* ========================================================================= */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold font-mono text-zinc-950 dark:text-white">
                  Teacher Registration (Email OTP)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error in modal */}
            {regError && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            {/* STEP 1: Details Form */}
            {regStep === 'form' && (
              <form onSubmit={handleSendSignupOtp} className="space-y-3 font-sans">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Enter your official details. A 6-digit verification code will be sent to your institutional email to prevent unauthorized signups.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Full Name
                  </label>
                  <Input
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Dr. Nirmala Poudel"
                    className="h-10 text-xs rounded-xl font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Department / Subject
                    </label>
                    <Input
                      required
                      value={regDept}
                      onChange={(e) => setRegDept(e.target.value)}
                      placeholder="e.g. Chemistry"
                      className="h-10 text-xs rounded-xl font-sans"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Institutional Email (OTP Target)
                  </label>
                  <Input
                    required
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="n.poudel@rrl.edu.np"
                    className="h-10 text-xs rounded-xl font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Account Password
                  </label>
                  <Input
                    required
                    type="password"
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-10 text-xs rounded-xl font-sans"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRegisterOpen(false)}
                    className="text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={regLoading}
                    className="text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer"
                  >
                    {regLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    <span>Send Verification Code →</span>
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 2: 6-Digit OTP Entry */}
            {regStep === 'otp' && (
              <form onSubmit={handleVerifySignupOtp} className="space-y-4 font-sans text-center">
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/70 text-left">
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">
                    Verification code dispatched to:
                  </div>
                  <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {regEmail}
                  </div>
                </div>

                {/* Development Mode Quick Code Hint */}
                {regDevOtp && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono flex items-center justify-between">
                    <span>⚡ Dev Code: <strong>{regDevOtp}</strong></span>
                    <button
                      type="button"
                      onClick={() => setRegOtp(regDevOtp)}
                      className="text-[10px] font-bold underline cursor-pointer"
                    >
                      Fill
                    </button>
                  </div>
                )}

                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">
                    Enter 6-Digit Code
                  </label>
                  <Input
                    required
                    maxLength={6}
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="h-12 text-center text-2xl font-mono tracking-[8px] font-bold rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Code expires in 10 minutes.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setRegStep('form')}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline cursor-pointer"
                  >
                    ← Edit Details
                  </button>

                  <button
                    type="button"
                    disabled={regTimer > 0 || regLoading}
                    onClick={handleSendSignupOtp}
                    className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 disabled:text-zinc-400 cursor-pointer"
                  >
                    {regTimer > 0 ? `Resend in ${regTimer}s` : 'Resend Code'}
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={regLoading || regOtp.length !== 6}
                  className="w-full h-10 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  {regLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>Verify Email & Submit Application</span>
                </Button>
              </form>
            )}

            {/* STEP 3: Verification Success & Pending Approval Notice */}
            {regStep === 'success' && (
              <div className="text-center space-y-4 py-3 font-sans animate-in zoom-in-95 duration-200">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Check className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                    Email Verified!
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed px-2">
                    Your institutional registration has been submitted and is currently in the <strong>Super Admin Review Queue</strong>.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left space-y-1 text-xs text-amber-800 dark:text-amber-300">
                  <div className="font-bold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Pending Super Admin Review</span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    Email Verified! Your application is pending Super Admin review. You will receive access once approved.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    setIsRegisterOpen(false)
                    setEmail(regEmail)
                    setError('Your account is pending Super Admin approval. Please await administrator verification.')
                  }}
                  className="w-full h-10 text-xs font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 cursor-pointer"
                >
                  Return to Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔐 MODAL 2: Self-Service Password Recovery via Email OTP */}
      {/* ========================================================================= */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold font-mono text-zinc-950 dark:text-white">
                  Reset Account Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error */}
            {forgotError && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Enter Email */}
            {forgotStep === 'email' && (
              <form onSubmit={handleSendForgotOtp} className="space-y-3 font-sans">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Enter your registered institutional email. We will send a 6-digit recovery code to verify your identity.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Institutional Email Address
                  </label>
                  <Input
                    required
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="faculty@rrl.edu.np"
                    autoFocus
                    className="h-10 text-xs rounded-xl font-sans"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsForgotOpen(false)}
                    className="text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={forgotLoading}
                    className="text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer"
                  >
                    {forgotLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    <span>Send Recovery Code</span>
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 2: Enter OTP & New Password */}
            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyForgotOtp} className="space-y-3 font-sans">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
                  Recovery code dispatched to: <strong className="text-indigo-600 dark:text-indigo-400">{forgotEmail}</strong>
                </div>

                {forgotDevOtp && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono flex items-center justify-between">
                    <span>⚡ Dev Code: <strong>{forgotDevOtp}</strong></span>
                    <button
                      type="button"
                      onClick={() => setForgotOtp(forgotDevOtp)}
                      className="text-[10px] font-bold underline cursor-pointer"
                    >
                      Fill
                    </button>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">
                    6-Digit Verification Code
                  </label>
                  <Input
                    required
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="h-11 text-center text-xl font-mono tracking-[6px] font-bold rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    New Account Password
                  </label>
                  <Input
                    required
                    type="password"
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-10 text-xs rounded-xl"
                  />
                  <p className="text-[10px] text-zinc-400">At least 6 characters</p>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setForgotStep('email')}
                    className="text-xs text-zinc-500 hover:text-zinc-900 underline cursor-pointer"
                  >
                    ← Change Email
                  </button>
                  <Button
                    type="submit"
                    disabled={forgotLoading || forgotOtp.length !== 6 || forgotNewPass.length < 6}
                    className="text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer"
                  >
                    {forgotLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                    <span>Update Password</span>
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 3: Success Notice */}
            {forgotStep === 'success' && (
              <div className="text-center space-y-4 py-3 font-sans animate-in zoom-in-95 duration-200">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Check className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                    Password Reset Complete!
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed px-2">
                    Your institutional password has been updated. You can now sign in to the laboratory portal.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    setIsForgotOpen(false)
                    setEmail(forgotEmail)
                  }}
                  className="w-full h-10 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  Sign In Now
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center relative overflow-hidden transition-colors duration-300">
      {/* Dynamic Animated Ambient Orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[100px] animate-aurora-1 pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 dark:bg-purple-600/15 rounded-full blur-[100px] animate-aurora-2 pointer-events-none" />
      <div className="absolute top-3/4 left-1/3 w-80 h-80 bg-cyan-500/10 dark:bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Bar with Brand & Theme Switcher */}
      <header className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 sm:px-12 z-20">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-sm">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <span className="font-mono font-bold text-xs tracking-wider text-zinc-900 dark:text-white uppercase">
              LabSync LIMS
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-zinc-400">
              v4.2 Lab Management System
            </span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Split Layout: Showcase & Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full max-w-[1400px]">
          {/* Left Column: High-Tech Laboratory Telemetry Showcase (Desktop) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 pr-4">
            {/* Status Live Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold w-fit shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All 3 Laboratories Connected (Phys • Chem • Comp)</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white font-mono leading-tight">
                Centralized Laboratory Management & Practical Register
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
                Streamlining academic practical sessions, student attendance registers, incident damage escalations, and certified reporting for institutional excellence.
              </p>
            </div>

            {/* Interactive Telemetry Cards Grid */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 backdrop-blur-xl space-y-1 shadow-2xs hover:border-indigo-500/40 transition-colors animate-float-slow">
                <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                  <Cpu className="h-5 w-5" />
                  <span className="text-[10px] font-mono font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-zinc-950 dark:text-white pt-1">
                  110+ Workstations
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">
                  Real-time telemetry across labs
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 backdrop-blur-xl space-y-1 shadow-2xs hover:border-emerald-500/40 transition-colors animate-float-reverse">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <Activity className="h-5 w-5" />
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Term 2083
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-zinc-950 dark:text-white pt-1">
                  14 Today's Practicals
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">
                  Curriculum syllabus tracking
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 backdrop-blur-xl space-y-1 shadow-2xs hover:border-purple-500/40 transition-colors">
                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                  <Atom className="h-5 w-5" />
                  <span className="text-[10px] font-mono font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                    Role-Bound
                  </span>
                </div>
                <div className="text-sm font-bold font-mono text-zinc-950 dark:text-white pt-1">
                  4-Tier RBAC Security
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">
                  Super Admin, Incharge, HOD, Teacher
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 backdrop-blur-xl space-y-1 shadow-2xs hover:border-cyan-500/40 transition-colors">
                <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
                  <Clock className="h-5 w-5" />
                  <span className="text-[10px] font-mono font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded">
                    Sync
                  </span>
                </div>
                <div className="text-sm font-bold font-mono text-zinc-950 dark:text-white pt-1">
                  Offline Outbox Buffer
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">
                  Resilient practical logging
                </div>
              </div>
            </div>

            {/* Institution Affiliation Stamp */}
            <div className="p-3.5 rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-500">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                <span>Radha Raman Secondary School</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase">
                Official Lab Terminal
              </span>
            </div>
          </div>

          {/* Right Column: Modern Authentication Card */}
          <div className="lg:col-span-6 flex items-center justify-center w-full">
            <Suspense fallback={<div className="p-8 text-center text-xs text-zinc-400 font-mono">Loading portal authentication...</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}
