'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Users,
  Plus,
  Trash2,
  Edit3,
  Key,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  Sliders,
  RotateCcw,
  Clock,
  UserPlus,
  Phone,
  Mail,
  Calendar,
  X,
  ChevronRight,
  User,
  Check,
  XCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  UserProfile,
  UserRole,
  UserPermissions,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/lib/permissions'
import {
  getAllUsers,
  createUserAccount,
  updateUserCredentials,
  toggleUserActiveStatus,
  updateUserPermissions,
  deleteUserAccount,
  approveUserAccount,
  rejectUserAccount,
} from '@/app/actions/auth'
import { broadcastSync } from '@/lib/sync-bus'

interface UserAccessManagerProps {
  isEditModeUnlocked: boolean
  triggerToast: (msg: string) => void
}

export default function UserAccessManager({
  isEditModeUnlocked,
  triggerToast,
}: UserAccessManagerProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [mounted, setMounted] = useState<boolean>(false)

  // Slide-over drawer state
  const [selectedDrawerUser, setSelectedDrawerUser] = useState<UserProfile | null>(null)

  // Modals state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [permissionUser, setPermissionUser] = useState<UserProfile | null>(null)
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null)

  // Add User Form State
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('teacher')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit Credentials Form State
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('teacher')

  // Permissions Form State
  const [activePerms, setActivePerms] = useState<UserPermissions>({})

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadUsers()
  }, [])

  const requireEditMode = (): boolean => {
    if (!isEditModeUnlocked) {
      triggerToast('🔒 Precaution Active: Unlock the "Precaution Active" switch in the header to modify or delete staff accounts.')
      return false
    }
    return true
  }

  const pendingCount = useMemo(
    () => users.filter((u) => u.approval_status === 'pending').length,
    [users]
  )

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter === 'active' && (!u.is_active || u.approval_status === 'pending')) return false
      if (statusFilter === 'pending' && u.approval_status !== 'pending') return false
      if (statusFilter === 'deactivated' && u.is_active) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches =
          u.full_name.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [users, roleFilter, statusFilter, searchQuery])

  // Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!newFullName.trim() || !newEmail.trim() || !newPassword) return

    setIsSubmitting(true)
    try {
      const res = await createUserAccount({
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || undefined,
        password: newPassword,
        role: newRole,
      })

      if (res.success) {
        triggerToast(`Account created for ${newFullName} (${newRole.replace('_', ' ').toUpperCase()})!`)
        setIsAddUserOpen(false)
        setNewFullName('')
        setNewEmail('')
        setNewPhone('')
        setNewPassword('')
        broadcastSync('users', { action: 'created' })
        loadUsers()
      } else {
        triggerToast(`❌ ${res.error || 'Failed to create user'}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode() || !editingUser) return

    setIsSubmitting(true)
    try {
      const res = await updateUserCredentials(editingUser.id, {
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim() || undefined,
        new_password: editPassword.trim() || undefined,
        role: editRole,
      })

      if (res.success) {
        triggerToast(`Credentials updated for ${editFullName}!`)
        setEditingUser(null)
        if (selectedDrawerUser?.id === editingUser.id) {
          setSelectedDrawerUser((prev) =>
            prev
              ? {
                  ...prev,
                  full_name: editFullName.trim(),
                  email: editEmail.trim(),
                  phone: editPhone.trim() || null,
                  role: editRole,
                }
              : null
          )
        }
        broadcastSync('users', { action: 'updated' })
        loadUsers()
      } else {
        triggerToast(`❌ ${res.error || 'Failed to update credentials'}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (user: UserProfile) => {
    if (!requireEditMode()) return
    const nextStatus = !user.is_active

    const res = await toggleUserActiveStatus(user.id, nextStatus)
    if (res.success) {
      triggerToast(
        nextStatus
          ? `🟢 Account activated for ${user.full_name}`
          : `🔴 Account deactivated for ${user.full_name}. Login access blocked.`
      )
      if (selectedDrawerUser?.id === user.id) {
        setSelectedDrawerUser((prev) => (prev ? { ...prev, is_active: nextStatus } : null))
      }
      broadcastSync('users', { action: 'status_toggled' })
      loadUsers()
    } else {
      triggerToast(`❌ ${res.error || 'Failed to toggle status'}`)
    }
  }

  const handleApproveUser = async (user: UserProfile) => {
    if (!requireEditMode()) return

    const res = await approveUserAccount(user.id)
    if (res.success) {
      triggerToast(`🟢 Account approved for ${user.full_name}! Activation notice sent to ${user.email}.`)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, approval_status: 'approved', is_active: true } : u))
      )
      if (selectedDrawerUser?.id === user.id) {
        setSelectedDrawerUser((prev) => (prev ? { ...prev, approval_status: 'approved', is_active: true } : null))
      }
      broadcastSync('users', { action: 'approved', userId: user.id })
      loadUsers()
    } else {
      triggerToast(`❌ ${res.error || 'Failed to approve user'}`)
    }
  }

  const handleRejectUser = async (user: UserProfile) => {
    if (!requireEditMode()) return

    const res = await rejectUserAccount(user.id)
    if (res.success) {
      triggerToast(`Account registration declined for ${user.full_name}.`)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, approval_status: 'rejected', is_active: false } : u))
      )
      if (selectedDrawerUser?.id === user.id) {
        setSelectedDrawerUser((prev) => (prev ? { ...prev, approval_status: 'rejected', is_active: false } : null))
      }
      broadcastSync('users', { action: 'rejected', userId: user.id })
      loadUsers()
    } else {
      triggerToast(`❌ ${res.error || 'Failed to reject user'}`)
    }
  }

  const handleSavePermissions = async () => {
    if (!requireEditMode() || !permissionUser) return

    setIsSubmitting(true)
    try {
      const res = await updateUserPermissions(permissionUser.id, activePerms)
      if (res.success) {
        triggerToast(`Permissions updated for ${permissionUser.full_name}!`)
        if (selectedDrawerUser?.id === permissionUser.id) {
          setSelectedDrawerUser((prev) => (prev ? { ...prev, custom_permissions: activePerms } : null))
        }
        setPermissionUser(null)
        broadcastSync('users', { action: 'permissions_updated' })
        loadUsers()
      } else {
        triggerToast(`❌ ${res.error || 'Failed to update permissions'}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!requireEditMode() || !userToDelete) return

    setIsSubmitting(true)
    try {
      const res = await deleteUserAccount(userToDelete.id)
      if (res.success) {
        triggerToast(`Account for ${userToDelete.full_name} deleted.`)
        if (selectedDrawerUser?.id === userToDelete.id) {
          setSelectedDrawerUser(null)
        }
        setUserToDelete(null)
        broadcastSync('users', { action: 'deleted' })
        loadUsers()
      } else {
        triggerToast(`❌ ${res.error || 'Failed to delete account'}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const getEffectivePermissions = (u: UserProfile): Record<string, boolean> => {
    const roleDefaults = DEFAULT_ROLE_PERMISSIONS[u.role] || {}
    const custom = u.custom_permissions || {}
    return { ...roleDefaults, ...custom }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/80 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs font-sans">
        <div className="flex flex-1 items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search by name, email, phone, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-zinc-50 dark:bg-zinc-950 font-sans"
            />
          </div>

          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 text-xs bg-zinc-50 dark:bg-zinc-950 w-40 font-medium"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="lab_incharge">Lab Incharge</option>
            <option value="hod">HOD</option>
            <option value="teacher">Teacher</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 text-xs bg-zinc-50 dark:bg-zinc-950 w-48 font-medium"
          >
            <option value="all">All Statuses ({users.length})</option>
            {pendingCount > 0 && (
              <option value="pending">⚠️ Pending Approvals ({pendingCount})</option>
            )}
            <option value="active">Active Accounts</option>
            <option value="deactivated">Deactivated</option>
          </Select>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAddUserOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-semibold gap-1.5 shadow-xs shrink-0 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Teacher / Staff</span>
        </Button>
      </div>

      {/* ⚠️ Pending Approvals Notice Banner */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-950 dark:text-amber-200">
                {pendingCount} Staff Registration{pendingCount > 1 ? 's' : ''} Awaiting Your Approval
              </div>
              <div className="text-xs text-amber-800/80 dark:text-amber-300/80">
                New accounts have completed email OTP verification and need authorization before login access is granted.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setStatusFilter('pending')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-sans text-xs font-semibold gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <span>Review Pending ({pendingCount})</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 2. Main Users Table */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Teacher & Staff Directory
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 font-sans mt-0.5">
              Showing {filteredUsers.length} of {users.length} registered institutional accounts (Click row to inspect full profile)
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Refresh</span>
          </button>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-400 font-sans">
              Loading staff accounts...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-400 font-sans">
              No staff accounts match the filter criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
                  <th className="py-3 px-4">Staff Member & Email</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Institutional Role</th>
                  <th className="py-3 px-4">Access Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredUsers.map((u) => {
                  const initials = u.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  const isSuperAdmin = u.role === 'super_admin'
                  const isIncharge = u.role === 'lab_incharge'
                  const isHOD = u.role === 'hod'

                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedDrawerUser(u)}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8.5 w-8.5 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-zinc-950 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {u.full_name}
                            </div>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {u.email || 'No email registered'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4">
                        {u.phone ? (
                          <span className="flex items-center gap-1.5 font-mono text-zinc-700 dark:text-zinc-300 font-medium text-xs">
                            <Phone className="h-3 w-3 text-zinc-400" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* Role Badge - Pure Category Semantic (Neutral) */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80">
                          {isSuperAdmin && (
                            <Shield className="h-3 w-3 mr-1 text-zinc-500 shrink-0" />
                          )}
                          {u.role === 'super_admin'
                            ? 'Super Admin'
                            : u.role === 'lab_incharge'
                            ? 'Lab Incharge'
                            : u.role === 'hod'
                            ? 'HOD'
                            : 'Teacher'}
                        </span>
                      </td>

                      {/* Access Status */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {u.approval_status === 'pending' ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                            <span>Pending Review</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!isEditModeUnlocked}
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                              u.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                            title={
                              isEditModeUnlocked
                                ? u.is_active
                                  ? 'Click to deactivate login access'
                                  : 'Click to activate login access'
                                : 'Unlock Admin Edit Mode to toggle'
                            }
                          >
                            {u.is_active ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                                <span>Deactivated</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Admin Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {u.approval_status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                disabled={!isEditModeUnlocked}
                                onClick={() => handleApproveUser(u)}
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-bold gap-1 shadow-xs cursor-pointer"
                                title="Approve and activate account"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Approve</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isEditModeUnlocked}
                                onClick={() => handleRejectUser(u)}
                                className="h-7 px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold gap-1 border-rose-200 dark:border-rose-800 cursor-pointer"
                                title="Reject application"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              {/* Edit Credentials */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingUser(u)
                                  setEditFullName(u.full_name)
                                  setEditEmail(u.email || '')
                                  setEditPhone(u.phone || '')
                                  setEditRole(u.role)
                                  setEditPassword('')
                                }}
                                className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                title="Edit Credentials & Password"
                              >
                                <Key className="h-3.5 w-3.5" />
                              </Button>

                              {/* Permissions Matrix */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setPermissionUser(u)
                                  setActivePerms(u.custom_permissions || DEFAULT_ROLE_PERMISSIONS[u.role] || {})
                                }}
                                className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                                title="Customize Feature Permissions"
                              >
                                <Sliders className="h-3.5 w-3.5" />
                              </Button>

                              {/* Delete Account (Native disabled + tooltip wrapping) */}
                              <span
                                title={
                                  !isEditModeUnlocked
                                    ? 'Unlock edit mode to delete accounts'
                                    : u.role === 'super_admin'
                                    ? 'Super Admin accounts cannot be deleted'
                                    : 'Delete staff account'
                                }
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!isEditModeUnlocked || u.role === 'super_admin'}
                                  onClick={() => {
                                    if (!isEditModeUnlocked) return
                                    setUserToDelete(u)
                                  }}
                                  className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 📁 SLIDE-OVER ACCOUNT DETAILS DRAWER */}
      {mounted && selectedDrawerUser && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl border-l border-zinc-200 dark:border-zinc-800 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Staff Account Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDrawerUser(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
              {/* Profile Card */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-center space-y-2.5">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-md">
                  {selectedDrawerUser.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                    {selectedDrawerUser.full_name}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 inline-block mt-1 uppercase">
                    {selectedDrawerUser.role.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Contact & Identity Details */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                  Account Credentials & Contact
                </h5>
                <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      Email Address
                    </span>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {selectedDrawerUser.email}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />
                      Phone Number
                    </span>
                    <strong className="text-zinc-900 dark:text-zinc-100 font-mono">
                      {selectedDrawerUser.phone || 'Not Assigned'}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                      Account Status
                    </span>
                    <span
                      className={`px-2 py-0.2 rounded-md text-[11px] font-bold ${
                        selectedDrawerUser.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                      }`}
                    >
                      {selectedDrawerUser.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                    Privileges & Access Checklist
                  </h5>
                  <button
                    type="button"
                    disabled={!isEditModeUnlocked}
                    onClick={() => {
                      setPermissionUser(selectedDrawerUser)
                      setActivePerms(
                        selectedDrawerUser.custom_permissions ||
                          DEFAULT_ROLE_PERMISSIONS[selectedDrawerUser.role] ||
                          {}
                      )
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Adjust
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-xs">
                  {Object.entries({
                    can_view_logs: 'View Practical Logs Register',
                    can_create_logs: 'Create & Endorse Practical Logs',
                    can_delete_logs: 'Delete Certified Logs',
                    can_view_incidents: 'View Incident & Damage Registry',
                    can_report_incidents: 'Report Incident & Equipment Damage',
                    can_manage_incidents: 'Manage Repairs & Resolutions',
                    can_manage_schedules: 'Edit Master Timetable Schedules',
                    can_manage_maintenance: 'Manage Lab Maintenance & PC Servicing',
                    can_access_admin: 'Access Super Admin Control Center',
                  }).map(([key, label]) => {
                    const effective = getEffectivePermissions(selectedDrawerUser)
                    const allowed = !!effective[key]

                    return (
                      <div key={key} className="flex items-center justify-between py-1">
                        <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
                        {allowed ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" />
                            Allowed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                            <XCircle className="h-3.5 w-3.5 text-zinc-400" />
                            Restricted
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 px-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={!isEditModeUnlocked}
                onClick={() => {
                  setEditingUser(selectedDrawerUser)
                  setEditFullName(selectedDrawerUser.full_name)
                  setEditEmail(selectedDrawerUser.email || '')
                  setEditPhone(selectedDrawerUser.phone || '')
                  setEditPassword('')
                  setEditRole(selectedDrawerUser.role)
                }}
                className="text-xs font-semibold"
              >
                <Key className="h-3.5 w-3.5 mr-1" />
                Change Password / Role
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={!isEditModeUnlocked || selectedDrawerUser.role === 'super_admin'}
                onClick={() => handleToggleStatus(selectedDrawerUser)}
                className="text-xs font-semibold"
              >
                {selectedDrawerUser.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 1: Add User Account */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 font-sans animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Add Faculty / Teacher Account
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Full Name & Honorific *
                </label>
                <Input
                  required
                  placeholder="e.g. Dr. Prakash Adhikari"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Institutional Email *
                  </label>
                  <Input
                    required
                    type="email"
                    placeholder="name@rrl.edu.np"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="+977 98XXXXXXXX"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Role Binding *
                </label>
                <Select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="h-8.5 text-xs font-sans"
                >
                  <option value="teacher">Teacher</option>
                  <option value="lab_incharge">Lab Incharge</option>
                  <option value="hod">HOD</option>
                  <option value="super_admin">Super Admin</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Initial Password *
                </label>
                <Input
                  required
                  type="password"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddUserOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Credentials & Password */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 font-sans animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Update Account: {editingUser.full_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCredentials} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Full Name
                </label>
                <Input
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Email Address
                  </label>
                  <Input
                    required
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="+977 98XXXXXXXX"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Role
                </label>
                <Select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="h-8.5 text-xs font-sans"
                >
                  <option value="teacher">Teacher</option>
                  <option value="lab_incharge">Lab Incharge</option>
                  <option value="hod">HOD</option>
                  <option value="super_admin">Super Admin</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  New Password (Leave blank to keep unchanged)
                </label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Update Credentials'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Granular Feature Permissions */}
      {permissionUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 font-sans animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Access Permissions: {permissionUser.full_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPermissionUser(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-xs text-zinc-500">
                Customize specific page and capability privileges for this staff member:
              </p>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/40">
                {[
                  { key: 'can_view_logs', label: 'View Practical Logs Register', desc: 'Can inspect historical practical sessions & attendance' },
                  { key: 'can_create_logs', label: 'Create & Submit Practical Logs', desc: 'Can record student attendance & practical experiments' },
                  { key: 'can_delete_logs', label: 'Delete Practical Logs', desc: 'Can remove practical log entries' },
                  { key: 'can_view_incidents', label: 'View Incident and Damage Logs', desc: 'Can inspect equipment breakages across laboratories' },
                  { key: 'can_report_incidents', label: 'Report Damage & Incidents', desc: 'Can file new breakage cases and trigger broadcasts' },
                  { key: 'can_manage_incidents', label: 'Manage Repairs & Statuses', desc: 'Can mark cases Under Repair, Replaced, or Resolved' },
                  { key: 'can_resolve_incidents', label: 'Resolve & Close Incidents', desc: 'Can sign off on final incident resolutions' },
                  { key: 'can_manage_schedules', label: 'Edit Master Timetable Schedules', desc: 'Can modify room booking routines' },
                  { key: 'can_manage_maintenance', label: 'Manage Lab Maintenance & Servicing', desc: 'Can configure PC care routines, log servicing, and snooze reminders' },
                  { key: 'can_access_admin', label: 'Access Super Admin Command Center', desc: 'Strictly restricted to Super Admin administrators' },
                ].map((perm) => {
                  const isChecked = (activePerms as any)[perm.key] ?? false
                  return (
                    <label
                      key={perm.key}
                      className="p-3 flex items-start justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60 cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {perm.label}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {perm.desc}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setActivePerms({
                            ...activePerms,
                            [perm.key]: e.target.checked,
                          })
                        }}
                        className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                      />
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPermissionUser(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={handleSavePermissions}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {isSubmitting ? 'Saving...' : 'Apply Permissions'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Account Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 font-sans animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Delete Staff Account
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Are you sure you want to permanently delete the account for{' '}
                  <strong>{userToDelete.full_name}</strong> ({userToDelete.email})?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-900 dark:text-rose-200">
              <strong>Warning:</strong> This staff member will no longer be able to log in. Their historical practical logs and incident audits will remain preserved for institutional records.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUserToDelete(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={handleDeleteUser}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Account Deletion'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
