"use client";

import { useEffect, useState } from "react";

interface SyncDashboardProps {
  syncOffset: number;
  fps: number;
  droppedFrames: number;
  networkLatency: number;
  participants: number;
  spectators: number;
  isRecording?: boolean;
}

export default function SyncDashboard({
  syncOffset,
  fps,
  droppedFrames,
  networkLatency,
  participants,
  spectators,
  isRecording = false,
}: SyncDashboardProps) {
  const [syncHistory, setSyncHistory] = useState<number[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  // Track sync history
  useEffect(() => {
    setSyncHistory(prev => {
      const updated = [...prev, syncOffset];
      if (updated.length > 60) updated.shift();
      return updated;
    });
  }, [syncOffset]);

  // Track latency history
  useEffect(() => {
    setLatencyHistory(prev => {
      const updated = [...prev, networkLatency];
      if (updated.length > 60) updated.shift();
      return updated;
    });
  }, [networkLatency]);

  const avgSync = syncHistory.length > 0
    ? syncHistory.reduce((a, b) => a + b, 0) / syncHistory.length
    : 0;

  const avgLatency = latencyHistory.length > 0
    ? latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length
    : 0;

  const syncQuality = syncOffset < 15 ? "Perfect" : syncOffset < 50 ? "Good" : "Poor";
  const overallScore = calculateOverallScore(syncOffset, fps, networkLatency);

  return (
    <div className="fixed top-4 left-4 w-80 bg-black/90 backdrop-blur-xl 
                    border border-white/20 rounded-2xl p-5 space-y-4 shadow-2xl">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            overallScore >= 90 ? "bg-green-400" :
            overallScore >= 70 ? "bg-yellow-400" :
            "bg-red-400"
          } animate-pulse`} />
          <h3 className="text-sm font-semibold text-white">System Performance</h3>
        </div>
        {isRecording && (
          <span className="text-xs bg-red-600 px-2 py-1 rounded-full animate-pulse">
            ⏺ REC
          </span>
        )}
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 
                      border border-indigo-500/30 rounded-xl p-4">
        <div className="text-xs text-zinc-400 mb-1">Overall Score</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-white">{overallScore}</span>
          <span className="text-sm text-zinc-400">/100</span>
        </div>
        <div className="mt-2 h-2 bg-black/50 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              overallScore >= 90 ? "bg-green-400" :
              overallScore >= 70 ? "bg-yellow-400" :
              "bg-red-400"
            }`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="space-y-3">
        <MetricRow
          label="Audio-Video Sync"
          value={`${syncOffset.toFixed(1)}ms`}
          target="<15ms"
          status={syncOffset < 15 ? "excellent" : syncOffset < 50 ? "good" : "poor"}
          badge={syncQuality}
        />

        <MetricRow
          label="Frame Rate"
          value={`${fps} FPS`}
          target="60 FPS"
          status={fps >= 58 ? "excellent" : fps >= 45 ? "good" : "poor"}
        />

        <MetricRow
          label="Network Latency"
          value={`${networkLatency}ms`}
          target="<100ms"
          status={networkLatency < 100 ? "excellent" : networkLatency < 200 ? "good" : "poor"}
        />

        <MetricRow
          label="Frame Drops"
          value={`${droppedFrames}`}
          target="0"
          status={droppedFrames === 0 ? "excellent" : droppedFrames < 10 ? "good" : "poor"}
        />
      </div>

      {/* Live Audience */}
      <div className="pt-3 border-t border-white/10">
        <div className="text-xs text-zinc-400 mb-2">Live Audience</div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-400 rounded-full" />
            <span className="text-sm text-white font-semibold">{participants}</span>
            <span className="text-xs text-zinc-400">participants</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-sm text-white font-semibold">{spectators}</span>
            <span className="text-xs text-zinc-400">spectators</span>
          </div>
        </div>
      </div>

      {/* Averages */}
      <div className="pt-3 border-t border-white/10 text-xs">
        <div className="flex justify-between text-zinc-400">
          <span>Avg Sync:</span>
          <span className="text-white font-mono">{avgSync.toFixed(1)}ms</span>
        </div>
        <div className="flex justify-between text-zinc-400 mt-1">
          <span>Avg Latency:</span>
          <span className="text-white font-mono">{avgLatency.toFixed(0)}ms</span>
        </div>
      </div>

      {/* Visual Graphs */}
      <div className="space-y-2">
        <MiniGraph 
          label="Sync History" 
          data={syncHistory} 
          threshold={15}
          color="rgb(99, 102, 241)"
        />
        <MiniGraph 
          label="Network Latency" 
          data={latencyHistory}
          threshold={100}
          color="rgb(52, 211, 153)"
        />
      </div>

      {/* Status Footer */}
      <div className="pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs">
          {overallScore >= 90 && (
            <>
              <span className="text-green-400">●</span>
              <span className="text-zinc-300">Broadcast Quality Achieved</span>
            </>
          )}
          {overallScore >= 70 && overallScore < 90 && (
            <>
              <span className="text-yellow-400">●</span>
              <span className="text-zinc-300">Good Performance</span>
            </>
          )}
          {overallScore < 70 && (
            <>
              <span className="text-red-400">●</span>
              <span className="text-zinc-300">Performance Issues Detected</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  target,
  status,
  badge,
}: {
  label: string;
  value: string;
  target: string;
  status: "excellent" | "good" | "poor";
  badge?: string;
}) {
  const colors = {
    excellent: "text-green-400",
    good: "text-yellow-400",
    poor: "text-red-400",
  };

  return (
    <div className="flex justify-between items-center">
      <div>
        <div className="text-sm text-zinc-300">{label}</div>
        <div className="text-[10px] text-zinc-500">Target: {target}</div>
      </div>
      <div className="text-right">
        <div className={`text-lg font-bold font-mono ${colors[status]}`}>
          {value}
        </div>
        {badge && (
          <div className={`text-[10px] px-2 py-0.5 rounded-full ${
            status === "excellent" ? "bg-green-400/20 text-green-400" :
            status === "good" ? "bg-yellow-400/20 text-yellow-400" :
            "bg-red-400/20 text-red-400"
          }`}>
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniGraph({
  label,
  data,
  threshold,
  color,
}: {
  label: string;
  data: number[];
  threshold: number;
  color: string;
}) {
  const maxValue = Math.max(...data, threshold * 2);

  return (
    <div>
      <div className="text-[10px] text-zinc-400 mb-1">{label}</div>
      <div className="h-12 bg-black/50 rounded-lg p-2 relative overflow-hidden">
        {/* Threshold line */}
        <div 
          className="absolute left-0 right-0 border-t border-dashed border-red-400/30"
          style={{ bottom: `${(threshold / maxValue) * 100}%` }}
        />
        
        {/* Graph */}
        <svg className="w-full h-full" preserveAspectRatio="none">
          <polyline
            points={data.map((value, i) => {
              const x = (i / (data.length - 1 || 1)) * 100;
              const y = 100 - (value / maxValue) * 100;
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}

function calculateOverallScore(
  syncOffset: number,
  fps: number,
  latency: number
): number {
  // Sync score (40 points)
  let syncScore = 0;
  if (syncOffset < 15) syncScore = 40;
  else if (syncOffset < 50) syncScore = 25;
  else syncScore = 10;

  // FPS score (30 points)
  let fpsScore = 0;
  if (fps >= 58) fpsScore = 30;
  else if (fps >= 45) fpsScore = 20;
  else fpsScore = 10;

  // Latency score (30 points)
  let latencyScore = 0;
  if (latency < 100) latencyScore = 30;
  else if (latency < 200) latencyScore = 20;
  else latencyScore = 10;

  return syncScore + fpsScore + latencyScore;
}
