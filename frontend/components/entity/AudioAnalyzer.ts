/**
 * AudioAnalyzer - Wraps Web Audio API AnalyserNode.
 * Creates AudioContext, connects to audio source, extracts frequency data,
 * and provides methods to get frequency bands for shader uniforms.
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private source: MediaElementAudioSourceNode | null = null;

  /**
   * Initialize the AudioContext and AnalyserNode.
   * Must be called after a user gesture (browser requirement).
   */
  async init(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;
  }

  /**
   * Connect an HTML audio element to the analyzer.
   */
  connectAudioElement(audioElement: HTMLAudioElement): void {
    if (!this.audioContext || !this.analyser) return;

    // Only create source if not already connected
    if (!this.source) {
      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  /**
   * Get raw frequency data as a normalized Float32Array (0 to 1).
   */
  getFrequencyData(): Float32Array {
    if (!this.analyser || !this.dataArray) {
      return new Float32Array(128);
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // Normalize to 0-1 range
    const normalized = new Float32Array(this.dataArray.length);
    for (let i = 0; i < this.dataArray.length; i++) {
      normalized[i] = this.dataArray[i] / 255.0;
    }
    return normalized;
  }

  /**
   * Get the average frequency level (0 to 1).
   */
  getAverageFrequency(): number {
    const data = this.getFrequencyData();
    if (data.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / data.length;
  }

  /**
   * Get bass level (low frequencies, 0 to 1).
   */
  getBassLevel(): number {
    const data = this.getFrequencyData();
    if (data.length === 0) return 0;

    // Bass is roughly the first 10% of frequency bins
    const bassEnd = Math.floor(data.length * 0.1);
    let sum = 0;
    for (let i = 0; i < bassEnd; i++) {
      sum += data[i];
    }
    return sum / bassEnd;
  }

  /**
   * Get treble level (high frequencies, 0 to 1).
   */
  getTrebleLevel(): number {
    const data = this.getFrequencyData();
    if (data.length === 0) return 0;

    // Treble is roughly the last 30% of frequency bins
    const trebleStart = Math.floor(data.length * 0.7);
    let sum = 0;
    for (let i = trebleStart; i < data.length; i++) {
      sum += data[i];
    }
    return sum / (data.length - trebleStart);
  }

  /**
   * Resume audio context (required after user gesture).
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * Clean up audio resources.
   */
  dispose(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.dataArray = null;
  }
}
