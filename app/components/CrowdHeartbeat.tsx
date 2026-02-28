"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface TapData {
  userId: string;
  bpm: number;
  confidence: number; // 0–1, how consistent their tapping is
}

interface CrowdHeartbeatProps {
  socket: any;
  roomId: string;
  isHost: boolean;
  actualBpm?: number;
  myId: string;
}

const MAX_TAPS = 8;
const BPM_MIN = 40;
const BPM_MAX = 200;

function calcBpmFromTaps(taps: number[]): { bpm: number; confidence: number } {
  if (taps.length < 3) return { bpm: 0, confidence: 0 };
  const intervals = taps.slice(1).map((t, i) => t - taps[i]);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((s, i) => s + Math.pow(i - avg, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const bpm = Math.round(60000 / avg);
  const confidence = Math.max(0, 1 - stdDev / avg);
  return {
    bpm: Math.max(BPM_MIN, Math.min(BPM_MAX, bpm)),
    confidence: Math.round(confidence * 100) / 100,
  };
}

export default function CrowdHeartbeat({
  socket,
  roomId,
  isHost,
  actualBpm = 90,
  myId,
}: CrowdHeartbeatProps) {
  const [myTaps, setMyTaps] = useState<number[]>([]);
  const [myBpm, setMyBpm] = useState<number>(0);
  const [myConfidence, setMyConfidence] = useState(0);
  const [crowdBpm, setCrowdBpm] = useState<number>(0);
  const [crowdTappers, setCrowdTappers] = useState<TapData[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [drift, setDrift] = useState<number | null>(null);
  const [bpmHistory, setBpmHistory] = useState<number[]>([]);
  const [totalTappers, setTotalTappers] = useState(0);
  const tapperTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const myTapsRef = useRef<number[]>([]);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Flash animation on tap
  useEffect(() => {
    if (!isFlashing) return;
    const t = setTimeout(() => setIsFlashing(false), 120);
    return () => clearTimeout(t);
  }, [isFlashing]);

  // Recalculate BPM when my taps change
  useEffect(() => {
    if (myTaps.length < 3) return;
    const { bpm, confidence } = calcBpmFromTaps(myTaps);
    setMyBpm(bpm);
    setMyConfidence(confidence);
    socket.emit("heartbeat_tap", { roomId, bpm, confidence, userId: myId });
  }, [myTaps]);

  // Calculate drift vs actual BPM
  useEffect(() => {
    if (crowdBpm === 0) return;
    setDrift(crowdBpm - actualBpm);
    setBpmHistory((prev) => {
      const next = [...prev, crowdBpm];
      if (next.length > 30) next.shift();
      return next;
    });
  }, [crowdBpm, actualBpm]);

  // Socket: receive taps from other participants
  useEffect(() => {
    if (!socket) return;

    socket.on("heartbeat_update", (data: { tappers: TapData[]; crowdBpm: number; totalTappers: number }) => {
      setCrowdTappers(data.tappers);
      setCrowdBpm(data.crowdBpm);
      setTotalTappers(data.totalTappers);
    });

    return () => socket.off("heartbeat_update");
  }, [socket]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    setIsFlashing(true);
    setTapCount((c) => c + 1);

    const newTaps = [...myTapsRef.current, now].slice(-MAX_TAPS);
    myTapsRef.current = newTaps;
    setMyTaps(newTaps);

    // Reset taps if idle > 2s
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      myTapsRef.current = [];
      setMyTaps([]);
      setMyBpm(0);
      setMyConfidence(0);
    }, 2500);
  }, []);

  // Keyboard shortcut: spacebar
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleTap]);

  const getDriftColor = () => {
    if (drift === null) return "#6b7280";
    if (Math.abs(drift) <= 2) return "#22c55e";
    if (Math.abs(drift) <= 8) return "#f97316";
    return "#ef4444";
  };

  const getDriftLabel = () => {
    if (drift === null || crowdBpm === 0) return "—";
    if (Math.abs(drift) <= 2) return "In sync ✓";
    if (drift > 0) return `+${drift} BPM ahead`;
    return `${drift} BPM behind`;
  };

  // Mini sparkline for BPM history
  const sparkPoints = bpmHistory.map((bpm, i) => {
    const x = (i / Math.max(bpmHistory.length - 1, 1)) * 100;
    const y = 100 - ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            💓 Crowd Heartbeat
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tap the beat you feel · {totalTappers} tapping · crowd BPM averaged live
          </p>
        </div>
        <div className="text-xs text-zinc-500 text-right">
          <div className="font-mono">Actual: <span className="text-white font-bold">{actualBpm}</span> BPM</div>
          {isHost && crowdBpm > 0 && (
            <div className="mt-0.5 font-mono" style={{ color: getDriftColor() }}>
              {getDriftLabel()}
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Tap button */}
          <div className="flex flex-col items-center">
            {/* Big tap button */}
            <button
              onPointerDown={handleTap}
              className={`
                relative w-40 h-40 rounded-full select-none touch-none
                flex flex-col items-center justify-center
                transition-all duration-75 active:scale-90
                ${isFlashing
                  ? "bg-pink-500/30 border-4 border-pink-400 shadow-[0_0_40px_#ec4899]"
                  : "bg-zinc-800/80 border-4 border-zinc-600 hover:border-zinc-400"}
              `}
            >
              {myBpm > 0 ? (
                <>
                  <span className="text-4xl font-black font-mono text-white">
                    {myBpm}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono mt-1">BPM</span>
                  <div className="absolute bottom-3 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: i < Math.round(myConfidence * 5)
                            ? "#22c55e"
                            : "#374151",
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-4xl">💓</span>
                  <span className="text-xs text-zinc-500 mt-2">TAP</span>
                </>
              )}

              {/* Ripple on flash */}
              {isFlashing && (
                <div className="absolute inset-0 rounded-full border-2 border-pink-400 animate-ping opacity-50" />
              )}
            </button>

            <p className="text-xs text-zinc-600 mt-3 text-center">
              Tap or press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Space</kbd>
            </p>

            {myTaps.length < 3 && myTaps.length > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                Keep tapping… ({myTaps.length}/{MAX_TAPS})
              </p>
            )}
          </div>

          {/* Right: Crowd BPM display */}
          <div className="space-y-4">
            {/* Crowd BPM big display */}
            <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
              <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Crowd BPM</p>
              <div
                className="text-5xl font-black font-mono transition-all duration-300"
                style={{ color: getDriftColor() }}
              >
                {crowdBpm || "—"}
              </div>
              {drift !== null && crowdBpm > 0 && (
                <div
                  className="mt-2 text-sm font-semibold"
                  style={{ color: getDriftColor() }}
                >
                  {getDriftLabel()}
                </div>
              )}
              <p className="text-xs text-zinc-600 mt-2">
                {totalTappers} participant{totalTappers !== 1 ? "s" : ""} tapping
              </p>
            </div>

            {/* BPM Sparkline */}
            {bpmHistory.length > 2 && (
              <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
                  Crowd BPM History
                </p>
                <svg
                  viewBox="0 0 100 40"
                  className="w-full"
                  preserveAspectRatio="none"
                  height={40}
                >
                  {/* Actual BPM reference line */}
                  <line
                    x1="0"
                    x2="100"
                    y1={100 - ((actualBpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100}
                    y2={100 - ((actualBpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Crowd BPM line */}
                  <polyline
                    points={sparkPoints}
                    fill="none"
                    stroke={getDriftColor()}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="flex justify-between text-[9px] text-zinc-700 mt-1 font-mono">
                  <span>BPM {Math.min(...bpmHistory)}</span>
                  <span>— Actual: {actualBpm}</span>
                  <span>BPM {Math.max(...bpmHistory)}</span>
                </div>
              </div>
            )}

            {/* Individual tappers */}
            {crowdTappers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">Tappers</p>
                {crowdTappers.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-pink-400" />
                    <span className="text-zinc-400 font-mono flex-1">{t.bpm} BPM</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div
                          key={j}
                          className="w-1 h-2 rounded-sm"
                          style={{
                            background: j < Math.round(t.confidence * 5)
                              ? "#22c55e"
                              : "#374151",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
