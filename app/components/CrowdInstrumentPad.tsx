"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface PadHit {
  padId: string;
  userId: string;
  userName: string;
  timestamp: number;
}

interface PadActivity {
  id: string;
  hits: number;
  active: boolean;
  lastHit: number;
}

interface CrowdInstrumentPadProps {
  socket: any;
  roomId: string;
  isHost: boolean;
  myName?: string;
}

const PADS = [
  { id: "kick",    label: "KICK",    emoji: "🥁", color: "#ef4444", key: "Q" },
  { id: "snare",   label: "SNARE",   emoji: "💥", color: "#f97316", key: "W" },
  { id: "hihat",   label: "HI-HAT",  emoji: "🔔", color: "#eab308", key: "E" },
  { id: "clap",    label: "CLAP",    emoji: "👏", color: "#22c55e", key: "R" },
  { id: "bass",    label: "808",     emoji: "🔊", color: "#3b82f6", key: "A" },
  { id: "synth",   label: "SYNTH",   emoji: "🎹", color: "#8b5cf6", key: "S" },
  { id: "perc",    label: "PERC",    emoji: "🪘", color: "#ec4899", key: "D" },
  { id: "vocal",   label: "VOCAL",   emoji: "🎤", color: "#06b6d4", key: "F" },
];

const MAX_RECENT = 6;

