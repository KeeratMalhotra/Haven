"use client";

import { Canvas } from "@react-three/fiber";
import ParticleSystem from "./ParticleSystem";

export default function EntityCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      style={{ background: "transparent" }}
      gl={{ antialias: true, alpha: true }}
    >
      <ParticleSystem />
    </Canvas>
  );
}
