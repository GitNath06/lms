'use client'

import React from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintTriggerButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') window.print()
      }}
      className="gap-1.5 text-xs font-semibold shadow-xs bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
    >
      <Printer className="h-3.5 w-3.5" />
      <span>Print Certified Sheet</span>
    </Button>
  )
}

export default PrintTriggerButton
