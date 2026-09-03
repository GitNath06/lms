'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

export interface PrintFilterControlsProps {
  labs: Array<{ id: string; name: string }>
  currentDate: string
  currentLabId: string
}

export function PrintFilterControls({
  labs,
  currentDate,
  currentLabId,
}: PrintFilterControlsProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLabChange = (newLabId: string) => {
    const params = new URLSearchParams()
    if (newLabId && newLabId !== 'all') params.set('lab_id', newLabId)
    if (currentDate) params.set('date', currentDate)
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleDateChange = (newDate: string) => {
    const params = new URLSearchParams()
    if (currentLabId && currentLabId !== 'all') params.set('lab_id', currentLabId)
    if (newDate) params.set('date', newDate)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="w-48">
        <Select
          value={currentLabId}
          onChange={(e) => handleLabChange(e.target.value)}
          className="h-8 text-xs"
        >
          <option value="all">All Laboratories</option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-36">
        <Input
          type="date"
          value={currentDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>
    </div>
  )
}

export default PrintFilterControls
