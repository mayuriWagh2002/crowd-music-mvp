"use client";

import { useEffect, useRef, useState } from "react";
import AudioVisualizer, { SyncMetrics } from "@/app/lib/audioVisualizer";

interface VisualizerProps {
  isPlaying: boolean;
  theme?: "lofi heartbreak" | "romantic" | "happy pop";
  showMetrics?: boolean;
  onMetricsUpdate?: (metrics: SyncMetrics) => void;
}

export default function Visualizer({
  isPlaying,
  theme = "lofi heartbreak",
  showMetrics = true,
  onMetricsUpdate,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<AudioVisualizer | null>(null);
  
  const [metrics, setMetrics] = useState<SyncMetrics>({
    audioTimestamp: 0,
    frameTimestamp: 0,
    offset: 0,
    fps: 0,
    dropped: 0,
  });

  // Initialize visualizer
  useEffect(() => {
    if (!canvasRef.current) return;

    const visualizer = new AudioVisualizer({
      canvas: canvasRef.current,
      width: 800,
      height: 400,
      theme,
      syncMode: true,
    });

    visualizerRef.current = visualizer;

    return () => {
      visualizer.stop();
    };
  }, [theme]);

  // Control playback
  useEffect(() => {
    if (!visualizerRef.current) return;

    if (isPlaying) {
      visualizerRef.current.start();
    } else {
      visualizerRef.current.stop();
    }
  }, [isPlaying]);

  // Update metrics
  useEffect(() => {
    if (!isPlaying || !visualizerRef.current) return;

    const interval = setInterval(() => {
      if (visualizerRef.current) {
        const newMetrics = visualizerRef.current.getSyncMetrics();
        setMetrics(newMetrics);
        
        // Call parent callback if provided
        if (onMetricsUpdate) {
          onMetricsUpdate(newMetrics);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, onMetricsUpdate]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-xl border border-white/10 bg-black"
      />
      
      {showMetrics && isPlaying && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm 
                      border border-white/20 rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">Sync Offset:</span>
            <span className={`font-mono ${
              metrics.offset < 15 ? "text-green-400" :
              metrics.offset < 50 ? "text-yellow-400" :
              "text-red-400"
            }`}>
              {metrics.offset.toFixed(2)}ms
            </span>
          </div>
          
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">FPS:</span>
            <span className={`font-mono ${
              metrics.fps >= 58 ? "text-green-400" :
              metrics.fps >= 45 ? "text-yellow-400" :
              "text-red-400"
            }`}>
              {metrics.fps}
            </span>
          </div>
          
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">Dropped:</span>
            <span className="font-mono text-zinc-300">{metrics.dropped}</span>
          </div>
          
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                metrics.offset < 15 ? "bg-green-400" :
                metrics.offset < 50 ? "bg-yellow-400" :
                "bg-red-400"
              } animate-pulse`} />
              <span className="text-zinc-400 text-[10px]">
                {metrics.offset < 15 ? "Perfect Sync" :
                 metrics.offset < 50 ? "Good Sync" :
                 "Sync Issues"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
