"use client";

import { motion, useSpring, useScroll } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 40,
    mass: 0.5,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[10000] h-px origin-left"
      style={{
        scaleX,
        backgroundColor: "#FF2D00",
      }}
      aria-hidden
    />
  );
}
