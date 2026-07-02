"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

type SplitTextProps = {
  text: string;
  className?: string;
  stagger?: number;
  byChar?: boolean;
  delay?: number;
  once?: boolean;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
};

export function SplitText({
  text,
  className = "",
  stagger = 0.06,
  byChar = false,
  delay = 0,
  once = true,
  as = "span",
}: SplitTextProps) {
  const Tag = motion[as] as typeof motion.span;
  const tokens = byChar ? text.split("") : text.split(" ");

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-10%" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      suppressHydrationWarning
    >
      {tokens.map((token, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden align-bottom"
          style={{ paddingBottom: byChar ? 0 : "0.08em" }}
        >
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: "110%" },
              visible: {
                y: "0%",
                transition: { duration: 0.85, ease: EASE },
              },
            }}
            suppressHydrationWarning
          >
            {token}
            {!byChar && i < tokens.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

export function SplitTextBlock({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08, delayChildren: delay } },
      }}
      suppressHydrationWarning
    >
      {children}
    </motion.div>
  );
}
