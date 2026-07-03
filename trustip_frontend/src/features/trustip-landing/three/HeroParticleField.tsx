"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Suspense, useMemo, useRef } from "react"
import * as THREE from "three"

const COUNT = 700

function Field() {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 14
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6
    }
    return arr
  }, [])

  useFrame((state, delta) => {
    if (!points.current) return
    // Slow drift plus mouse-reactive tilt
    points.current.rotation.y += delta * 0.012
    const { x, y } = state.pointer
    points.current.rotation.x += (y * 0.08 - points.current.rotation.x) * 0.03
    points.current.rotation.z += (x * 0.05 - points.current.rotation.z) * 0.03
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#EDEAE3"
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  )
}

/** Sparse mouse-reactive particle field behind the TRUSTIP wordmark. */
export default function HeroParticleField() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <Field />
      </Suspense>
    </Canvas>
  )
}
