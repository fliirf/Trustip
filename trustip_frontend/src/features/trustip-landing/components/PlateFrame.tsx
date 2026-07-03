"use client"

import { type ReactNode } from "react"

type PlateFrameProps = {
  /** Bottom-left composition tag, e.g. "ORBIT · ESCROW". Omit if the composition already carries its own corner labels. */
  label?: string
  /** Optional top-right status line, e.g. "● VERIFIED (SIM)" */
  status?: string
  children: ReactNode
  className?: string
}

/**
 * Hairline-framed container with crosshair corners and a mono composition
 * label — the "plate" convention for image-free SVG compositions.
 */
export function PlateFrame({ label, status, children, className = "" }: PlateFrameProps) {
  return (
    <div className={`relative border border-[rgba(237,234,227,0.08)] ${className}`}>
      <span aria-hidden className="absolute top-0 left-0 w-0 h-0 crosshair-tl" />
      <span aria-hidden className="absolute top-0 right-0 w-0 h-0 crosshair-tr" />
      <span aria-hidden className="absolute bottom-0 left-0 w-0 h-0 crosshair-bl" />
      <span aria-hidden className="absolute bottom-0 right-0 w-0 h-0 crosshair-br" />
      {status && (
        <span className="absolute top-4 right-4 z-10 font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#FF2D00]">
          {status}
        </span>
      )}
      {children}
      {label && (
        <span className="absolute bottom-4 left-4 z-10 font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#C6C2B8]">
          {label}
        </span>
      )}
    </div>
  )
}
