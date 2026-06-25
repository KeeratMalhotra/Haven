varying float vAlpha;
varying float vDistance;
varying vec3 vColor;

void main() {
  // Create circular point with soft radial falloff
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);

  // Discard fragments outside the circle
  if (dist > 0.5) discard;

  // Soft glow falloff - exponential for neon effect
  float glow = exp(-dist * 6.0);

  // Inner core brightness
  float core = smoothstep(0.3, 0.0, dist);

  // Combine for final intensity
  float intensity = glow * 0.7 + core * 0.5;

  // Apply neon color with glow
  vec3 finalColor = vColor * intensity;

  // Add white hot core for extra glow
  finalColor += vec3(1.0) * core * 0.3;

  // Alpha based on distance from particle center and vertex alpha
  float alpha = intensity * vAlpha;

  // Boost alpha for additive blending appearance
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, alpha);
}
