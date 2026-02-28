"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ReactionPoint {
  bar: number;      // 0–N, which bar of the song
  emoji: string;
  intensity: number; // 1–5
  timestamp: number;
}

interface EmotionHeatmapProps {
  socket: any;
  roomId: string;
  isHost: boolean;
  bpm?: number;
  isPlaying?: boolean;
}

const EMOJI_WEIGHT: Record<string, number> = {
  "🔥": 5, "❤️": 4, "🎵": 3, "⚡": 4, "😴": 1,
};

const EMOJI_COLORS: Record<string, string> = {
  "🔥": "#f97316",
  "❤️": "#ec4899",
  "🎵": "#8b5cf6",
  "⚡": "#fbbf24",
  "😴": "#6b7280",
};

const TOTAL_BARS = 32;
const CANVAS_H = 100;

export default function EmotionHeatmap({
  socket,
  roomId,
  isHost,
  bpm = 90,
  isPlaying = false,
}: EmotionHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [heatData, setHeatData] = useState<number[]>(new Array(TOTAL_BARS).fill(0));
  const [emojiData, setEmojiData] = useState<Record<number, Record<string, number>>>(
    Object.fromEntries(Array.from({ length: TOTAL_BARS }, (_, i) => [i, {}]))
  );
  const [currentBar, setCurrentBar] = useState(0);
  const [peakBar, setPeakBar] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [totalReactions, setTotalReactions] = useState(0);
  const reactionPoints = useRef<ReactionPoint[]>([]);
  const startTimeRef = useRef<number>(0);

  // Track current bar based on playback time + BPM
  useEffect(() => {
    if (!isPlaying) return;
    startTimeRef.current = Date.now();

    const secondsPerBar = (4 * 60) / bpm; // 4 beats per bar
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const bar = Math.floor(elapsed / secondsPerBar) % TOTAL_BARS;
      setCurrentBar(bar);
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, bpm]);

  // Socket listener: when a reaction comes in, attach it to the current bar
  useEffect(() => {
    if (!socket) return;

    const handleReaction = (data: { emoji: string }) => {
      const bar = currentBar;
      const weight = EMOJI_WEIGHT[data.emoji] || 2;

      reactionPoints.current.push({
        bar,
        emoji: data.emoji,
        intensity: weight,
        timestamp: Date.now(),
      });

      setTotalReactions((t) => t + 1);

      setHeatData((prev) => {
        const next = [...prev];
        next[bar] = Math.min(100, next[bar] + weight * 3);
        return next;
      });

      setEmojiData((prev) => {
        const barData = { ...(prev[bar] || {}) };
        barData[data.emoji] = (barData[data.emoji] || 0) + 1;
        return { ...prev, [bar]: barData };
      });
    };

    socket.on("reaction_broadcast", handleReaction);
    socket.on("send_reaction", handleReaction);
    return () => {
      socket.off("reaction_broadcast", handleReaction);
      socket.off("send_reaction", handleReaction);
    };
  }, [socket, currentBar]);

  // Find peak bar
  useEffect(() => {
    const max = Math.max(...heatData);
    if (max > 0) {
      setPeakBar(heatData.indexOf(max));
    }
  }, [heatData]);

  // Draw canvas heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const barW = W / TOTAL_BARS;

    ctx.clearRect(0, 0, W, H);

    heatData.forEach((heat, i) => {
      const x = i * barW;
      const normalized = heat / 100;

      if (normalized === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(x + 1, 0, barW - 2, H);
        return;
      }

      // Color: cold (blue) → warm (orange) → hot (red)
      let r, g, b;
      if (normalized < 0.5) {
        const t = normalized * 2;
        r = Math.round(99 + t * (249 - 99));
        g = Math.round(102 + t * (115 - 102));
        b = Math.round(241 + t * (22 - 241));
      } else {
        const t = (normalized - 0.5) * 2;
        r = Math.round(249 + t * (239 - 249));
        g = Math.round(115 + t * (68 - 115));
        b = Math.round(22 + t * (22 - 22));
      }

      const barH = Math.max(4, normalized * H);

      // Glow
      ctx.shadowBlur = normalized * 20;
      ctx.shadowColor = `rgb(${r},${g},${b})`;

      // Bar from bottom
      const grad = ctx.createLinearGradient(x, H, x, H - barH);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.3)`);
      ctx.fillStyle = grad;

      const radius = Math.min(4, barW / 3);
      ctx.beginPath();
      ctx.roundRect(x + 1, H - barH, barW - 2, barH, [radius, radius, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Peak highlight
      if (i === peakBar) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x + 1, H - barH, barW - 2, barH);
        ctx.setLineDash([]);
      }
    });

    // Playhead
    if (isPlaying) {
      const px = currentBar * barW + barW / 2;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#fff";
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Hover tooltip bar
    if (hoveredBar !== null) {
      const x = hoveredBar * barW;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(x, 0, barW, H);
    }
  }, [heatData, currentBar, isPlaying, peakBar, hoveredBar]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bar = Math.floor((x / rect.width) * TOTAL_BARS);
    setHoveredBar(Math.max(0, Math.min(TOTAL_BARS - 1, bar)));
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredBar(null), []);

  const topEmojisForBar = hoveredBar !== null
    ? Object.entries(emojiData[hoveredBar] || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  const handleReset = () => {
    setHeatData(new Array(TOTAL_BARS).fill(0));
    setEmojiData(Object.fromEntries(Array.from({ length: TOTAL_BARS }, (_, i) => [i, {}])));
    reactionPoints.current = [];
    setTotalReactions(0);
    setPeakBar(null);
  };

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🌡️ Emotion Heatmap
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Where in the song the crowd reacted most · {totalReactions} reactions mapped
          </p>
        </div>
        <div className="flex items-center gap-3">
          {peakBar !== null && (
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 
                           px-3 py-1.5 rounded-lg text-xs">
              <span className="text-orange-400 font-semibold">🔥 Peak: Bar {peakBar + 1}</span>
            </div>
          )}
          {isHost && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Canvas heatmap */}
      <div className="px-6 pt-4 pb-2 relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={CANVAS_H}
          className="w-full rounded-lg cursor-crosshair"
          style={{ height: CANVAS_H }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Bar number labels */}
        <div className="flex justify-between mt-1 px-0.5">
          {[1, 5, 9, 13, 17, 21, 25, 29, 32].map((n) => (
            <span key={n} className="text-[9px] text-zinc-600 font-mono">
              {n}
            </span>
          ))}
        </div>

        {/* Hover tooltip */}
        {hoveredBar !== null && (
          <div
            className="absolute top-2 pointer-events-none bg-zinc-800 border border-white/10 
                       rounded-lg px-3 py-2 text-xs shadow-xl z-10 min-w-[100px]"
            style={{
              left: `${Math.min(85, (hoveredBar / TOTAL_BARS) * 100)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold text-white mb-1">Bar {hoveredBar + 1}</p>
            <p className="text-zinc-400">Heat: {heatData[hoveredBar].toFixed(0)}%</p>
            {topEmojisForBar.length > 0 && (
              <div className="flex gap-1 mt-1">
                {topEmojisForBar.map(([emoji, count]) => (
                  <span key={emoji} className="text-base" title={`${count}×`}>{emoji}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Heat legend + emoji breakdown */}
      <div className="px-6 pb-5">
        <div className="flex items-center justify-between mb-3">
          {/* Gradient legend */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">Cold</span>
            <div
              className="w-24 h-2 rounded-full"
              style={{
                background: "linear-gradient(to right, #6366f1, #f97316, #ef4444)",
              }}
            />
            <span className="text-[10px] text-zinc-500">Hot</span>
          </div>

          {/* BPM + playback info */}
          <div className="text-xs text-zinc-600 font-mono">
            {bpm} BPM · {isPlaying ? `Bar ${currentBar + 1}/32` : "Stopped"}
          </div>
        </div>

        {/* Top reacted bars */}
        {totalReactions > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {heatData
              .map((heat, i) => ({ heat, bar: i }))
              .sort((a, b) => b.heat - a.heat)
              .slice(0, 4)
              .map(({ heat, bar }) => {
                const barEmojis = Object.entries(emojiData[bar] || {})
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2);
                return (
                  <div
                    key={bar}
                    className="bg-black/30 rounded-lg p-2 border border-white/5 text-center"
                  >
                    <div className="text-sm font-bold text-orange-400">Bar {bar + 1}</div>
                    <div className="text-xs text-zinc-400">{heat.toFixed(0)}% heat</div>
                    <div className="text-base mt-1">
                      {barEmojis.map(([e]) => e).join("")}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
