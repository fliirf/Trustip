"use client"

import { useEffect, useState } from "react"

/**
 * Gate for the lazy 3D scenes: desktop-class pointer, wide viewport, and no
 * reduced-motion preference. Everything else gets the static SVG fallback.
 */
export function useCan3D() {
  const [can, setCan] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(
      "(pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    )
    const update = () => setCan(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  return can
}
