"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, Suspense, useEffect } from "react";
import * as THREE from "three";
import { useScroll, useTransform, motion, useSpring } from "framer-motion";

/* ============================================================
   3D Escrow Object — dark orbital escrow machine
   Thin concentric rings, wireframe sphere, red-orange payment dot
   ============================================================ */

function OrbitRing({
  radius,
  rotation,
  speed,
  color,
  opacity = 0.4,
  thickness = 0.005,
}: {
  radius: number;
  rotation: [number, number, number];
  speed: number;
  color: string;
  opacity?: number;
  thickness?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * speed;
  });

  return (
    <mesh ref={ref} rotation={rotation}>
      <torusGeometry args={[radius, thickness, 16, 128]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function WireframeSphere({
  radius,
  color,
  opacity,
  detail = 2,
}: {
  radius: number;
  color: string;
  opacity: number;
  detail?: number;
}) {
  return (
    <lineSegments>
      <icosahedronGeometry args={[radius, detail]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
    </lineSegments>
  );
}

function PaymentDot({
  orbitRadius,
  speed,
  tilt,
  color = "#FF2D00",
}: {
  orbitRadius: number;
  speed: number;
  tilt: number;
  color?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    ref.current.position.x = Math.cos(t) * orbitRadius;
    ref.current.position.z = Math.sin(t) * orbitRadius;
    ref.current.position.y = Math.sin(t) * orbitRadius * Math.sin(tilt);
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Subtle outer glow */}
      <mesh scale={2.2}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function VaultCore({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current || !innerRef.current) return;
    const scrollProgress = scrollRef.current;
    // Slow idle rotation
    groupRef.current.rotation.y += delta * 0.08;
    innerRef.current.rotation.y -= delta * 0.12;
    innerRef.current.rotation.x += delta * 0.04;

    // Scroll-linked tilt and expand
    const expand = 1 + scrollProgress * 0.25;
    groupRef.current.scale.setScalar(expand);
    groupRef.current.rotation.x = scrollProgress * 0.4;
  });

  return (
    <group ref={groupRef}>
      {/* Outer ring system */}
      <group ref={innerRef}>
        <OrbitRing radius={2.4} rotation={[Math.PI / 2, 0, 0]} speed={0.18} color="#EDEAE3" opacity={0.18} />
        <OrbitRing radius={2.0} rotation={[Math.PI / 2.4, 0.2, 0]} speed={-0.14} color="#EDEAE3" opacity={0.25} />
        <OrbitRing radius={1.6} rotation={[Math.PI / 1.8, -0.3, 0.1]} speed={0.22} color="#EDEAE3" opacity={0.35} />
        <OrbitRing radius={1.2} rotation={[Math.PI / 2.2, 0.5, -0.2]} speed={-0.30} color="#EDEAE3" opacity={0.5} />

        {/* Tilted accent orbit — red-orange */}
        <OrbitRing radius={2.2} rotation={[Math.PI / 3, 0.4, 0.2]} speed={0.12} color="#FF2D00" opacity={0.4} thickness={0.004} />
      </group>

      {/* Wireframe spheres — concentric */}
      <WireframeSphere radius={1.0} color="#EDEAE3" opacity={0.12} detail={2} />
      <WireframeSphere radius={0.6} color="#EDEAE3" opacity={0.18} detail={1} />

      {/* Solid inner core */}
      <mesh>
        <icosahedronGeometry args={[0.25, 0]} />
        <meshBasicMaterial color="#0A0A0A" wireframe={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.26, 0]} />
        <meshBasicMaterial color="#EDEAE3" wireframe transparent opacity={0.4} />
      </mesh>

      {/* Orbiting payment dots */}
      <PaymentDot orbitRadius={2.2} speed={0.45} tilt={0.4} />
      <PaymentDot orbitRadius={1.6} speed={-0.6} tilt={-0.6} color="#EDEAE3" />

      {/* Cardinal markers — tiny squares */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6]}
          rotation={[0, -a, 0]}
        >
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial color="#EDEAE3" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      cameraRef.current = camera;
      camera.position.set(0, 0, 6);
    }
  }, [camera]);

  useFrame(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.position.x = Math.sin(scrollRef.current * 1.2) * 1.5;
    cam.position.y = Math.cos(scrollRef.current * 0.8) * 0.8;
    cam.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={0.3} />
      <VaultCore scrollRef={scrollRef} />
    </>
  );
}

type EscrowOrbitProps = {
  className?: string;
  scrollYProgress?: ReturnType<typeof useScroll>["scrollYProgress"];
};

export function EscrowOrbit({ className = "", scrollYProgress }: EscrowOrbitProps) {
  // For pages without explicit scroll progress, use a static-ish spring
  const fallback = useSpring(useScroll().scrollYProgress, { stiffness: 100, damping: 30 });
  const progress = scrollYProgress ?? fallback;

  const scrollRef = useRef(0);

  // Sync the framer-motion scroll progress into a ref for rAF usage
  useEffect(() => {
    const unsub = progress.on("change", (v: number) => {
      scrollRef.current = v;
    });
    return () => unsub();
  }, [progress]);

  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene scrollRef={scrollRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