export default function CrowdInstrumentPad({
  socket,
  roomId,
  isHost,
  myName = "Participant",
}: CrowdInstrumentPadProps) {
  const [activity, setActivity] = useState<Record<string, PadActivity>>(
    Object.fromEntries(PADS.map((p) => [p.id, { id: p.id, hits: 0, active: false, lastHit: 0 }]))
  );
  const [recentHits, setRecentHits] = useState<Array<{ padId: string; name: string; id: number }>>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [myCooldowns, setMyCooldowns] = useState<Record<string, boolean>>({});
  const [hotPad, setHotPad] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const pressedRef = useRef<Record<string, boolean>>({});

  // Decay activity over time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActivity((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((id) => {
          if (updated[id].active && now - updated[id].lastHit > 300) {
            updated[id] = { ...updated[id], active: false };
          }
        });
        return updated;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Find hot pad (most hits in last few seconds)
  useEffect(() => {
    const maxHits = Math.max(...Object.values(activity).map((a) => a.hits));
    if (maxHits === 0) { setHotPad(null); return; }
    const hot = Object.values(activity).find((a) => a.hits === maxHits);
    setHotPad(hot?.id || null);
  }, [activity]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("pad_hit", (data: PadHit) => {
      setTotalHits((t) => t + 1);

      setActivity((prev) => {
        const pad = prev[data.padId];
        if (!pad) return prev;
        return {
          ...prev,
          [data.padId]: {
            ...pad,
            hits: pad.hits + 1,
            active: true,
            lastHit: Date.now(),
          },
        };
      });

      const hitId = Date.now() + Math.random();
      setRecentHits((prev) => [
        { padId: data.padId, name: data.userName, id: hitId },
        ...prev.slice(0, MAX_RECENT - 1),
      ]);
    });

    socket.on("pad_reset", () => {
      setActivity(
        Object.fromEntries(PADS.map((p) => [p.id, { id: p.id, hits: 0, active: false, lastHit: 0 }]))
      );
      setTotalHits(0);
      setRecentHits([]);
    });

    return () => {
      socket.off("pad_hit");
      socket.off("pad_reset");
    };
  }, [socket]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !enabled) return;
      const key = e.key.toUpperCase();
      const pad = PADS.find((p) => p.key === key);
      if (pad && !pressedRef.current[pad.id]) {
        pressedRef.current[pad.id] = true;
        hitPad(pad.id);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const pad = PADS.find((p) => p.key === key);
      if (pad) pressedRef.current[pad.id] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled]);

  const hitPad = useCallback((padId: string) => {
    if (myCooldowns[padId] || !enabled) return;

    // Optimistic UI
    setActivity((prev) => ({
      ...prev,
      [padId]: { ...prev[padId], active: true, lastHit: Date.now() },
    }));

    socket.emit("pad_hit", {
      roomId,
      padId,
      userName: myName,
      timestamp: Date.now(),
    });

    // 150ms cooldown per pad
    setMyCooldowns((prev) => ({ ...prev, [padId]: true }));
    setTimeout(() => {
      setMyCooldowns((prev) => ({ ...prev, [padId]: false }));
    }, 150);
  }, [myCooldowns, enabled, socket, roomId, myName]);

  const mostHitPad = PADS.find((p) => p.id === hotPad);

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              🪘 Crowd Instrument Pad
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Everyone plays together • {totalHits} total hits
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hotPad && mostHitPad && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: `${mostHitPad.color}22`, color: mostHitPad.color, border: `1px solid ${mostHitPad.color}44` }}
              >
                <span>{mostHitPad.emoji}</span>
                <span>🔥 HOT</span>
              </div>
            )}
            {isHost && (
              <button
                onClick={() => socket.emit("pad_reset", { roomId })}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pad Grid */}
      <div className="p-6">
        <div className="grid grid-cols-4 gap-3 mb-4">
          {PADS.map((pad) => {
            const state = activity[pad.id];
            const isActive = state?.active;
            const isCooling = myCooldowns[pad.id];
            const hitCount = state?.hits || 0;

            return (
              <button
                key={pad.id}
                onPointerDown={() => hitPad(pad.id)}
                disabled={!enabled}
                className={`
                  relative aspect-square rounded-xl flex flex-col items-center justify-center
                  select-none touch-none transition-all duration-75 border-2
                  ${isActive
                    ? "scale-95 brightness-150"
                    : "scale-100 hover:scale-[1.03] active:scale-95"
                  }
                  ${isCooling ? "cursor-not-allowed" : "cursor-pointer"}
                `}
                style={{
                  background: isActive
                    ? `${pad.color}33`
                    : `${pad.color}0d`,
                  borderColor: isActive ? pad.color : `${pad.color}44`,
                  boxShadow: isActive ? `0 0 20px ${pad.color}66` : "none",
                }}
              >
                {/* Hit count badge */}
                {hitCount > 0 && (
                  <div
                    className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1 rounded"
                    style={{ color: pad.color, background: `${pad.color}22` }}
                  >
                    {hitCount}
                  </div>
                )}

                {/* Key hint */}
                <div
                  className="absolute bottom-1.5 left-1.5 text-[9px] font-mono opacity-40"
                  style={{ color: pad.color }}
                >
                  {pad.key}
                </div>

                <span className="text-2xl mb-1 leading-none">{pad.emoji}</span>
                <span
                  className="text-[10px] font-bold tracking-widest"
                  style={{ color: pad.color }}
                >
                  {pad.label}
                </span>

                {/* Active pulse ring */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-xl animate-ping opacity-30"
                    style={{ border: `2px solid ${pad.color}` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-zinc-500">
            🎹 Keyboard shortcuts: Q W E R (top row) · A S D F (bottom row)
          </p>
          <button
            onClick={() => setEnabled((e) => !e)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              enabled ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700"
            }`}
          >
            {enabled ? "● Active" : "○ Paused"}
          </button>
        </div>

        {/* Activity feed */}
        {recentHits.length > 0 && (
          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Live Activity</p>
            <div className="space-y-1">
              {recentHits.map((hit) => {
                const pad = PADS.find((p) => p.id === hit.padId);
                return (
                  <div key={hit.id} className="flex items-center gap-2 text-xs">
                    <span>{pad?.emoji}</span>
                    <span className="text-zinc-400">{hit.name}</span>
                    <span style={{ color: pad?.color }} className="font-semibold">
                      hit {pad?.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Beat visualization — horizontal bars showing relative pad popularity */}
        <div className="mt-4 space-y-1.5">
          {PADS.map((pad) => {
            const hits = activity[pad.id]?.hits || 0;
            const maxHits = Math.max(...Object.values(activity).map((a) => a.hits), 1);
            const pct = (hits / maxHits) * 100;

            return (
              <div key={pad.id} className="flex items-center gap-2">
                <span className="text-xs w-14 text-right" style={{ color: pad.color }}>
                  {pad.label}
                </span>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: pad.color }}
                  />
                </div>
                <span className="text-[10px] text-zinc-600 w-6 text-right font-mono">
                  {hits}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
