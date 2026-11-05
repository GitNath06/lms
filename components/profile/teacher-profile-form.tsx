'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Phone,
  Mail,
  Shield,
  BookOpen,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bell,
  GraduationCap,
  Camera,
  Trash2,
  Clock,
  Lock,
  Plus,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { updateTeacherProfile, updateTeacherAvatar } from '@/app/actions/profile'
import { compressImage } from '@/lib/image-compress'
import { clearUserScopeCache } from '@/hooks/use-user-scope'
import {
  changeCurrentPassword,
  initiateDualOtpEmailChange,
  confirmDualOtpEmailChange,
} from '@/app/actions/profile-credentials'
import PasswordRequirementsChecklist from '@/components/auth/password-requirements-checklist'
import { validatePasswordPolicy } from '@/lib/auth-policy'
import type { UserProfile } from '@/lib/permissions'
import type { UserScopeContext } from '@/lib/context/user-scope'

interface TeacherProfileFormProps {
  initialProfile: UserProfile
  userScope?: UserScopeContext
}

export function TeacherProfileForm({ initialProfile, userScope }: TeacherProfileFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Active Tab: 'identity' | 'security' | 'preferences'
  const [activeTab, setActiveTab] = useState<'identity' | 'security' | 'preferences'>('identity')

  // Avatar State
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialProfile.photo_url || initialProfile.avatar_url || null
  )
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form Fields - Bio & Identity
  const [honorific, setHonorific] = useState(initialProfile.honorific || '')
  const [fullName, setFullName] = useState(initialProfile.full_name || '')
  const [phone, setPhone] = useState(initialProfile.phone || '')
  const [bio, setBio] = useState(initialProfile.bio || '')

  // Current Email
  const [currentEmail, setCurrentEmail] = useState(initialProfile.email || '')

  // Preferences
  const currentPrefs = (initialProfile.teaching_preferences || {}) as {
    specializations?: string[]
    notifyScheduleConflicts?: boolean
    notifyUpcomingLabs?: boolean
  }

  const [specializations, setSpecializations] = useState<string[]>(
    currentPrefs.specializations || ['Physics Practical', 'Computer Science']
  )
  const [newSpecInput, setNewSpecInput] = useState('')
  const [notifyConflicts, setNotifyConflicts] = useState(
    currentPrefs.notifyScheduleConflicts ?? true
  )
  const [notifyUpcoming, setNotifyUpcoming] = useState(
    currentPrefs.notifyUpcomingLabs ?? true
  )

  const isAccountPending =
    initialProfile.approval_status === 'pending' || Boolean(userScope?.isPending)

  // -------------------------------------------------------------
  // CREDENTIALS STATE: Password Change
  // -------------------------------------------------------------
  const [currPassword, setCurrPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrPass, setShowCurrPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [isPassChanging, setIsPassChanging] = useState(false)
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // -------------------------------------------------------------
  // CREDENTIALS STATE: Dual-OTP Email Change
  // -------------------------------------------------------------
  const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request')
  const [emailCurrPassword, setEmailCurrPassword] = useState('')
  const [showEmailCurrPass, setShowEmailCurrPass] = useState(false)
  const [targetNewEmail, setTargetNewEmail] = useState('')
  const [oldEmailOtp, setOldEmailOtp] = useState('')
  const [newEmailOtp, setNewEmailOtp] = useState('')
  const [isEmailSending, setIsEmailSending] = useState(false)
  const [isEmailConfirming, setIsEmailConfirming] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [emailTimer, setEmailTimer] = useState(60)
  const [devOtpOld, setDevOtpOld] = useState<string | undefined>()
  const [devOtpNew, setDevOtpNew] = useState<string | undefined>()

  // Resend Countdown Timer
  useEffect(() => {
    let interval: any
    if (emailStep === 'verify' && emailTimer > 0) {
      interval = setInterval(() => setEmailTimer((t) => t - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [emailStep, emailTimer])

  const getInitials = (name?: string) => {
    if (!name) return 'FC'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // --- Avatar Handlers ---
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarMessage({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WEBP).' })
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setAvatarMessage({ type: 'error', text: 'Image file size must be less than 4MB.' })
      return
    }

    setAvatarMessage(null)
    setIsAvatarUploading(true)

    try {
      const compressedWebP = await compressImage(file, {
        maxWidth: 256,
        maxHeight: 256,
        quality: 0.75,
        format: 'image/webp',
      })
      const res = await updateTeacherAvatar(compressedWebP)
      if (res.success) {
        setAvatarUrl(res.photo_url || compressedWebP)
        setAvatarMessage({ type: 'success', text: 'Profile picture updated successfully.' })
        clearUserScopeCache()
        router.refresh()
      } else {
        setAvatarMessage({ type: 'error', text: res.error || 'Failed to upload photo.' })
      }
    } catch (err: any) {
      setAvatarMessage({ type: 'error', text: err?.message || 'Error uploading photo.' })
    } finally {
      setIsAvatarUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarMessage(null)
    setIsAvatarUploading(true)
    try {
      const res = await updateTeacherAvatar('')
      if (res.success) {
        setAvatarUrl(null)
        setAvatarMessage({ type: 'success', text: 'Profile picture removed.' })
        clearUserScopeCache()
        router.refresh()
      } else {
        setAvatarMessage({ type: 'error', text: res.error || 'Failed to remove photo.' })
      }
    } catch (err: any) {
      setAvatarMessage({ type: 'error', text: err?.message || 'Error removing photo.' })
    } finally {
      setIsAvatarUploading(false)
    }
  }

  // --- Subject Focus Tags ---
  const handleAddSpec = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newSpecInput.trim()
    if (trimmed && !specializations.includes(trimmed)) {
      setSpecializations([...specializations, trimmed])
      setNewSpecInput('')
    }
  }

  const handleRemoveSpec = (tag: string) => {
    setSpecializations(specializations.filter((s) => s !== tag))
  }

  // --- Profile Identity Save ---
  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMessage(null)

    startTransition(async () => {
      const res = await updateTeacherProfile({
        full_name: fullName,
        phone: phone || null,
        honorific: honorific || null,
        bio: bio || null,
        teaching_preferences: {
          specializations,
          notifyScheduleConflicts: notifyConflicts,
          notifyUpcomingLabs: notifyUpcoming,
        },
      })

      if (res.success) {
        clearUserScopeCache()
        setStatusMessage({ type: 'success', text: 'Faculty profile and preferences saved successfully.' })
        router.refresh()
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to update profile.' })
      }
    })
  }

  // --- Password Change Handler ---
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassMessage(null)

    if (!currPassword) {
      setPassMessage({ type: 'error', text: 'Please enter your current password.' })
      return
    }

    const val = validatePasswordPolicy(newPassword)
    if (!val.isValid) {
      setPassMessage({ type: 'error', text: `New password requirement not met: ${val.errors.join(', ')}.` })
      return
    }

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'New password and confirmation password do not match.' })
      return
    }

    if (currPassword === newPassword) {
      setPassMessage({ type: 'error', text: 'New password cannot be the same as your current password.' })
      return
    }

    setIsPassChanging(true)
    try {
      const res = await changeCurrentPassword({
        currentPassword: currPassword,
        newPassword,
        confirmPassword,
      })

      if (res.success) {
        setPassMessage({ type: 'success', text: res.message || 'Password changed successfully!' })
        setCurrPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPassMessage({ type: 'error', text: res.error || 'Failed to change password.' })
      }
    } catch (err: any) {
      setPassMessage({ type: 'error', text: err?.message || 'Unexpected error changing password.' })
    } finally {
      setIsPassChanging(false)
    }
  }

  // --- Email Change: Step 1 Send Dual OTPs ---
  const handleInitiateEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMessage(null)

    if (!emailCurrPassword) {
      setEmailMessage({ type: 'error', text: 'Please enter your current password to authorize email change.' })
      return
    }

    if (!targetNewEmail || !targetNewEmail.includes('@')) {
      setEmailMessage({ type: 'error', text: 'Please enter a valid new institutional email address.' })
      return
    }

    if (targetNewEmail.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
      setEmailMessage({ type: 'error', text: 'The new email must be different from your current address.' })
      return
    }

    setIsEmailSending(true)
    try {
      const res = await initiateDualOtpEmailChange({
        currentPassword: emailCurrPassword,
        newEmail: targetNewEmail,
      })

      if (res.success) {
        setEmailStep('verify')
        setEmailTimer(60)
        setDevOtpOld(res.devOtpOld)
        setDevOtpNew(res.devOtpNew)
        setEmailMessage({
          type: 'success',
          text: `Verification codes dispatched! Check both ${currentEmail} and ${targetNewEmail}.`,
        })
      } else {
        setEmailMessage({ type: 'error', text: res.error || 'Failed to dispatch verification codes.' })
      }
    } catch (err: any) {
      setEmailMessage({ type: 'error', text: err?.message || 'Error initiating email change.' })
    } finally {
      setIsEmailSending(false)
    }
  }

  // --- Email Change: Step 2 Verify Both OTPs ---
  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMessage(null)

    if (!oldEmailOtp.trim() || !newEmailOtp.trim()) {
      setEmailMessage({ type: 'error', text: 'Both verification codes (from old and new emails) are required.' })
      return
    }

    setIsEmailConfirming(true)
    try {
      const res = await confirmDualOtpEmailChange({
        currentPassword: emailCurrPassword,
        newEmail: targetNewEmail,
        oldEmailOtp: oldEmailOtp.trim(),
        newEmailOtp: newEmailOtp.trim(),
      })

      if (res.success) {
        clearUserScopeCache()
        setEmailMessage({ type: 'success', text: res.message || 'Email successfully updated!' })
        setCurrentEmail(targetNewEmail.trim().toLowerCase())
        setEmailStep('request')
        setEmailCurrPassword('')
        setTargetNewEmail('')
        setOldEmailOtp('')
        setNewEmailOtp('')
        setDevOtpOld(undefined)
        setDevOtpNew(undefined)
        router.refresh()
      } else {
        setEmailMessage({ type: 'error', text: res.error || 'Failed to confirm email change.' })
      }
    } catch (err: any) {
      setEmailMessage({ type: 'error', text: err?.message || 'Error confirming email change.' })
    } finally {
      setIsEmailConfirming(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Top Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('identity')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'identity'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <User className="h-4 w-4 text-indigo-500" />
          <span>Academic Profile & Scope</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <KeyRound className="h-4 w-4 text-amber-500" />
          <span>Security & Credentials</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'preferences'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Bell className="h-4 w-4 text-emerald-500" />
          <span>Preferences & Alerts</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ACADEMIC IDENTITY & SCOPE                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'identity' && (
        <form onSubmit={handleSubmitProfile} className="space-y-6">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Biographical & Academic Identity Section */}
          <div className="glass-card p-5 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              <User className="h-4 w-4 text-indigo-500" />
              <span>Biographical & Academic Identity</span>
            </div>

            {/* Profile Picture / Avatar Management */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-indigo-500/30 overflow-hidden bg-gradient-to-br from-indigo-500/10 via-zinc-100 to-zinc-200 dark:from-indigo-950/40 dark:via-zinc-800 dark:to-zinc-900 flex items-center justify-center shadow-inner">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName || 'Faculty Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl sm:text-2xl font-bold font-heading text-indigo-600 dark:text-indigo-400 tracking-wider">
                      {getInitials(fullName)}
                    </span>
                  )}
                </div>
                {isAvatarUploading && (
                  <div className="absolute inset-0 rounded-2xl bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Faculty Profile Picture
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Upload an official institutional photograph. Recommended: square JPG, PNG, or WEBP under 4MB.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFile}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isAvatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Upload Photo</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      disabled={isAvatarUploading}
                      onClick={handleRemoveAvatar}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-200 dark:bg-zinc-800 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {avatarMessage && (
                  <div
                    className={`text-xs font-medium flex items-center gap-1.5 ${
                      avatarMessage.type === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {avatarMessage.type === 'success' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{avatarMessage.text}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Honorific */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                  Honorific / Title
                </label>
                <select
                  value={honorific}
                  onChange={(e) => setHonorific(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="">None</option>
                  <option value="Er.">Er. (Engineer)</option>
                  <option value="Dr.">Dr. (Doctorate)</option>
                  <option value="Prof.">Prof. (Professor)</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                </select>
              </div>

              {/* Full Name */}
              <div className="md:col-span-9 space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Adhikari"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              {/* Email (With quick link to Credentials tab) */}
              <div className="md:col-span-6 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-zinc-400" />
                    <span>Institutional Email</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('security')}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
                <div className="px-3 py-2 text-xs rounded-xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono select-none flex items-center justify-between">
                  <span>{currentEmail}</span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Primary
                  </span>
                </div>
              </div>

              {/* Contact Phone */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-zinc-400" />
                  <span>Contact Number</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +977 9841XXXXXX"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              {/* Professional Bio */}
              <div className="md:col-span-12 space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                  Faculty Specialization & Research Bio
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your subject focus, laboratory practical modules, or research areas..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>
          </div>

          {/* Assigned Curriculum & Laboratory Scope Section */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
                <GraduationCap className="h-4 w-4 text-indigo-500" />
                <span>Assigned Curriculum & Laboratory Scope</span>
              </div>
              {isAccountPending ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Pending Admin Allocation
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Institutional Allocation
                </span>
              )}
            </div>

            {isAccountPending ? (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  Curriculum mapping is currently pending administrator verification.
                </p>
                <p className="text-[11px]">
                  Once your faculty registration is approved, your institutional class assignments (e.g. Class 11 & 12 Science/Engineering), practical subjects, and assigned laboratories will be displayed here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Assigned Classes & Labs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Assigned Cohorts & Classes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {userScope && userScope.assignedClasses.length > 0 ? (
                        userScope.assignedClasses.map((cls) => (
                          <span key={cls} className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold">
                            {cls}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400 text-xs italic">No specific class batch assigned yet</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Designated Laboratories</div>
                    <div className="flex flex-wrap gap-1.5">
                      {userScope && userScope.assignedLabIds.length > 0 ? (
                        userScope.assignedLabIds.map((lab) => (
                          <span key={lab} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-semibold uppercase">
                            {lab}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400 text-xs italic">No lab facility assigned yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assigned Subjects Table */}
                {userScope && userScope.assignedSubjects.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Curricular Practical Subjects</div>
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                      {userScope.assignedSubjects.map((sub, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs bg-zinc-50/50 dark:bg-zinc-900/30">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              <span className="font-mono text-indigo-600 dark:text-indigo-400">{sub.code}</span>
                              <span>{sub.title}</span>
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              Grade: {sub.grade} • Facility: {sub.labName || sub.labId.toUpperCase()}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                            {sub.labId}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Save Action Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Faculty Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SECURITY & CREDENTIALS                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Card 1: Change Account Password */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
                <Lock className="h-4 w-4 text-amber-500" />
                <span>Change Account Password</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Institutional Policy Standard</span>
            </div>

            {passMessage && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                  passMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                }`}
              >
                {passMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{passMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrPass ? 'text' : 'password'}
                    required
                    value={currPassword}
                    onChange={(e) => setCurrPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-10 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrPass(!showCurrPass)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showCurrPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full px-3 py-2 pr-10 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2 pr-10 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Live Password Policy Checklist */}
              {newPassword && (
                <PasswordRequirementsChecklist
                  password={newPassword}
                  confirmPassword={confirmPassword}
                  showConfirmMatch={true}
                />
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPassChanging}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isPassChanging ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Change Institutional Email (Dual-Channel Handshake) */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
                <Mail className="h-4 w-4 text-indigo-500" />
                <span>Change Institutional Email Address</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                <ShieldCheck className="h-3 w-3 text-indigo-500" />
                Dual-Channel Handshake
              </span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Institutional Security Requirement
              </p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                To prevent unauthorized takeovers and accidental lockouts, changing your email requires:
                <br />
                <strong>1. Password Re-Authentication</strong> • <strong>2. Authorization Code sent to current email</strong> • <strong>3. Verification Code sent to new email</strong>.
              </p>
            </div>

            {emailMessage && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
                  emailMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                }`}
              >
                {emailMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{emailMessage.text}</span>
              </div>
            )}

            {/* STEP 1: Request Codes */}
            {emailStep === 'request' && (
              <form onSubmit={handleInitiateEmailChange} className="space-y-4 max-w-xl">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                    Current Email Address
                  </label>
                  <div className="px-3 py-2 text-xs rounded-xl bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono select-none">
                    {currentEmail}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                    Re-Enter Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showEmailCurrPass ? 'text' : 'password'}
                      required
                      value={emailCurrPassword}
                      onChange={(e) => setEmailCurrPassword(e.target.value)}
                      placeholder="Confirm your identity with password"
                      className="w-full px-3 py-2 pr-10 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailCurrPass(!showEmailCurrPass)}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {showEmailCurrPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                    New Institutional Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={targetNewEmail}
                    onChange={(e) => setTargetNewEmail(e.target.value)}
                    placeholder="e.g. new.faculty@rrl.edu.np"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isEmailSending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isEmailSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending Codes to Both Emails...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        <span>Dispatch Verification Codes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Verify Dual OTPs */}
            {emailStep === 'verify' && (
              <form onSubmit={handleConfirmEmailChange} className="space-y-4 max-w-xl">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <span>Transfer Route:</span>
                    <button
                      type="button"
                      onClick={() => setEmailStep('request')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] cursor-pointer"
                    >
                      Change Destination
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {currentEmail}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-bold">
                      {targetNewEmail}
                    </span>
                  </div>
                </div>

                {/* Dev OTP Helper Banner */}
                {(devOtpOld || devOtpNew) && (
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-xs font-mono space-y-1">
                    <div className="text-[10px] uppercase text-zinc-400 font-bold">Development OTP Assist:</div>
                    {devOtpOld && <div>Current Email Code: <strong className="text-amber-600 dark:text-amber-400">{devOtpOld}</strong></div>}
                    {devOtpNew && <div>New Email Code: <strong className="text-indigo-600 dark:text-indigo-400">{devOtpNew}</strong></div>}
                  </div>
                )}

                {/* Old Email OTP */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                    1. Current Email Authorization Code ({currentEmail}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={oldEmailOtp}
                    onChange={(e) => setOldEmailOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="w-full tracking-widest text-center font-mono text-sm px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                {/* New Email OTP */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                    2. New Email Verification Code ({targetNewEmail}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newEmailOtp}
                    onChange={(e) => setNewEmailOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="w-full tracking-widest text-center font-mono text-sm px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isEmailConfirming || oldEmailOtp.length !== 6 || newEmailOtp.length !== 6}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isEmailConfirming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying & Migrating Email...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Verify Both Codes & Complete Transfer</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isEmailSending || emailTimer > 0}
                    onClick={handleInitiateEmailChange}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isEmailSending ? 'animate-spin' : ''}`} />
                    <span>{emailTimer > 0 ? `Resend (${emailTimer}s)` : 'Resend Codes'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 3: Security & Session Telemetry */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Institutional Clearance & Session Telemetry</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Assigned Role</div>
                <div className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100 uppercase">
                  {initialProfile.role}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Account Status</div>
                {isAccountPending ? (
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span>Pending Approval</span>
                  </div>
                ) : initialProfile.approval_status === 'rejected' ? (
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                    <span>Rejected</span>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Verified</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Operational Clearance</div>
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {isAccountPending ? 'Restricted Profile Access' : 'Full Operational Access'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: PREFERENCES & ALERTS                                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSubmitProfile} className="space-y-6">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Curricular Specializations & Preferences Section */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              <BookOpen className="h-4 w-4 text-emerald-500" />
              <span>Curricular Specializations & Practical Focus</span>
            </div>

            {/* Tag chips */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                Practical Subject Focus
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {specializations.map((spec) => (
                  <span
                    key={spec}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  >
                    <span>{spec}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpec(spec)}
                      className="hover:text-rose-500 text-zinc-400 transition-colors cursor-pointer text-xs font-bold"
                      title="Remove specialization"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1 max-w-md">
                <input
                  type="text"
                  value={newSpecInput}
                  onChange={(e) => setNewSpecInput(e.target.value)}
                  placeholder="Add subject (e.g. Chemistry Lab, Class 12 CS)"
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  type="button"
                  onClick={handleAddSpec}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Focus</span>
                </button>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-3">
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                <Bell className="h-3 w-3 text-zinc-400" />
                <span>Operational Reminders & Alerts</span>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyConflicts}
                  onChange={(e) => setNotifyConflicts(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  Notify me of timetable collisions or room double-booking alerts
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyUpcoming}
                  onChange={(e) => setNotifyUpcoming(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600 border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  Display live reminder banner for upcoming practical sessions within 15 minutes
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Preferences...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
