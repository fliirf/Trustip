"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Suspense, useRef } from "react"
import * as THREE from "three"

const BONE = "#EDEAE3"
const BLOOD = "#FF2D00"

function OrbitRing({
  radius,
  rotation,
  speed,
  color,
  opacity,
}: {
  radius: number
  rotation: [number, number, number]
  speed: number
  color: string
  opacity: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed
  })
  return (
    <mesh ref={ref} rotation={rotation}>
      <torusGeometry args={[radius, 0.005, 16, 128]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
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
      {/* Rim relief ring */}
      <mesh position={[0, 0.065, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.015, 12, 96]} />
        <meshStandardMaterial color={BONE} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.065, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.015, 12, 96]} />
        <meshStandardMaterial color={BONE} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}

/** Red-orange payment dot with layered additive shells — fake bloom, no postprocessing dep. */
function PaymentDot() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * 0.55
    ref.current.position.set(Math.cos(t) * 1.9, Math.sin(t * 0.9) * 0.5, Math.sin(t) * 1.9)
  })
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color={BLOOD} />
      </mesh>
      {[1.8, 3.2, 5.5].map((s, i) => (
        <mesh key={i} scale={s}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial
            color={BLOOD}
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

function Scene() {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current) return
    // Gentle mouse-reactive tilt
    const { x, y } = state.pointer
    group.current.rotation.y += (x * 0.3 - group.current.rotation.y) * 0.04
    group.current.rotation.x += (-y * 0.2 - group.current.rotation.x) * 0.04
  })
  return (
    <group ref={group}>
      <ambientLight intensity={0.25} />
      <pointLight position={[4, 4, 4]} intensity={14} color={BONE} />
      <pointLight position={[-4, -2, 3]} intensity={10} color={BLOOD} />
      <EscrowCoin />
      <OrbitRing radius={1.6} rotation={[Math.PI / 2.1, 0.2, 0]} speed={0.16} color={BONE} opacity={0.3} />
      <OrbitRing radius={1.95} rotation={[Math.PI / 2.6, -0.3, 0.1]} speed={-0.12} color={BONE} opacity={0.18} />
      <OrbitRing radius={2.3} rotation={[Math.PI / 3, 0.5, 0.2]} speed={0.09} color={BLOOD} opacity={0.28} />
      <PaymentDot />
    </group>
  )
}

/** Lazy 3D escrow orbit for section 04 — mounted only via next/dynamic on capable devices. */
export default function EscrowOrbit3D() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.4, 4.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
