/**
 * Audio Visualizer with Real-Time Sync
 * Simplified version for immediate implementation
 */

import * as Tone from "tone";

export interface VisualizerConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  theme: "lofi heartbreak" | "romantic" | "happy pop";
  syncMode: boolean;
}

export interface SyncMetrics {
  audioTimestamp: number;
  frameTimestamp: number;
  offset: number;
  fps: number;
  dropped: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
}

class AudioVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private analyzer: Tone.Analyser;
  private waveformAnalyzer: Tone.Waveform;
  
  private animationFrame: number | null = null;
  private syncTimestamps: number[] = [];
  private frameCount = 0;
  private droppedFrames = 0;
  private lastFrameTime = 0;

  private particles: Particle[] = [];
  private beatDetector: BeatDetector;
  
  constructor(config: VisualizerConfig) {
    this.canvas = config.canvas;
    const context = this.canvas.getContext("2d");
    
    if (!context) {
      throw new Error("Canvas 2D context not available");
    }
    
    this.ctx = context;
    this.canvas.width = config.width;
    this.canvas.height = config.height;

    // Tone.js audio analysis
    this.analyzer = new Tone.Analyser("fft", 512);
    this.waveformAnalyzer = new Tone.Waveform(512);
    
    // Connect to Tone's master output
    Tone.getDestination().connect(this.analyzer);
    Tone.getDestination().connect(this.waveformAnalyzer);

    this.beatDetector = new BeatDetector(this.analyzer);
  }

  start() {
    if (this.animationFrame) return;

    const render = () => {
      const now = performance.now();
      const audioTime = Tone.Transport.seconds;

      // Track sync metrics
      this.syncTimestamps.push(now);
      if (this.syncTimestamps.length > 60) {
        this.syncTimestamps.shift();
      }

      // Detect dropped frames
      if (this.lastFrameTime > 0) {
        const expectedDelta = 1000 / 60;
        const actualDelta = now - this.lastFrameTime;
        
        if (actualDelta > expectedDelta * 1.5) {
          this.droppedFrames++;
        }
      }

      this.lastFrameTime = now;
      this.frameCount++;

      // Render frame
      this.renderFrame(audioTime, now);

      this.animationFrame = requestAnimationFrame(render);
    };

    render();
  }

  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.clear();
  }

  private renderFrame(audioTime: number, frameTime: number) {
    this.clear();

    const fftData = this.analyzer.getValue() as Float32Array;
    const waveformData = this.waveformAnalyzer.getValue() as Float32Array;

    const beatDetected = this.beatDetector.detect();

    if (beatDetected) {
      this.spawnParticles(50);
      this.flashEffect();
    }

    this.drawWaveform(waveformData, audioTime);
    this.drawSpectrum(fftData, audioTime);
    this.updateParticles();
    this.drawSyncIndicator(audioTime, frameTime);
  }

  private drawWaveform(data: Float32Array, audioTime: number) {
    const { width, height } = this.canvas;
    const centerY = height * 0.5;
    const amplitude = height * 0.25;

    this.ctx.strokeStyle = `rgba(99, 102, 241, ${0.8 + Math.sin(audioTime * 2) * 0.2})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * width;
      const y = centerY + data[i] * amplitude;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();
  }

  private drawSpectrum(data: Float32Array, audioTime: number) {
    const { width, height } = this.canvas;
    const barWidth = width / data.length;
    const maxHeight = height * 0.4;

    for (let i = 0; i < data.length; i++) {
      const value = (data[i] + 100) / 100;
      const barHeight = Math.max(0, value * maxHeight);

      const x = i * barWidth;
      const y = height - barHeight;

      const hue = (200 + i + audioTime * 50) % 360;
      this.ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
      
      this.ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  }

  private drawSyncIndicator(audioTime: number, frameTime: number) {
    const offset = Math.abs(frameTime - audioTime * 1000);
    
    let color = "rgb(34, 197, 94)";
    if (offset > 50) {
      color = "rgb(239, 68, 68)";
    } else if (offset > 15) {
      color = "rgb(234, 179, 8)";
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(10, 10, 10, 10);

    this.ctx.fillStyle = "white";
    this.ctx.font = "12px monospace";
    this.ctx.fillText(`Sync: ${offset.toFixed(2)}ms`, 30, 19);
    this.ctx.fillText(`FPS: ${this.calculateFPS()}`, 30, 35);
    this.ctx.fillText(`Drops: ${this.droppedFrames}`, 30, 51);
  }

  private spawnParticles(count: number) {
    const { width, height } = this.canvas;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: width / 2,
        y: height / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        decay: 0.02,
        size: Math.random() * 4 + 2,
        color: `hsl(${Math.random() * 60 + 200}, 70%, 60%)`,
      });
    }
  }

  private updateParticles() {
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= particle.decay;

      this.ctx.fillStyle = particle.color;
      this.ctx.globalAlpha = particle.life;
      this.ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }

    this.ctx.globalAlpha = 1.0;
  }

  private flashEffect() {
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private calculateFPS(): number {
    if (this.syncTimestamps.length < 2) return 0;

    const duration =
      this.syncTimestamps[this.syncTimestamps.length - 1] -
      this.syncTimestamps[0];

    return Math.round((this.syncTimestamps.length / duration) * 1000);
  }

  getSyncMetrics(): SyncMetrics {
    const audioTimestamp = Tone.Transport.seconds * 1000;
    const frameTimestamp = performance.now();

    return {
      audioTimestamp,
      frameTimestamp,
      offset: Math.abs(frameTimestamp - audioTimestamp),
      fps: this.calculateFPS(),
      dropped: this.droppedFrames,
    };
  }

  private clear() {
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

class BeatDetector {
  private analyzer: Tone.Analyser;
  private threshold = -30;
  private lastBeatTime = 0;
  private cooldown = 200;

  constructor(analyzer: Tone.Analyser) {
    this.analyzer = analyzer;
  }

  detect(): boolean {
    const values = this.analyzer.getValue() as Float32Array;
    
    const lowFreqAvg =
      values.slice(0, 10).reduce((a, b) => a + b, 0) / 10;

    const now = Date.now();

    if (lowFreqAvg > this.threshold && now - this.lastBeatTime > this.cooldown) {
      this.lastBeatTime = now;
      return true;
    }

    return false;
  }
}

export default AudioVisualizer;
