import React from 'react'
import { ProfileClientView } from '@/components/profile/profile-client-view'
import { getCurrentUserProfile } from '@/app/actions/auth'

export const metadata = {
  title: 'Faculty Profile & Preferences | LabSync LIMS',
  description: 'Manage academic identity, honorifics, and teaching preferences.',
}

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile()
  return <ProfileClientView initialProfile={profile} />
}
