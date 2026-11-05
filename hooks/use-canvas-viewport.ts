import { useState, useRef, useCallback, useEffect } from 'react'

export interface CanvasViewportOptions {
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  defaultZoom?: number
}

export interface CanvasViewportState {
  zoom: number
  pan: { x: number; y: number }
  isPanning: boolean
  isPanToolActive: boolean
  isSpacePressed: boolean
  focusedWsId: string | null
}

export function useCanvasViewport(options: CanvasViewportOptions = {}) {
  const {
    minZoom = 0.25,
    maxZoom = 2.0,
    zoomStep = 0.15,
    defaultZoom = 1.0,
  } = options

  const containerRef = useRef<HTMLDivElement | null>(null)
  
  // Single atomic state for zoom and pan to avoid desynchronized rendering
  const [viewport, setViewport] = useState({
    zoom: defaultZoom,
    pan: { x: 0, y: 0 },
  })
  
  const [isPanning, setIsPanning] = useState(false)
  const [isPanToolActive, setIsPanToolActive] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [focusedWsId, setFocusedWsId] = useState<string | null>(null)
  const [isWheelActive, setIsWheelActive] = useState(false)

  // Drag tracking refs
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const touchDistanceRef = useRef<number | null>(null)
  const wheelActiveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clamp helper
  const clampZoom = useCallback(
    (val: number) => Math.min(maxZoom, Math.max(minZoom, Math.round(val * 100) / 100)),
    [minZoom, maxZoom]
  )

  // Set pan helper
  const setPan = useCallback(
    (updater: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
      setViewport((prev) => ({
        ...prev,
        pan: typeof updater === 'function' ? updater(prev.pan) : updater,
      }))
    },
    []
  )

  // 1. Zoom In / Zoom Out (Focal to center)
  const zoomIn = useCallback(() => {
    setViewport((prev) => {
      const nextZoom = clampZoom(prev.zoom + zoomStep)
      if (nextZoom === prev.zoom) return prev
      if (!containerRef.current) return { ...prev, zoom: nextZoom }

      const rect = containerRef.current.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      return {
        zoom: nextZoom,
        pan: {
          x: Math.round(cx - ((cx - prev.pan.x) / prev.zoom) * nextZoom),
          y: Math.round(cy - ((cy - prev.pan.y) / prev.zoom) * nextZoom),
        },
      }
    })
  }, [clampZoom, zoomStep])

  const zoomOut = useCallback(() => {
    setViewport((prev) => {
      const nextZoom = clampZoom(prev.zoom - zoomStep)
      if (nextZoom === prev.zoom) return prev
      if (!containerRef.current) return { ...prev, zoom: nextZoom }

      const rect = containerRef.current.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      return {
        zoom: nextZoom,
        pan: {
          x: Math.round(cx - ((cx - prev.pan.x) / prev.zoom) * nextZoom),
          y: Math.round(cy - ((cy - prev.pan.y) / prev.zoom) * nextZoom),
        },
      }
    })
  }, [clampZoom, zoomStep])

  // 2. Reset (1:1) - Centered in container
  const resetZoom = useCallback(() => {
    if (!containerRef.current) {
      setViewport({ zoom: 1.0, pan: { x: 0, y: 0 } })
      return
    }
    const rect = containerRef.current.getBoundingClientRect()
    const targetW = 1360
    const targetH = 780
    const newPanX = (rect.width - targetW) / 2
    const newPanY = (rect.height - targetH) / 2
    setViewport({
      zoom: 1.0,
      pan: { x: Math.round(newPanX), y: Math.round(newPanY) },
    })
  }, [])

  // 3. Fit to Screen - All 48 PCs centered inside canvas box with 1 click
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const targetW = 1360
    const targetH = 780
    const scale = Math.min((rect.width - 48) / targetW, (rect.height - 48) / targetH)
    const newZoom = clampZoom(scale)

    const scaledW = targetW * newZoom
    const scaledH = targetH * newZoom
    const newPanX = (rect.width - scaledW) / 2
    const newPanY = (rect.height - scaledH) / 2

    setViewport({
      zoom: newZoom,
      pan: { x: Math.round(newPanX), y: Math.round(newPanY) },
    })
  }, [clampZoom])

  // 4. Focus & Pan to specific workstation
  const focusWorkstation = useCallback(
    (wsId: string, posXPercent: number, posYPercent: number) => {
      setFocusedWsId(wsId)
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const targetW = 1360
        const targetH = 780
        const targetZoom = Math.max(viewport.zoom, 1.1)
        const targetXInCanvas = (posXPercent / 100) * targetW
        const targetYInCanvas = (posYPercent / 100) * targetH

        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const targetPanX = Math.round(centerX - targetXInCanvas * targetZoom)
        const targetPanY = Math.round(centerY - targetYInCanvas * targetZoom)

        setViewport({
          zoom: targetZoom,
          pan: { x: targetPanX, y: targetPanY },
        })
      }

      setTimeout(() => {
        setFocusedWsId((curr) => (curr === wsId ? null : curr))
      }, 3000)
    },
    [viewport.zoom]
  )

  // Attach ResizeObserver on the outer viewport wrapper (automatically recalculates auto-fit scale on resize/sidebar/drawer)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let prevW = 0
    let prevH = 0

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0 && (Math.abs(width - prevW) > 5 || Math.abs(height - prevH) > 5)) {
          prevW = width
          prevH = height
          fitToScreen()
        }
      }
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [fitToScreen])

  // 5. Professional CAD Native Wheel Handler (Figma / Miro / Google Maps standard)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheelNative = (e: WheelEvent) => {
      // Case A: User holds Ctrl or Meta (or trackpad pinch-zoom) -> ZOOM
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()

        setIsWheelActive(true)
        if (wheelActiveTimeoutRef.current) clearTimeout(wheelActiveTimeoutRef.current)
        wheelActiveTimeoutRef.current = setTimeout(() => {
          setIsWheelActive(false)
        }, 150)

        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Damped normalized delta to avoid violent jumps
        const direction = e.deltaY < 0 ? 1 : -1
        const rawStep = Math.abs(e.deltaY) * 0.001
        const step = Math.min(rawStep, 0.06) * direction

        setViewport((prev) => {
          const nextZoom = clampZoom(prev.zoom + step)
          if (nextZoom === prev.zoom) return prev

          const focalX = (mouseX - prev.pan.x) / prev.zoom
          const focalY = (mouseY - prev.pan.y) / prev.zoom

          return {
            zoom: nextZoom,
            pan: {
              x: Math.round(mouseX - focalX * nextZoom),
              y: Math.round(mouseY - focalY * nextZoom),
            },
          }
        })
      } else if (isPanToolActive || isSpacePressed) {
        // Case B: Pan mode is active -> wheel pans the canvas
        e.preventDefault()
        setViewport((prev) => ({
          ...prev,
          pan: {
            x: Math.round(prev.pan.x - e.deltaX),
            y: Math.round(prev.pan.y - e.deltaY),
          },
        }))
      } else {
        // Case C: Normal mouse scroll -> DO NOT ZOOM! Let page scroll naturally.
      }
    }

    container.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheelNative)
      if (wheelActiveTimeoutRef.current) clearTimeout(wheelActiveTimeoutRef.current)
    }
  }, [clampZoom, isPanToolActive, isSpacePressed])

  // 6. Keyboard events (Space bar pan modifier)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const activeTag = document.activeElement?.tagName.toLowerCase()
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          setIsSpacePressed(true)
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
        setIsPanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // 7. Pointer Drag Panning
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const isMiddle = e.button === 1
      const isSpaceDrag = e.button === 0 && isSpacePressed
      const isPanActive = e.button === 0 && isPanToolActive

      if (isMiddle || isSpaceDrag || isPanActive) {
        e.preventDefault()
        e.stopPropagation()
        setIsPanning(true)
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: viewport.pan.x,
          panY: viewport.pan.y,
        }
        ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
      }
    },
    [isSpacePressed, isPanToolActive, viewport.pan]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dragStart = dragStartRef.current
      if (!isPanning || !dragStart) return
      e.preventDefault()
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      const targetPanX = Math.round(dragStart.panX + dx)
      const targetPanY = Math.round(dragStart.panY + dy)
      setViewport((prev) => ({
        ...prev,
        pan: {
          x: targetPanX,
          y: targetPanY,
        },
      }))
    },
    [isPanning]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false)
      dragStartRef.current = null
      try {
        const target = e.target as HTMLElement | null
        if (target && typeof target.hasPointerCapture === 'function' && target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Ignore if pointer capture release fails
      }
    }
  }, [isPanning])

  // 8. Multi-touch Pinch to Zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY)
      touchDistanceRef.current = dist
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchDistanceRef.current !== null) {
        e.preventDefault()
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY)
        const factor = dist / touchDistanceRef.current
        touchDistanceRef.current = dist

        setViewport((prev) => ({
          ...prev,
          zoom: clampZoom(prev.zoom * factor),
        }))
      }
    },
    [clampZoom]
  )

  const handleTouchEnd = useCallback(() => {
    touchDistanceRef.current = null
  }, [])

  const togglePanTool = useCallback(() => {
    setIsPanToolActive((prev) => !prev)
  }, [])

  return {
    containerRef,
    zoom: viewport.zoom,
    pan: viewport.pan,
    setPan,
    isPanning,
    isPanToolActive,
    isSpacePressed,
    focusedWsId,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    focusWorkstation,
    togglePanTool,
    containerProps: {
      ref: containerRef,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    canvasTransformStyle: {
      transform: `translate3d(${viewport.pan.x}px, ${viewport.pan.y}px, 0) scale(${viewport.zoom})`,
      transformOrigin: '0 0',
      transition: isPanning || isWheelActive ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
      willChange: 'transform',
    },
  }
}
