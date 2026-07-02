"use client";

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

type SectionMarkerProps = {
  index: string;
  label: string;
  className?: string;
  align?: "left" | "right";
  accent?: boolean;
};

export function SectionMarker({
  index,
  label,
  className = "",
  align = "left",
  accent = false,
}: SectionMarkerProps) {
  return (
    <motion.div
      className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""} ${className}`}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <span
        className={`font-mono-jb text-micro uppercase tracking-[0.22em] ${
          accent ? "text-[#FF2D00]" : "text-bone-60"
        }`}
      >
        [{index}]
      </span>
      <span className="h-px w-8 bg-fog" />
      <span className="font-mono-jb text-micro uppercase tracking-[0.22em] text-bone-60">
        {label}
      </span>
    </motion.div>
  );
}
