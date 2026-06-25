"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MouseTracker } from "./MouseTracker";

import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";

const PARTICLE_COUNT = 3000;

export default function ParticleSystem() {
  const meshRef = useRef<THREE.Points>(null);
  const mouseTracker = useRef<MouseTracker>(new MouseTracker(0.08));
  const { gl } = useThree();

  // Create uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uAudioFrequency: { value: 0 },
      uAudioBass: { value: 0 },
      uAudioTreble: { value: 0 },
    }),
    []
  );

  // Generate particle positions in a ring/sphere formation
  const { positions, randoms, phases } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Distribute in a sphere/ring shape
      // Use golden ratio for even distribution
      const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      // Radius varies to create a ring-like density (more particles at certain radii)
      const baseRadius = 1.5 + Math.sin(phi * 3) * 0.5;
      const radius = baseRadius + (Math.random() - 0.5) * 0.8;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = (Math.random() - 0.5) * 1.5;

      randoms[i] = Math.random();
      phases[i] = Math.random();
    }

    return { positions, randoms, phases };
  }, []);

  // Attach mouse tracker to the canvas DOM element
  useEffect(() => {
    const tracker = mouseTracker.current;
    const domElement = gl.domElement;
    tracker.attach(domElement);

    return () => {
      tracker.dispose();
    };
  }, [gl.domElement]);

  // Animation loop - update uniforms each frame
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const material = meshRef.current.material as THREE.ShaderMaterial;

    // Update time
    material.uniforms.uTime.value += delta;

    // Update mouse
    mouseTracker.current.update();
    material.uniforms.uMouse.value.set(
      mouseTracker.current.x,
      mouseTracker.current.y
    );

    // Subtle idle audio simulation when no real audio is playing
    // This makes the entity feel alive even without audio input
    const time = material.uniforms.uTime.value;
    const idlePulse = Math.sin(time * 2) * 0.02 + 0.02;
    material.uniforms.uAudioFrequency.value = idlePulse;
    material.uniforms.uAudioBass.value = Math.sin(time * 1.2) * 0.03 + 0.03;
    material.uniforms.uAudioTreble.value = Math.sin(time * 3.5) * 0.01 + 0.01;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          args={[randoms, 1]}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          args={[phases, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
