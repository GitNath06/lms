'use client'

import { useSyncExternalStore } from 'react'

let isOpen = false
const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

export const commandPaletteStore = {
  open: () => {
    isOpen = true
    emitChange()
  },
  close: () => {
    isOpen = false
    emitChange()
  },
  toggle: () => {
    isOpen = !isOpen
    emitChange()
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => isOpen,
  getServerSnapshot: () => false,
}

export function useCommandPalette() {
  const openState = useSyncExternalStore(
    commandPaletteStore.subscribe,
    commandPaletteStore.getSnapshot,
    commandPaletteStore.getServerSnapshot
  )

  return {
    isOpen: openState,
    open: commandPaletteStore.open,
    close: commandPaletteStore.close,
    toggle: commandPaletteStore.toggle,
  }
}
