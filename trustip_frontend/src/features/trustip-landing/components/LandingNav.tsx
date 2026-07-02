"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { NAV_ITEMS } from "../data/landing-content"
import { WalletCTAButton } from "./WalletCTAButton"

const EASE = [0.16, 1, 0.3, 1] as const

export function LandingNav() {
  const [activeId, setActiveId] = useState("hero")
  const [clock, setClock] = useState("--:--:--")

  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight * 0.4
      let current = "hero"
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= mid) {
          current = item.id
        }
      }
      setActiveId(current)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const jakarta = new Date(d.getTime() + (d.getTimezoneOffset() + 420) * 60000)
      const h = String(jakarta.getHours()).padStart(2, "0")
      const m = String(jakarta.getMinutes()).padStart(2, "0")
      const s = String(jakarta.getSeconds()).padStart(2, "0")
      setClock(`${h}:${m}:${s} JKT`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      {/* Desktop vertical rail */}
      <div className="hidden lg:flex fixed left-6 top-0 bottom-0 z-50 flex-col justify-between py-8 pointer-events-none">
        <div className="pointer-events-auto">
          <button
            onClick={() => scrollTo("hero")}
            data-cursor="OPEN"
            className="font-display font-medium text-[15px] tracking-tight text-[#F7F8FA]"
          >
            TRUSTIP
            <span className="text-[#16C784]">.</span>
          </button>
          <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB] mt-1">
            STELLAR NATIVE
          </div>
        </div>

        <nav className="pointer-events-auto flex flex-col gap-3">
          {NAV_ITEMS.map((s) => {
            const active = activeId === s.id
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                data-cursor="OPEN"
                className="group flex items-center gap-3 text-left"
              >
                <span
                  className="h-px transition-all duration-500"
                  style={{
                    width: active ? 40 : 20,
                    backgroundColor: active ? "#16C784" : "rgba(247,248,250,0.3)",
                  }}
                />
                <span
                  className={`font-mono-jb text-[9.5px] uppercase tracking-[0.22em] transition-colors duration-300 ${
                    active ? "text-[#F7F8FA]" : "text-[#A6ADBB] group-hover:text-[#F7F8FA]/60"
                  }`}
                >
                  {s.n} {s.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="pointer-events-auto flex flex-col gap-3">
          <WalletCTAButton variant="ghost" label="Preview Wallet" />
          <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]">
            {clock}
          </div>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-[rgba(255,255,255,0.08)] bg-[#020204]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={() => scrollTo("hero")}
            className="font-display font-medium text-[14px] tracking-tight text-[#F7F8FA]"
          >
            TRUSTIP<span className="text-[#16C784]">.</span>
          </button>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-[#A6ADBB]"
            >
              {NAV_ITEMS.find((s) => s.id === activeId)?.n} —{" "}
              {NAV_ITEMS.find((s) => s.id === activeId)?.label}
            </motion.div>
          </AnimatePresence>
          <WalletCTAButton variant="ghost" label="Wallet" />
        </div>
      </div>
    </>
  )
}
