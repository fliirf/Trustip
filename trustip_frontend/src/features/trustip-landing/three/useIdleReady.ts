"use client"

import { useEffect, useState } from "react"

/**
 * True once the browser is idle after mount. Gates heavy decorative work
 * (e.g. the Three.js hero particle field) so it never competes with the
 * critical first paint/hydration. Falls back to a short timeout on engines
 * without requestIdleCallback (Safari).
 */
export function useIdleReady() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (w.requestIdleCallback) {
      const handle = w.requestIdleCallback(() => setReady(true), { timeout: 1500 })
      return () => w.cancelIdleCallback?.(handle)
    }

    const timeout = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(timeout)
  }, [])

  return ready
}
