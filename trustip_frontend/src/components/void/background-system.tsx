"use client";

import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/* ============================================================
   Motion Graphic Background System
   Subtle animated backgrounds that fill the void without
   being decorative or noisy.
   ============================================================ */

export function BackgroundSystem() {
  const { scrollYProgress } = useScroll();
  const gridY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const numeralY = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Coordinate grid — slow drift */}
      <motion.div
        style={{ y: gridY }}
        className="absolute inset-[-50%] opacity-[0.04]"
        aria-hidden
      >
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#EDEAE3" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </motion.div>

      {/* Vertical scanning lines */}
      <motion.div
        className="absolute inset-0 opacity-[0.04]"
        animate={{ backgroundPosition: ["0 0", "0 100px"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0, transparent 4px, rgba(237,234,227,0.5) 4px, rgba(237,234,227,0.5) 5px)",
        }}
        aria-hidden
      />

      {/* Faint ghost numerals drifting */}
      <motion.div
        style={{ y: numeralY }}
        className="absolute left-1/2 top-[120vh] -translate-x-1/2 pointer-events-none"
        aria-hidden
      >
        <span
          className="font-display font-light leading-none text-bone-4 select-none"
          style={{ fontSize: "clamp(300px, 50vw, 800px)" }}
        >
          00
        </span>
      </motion.div>
    </div>
  );
}
