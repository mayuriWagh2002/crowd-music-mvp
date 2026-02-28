"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "star" | "ring";
}

interface HypeMeterProps {
  socket: any;
  roomId: string;
  currentLyric?: string;
  currentTheme?: string;
  vibeScore?: { score: number; mood: string; color: string };
}

const COLORS = [
  "#f97316", "#ef4444", "#fbbf24", "#8b5cf6",
  "#ec4899", "#06b6d4", "#22c55e", "#ffffff",
];

const HYPE_THRESHOLD = 80;

function spawnParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 3 + Math.random() * 8;
    const life = 60 + Math.random() * 80;
    return {
      id: i + Math.random() * 10000,
      x: 50,
      y: 50,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 8,
      life,
      maxLife: life,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      shape: (["circle", "star", "ring"] as const)[Math.floor(Math.random() * 3)],
    };
  });
}

export default function HypeMeter({
  socket,
  roomId,
  currentLyric,
  currentTheme = "lofi heartbreak",
  vibeScore,
}: HypeMeterProps) {
  const [active, setActive] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [hypeCount, setHypeCount] = useState(0); // Times hype triggered this session
  const [displayLyric, setDisplayLyric] = useState<string | null>(null);
  const [displayMood, setDisplayMood] = useState<string>("LIT 🔥");
  const [displayColor, setDisplayColor] = useState("#f97316");
  const [pulse, setPulse] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  const triggerHype = useCallback((lyric?: string, mood?: string, color?: string) => {
    setActive(true);
    setHypeCount((c) => c + 1);
    setDisplayLyric(lyric || currentLyric || null);
    setDisplayMood(mood || "LIT 🔥");
    setDisplayColor(color || "#f97316");
    setPulse(true);

    const burst = spawnParticles(80);
    particlesRef.current = burst;
    setParticles(burst);

    // Auto-dismiss after 6s
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setActive(false);
      setPulse(false);
    }, 6000);
  }, [currentLyric]);

  // Particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15, // gravity
          vx: p.vx * 0.98,
          life: p.life - 1,
          rotation: p.rotation + p.rotationSpeed,
        }))
        .filter((p) => p.life > 0);

      particlesRef.current.forEach((p) => {
        const alpha = p.life / p.maxLife;
        const px = (p.x / 100) * w;
        const py = (p.y / 100) * h;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(px, py);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.shape === "ring") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Star
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 4) / 5 - Math.PI / 2;
            const r = i % 2 === 0 ? p.size : p.size * 0.4;
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          ctx.fillStyle = p.color;
          ctx.fill();
        }

        ctx.restore();
      });

      if (particlesRef.current.length > 0) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [active, particles]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("mood_ring_update", (data: { score: number; mood: string; color: string }) => {
      if (data.score >= HYPE_THRESHOLD) {
        triggerHype(undefined, data.mood, data.color);
      }
    });

    socket.on("battle_winner", (data: any) => {
      const winner = data.winner === "A" ? data.battle?.entryA : data.battle?.entryB;
      if (winner?.text) {
        triggerHype(winner.text, "BATTLE WON 👑", "#fbbf24");
      }
    });

    return () => {
      socket.off("mood_ring_update");
      socket.off("battle_winner");
    };
  }, [socket, triggerHype]);

  // Watch vibeScore prop changes
  useEffect(() => {
    if (vibeScore && vibeScore.score >= HYPE_THRESHOLD) {
      triggerHype(currentLyric, vibeScore.mood, vibeScore.color);
    }
  }, [vibeScore?.score]);

  if (!active) {
    return (
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              🚀 Hype Meter
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Fires when crowd energy peaks · {hypeCount > 0 ? `${hypeCount}× triggered` : "Waiting for peak energy…"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Current vibe score mini */}
            {vibeScore && (
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${vibeScore.score}%`, background: vibeScore.color }}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-400">{vibeScore.score}/100</span>
              </div>
            )}

            {/* Manual trigger for testing */}
            <button
              onClick={() => triggerHype(currentLyric, "MANUAL HYPE 🔥", "#f97316")}
              className="px-3 py-1.5 bg-orange-600/20 border border-orange-500/30 
                         text-orange-400 hover:bg-orange-600/30 rounded-lg text-xs transition"
            >
              Test 🎆
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
          <span>Threshold: vibe score ≥ {HYPE_THRESHOLD} or battle winner crowned</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      onClick={() => { setActive(false); setPulse(false); }}
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${displayColor}22 0%, #000000ee 60%)`,
      }}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
        width={window?.innerWidth || 1200}
        height={window?.innerHeight || 800}
      />

      {/* Background pulse rings */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border pointer-events-none animate-ping"
          style={{
            width: `${i * 200}px`,
            height: `${i * 200}px`,
            borderColor: `${displayColor}${Math.floor(50 / i).toString(16).padStart(2, "0")}`,
            animationDuration: `${1 + i * 0.4}s`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 text-center px-8 max-w-3xl pointer-events-none">
        {/* Mood label */}
        <div
          className="text-6xl font-black tracking-tight mb-4 animate-bounce"
          style={{
            color: displayColor,
            textShadow: `0 0 40px ${displayColor}88, 0 0 80px ${displayColor}44`,
          }}
        >
          {displayMood}
        </div>

        {/* Lyric */}
        {displayLyric && (
          <div
            className="text-2xl md:text-4xl font-bold text-white leading-tight mb-6"
            style={{
              textShadow: "0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.1)",
            }}
          >
            "{displayLyric}"
          </div>
        )}

        {/* Theme */}
        <p
          className="text-sm uppercase tracking-[0.3em] opacity-60"
          style={{ color: displayColor }}
        >
          {currentTheme}
        </p>

        {/* Dismiss hint */}
        <p className="text-xs text-white/20 mt-8">
          tap anywhere to dismiss
        </p>
      </div>

      {/* Corner decorations */}
      {["top-4 left-4", "top-4 right-4", "bottom-4 left-4", "bottom-4 right-4"].map((pos) => (
        <div
          key={pos}
          className={`absolute ${pos} text-3xl animate-spin`}
          style={{ animationDuration: "3s" }}
        >
          ✦
        </div>
      ))}
    </div>
  );
}
