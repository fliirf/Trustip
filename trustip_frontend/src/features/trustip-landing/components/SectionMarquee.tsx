"use client"

import { Marquee } from "@/components/void/marquee"

type SectionMarqueeProps = {
  items: string[]
  reverse?: boolean
  className?: string
}

/**
 * Full-width kinetic marquee band used as section punctuation between
 * sections — a boundary object, not content. Borrowed from the VOID
 * reference footer band.
 */
export function SectionMarquee({ items, reverse, className = "" }: SectionMarqueeProps) {
  return (
    <div
      aria-hidden
      className={`relative border-t border-[rgba(237,234,227,0.08)] bg-[#050505] py-3 overflow-hidden lg:pl-32 ${className}`}
    >
      <Marquee items={items} reverse={reverse} />
    </div>
  )
}
