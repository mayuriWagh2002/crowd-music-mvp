"use client";

import { useEffect, useState, useRef } from "react";

type EventType =
  | "reaction"
  | "lyric_submitted"
  | "poll_started"
  | "poll_ended"
  | "beat_change"
  | "battle_started"
  | "battle_winner"
  | "roulette_spin"
  | "participant_joined"
  | "vibe_peak";

interface TimelineEvent {
  id: string;
  type: EventType;
  label: string;
  detail?: string;
  timestamp: number;
  color: string;
  icon: string;
  height: number; // 1–4, visual "intensity"
}

interface SessionTimelineProps {
  socket: any;
  roomId: string;
  sessionStartTime: number;
}

const EVENT_CONFIG: Record<EventType, { color: string; icon: string; baseHeight: number }> = {
  reaction:           { color: "#f97316", icon: "🔥", baseHeight: 2 },
  lyric_submitted:    { color: "#8b5cf6", icon: "✍️", baseHeight: 2 },
  poll_started:       { color: "#06b6d4", icon: "📊", baseHeight: 3 },
  poll_ended:         { color: "#22c55e", icon: "✅", baseHeight: 2 },
  beat_change:        { color: "#eab308", icon: "🎵", baseHeight: 4 },
  battle_started:     { color: "#ef4444", icon: "⚔️", baseHeight: 3 },
  battle_winner:      { color: "#fbbf24", icon: "👑", baseHeight: 4 },
  roulette_spin:      { color: "#a855f7", icon: "🎲", baseHeight: 3 },
  participant_joined: { color: "#6366f1", icon: "👤", baseHeight: 1 },
  vibe_peak:          { color: "#ec4899", icon: "🚀", baseHeight: 4 },
};

function makeEvent(type: EventType, label: string, detail?: string): TimelineEvent {
  const cfg = EVENT_CONFIG[type];
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    label,
    detail,
    timestamp: Date.now(),
    color: cfg.color,
    icon: cfg.icon,
    height: cfg.baseHeight + Math.floor(Math.random() * 1.5),
  };
}

// Demo seed events so timeline isn't empty on first load
const SEED_EVENTS: TimelineEvent[] = [
  { id: "s1", type: "participant_joined", label: "Session started", timestamp: Date.now() - 120000, color: "#6366f1", icon: "👤", height: 1 },
  { id: "s2", type: "lyric_submitted",    label: "First lyric",    timestamp: Date.now() - 95000,  color: "#8b5cf6", icon: "✍️", height: 2 },
  { id: "s3", type: "reaction",           label: "🔥 × 5",         timestamp: Date.now() - 80000,  color: "#f97316", icon: "🔥", height: 3 },
  { id: "s4", type: "poll_started",       label: "Tempo poll",     timestamp: Date.now() - 60000,  color: "#06b6d4", icon: "📊", height: 3 },
  { id: "s5", type: "poll_ended",         label: "Faster wins",    timestamp: Date.now() - 52000,  color: "#22c55e", icon: "✅", height: 2 },
  { id: "s6", type: "beat_change",        label: "New theme",      timestamp: Date.now() - 40000,  color: "#eab308", icon: "🎵", height: 4 },
  { id: "s7", type: "battle_started",     label: "Battle!",        timestamp: Date.now() - 25000,  color: "#ef4444", icon: "⚔️", height: 3 },
  { id: "s8", type: "battle_winner",      label: "Line crowned",   timestamp: Date.now() - 15000,  color: "#fbbf24", icon: "👑", height: 5 },
];

const BAR_WIDTH = 14;
const BAR_GAP = 5;
const CANVAS_H = 80;
const UNIT = BAR_WIDTH + BAR_GAP;

