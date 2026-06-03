'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ─── Particle field ──────────────────────────────────────────────────────────

function ParticleField() {
  const ref = useRef<THREE.Points>(null);
  const count = 4500;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r     = 9 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.y = s.clock.elapsedTime * 0.018;
    ref.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.008) * 0.04;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.013}
        color="#6030b8"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Near particles (foreground depth layer) ─────────────────────────────────

function ForegroundDust() {
  const ref = useRef<THREE.Points>(null);
  const count = 800;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 + 1;
    }
    return pos;
  }, []);

  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.y = s.clock.elapsedTime * 0.006;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        color="#9060d8"
        transparent
        opacity={0.18}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Protocol orb ─────────────────────────────────────────────────────────────

function ProtocolOrb({
  mouse,
}: {
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const orbRef    = useRef<THREE.Mesh>(null);
  const innerRef  = useRef<THREE.Mesh>(null);
  const coreRef   = useRef<THREE.Mesh>(null);
  const r1Ref     = useRef<THREE.Mesh>(null);
  const r2Ref     = useRef<THREE.Mesh>(null);
  const r3Ref     = useRef<THREE.Mesh>(null);
  const glowLight = useRef<THREE.PointLight>(null);
  const mouseLight = useRef<THREE.PointLight>(null);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const py = 0.25 + Math.sin(t * 0.38) * 0.18;

    if (orbRef.current) {
      orbRef.current.rotation.y = t * 0.055;
      orbRef.current.rotation.x = Math.sin(t * 0.18) * 0.06;
      orbRef.current.position.y = py;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.11;
      innerRef.current.position.y = py;
    }
    if (coreRef.current) {
      coreRef.current.position.y = py;
      const s2 = 1 + Math.sin(t * 2.2) * 0.06;
      coreRef.current.scale.setScalar(s2);
    }
    if (r1Ref.current) { r1Ref.current.rotation.z = t * 0.07;  r1Ref.current.position.y = py; }
    if (r2Ref.current) { r2Ref.current.rotation.x = t * 0.05;  r2Ref.current.rotation.z = t * 0.03; r2Ref.current.position.y = py; }
    if (r3Ref.current) { r3Ref.current.rotation.y = t * 0.04;  r3Ref.current.rotation.x = t * 0.06; r3Ref.current.position.y = py; }

    if (glowLight.current) {
      glowLight.current.intensity = 3.5 + Math.sin(t * 1.6) * 0.9;
      glowLight.current.position.y = py;
    }
    if (mouseLight.current) {
      const tx = mouse.current.x * 5;
      const ty = -mouse.current.y * 3 + 1;
      mouseLight.current.position.x += (tx - mouseLight.current.position.x) * 0.04;
      mouseLight.current.position.y += (ty - mouseLight.current.position.y) * 0.04;
    }
  });

  return (
    <group>
      {/* Internal core light */}
      <pointLight ref={glowLight} position={[0, 0.25, 0]} intensity={3.5} color="#6018d0" distance={9} decay={2} />

      {/* Mouse-tracking accent light */}
      <pointLight ref={mouseLight} position={[0, 1, 4]} intensity={2} color="#9040ff" distance={14} decay={2} />

      {/* Rim / fill lights — keep intensities low */}
      <pointLight position={[5, 7, -6]} intensity={1}   color="#101890" distance={20} decay={2} />
      <pointLight position={[-4, 2, -4]} intensity={0.6} color="#300050" distance={15} decay={2} />

      {/* ── Outer glass icosahedron ── */}
      <mesh ref={orbRef} position={[0, 0.25, 0]}>
        <icosahedronGeometry args={[2.05, 3]} />
        <MeshTransmissionMaterial
          backside
          samples={8}
          resolution={512}
          transmission={0.93}
          roughness={0.05}
          thickness={0.45}
          ior={1.42}
          chromaticAberration={0.02}
          anisotropy={0.15}
          distortion={0.08}
          distortionScale={0.12}
          temporalDistortion={0.04}
          color="#0c0420"
          attenuationColor="#7828ff"
          attenuationDistance={0.9}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* ── Inner emissive sphere ── */}
      <mesh ref={innerRef} position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.88, 32, 32]} />
        <meshStandardMaterial
          color="#180040"
          emissive="#4c0faf"
          emissiveIntensity={2}
          roughness={0.55}
          metalness={0.2}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* ── Bright core dot ── */}
      <mesh ref={coreRef} position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshBasicMaterial color="#e8d4ff" transparent opacity={0.95} />
      </mesh>

      {/* ── Orbital rings ── */}
      <mesh ref={r1Ref} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.72, 0.007, 8, 140]} />
        <meshBasicMaterial color="#8840ff" transparent opacity={0.55} />
      </mesh>

      <mesh ref={r2Ref} position={[0, 0.25, 0]} rotation={[0.55, Math.PI / 4, 0]}>
        <torusGeometry args={[2.98, 0.005, 8, 140]} />
        <meshBasicMaterial color="#4458ff" transparent opacity={0.38} />
      </mesh>

      <mesh ref={r3Ref} position={[0, 0.25, 0]} rotation={[-0.78, Math.PI / 3, Math.PI / 5]}>
        <torusGeometry args={[3.22, 0.004, 8, 140]} />
        <meshBasicMaterial color="#28c8ff" transparent opacity={0.22} />
      </mesh>

      {/* ── Outer atmosphere halo ── */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[4.2, 24, 24]} />
        <meshBasicMaterial color="#380898" transparent opacity={0.035} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// ─── Camera parallax ─────────────────────────────────────────────────────────

function CameraRig({
  mouse,
}: {
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0.25, 0), []);

  useFrame(() => {
    const tx = mouse.current.x * 0.75;
    const ty = -mouse.current.y * 0.32 + 0.25;
    camera.position.x += (tx - camera.position.x) * 0.028;
    camera.position.y += (ty - camera.position.y) * 0.028;
    camera.lookAt(target);
  });

  return null;
}

// ─── Full scene ───────────────────────────────────────────────────────────────

function Scene({
  mouseRef,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  return (
    <>
      <fog attach="fog" args={['#030310', 20, 48]} />
      <ambientLight intensity={0.035} color="#080420" />
      <directionalLight position={[2, 10, 4]} intensity={0.12} color="#3018a0" />

      <Stars radius={90} depth={70} count={6000} factor={3} saturation={0.15} fade speed={0.5} />
      <ParticleField />
      <ForegroundDust />
      <ProtocolOrb mouse={mouseRef} />
      <CameraRig mouse={mouseRef} />
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function HeroCanvas({
  mouseRef,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  return (
    <Canvas
      shadows={false}
      camera={{ position: [0, 0.4, 9], fov: 52 }}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.62,
      }}
      style={{ background: '#030310' }}
      dpr={[1, 1.5]}
    >
      <Scene mouseRef={mouseRef} />
    </Canvas>
  );
}
