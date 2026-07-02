"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, useReducedMotion } from "framer-motion"

const GLYPHS = "0123456789ABCDEFabcdef"

type ScrambleTextProps = {
  text: string
  className?: string
}

/**
 * Reveals a monospace string with a brief hash-scramble effect when it scrolls
 * into view. Purely visual — the value is static demo/mock text. Characters that
 * are structural (space, ellipsis, middot, parentheses) are never scrambled so
 * the "(DEMO)" / "MOCK" markers stay legible the entire time.
 */
export function ScrambleText({ text, className = "" }: ScrambleTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-10%" })
  const reduce = useReducedMotion()
  const [out, setOut] = useState(text)

  useEffect(() => {
    // Reduced motion / not yet visible: leave the value static (render path below
    // shows `text` directly, so no synchronous setState is needed here).
    if (!inView || reduce) return

    const total = 18
    let frame = 0
    const id = setInterval(() => {
      frame++
      const revealed = Math.floor((frame / total) * text.length)
      setOut(
        text
          .split("")
          .map((ch, i) => {
            if (i < revealed || !/[0-9a-zA-Z]/.test(ch)) return ch
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          })
          .join(""),
      )
      if (frame >= total) {
        clearInterval(id)
        setOut(text)
      }
    }, 40)

    return () => clearInterval(id)
  }, [inView, reduce, text])

  return (
    <span ref={ref} className={className}>
      {reduce ? text : out}
    </span>
  )
}
