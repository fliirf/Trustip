"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import type { MotionValue } from "framer-motion"

type Props = {
  /** Hero scroll progress (0-1) — drives a gentle camera push-in. */
  progress?: MotionValue<number>
}

type LayerSpec = { count: number; spread: [number, number, number]; size: number; opacity: number }

const LAYERS: LayerSpec[] = [
  { count: 500, spread: [16, 9, 3], size: 0.012, opacity: 0.35 }, // far
  { count: 450, spread: [14, 8, 3], size: 0.02, opacity: 0.5 }, // mid
  { count: 250, spread: [12, 7, 2.5], size: 0.034, opacity: 0.65 }, // near
]

function makePositions(spec: LayerSpec, seedOffset: number) {
  let seed = 1337 + seedOffset
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const arr = new Float32Array(spec.count * 3)
  for (let i = 0; i < spec.count; i++) {
    arr[i * 3] = (rand() - 0.5) * spec.spread[0]
    arr[i * 3 + 1] = (rand() - 0.5) * spec.spread[1]
    arr[i * 3 + 2] = (rand() - 0.5) * spec.spread[2]
  }
  return arr
}

function Layer({
  spec,
  index,
  depth,
}: {
  spec: LayerSpec
  index: number
  depth: number
}) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => makePositions(spec, index * 97), [spec, index])

  useFrame((state, delta) => {
    if (!ref.current) return
    // Deeper layers drift slower — parallax between layers
    const speed = 0.006 + index * 0.006
    ref.current.rotation.y += delta * speed
    const { x, y } = state.pointer
    const f = 0.03 + index * 0.03
    ref.current.rotation.x += (y * f - ref.current.rotation.x) * 0.03
    ref.current.rotation.z += (x * f * 0.6 - ref.current.rotation.z) * 0.03
  })

  return (
    <points ref={ref} position={[0, 0, depth]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#EDEAE3"
        size={spec.size}
        sizeAttenuation
        transparent
        opacity={spec.opacity}
        depthWrite={false}
      />
    </points>
  )
}

/** Faint constellation lines between near-layer neighbours, fading with span length. */
function ConnectionLines() {
  const ref = useRef<THREE.LineSegments>(null)
  const geometry = useMemo(() => {
    const pos = makePositions(LAYERS[2], 2 * 97)
    const pts: number[] = []
    const cols: number[] = []
    const MAX_D = 1.7
    const N = LAYERS[2].count
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pos[i * 3] - pos[j * 3]
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1]
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2]
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d < MAX_D) {
          pts.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2])
          // Fade with distance via vertex color intensity
          const a = (1 - d / MAX_D) * 0.6
          cols.push(a, a, a, a, a, a)
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3))
    return g
  }, [])

  useFrame((state, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.018
    const { x, y } = state.pointer
    ref.current.rotation.x += (y * 0.09 - ref.current.rotation.x) * 0.03
    ref.current.rotation.z += (x * 0.054 - ref.current.rotation.z) * 0.03
  })

  return (
    <lineSegments ref={ref} position={[0, 0, 1.2]} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.16} depthWrite={false} />
    </lineSegments>
  )
}

function CameraRig({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  useFrame((state) => {
    // Scroll-reactive push-in: the field slides toward the viewer as the hero exits
    const target = 6 - progressRef.current * 1.6
    state.camera.position.z += (target - state.camera.position.z) * 0.06
  })
  return null
}

/** Layered mouse-reactive particle field behind the TRUSTIP wordmark. */
export default function HeroParticleField({ progress }: Props) {
  const progressRef = useRef(0)
  useEffect(() => {
    if (!progress) return
    progressRef.current = progress.get()
    return progress.on("change", (v) => (progressRef.current = v))
  }, [progress])

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <CameraRig progressRef={progressRef} />
        {LAYERS.map((spec, i) => (
          <Layer key={i} spec={spec} index={i} depth={i * 1.2 - 1.2} />
        ))}
        <ConnectionLines />
      </Suspense>
    </Canvas>
  )
}
