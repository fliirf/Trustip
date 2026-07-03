"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Magnetic } from "@/components/void/magnetic"

type WalletCTAButtonProps = {
  label?: string
  variant?: "primary" | "ghost"
  onPreview?: () => void
}

export function WalletCTAButton({ label = "Connect a wallet", variant = "primary", onPreview }: WalletCTAButtonProps) {
  const [preview, setPreview] = useState(false)

  const handleClick = () => {
    console.warn("[MOCK] Wallet connect preview - no real wallet SDK imported")
    setPreview(true)
    onPreview?.()
    setTimeout(() => setPreview(false), 3000)
  }

  if (variant === "ghost") {
    return (
      <button
        onClick={handleClick}
        className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#C6C2B8] hover:text-[#EDEAE3] transition-colors duration-300 underline-offset-4 hover:underline"
      >
        {label} →
      </button>
    )
  }

  return (
    <Magnetic strength={0.18}>
      <button
        onClick={handleClick}
        data-cursor="CONNECT"
        className="group relative flex items-center gap-3 px-6 py-3 border border-[rgba(237,234,227,0.15)] hover:border-[#FF2D00] transition-colors duration-500 bg-[#0A0A0A]"
      >
        {/* Wallet glyph */}
        <span
          aria-hidden
          className="grid place-items-center w-6 h-6 border border-[#FF2D00]/40 text-[#FF2D00] text-[11px] leading-none group-hover:border-[#FF2D00] transition-colors duration-500"
        >
          ◈
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] text-[#EDEAE3]">
            {preview ? "✓ Demo wallet connected" : label}
          </span>
          <span className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#C6C2B8]/70">
            {preview ? "Preview only · no real wallet" : "Freighter · xBull · Stellar"}
          </span>
        </span>
        <AnimatePresence>
          {preview && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="font-mono-jb text-[8px] uppercase tracking-[0.22em] text-[#FF2D00] border border-[#FF2D00]/30 px-1.5 py-0.5"
            >
              DEMO
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </Magnetic>
  )
}