export default function SessionTimeline({ socket, roomId, sessionStartTime }: SessionTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(SEED_EVENTS);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const addEvent = (event: TimelineEvent) => {
    setEvents((prev) => [...prev, event]);
    // Auto-scroll to end
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    }, 50);
  };

  // Listen to all socket events and convert them to timeline entries
  useEffect(() => {
    if (!socket) return;

    socket.on("reaction_broadcast", (data: { emoji: string }) => {
      addEvent(makeEvent("reaction", `${data.emoji} reaction`));
    });

    socket.on("crowd_suggestion_received", () => {
      addEvent(makeEvent("lyric_submitted", "Lyric suggested"));
    });

    socket.on("room_state", (data: any) => {
      if (data.currentQuestion && !data.aiInsight) {
        addEvent(makeEvent("poll_started", data.currentQuestion.label || "Poll opened"));
      }
      if (data.aiInsight && data.aiInsight.includes("prefer")) {
        addEvent(makeEvent("poll_ended", "Poll concluded", data.aiInsight));
      }
    });

    socket.on("theme_changed", (data: { theme: string }) => {
      addEvent(makeEvent("beat_change", `Theme: ${data.theme}`));
    });

    socket.on("battle_started", () => {
      addEvent(makeEvent("battle_started", "Battle began!"));
    });

    socket.on("battle_ended", (data: any) => {
      const winner = data.winner === "A" ? data.battle?.entryA : data.battle?.entryB;
      addEvent(makeEvent("battle_winner", "Battle won", winner?.text));
    });

    socket.on("beat_roulette_result", (data: { theme: string }) => {
      addEvent(makeEvent("roulette_spin", `Roulette: ${data.theme}`));
    });

    socket.on("mood_ring_update", (data: { mood: string; score: number }) => {
      if (data.score > 80) {
        addEvent(makeEvent("vibe_peak", `PEAK VIBE: ${data.mood}`, `Score ${data.score}/100`));
      }
    });

    return () => {
      socket.off("reaction_broadcast");
      socket.off("crowd_suggestion_received");
      socket.off("room_state");
      socket.off("theme_changed");
      socket.off("battle_started");
      socket.off("battle_ended");
      socket.off("beat_roulette_result");
      socket.off("mood_ring_update");
    };
  }, [socket]);

  // Draw canvas waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalWidth = events.length * UNIT + 40;
    canvas.width = totalWidth;
    canvas.height = CANVAS_H;

    ctx.clearRect(0, 0, totalWidth, CANVAS_H);

    events.forEach((event, i) => {
      const x = i * UNIT + 20;
      const barH = event.height * 12;
      const y = CANVAS_H / 2 - barH / 2;

      // Glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = event.color;

      // Bar
      ctx.fillStyle = event.color + "cc";
      const radius = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barH, radius);
      ctx.fill();

      // Mirror bar (below center)
      ctx.fillStyle = event.color + "44";
      ctx.beginPath();
      ctx.roundRect(x, CANVAS_H / 2 + 2, BAR_WIDTH, barH * 0.4, radius);
      ctx.fill();

      ctx.shadowBlur = 0;
    });
  }, [events]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            📼 Session Timeline
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {events.length} events · running {formatTime(elapsed)}
          </p>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3">
          {(["reaction", "lyric_submitted", "beat_change", "battle_winner"] as EventType[]).map((type) => {
            const cfg = EVENT_CONFIG[type];
            return (
              <div key={type} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                <span className="text-zinc-500 capitalize">{type.replace("_", " ")}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Waveform scroll area */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-thin scrollbar-track-transparent 
                   scrollbar-thumb-zinc-700 hover:scrollbar-thumb-zinc-500"
        style={{ scrollBehavior: "smooth" }}
      >
        <div
          className="relative px-4 py-3"
          style={{ minWidth: `${events.length * UNIT + 60}px` }}
        >
          {/* Canvas waveform */}
          <canvas
            ref={canvasRef}
            height={CANVAS_H}
            className="w-full"
            style={{ imageRendering: "crisp-edges" }}
          />

          {/* Invisible hit targets for hover */}
          <div className="absolute inset-0 flex items-center px-4">
            {events.map((event, i) => (
              <div
                key={event.id}
                className="relative flex-shrink-0"
                style={{ width: UNIT, paddingRight: BAR_GAP }}
                onMouseEnter={() => setHoveredEvent(event)}
                onMouseLeave={() => setHoveredEvent(null)}
              >
                <div className="h-full w-full cursor-pointer" />

                {/* Tooltip */}
                {hoveredEvent?.id === event.id && (
                  <div
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20
                               bg-zinc-800 border border-white/10 rounded-lg px-3 py-2
                               text-xs whitespace-nowrap shadow-xl pointer-events-none"
                  >
                    <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                      <span>{event.icon}</span>
                      <span style={{ color: event.color }}>{event.label}</span>
                    </div>
                    {event.detail && (
                      <p className="text-zinc-400 max-w-[160px] whitespace-normal truncate">
                        {event.detail}
                      </p>
                    )}
                    <p className="text-zinc-600 mt-1">{getRelativeTime(event.timestamp)}</p>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* NOW marker */}
          <div
            className="absolute right-4 top-0 bottom-0 w-px bg-white/20 pointer-events-none"
            style={{ boxShadow: "0 0 8px rgba(255,255,255,0.3)" }}
          />
          <div className="absolute right-2 top-2 text-[10px] text-white/30 font-mono">
            NOW
          </div>
        </div>
      </div>

      {/* Event type breakdown */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][])
            .filter(([type]) => events.some((e) => e.type === type))
            .slice(0, 4)
            .map(([type, cfg]) => {
              const count = events.filter((e) => e.type === type).length;
              return (
                <div
                  key={type}
                  className="bg-black/30 rounded-xl p-3 border border-white/5 text-center"
                >
                  <div className="text-xl mb-1">{cfg.icon}</div>
                  <div className="text-lg font-black" style={{ color: cfg.color }}>{count}</div>
                  <div className="text-[10px] text-zinc-600 capitalize">
                    {type.replace(/_/g, " ")}
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
