"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Defers mounting (and, via next/dynamic children, fetching) below-the-fold
 * sections until they're close to entering the viewport. Reserves min-height
 * before mount so entering sections don't shift layout (keeps CLS at 0).
 */
export function LazySection({
  children,
  minHeightClass = "min-h-[100dvh]",
}: {
  children: React.ReactNode
  minHeightClass?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: "600px 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  return <div ref={ref} className={inView ? undefined : minHeightClass}>{inView ? children : null}</div>
}
