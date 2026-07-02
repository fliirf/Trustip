"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavStore } from "./nav-store";

const EASE = [0.16, 1, 0.3, 1] as const;

const SECTIONS = [
  { id: "index", label: "INDEX", n: "01" },
  { id: "checkout", label: "CHECKOUT", n: "02" },
  { id: "escrow", label: "ESCROW", n: "03" },
  { id: "timeline", label: "TIMELINE", n: "04" },
  { id: "seller", label: "SELLER", n: "05" },
  { id: "create", label: "CREATE", n: "06" },
  { id: "payout", label: "PAYOUT", n: "07" },
  { id: "trust", label: "TRUST PROFILE", n: "08" },
  { id: "review", label: "REVIEW", n: "09" },
] as const;

export function VoidNav() {
  const [activeId, setActiveId] = useState<string>("index");
  const [clock, setClock] = useState("--:--:--");
  const setActive = useNavStore((s) => s.setActive);

  useEffect(() => {
    const onScroll = () => {
      const sections = SECTIONS.map((s) => document.getElementById(s.id));
      const mid = window.innerHeight * 0.4;
      let current = "index";
      for (const sec of sections) {
        if (!sec) continue;
        const rect = sec.getBoundingClientRect();
        if (rect.top <= mid) {
          current = sec.id;
        }
      }
      setActiveId(current);
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [setActive]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const jakarta = new Date(d.getTime() + (d.getTimezoneOffset() + 420) * 60000);
      const h = String(jakarta.getHours()).padStart(2, "0");
      const m = String(jakarta.getMinutes()).padStart(2, "0");
      const s = String(jakarta.getSeconds()).padStart(2, "0");
      setClock(`${h}:${m}:${s} JKT`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* ===== Desktop vertical rail (lg+) ===== */}
      <div className="hidden lg:flex fixed left-6 top-0 bottom-0 z-50 flex-col justify-between py-8 pointer-events-none">
        {/* Top: wordmark */}
        <div className="pointer-events-auto">
          <button
            onClick={() => scrollTo("index")}
            data-cursor="OPEN"
            className="font-display font-medium text-[15px] tracking-tight text-bone"
          >
            TRUSTIP
            <span className="text-[#FF2D00]">.</span>
          </button>
          <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-bone-40 mt-1">
            STELLAR NATIVE
          </div>
        </div>

        {/* Middle: section list */}
        <nav className="pointer-events-auto flex flex-col gap-3">
          {SECTIONS.map((s) => {
            const active = activeId === s.id;
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
                    backgroundColor: active ? "#FF2D00" : "rgba(237,234,227,0.4)",
                  }}
                />
                <span
                  className={`font-mono-jb text-[9.5px] uppercase tracking-[0.22em] transition-colors duration-300 ${
                    active ? "text-bone" : "text-bone-40 group-hover:text-bone-60"
                  }`}
                >
                  {s.n} {s.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom: live clock */}
        <div className="pointer-events-auto">
          <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-bone-40">
            {clock}
          </div>
          <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-bone-40 mt-1">
            ● PROTECTION LIVE
          </div>
        </div>
      </div>

      {/* ===== Mobile top bar ===== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-fog bg-[#050505]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={() => scrollTo("index")}
            className="font-display font-medium text-[14px] tracking-tight text-bone"
          >
            TRUSTIP<span className="text-[#FF2D00]">.</span>
          </button>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-bone-60"
            >
              {SECTIONS.find((s) => s.id === activeId)?.n} —{" "}
              {SECTIONS.find((s) => s.id === activeId)?.label}
            </motion.div>
          </AnimatePresence>
          <div className="font-mono-jb text-[9px] uppercase tracking-[0.22em] text-bone-40">
            {clock.split(" ")[0]}
          </div>
        </div>
      </div>
    </>
  );
}
