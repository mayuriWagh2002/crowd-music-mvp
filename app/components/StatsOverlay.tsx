"use client";

interface StatsOverlayProps {
  syncOffset: number;
  fps: number;
  networkLatency: number;
  participants: number;
  spectators: number;
}

export default function StatsOverlay({
  syncOffset,
  fps,
  networkLatency,
  participants,
  spectators,
}: StatsOverlayProps) {
  return (
    <div className="fixed top-4 left-4 bg-black/80 backdrop-blur-sm 
                    border border-white/20 rounded-xl p-4 space-y-3 min-w-[200px]">
      <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2">
        🎯 System Performance
      </div>

      <StatRow
        label="Audio-Video Sync"
        value={`${syncOffset.toFixed(1)}ms`}
        status={syncOffset < 15 ? "excellent" : syncOffset < 50 ? "good" : "poor"}
      />

      <StatRow
        label="Frame Rate"
        value={`${fps} FPS`}
        status={fps >= 58 ? "excellent" : fps >= 45 ? "good" : "poor"}
      />

      <StatRow
        label="Network Latency"
        value={`${networkLatency}ms`}
        status={networkLatency < 100 ? "excellent" : networkLatency < 200 ? "good" : "poor"}
      />

      <div className="pt-2 border-t border-white/10">
        <StatRow
          label="Live Audience"
          value={`${participants + spectators}`}
          status="neutral"
        />
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "excellent" | "good" | "poor" | "neutral";
}) {
  const colors = {
    excellent: "text-green-400",
    good: "text-yellow-400",
    poor: "text-red-400",
    neutral: "text-zinc-300",
  };

  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className={`font-mono font-semibold ${colors[status]}`}>
        {value}
      </span>
    </div>
  );
}