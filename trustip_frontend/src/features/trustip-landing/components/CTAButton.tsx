"use client"

import { motion } from "framer-motion"
import { Magnetic } from "@/components/void/magnetic"

type CTAButtonProps = {
  label: string
  /** Prototype-only: smooth-scrolls to a section id. No navigation, no network. */
  targetId?: string
  onClick?: () => void
  variant?: "primary" | "outline"
}

/**
 * Primary marketing CTA — prototype only.
 * Does nothing but scroll to a section (or run a passed handler).
 * No wallet SDK, no endpoint, no payment call.
 */
export function CTAButton({ label, targetId = "checkout", onClick, variant = "primary" }: CTAButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const primary = variant === "primary"

  return (
    <Magnetic strength={0.2}>
      <button
        onClick={handleClick}
        data-cursor="OPEN"
        className={`group relative flex items-center gap-3 px-6 py-3.5 border transition-colors duration-500 bg-[#050505] ${
          primary
            ? "border-[rgba(237,234,227,0.18)] hover:border-[#FF2D00]"
            : "border-[rgba(237,234,227,0.1)] hover:border-[#EDEAE3]/40"
        }`}
      >
        {primary && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D00] shrink-0 group-hover:scale-125 transition-transform duration-500" />
        )}
        <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] font-medium text-[#EDEAE3]">
          {label}
        </span>
        <span className="font-mono-jb text-[12px] text-[#B9B5AB] transition-transform duration-500 group-hover:translate-x-1">
          →
        </span>
      </button>
    </Magnetic>
  )
}
