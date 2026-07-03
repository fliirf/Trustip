"use client"

import { useEffect } from "react"
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion"

type OrbitalCoreProps = {
  className?: string
  /** Optional scroll progress (0-1) of the parent section — used for a gentle exit scale/fade. */
  progress?: MotionValue<number>
}

const BONE = "237,234,227"
const BLOOD = "#FF2D00"

/* Concentric bone rings — thin, restrained, per the original EscrowOrbit */
const RINGS = [
  { r: 46, dash: "1 3", duration: 140, dir: 1, opacity: 0.16 },
  { r: 38, dash: undefined, duration: 0, dir: 1, opacity: 0.12 },
  { r: 30, dash: undefined, duration: 90, dir: -1, opacity: 0.18 },
  { r: 22, dash: undefined, duration: 0, dir: 1, opacity: 0.24 },
]

/** Tilted elliptical orbits — bone, plus one surgical red-orange accent orbit. */
const ELLIPSES = [
  { rx: 48, ry: 19, tilt: 18, color: `rgba(${BONE},0.14)`, dash: "2.5 2" },
  { rx: 42, ry: 15, tilt: -26, color: `rgba(${BONE},0.20)`, dash: undefined },
  { rx: 45, ry: 17, tilt: -60, color: "rgba(255,45,0,0.35)", dash: "1 2.5" },
]

/** Tiny drifting debris marks orbiting the core, like the reference cubes. */
const DEBRIS = [
  { r: 44, phase: 40, duration: 90, dir: 1 },
  { r: 33, phase: 160, duration: 70, dir: -1 },
  { r: 26, phase: 280, duration: 110, dir: 1 },
]

const TICKS = Array.from({ length: 12 }, (_, i) => i * 30)

/**
 * Hero's protected-core artifact — recreates the original EscrowOrbit
 * composition (concentric bone rings, wireframe core, cardinal markers,
 * one red-orange payment dot) in SVG with pointer parallax.
 */
export function OrbitalCore({ className = "", progress }: OrbitalCoreProps) {
  const reduce = useReducedMotion()

  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 40, damping: 18, mass: 0.7 })
  const sy = useSpring(py, { stiffness: 40, damping: 18, mass: 0.7 })
  const tiltZ = useTransform(sx, [-18, 18], [-3, 3])

  useEffect(() => {
    if (reduce) return
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      px.set(nx * 18)
      py.set(ny * 18)
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [reduce, px, py])

  const fallbackProgress = useMotionValue(0)
  const boundProgress = progress ?? fallbackProgress
  const exitScale = useTransform(boundProgress, [0, 1], [1, 0.88])
  const exitOpacity = useTransform(boundProgress, [0, 1], [1, 0.45])

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
      style={{
        x: reduce ? 0 : sx,
        y: reduce ? 0 : sy,
        rotate: reduce ? 0 : tiltZ,
        scale: exitScale,
        opacity: exitOpacity,
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        {/* Cardinal instrument ticks */}
        {TICKS.map((deg) => (
          <line
            key={deg}
            x1="50"
            y1="4.5"
            x2="50"
            y2={deg % 90 === 0 ? "7.5" : "6.5"}
            stroke={`rgba(${BONE},0.18)`}
            strokeWidth="0.3"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}

        {/* Tilted elliptical orbits */}
        {ELLIPSES.map((el, i) => (
          <ellipse
            key={`el-${i}`}
            cx="50"
            cy="50"
            rx={el.rx}
            ry={el.ry}
            fill="none"
            stroke={el.color}
            strokeWidth="0.22"
            strokeDasharray={el.dash}
            transform={`rotate(${el.tilt} 50 50)`}
          />
        ))}

        {/* Concentric rings */}
        {RINGS.map((ring, i) => (
          <motion.g
            key={i}
            style={{ transformOrigin: "50px 50px" }}
            animate={
              reduce || !ring.duration
                ? undefined
                : { rotate: 360 * ring.dir }
            }
            transition={
              reduce || !ring.duration
                ? undefined
                : { duration: ring.duration, repeat: Infinity, ease: "linear" }
            }
          >
            <circle
              cx="50"
              cy="50"
              r={ring.r}
              fill="none"
              stroke={`rgba(${BONE},${ring.opacity})`}
              strokeWidth="0.25"
              strokeDasharray={ring.dash}
            />
          </motion.g>
        ))}

        {/* Cardinal square markers — like the reference's tiny planes */}
        {[0, 90, 180, 270].map((deg) => (
          <rect
            key={`cm-${deg}`}
            x="49.1"
            y="10.6"
            width="1.8"
            height="1.8"
            fill="none"
            stroke={`rgba(${BONE},0.5)`}
            strokeWidth="0.25"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}

        {/* Wireframe core — nested rotated squares standing in for the icosahedron */}
        <motion.g
          style={{ transformOrigin: "50px 50px" }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={reduce ? undefined : { duration: 160, repeat: Infinity, ease: "linear" }}
        >
          {[0, 30, 60].map((deg) => (
            <rect
              key={`core-${deg}`}
              x="44.5"
              y="44.5"
              width="11"
              height="11"
              fill="none"
              stroke={`rgba(${BONE},0.28)`}
              strokeWidth="0.25"
              transform={`rotate(${deg + 45} 50 50)`}
            />
          ))}
        </motion.g>

        {/* Drifting debris marks */}
        {DEBRIS.map((d, i) => (
          <motion.g
            key={`db-${i}`}
            style={{ transformOrigin: "50px 50px" }}
            initial={{ rotate: d.phase }}
            animate={reduce ? undefined : { rotate: [d.phase, d.phase + 360 * d.dir] }}
            transition={
              reduce ? undefined : { duration: d.duration, repeat: Infinity, ease: "linear" }
            }
          >
            <rect
              x={50 + d.r - 0.7}
              y={49.3}
              width="1.4"
              height="1.4"
              fill={`rgba(${BONE},0.45)`}
            />
          </motion.g>
        ))}

        {/* Single red-orange payment dot — the one surgical accent */}
        <motion.g
          style={{ transformOrigin: "50px 50px" }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={reduce ? undefined : { duration: 34, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="90" cy="50" r="1.1" fill={BLOOD} />
          <circle cx="90" cy="50" r="2.6" fill="none" stroke={BLOOD} strokeWidth="0.2" opacity="0.3" />
        </motion.g>

        {/* Secondary bone dot, counter-rotating */}
        <motion.g
          style={{ transformOrigin: "50px 50px" }}
          animate={reduce ? undefined : { rotate: -360 }}
          transition={reduce ? undefined : { duration: 52, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="80" cy="50" r="0.8" fill={`rgba(${BONE},0.8)`} />
        </motion.g>

        {/* Still bone core point */}
        <circle cx="50" cy="50" r="1.4" fill={`rgba(${BONE},0.9)`} />
      </svg>
    </motion.div>
  )
}
