/**
 * Tests for ParticleSystem component.
 *
 * Mocks @react-three/fiber and Three.js since they require WebGL
 * which is not available in the test environment.
 */

import React from "react";

// Mock @react-three/fiber
jest.mock("@react-three/fiber", () => ({
  useFrame: jest.fn(),
  useThree: jest.fn(() => ({
    gl: {
      domElement: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
      },
    },
  })),
}));

// Mock three
jest.mock("three", () => ({
  Vector2: jest.fn().mockImplementation((x, y) => ({ x: x || 0, y: y || 0, set: jest.fn() })),
  Points: jest.fn(),
  ShaderMaterial: jest.fn(),
  BufferGeometry: jest.fn(),
  AdditiveBlending: 1,
}));

// Mock internal dependencies
jest.mock("@/components/entity/MouseTracker", () => ({
  MouseTracker: jest.fn().mockImplementation(() => ({
    attach: jest.fn(),
    dispose: jest.fn(),
    update: jest.fn(),
    x: 0,
    y: 0,
  })),
}));

jest.mock("@/components/entity/AudioAnalyzer", () => ({
  AudioAnalyzer: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    connectAudioElement: jest.fn(),
    getAverageFrequency: jest.fn(() => 0),
    getBassLevel: jest.fn(() => 0),
    getTrebleLevel: jest.fn(() => 0),
  })),
}));

jest.mock("@/lib/voice", () => ({
  getVoiceAudioElement: jest.fn(() => null),
}));

// Mock .glsl imports
jest.mock("@/components/entity/shaders/vertex.glsl", () => "void main() {}", { virtual: true });
jest.mock("@/components/entity/shaders/fragment.glsl", () => "void main() {}", { virtual: true });

describe("ParticleSystem", () => {
  it("mounts without crashing", () => {
    // Import after all mocks are set up
    const ParticleSystem = require("@/components/entity/ParticleSystem").default;

    // ParticleSystem renders Three.js primitives (<points>, <bufferGeometry>, <shaderMaterial>)
    // In a mocked environment, these are just JSX elements
    // We just verify the module loads and exports a component without throwing
    expect(ParticleSystem).toBeDefined();
    expect(typeof ParticleSystem).toBe("function");
  });
});
