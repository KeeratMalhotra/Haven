/**
 * MouseTracker - Tracks mouse position and converts to normalized device coordinates.
 * Provides smooth interpolated values via lerp for use in shader uniforms.
 */
export class MouseTracker {
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private lerpFactor: number;
  private active = false;

  constructor(lerpFactor = 0.08) {
    this.lerpFactor = lerpFactor;
  }

  /**
   * Start tracking mouse movement on the given element.
   */
  attach(element: HTMLElement): void {
    if (this.active) return;
    this.active = true;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      // Convert to normalized device coordinates (-1 to 1)
      this.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.targetY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const handleMouseLeave = () => {
      // Gradually return to center
      this.targetX = 0;
      this.targetY = 0;
    };

    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("mouseleave", handleMouseLeave);

    // Store cleanup function
    this._cleanup = () => {
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }

  private _cleanup: (() => void) | null = null;

  /**
   * Update interpolated position (call each frame).
   */
  update(): void {
    this.currentX += (this.targetX - this.currentX) * this.lerpFactor;
    this.currentY += (this.targetY - this.currentY) * this.lerpFactor;
  }

  /**
   * Get the smoothly interpolated X position (-1 to 1).
   */
  get x(): number {
    return this.currentX;
  }

  /**
   * Get the smoothly interpolated Y position (-1 to 1).
   */
  get y(): number {
    return this.currentY;
  }

  /**
   * Clean up event listeners.
   */
  dispose(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
    this.active = false;
  }
}
