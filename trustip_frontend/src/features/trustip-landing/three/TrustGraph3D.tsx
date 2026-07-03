"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import { Suspense, useMemo, useRef, useState } from "react"
import * as THREE from "three"

const BONE = "#EDEAE3"
const BLOOD = "#FF2D00"
const NODE_COUNT = 22

type NodeDef = { pos: [number, number, number]; accent: boolean; label: string }

function buildGraph() {
  // Deterministic pseudo-random layout so SSR/CSR and reloads agree.
  let seed = 42
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const nodes: NodeDef[] = Array.from({ length: NODE_COUNT }, (_, i) => {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    const r = 1.1 + rand() * 0.9
    return {
      pos: [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.8,
        r * Math.cos(phi),
      ] as [number, number, number],
      accent: i % 7 === 0,
      label: `ORDER · TRP-${String(1000 + i * 13)} (DEMO)`,
    }
  })
  const edges: [number, number][] = []
  for (let i = 0; i < NODE_COUNT; i++) {
    const j = Math.floor(rand() * NODE_COUNT)
    if (j !== i) edges.push([i, j])
    if (rand() > 0.55) {
      const k = Math.floor(rand() * NODE_COUNT)
      if (k !== i) edges.push([i, k])
    }
  }
  return { nodes, edges }
}

function Node({ def, index }: { def: NodeDef; index: number }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const s = 1 + Math.sin(state.clock.elapsedTime * 1.4 + index) * 0.12
    ref.current.scale.setScalar(hover ? 1.9 : s)
  })
  const size = def.accent ? 0.055 : 0.038
  return (
    <group position={def.pos}>
      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[size, 12, 12]} />
        <meshBasicMaterial
          color={hover || def.accent ? BLOOD : BONE}
          transparent
          opacity={hover ? 1 : def.accent ? 0.95 : 0.65}
        />
      </mesh>
      {/* Soft additive glow shell per node */}
      <mesh scale={hover ? 4 : 2.4}>
        <sphereGeometry args={[size, 10, 10]} />
        <meshBasicMaterial
          color={hover || def.accent ? BLOOD : BONE}
          transparent
          opacity={hover ? 0.3 : 0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {hover && (
        <Html center distanceFactor={6} style={{ pointerEvents: "none" }}>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#EDEAE3",
              background: "rgba(5,5,5,0.85)",
              border: "1px solid rgba(255,45,0,0.5)",
              padding: "3px 7px",
              whiteSpace: "nowrap",
              transform: "translateY(-22px)",
            }}
          >
            {def.label}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Small pulses that travel along graph edges. */
function EdgePulses({ nodes, edges }: { nodes: NodeDef[]; edges: [number, number][] }) {
  const COUNT = 5
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const routes = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        edge: edges[(i * 5) % edges.length],
        speed: 0.3 + (i % 3) * 0.18,
        offset: i / COUNT,
      })),
    [edges],
  )

  useFrame((state) => {
    routes.forEach((r, i) => {
      const m = refs.current[i]
      if (!m) return
      const t = (state.clock.elapsedTime * r.speed + r.offset) % 1
      const a = nodes[r.edge[0]].pos
      const b = nodes[r.edge[1]].pos
      m.position.set(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      )
      const mat = m.material as THREE.MeshBasicMaterial
      // Bright mid-edge, fading at both endpoints
      mat.opacity = Math.sin(t * Math.PI) * 0.9
    })
  })

  return (
    <>
      {routes.map((_, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color={BLOOD} transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

function Graph() {
  const group = useRef<THREE.Group>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const { nodes, edges } = useMemo(() => buildGraph(), [])

  const lineGeom = useMemo(() => {
    const pts: number[] = []
    for (const [a, b] of edges) {
      pts.push(...nodes[a].pos, ...nodes[b].pos)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [nodes, edges])

  useFrame((state, delta) => {
    if (!group.current) return
    // Idle breathing
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02
    group.current.scale.setScalar(breathe)
    if (!dragging.current) {
      group.current.rotation.y += delta * 0.08
      const { x, y } = state.pointer
      group.current.rotation.x += (-y * 0.15 - group.current.rotation.x) * 0.03
      group.current.rotation.z += (x * 0.06 - group.current.rotation.z) * 0.03
    }
  })

  return (
    <group
      ref={group}
      onPointerDown={(e) => {
        dragging.current = true
        last.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
      onPointerMove={(e) => {
        if (!dragging.current || !group.current) return
        group.current.rotation.y += (e.clientX - last.current.x) * 0.005
        group.current.rotation.x += (e.clientY - last.current.y) * 0.005
        last.current = { x: e.clientX, y: e.clientY }
      }}
    >
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial color={BONE} transparent opacity={0.14} />
      </lineSegments>
      <EdgePulses nodes={nodes} edges={edges} />
      {nodes.map((n, i) => (
        <Node key={i} def={n} index={i} />
      ))}
      {/* Center escrow anchor */}
      <mesh>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color={BLOOD} />
      </mesh>
      {[2.6, 4.5].map((s, i) => (
        <mesh key={i} scale={s}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial
            color={BLOOD}
            transparent
            opacity={0.15 / (i + 1)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Interactive 3D trust constellation — hover nodes for labels, drag to rotate. */
export default function TrustGraph3D() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent", touchAction: "none", cursor: "grab" }}
    >
      <Suspense fallback={null}>
        <Graph />
      </Suspense>
    </Canvas>
  )
}
