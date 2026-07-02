"use client";

import { useEffect, useSyncExternalStore, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/* Detect fine pointer (mouse) vs coarse (touch) using matchMedia */
function subscribe(callback: () => void) {
  const mql = window.matchMedia("(pointer: fine)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getSnapshot() {
  return window.matchMedia("(pointer: fine)").matches;
}
function getServerSnapshot() {
  return false;
}

export function Cursor() {
  const isFinePointer = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hidden, setHidden] = useState(true);
  const [label, setLabel] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);

  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const ringX = useSpring(dotX, { stiffness: 350, damping: 30, mass: 0.6 });
  const ringY = useSpring(dotY, { stiffness: 350, damping: 30, mass: 0.6 });

  useEffect(() => {
    if (!isFinePointer) return;
    document.documentElement.classList.add("custom-cursor-active");

    const onMove = (e: MouseEvent) => {
      setHidden(false);
      dotX.set(e.clientX);
      dotY.set(e.clientY);

      const target = e.target as HTMLElement;
      const interactive = target.closest("a, button, [data-cursor], [data-magnetic]");
      if (interactive) {
        const customLabel = interactive.getAttribute("data-cursor");
        setLabel(customLabel || "OPEN");
        setHovering(true);
      } else {
        setLabel(null);
        setHovering(false);
      }
    };

    const onLeave = () => setHidden(true);

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [isFinePointer, dotX, dotY]);

  if (!isFinePointer) return null;

  return (
    <>
      {/* Small red-orange dot — tracks 1:1 */}
      <motion.div
        className="fixed top-0 left-0 z-[9999] pointer-events-none"
        style={{
          x: dotX,
          y: dotY,
          opacity: hidden ? 0 : hovering ? 0 : 1,
        }}
      >
        <div
          className="rounded-full"
          style={{
            width: 6,
            height: 6,
            backgroundColor: "#FF2D00",
            transform: "translate(-50%, -50%)",
          }}
        />
      </motion.div>

      {/* Thin ring — lags with spring */}
      <motion.div
        className="fixed top-0 left-0 z-[9998] pointer-events-none"
        style={{
          x: ringX,
          y: ringY,
          opacity: hidden ? 0 : 1,
        }}
      >
        <motion.div
          className="rounded-full flex items-center justify-center"
          animate={{
            width: hovering ? 64 : 36,
            height: hovering ? 64 : 36,
            borderColor: hovering ? "rgba(255,45,0,0.9)" : "rgba(237,234,227,0.4)",
            backgroundColor: hovering ? "rgba(255,45,0,0.05)" : "rgba(0,0,0,0)",
          }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            border: "1px solid rgba(237,234,227,0.4)",
            transform: "translate(-50%, -50%)",
            mixBlendMode: "normal",
          }}
        >
          {label && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono-jb text-[8.5px] uppercase tracking-[0.22em]"
              style={{ color: "#EDEAE3" }}
            >
              {label}
            </motion.span>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
