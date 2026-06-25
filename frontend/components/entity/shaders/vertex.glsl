uniform float uTime;
uniform vec2 uMouse;
uniform float uAudioFrequency;
uniform float uAudioBass;
uniform float uAudioTreble;

attribute float aRandom;
attribute float aPhase;

varying float vAlpha;
varying float vDistance;
varying vec3 vColor;

// Simplex noise approximation for organic motion
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

float noise3D(vec3 p) {
  return noise(p.x + p.y * 157.0 + p.z * 113.0);
}

void main() {
  vec3 pos = position;

  // --- Idle floating animation (perlin-like noise + sin waves) ---
  float noiseVal = noise3D(pos * 0.5 + uTime * 0.3);
  float floatX = sin(uTime * 0.7 + aPhase * 6.28) * 0.15 * (0.5 + noiseVal);
  float floatY = cos(uTime * 0.5 + aPhase * 3.14) * 0.2 * (0.5 + noiseVal);
  float floatZ = sin(uTime * 0.6 + aRandom * 6.28) * 0.1;

  pos += vec3(floatX, floatY, floatZ);

  // --- Mouse attraction (distance-based force toward cursor) ---
  // Convert mouse from NDC to world-space approximation
  vec3 mouseWorld = vec3(uMouse.x * 3.0, uMouse.y * 3.0, 0.0);
  vec3 toMouse = mouseWorld - pos;
  float distToMouse = length(toMouse);
  float attractionStrength = 0.8 / (1.0 + distToMouse * distToMouse);
  // Particles closer to mouse are attracted more strongly
  vec3 attraction = normalize(toMouse) * attractionStrength * smoothstep(5.0, 0.0, distToMouse);
  pos += attraction;

  // --- Audio reactivity (frequency displaces particles outward) ---
  float radius = length(pos.xy);
  vec3 radialDir = normalize(vec3(pos.xy, 0.0));

  // Bass causes expansion, treble causes jitter
  float bassDisplacement = uAudioBass * 0.8 * smoothstep(0.0, 2.0, radius);
  float trebleJitter = uAudioTreble * 0.3 * noise(aRandom * 100.0 + uTime * 5.0);
  float freqDisplacement = uAudioFrequency * 0.5;

  pos += radialDir * (bassDisplacement + trebleJitter + freqDisplacement);

  // --- Breathing effect (subtle pulsing) ---
  float breathe = sin(uTime * 1.5) * 0.05;
  pos *= 1.0 + breathe;

  // --- Compute varying outputs ---
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  // Distance from center affects alpha
  vDistance = length(pos.xy) / 3.0;
  vAlpha = 0.4 + 0.6 * (1.0 - vDistance) + uAudioFrequency * 0.3;
  vAlpha = clamp(vAlpha, 0.1, 1.0);

  // Color based on position and audio
  float colorMix = (pos.x + pos.y) * 0.2 + uAudioFrequency * 0.5;
  vColor = mix(
    vec3(0.0, 0.96, 1.0),   // Cyan
    vec3(0.71, 0.0, 1.0),    // Purple
    0.5 + 0.5 * sin(colorMix + uTime * 0.5)
  );

  // Point size - closer particles appear larger
  gl_PointSize = (3.0 + aRandom * 2.0 + uAudioBass * 3.0) * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
