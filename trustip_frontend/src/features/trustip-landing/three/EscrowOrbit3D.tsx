"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import type { MotionValue } from "framer-motion"

const BONE = "#EDEAE3"
const BLOOD = "#FF2D00"

type Props = {
  /** Section scroll progress (0-1) — drives camera drift and the orbit "closing". */
  progress?: MotionValue<number>
}

/** Bridge a framer MotionValue into a ref usable inside useFrame. */
function useProgressRef(progress?: MotionValue<number>) {
  const ref = useRef(0)
  useEffect(() => {
    if (!progress) return
    ref.current = progress.get()
    return progress.on("change", (v) => (ref.current = v))
  }, [progress])
  return ref
}

function OrbitRing({
  radius,
  rotation,
  speed,
  color,
  opacity,
  tighten,
  progressRef,
}: {
  radius: number
  rotation: [number, number, number]
  speed: number
  color: string
  opacity: number
  /** How much the ring pulls inward as the section scrubs (0-1 of its radius). */
  tighten: number
  progressRef: React.MutableRefObject<number>
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.z += delta * speed
    // Rings tighten toward the core as the escrow closes
    const s = 1 - tighten * Math.min(progressRef.current * 1.6, 1)
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} rotation={rotation}>
      <torusGeometry args={[radius, 0.005, 16, 128]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  )
}

/** Dashed accent circle that completes (draws in) with scroll — the orbit closing. */
function ClosingRing({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const lineRef = useRef<THREE.Line>(null)
  const SEGMENTS = 128
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * 2.15, 0, Math.sin(a) * 2.15))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])

  useFrame((_, delta) => {
    const line = lineRef.current
    if (!line) return
    line.rotation.y += delta * 0.1
    const t = Math.min(Math.max((progressRef.current - 0.1) / 0.5, 0), 1)
    line.geometry.setDrawRange(0, Math.floor(t * (SEGMENTS + 1)))
  })

  return (
     
    <primitive
      object={useMemo(() => {
        const mat = new THREE.LineDashedMaterial({
          color: BLOOD,
          transparent: true,
          opacity: 0.6,
          dashSize: 0.12,
          gapSize: 0.08,
        })
        const l = new THREE.Line(geometry, mat)
        l.computeLineDistances()
        l.rotation.x = Math.PI / 8
        return l
         
      }, [geometry])}
      ref={lineRef}
    />
  )
}

/** Metallic escrow coin — the locked USDC artifact (no branding, pure form). */
function EscrowCoin() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.25
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.28 + 0.5
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08
  })
  return (
    <group ref={ref}>
      <mesh>
        <cylinderGeometry args={[0.85, 0.85, 0.12, 64]} />
        <meshStandardMaterial color={BONE} metalness={0.92} roughness={0.28} />
      </mesh>
      {[0.065, -0.065].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.68, 0.015, 12, 96]} />
          <meshStandardMaterial color={BONE} metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      {/* Layered additive bloom shells around the core */}
      {[1.05, 1.35, 1.9, 2.8].map((s, i) => (
        <mesh key={i} scale={s}>
          <sphereGeometry args={[0.9, 24, 24]} />
          <meshBasicMaterial
            color={i < 2 ? BONE : BLOOD}
            transparent
            opacity={0.05 / (i + 1)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Orbiting body with additive glow shells. */
function OrbitBody({
  radius,
  speed,
  tilt,
  phase,
  size,
  color,
  glow,
}: {
  radius: number
  speed: number
  tilt: number
  phase: number
  size: number
  color: string
  glow: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * speed + phase
    ref.current.position.set(
      Math.cos(t) * radius,
      Math.sin(t) * radius * Math.sin(tilt),
      Math.sin(t) * radius,
    )
  })
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {glow &&
        [1.8, 3.2, 5.5].map((s, i) => (
          <mesh key={i} scale={s}>
            <sphereGeometry args={[size, 16, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.22 / (i + 1)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
    </group>
  )
}

/** Slow-rotating dust field behind the machine. */
function DustField() {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const N = 350
    const arr = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = 3 + Math.random() * 5
      const theta = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * 5
      arr[i * 3] = Math.cos(theta) * r
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = Math.sin(theta) * r
    }
    return arr
  }, [])
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.015
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={BONE} size={0.014} sizeAttenuation transparent opacity={0.35} depthWrite={false} />
    </points>
  )
}

function Scene({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current) return
    const { x, y } = state.pointer
    group.current.rotation.y += (x * 0.3 - group.current.rotation.y) * 0.04
    group.current.rotation.x += (-y * 0.2 - group.current.rotation.x) * 0.04
    // Scroll-linked camera drift and gentle push-in as the orbit closes
    const p = progressRef.current
    state.camera.position.x += (Math.sin(p * Math.PI) * 0.9 - state.camera.position.x) * 0.05
    state.camera.position.y += (0.4 + p * 0.5 - state.camera.position.y) * 0.05
    state.camera.position.z += (4.2 - p * 0.7 - state.camera.position.z) * 0.05
    state.camera.lookAt(0, 0, 0)
  })
  return (
    <group ref={group}>
      <ambientLight intensity={0.25} />
      <pointLight position={[4, 4, 4]} intensity={14} color={BONE} />
      <pointLight position={[-4, -2, 3]} intensity={10} color={BLOOD} />
      <DustField />
      <EscrowCoin />
      <OrbitRing radius={1.6} rotation={[Math.PI / 2.1, 0.2, 0]} speed={0.16} color={BONE} opacity={0.3} tighten={0.1} progressRef={progressRef} />
      <OrbitRing radius={1.95} rotation={[Math.PI / 2.6, -0.3, 0.1]} speed={-0.12} color={BONE} opacity={0.18} tighten={0.16} progressRef={progressRef} />
      <OrbitRing radius={2.3} rotation={[Math.PI / 3, 0.5, 0.2]} speed={0.09} color={BLOOD} opacity={0.28} tighten={0.22} progressRef={progressRef} />
      <OrbitRing radius={2.7} rotation={[Math.PI / 2.3, -0.6, 0.3]} speed={-0.06} color={BONE} opacity={0.1} tighten={0.3} progressRef={progressRef} />
      <ClosingRing progressRef={progressRef} />
      {/* Orbiting bodies at staggered radii/speeds */}
      <OrbitBody radius={1.9} speed={0.55} tilt={0.4} phase={0} size={0.045} color={BLOOD} glow />
      <OrbitBody radius={1.45} speed={-0.8} tilt={-0.6} phase={2.1} size={0.03} color={BONE} glow={false} />
      <OrbitBody radius={2.45} speed={0.32} tilt={0.25} phase={4.2} size={0.026} color={BONE} glow={false} />
      <OrbitBody radius={2.75} speed={-0.2} tilt={-0.35} phase={1.1} size={0.02} color={BONE} glow={false} />
    </group>
  )
}

/** Lazy 3D escrow orbit for section 04 — mounted only via next/dynamic on capable devices. */
export default function EscrowOrbit3D({ progress }: Props) {
  const progressRef = useProgressRef(progress)
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.4, 4.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      {/* Depth fog fades the dust and outer rings into the void */}
      <fog attach="fog" args={["#050505", 4.5, 10]} />
      <Suspense fallback={null}>
        <Scene progressRef={progressRef} />
      </Suspense>
    </Canvas>
  )
}
