'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface UseInfiniteSliceOptions {
  initialLimit?: number
  step?: number
  rootMargin?: string
}

export interface UseInfiniteSliceReturn<T> {
  visibleItems: T[]
  sentinelRef: (node: HTMLElement | null) => void
  hasMore: boolean
  totalCount: number
  limit: number
  reset: () => void
}

/**
 * useInfiniteSlice
 * 
 * High-performance windowed slicing for client-side lists.
 * Preserves 100% of items in memory for search, filtering, and bulk operations,
 * but renders items in progressive chunks to keep DOM memory and layout shifts at 0.
 */
export function useInfiniteSlice<T>(
  items: T[],
  options?: UseInfiniteSliceOptions
): UseInfiniteSliceReturn<T> {
  const initialLimit = options?.initialLimit ?? 25
  const step = options?.step ?? 25
  const rootMargin = options?.rootMargin ?? '250px'

  const [limit, setLimit] = useState(initialLimit)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelNodeRef = useRef<HTMLElement | null>(null)

  // Reset slice limit whenever items identity/length changes (e.g. search query or class filter changed)
  const prevItemsRef = useRef(items)
  useEffect(() => {
    if (prevItemsRef.current !== items) {
      prevItemsRef.current = items
      setLimit(initialLimit)
    }
  }, [items, initialLimit])

  const reset = useCallback(() => {
    setLimit(initialLimit)
  }, [initialLimit])

  // Callback ref for the sentinel element
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      sentinelNodeRef.current = node

      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!node) return

      if (typeof IntersectionObserver === 'undefined') {
        // Fallback for non-supporting environments: render all
        setLimit(items.length)
        return
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setLimit((prev) => Math.min(items.length, prev + step))
          }
        },
        { rootMargin }
      )

      observerRef.current.observe(node)
    },
    [items.length, step, rootMargin]
  )

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  const hasMore = limit < items.length
  const visibleItems = items.slice(0, limit)

  return {
    visibleItems,
    sentinelRef,
    hasMore,
    totalCount: items.length,
    limit,
    reset,
  }
}

