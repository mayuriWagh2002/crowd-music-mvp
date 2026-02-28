"use client";

import { useEffect, useState, useRef } from "react";

interface VibeScore {
  score: number;
  mood: string;
  color: string;
}

interface MoodRingProps {
  socket: any;
  roomId: string;
  initialVibe?: VibeScore;
}

const MOOD_CONFIG = {
  LIT: {
    label: "LIT 🔥",
    bg: "from-orange-900/40 to-red-900/40",
    border: "border-orange-500/50",
    glow: "shadow-orange-500/30",
    pulse: "bg-orange-500",
    desc: "Crowd is absolutely on fire",
  },
  VIBING: {
    label: "VIBING 🎵",
    bg: "from-purple-900/40 to-indigo-900/40",
    border: "border-purple-500/50",
    glow: "shadow-purple-500/30",
    pulse: "bg-purple-500",
    desc: "Energy is strong and steady",
  },
  NEUTRAL: {
    label: "NEUTRAL 😐",
    bg: "from-zinc-900/40 to-zinc-800/40",
    border: "border-zinc-600/50",
    glow: "shadow-zinc-500/20",
    pulse: "bg-zinc-500",
    desc: "Crowd is present but waiting",
  },
  DEAD: {
    label: "DEAD 😴",
    bg: "from-slate-900/40 to-gray-900/40",
    border: "border-slate-600/30",
    glow: "shadow-slate-500/10",
    pulse: "bg-slate-600",
    desc: "Consider switching things up",
  },
};

export default function MoodRing({ socket, roomId, initialVibe }: MoodRingProps) {
  const [vibe, setVibe] = useState<VibeScore>(
    initialVibe || { score: 50, mood: "NEUTRAL", color: "#6366f1" }
  );
  const [prevScore, setPrevScore] = useState(50);
  const [trend, setTrend] = useState<"up" | "down" | "stable">("stable");
  const [scoreHistory, setScoreHistory] = useState<number[]>([50]);
  const [burst, setBurst] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on("mood_ring_update", (newVibe: VibeScore) => {
      setVibe((prev) => {
        const delta = newVibe.score - prev.score;
        setTrend(delta > 3 ? "up" : delta < -3 ? "down" : "stable");
        setPrevScore(prev.score);
        return newVibe;
      });

      setScoreHistory((prev) => {
        const updated = [...prev, newVibe.score];
        return updated.slice(-30);
      });

      // Burst effect when crossing into LIT
      if (newVibe.mood === "LIT") {
        setBurst(true);
        setTimeout(() => setBurst(false), 600);
      }
    });

    return () => socket.off("mood_ring_update");
  }, [socket]);

  // Draw sparkline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (scoreHistory.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = vibe.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    scoreHistory.forEach((score, i) => {
      const x = (i / (scoreHistory.length - 1)) * w;
      const y = h - (score / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Fill below
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = `${vibe.color}22`;
    ctx.fill();
  }, [scoreHistory, vibe.color]);

  const config = MOOD_CONFIG[vibe.mood as keyof typeof MOOD_CONFIG] || MOOD_CONFIG.NEUTRAL;

  return (
    <div
      className={`
        relative bg-gradient-to-br ${config.bg} backdrop-blur-xl 
        border ${config.border} rounded-2xl p-5 overflow-hidden
        shadow-xl ${config.glow}
        transition-all duration-700
        ${burst ? "scale-105" : "scale-100"}
      `}
    >
      {/* Burst effect */}
      {burst && (
        <div className="absolute inset-0 bg-orange-500/10 animate-ping rounded-2xl pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${config.pulse} animate-pulse`}
            />
            🎭 Mood Ring
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">{config.desc}</p>
        </div>

        {/* Trend arrow */}
        <div className="text-right">
          <div className={`text-2xl font-black ${
            trend === "up" ? "text-green-400" :
            trend === "down" ? "text-red-400" :
            "text-zinc-400"
          }`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </div>
        </div>
      </div>

      {/* Big mood label */}
      <div className="text-center mb-4">
        <div
          className="text-3xl font-black tracking-widest uppercase"
          style={{ color: vibe.color, textShadow: `0 0 20px ${vibe.color}66` }}
        >
          {config.label}
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Dead</span>
          <span className="font-mono font-semibold" style={{ color: vibe.color }}>
            {vibe.score}/100
          </span>
          <span>Lit</span>
        </div>
        <div className="h-3 bg-black/50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${vibe.score}%`,
              background: `linear-gradient(to right, #6366f1, ${vibe.color})`,
              boxShadow: `0 0 8px ${vibe.color}88`,
            }}
          />
        </div>
      </div>

      {/* Sparkline */}
      <div className="bg-black/30 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={300}
          height={48}
          className="w-full"
          style={{ imageRendering: "crisp-edges" }}
        />
        <div className="flex justify-between text-[10px] text-zinc-600 px-2 pb-1">
          <span>30s ago</span>
          <span>Now</span>
        </div>
      </div>

      {/* Breakdown hint */}
      <div className="mt-3 grid grid-cols-3 gap-1 text-center">
        {[
          { emoji: "🔥", label: "Energy" },
          { emoji: "❤️", label: "Love" },
          { emoji: "😴", label: "Boredom" },
        ].map(({ emoji, label }) => (
          <div key={emoji} className="bg-black/20 rounded-lg py-1.5">
            <div className="text-lg leading-none">{emoji}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
