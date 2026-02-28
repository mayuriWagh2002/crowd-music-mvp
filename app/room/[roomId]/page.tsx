"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";

import { startRoomBeat, stopRoomBeat } from "@/app/lib/musicEngine";
import LyricCanvas from "@/app/components/LyricCanvas";
import VoiceRecorder from "@/app/components/VoiceRecorder";
import Visualizer from "@/app/components/Visualizer";
import VideoGrid from "@/app/components/VideoGrid";
import ProducerMixConsole from "@/app/components/ProducerMixConsole";
import AICopilotPanel from "@/app/components/AICopilotPanel";
import CrowdFeedbackDashboard from "@/app/components/CrowdFeedbackDashboard";
import MoodRing from "@/app/components/MoodRing";
import Leaderboard from "@/app/components/Leaderboard";
import ParticipantPanel from "@/app/components/ParticipantPanel";
import AILyricBattlePanel from "@/app/components/AILyricBattlePanel";
import CrowdInstrumentPad from "@/app/components/CrowdInstrumentPad";
import HypeMeter from "@/app/components/HypeMeter";
import SyncDashboard from "@/app/components/SyncDashboard";

interface RoomState {
  participants: Array<{ id: string; name: string }>;
  spectatorCount: number;
  hostId: string | null;
  theme: string;
  currentQuestion: any;
  questionVotes: Record<string, number>;
  aiInsight: string | null;
  demoMode: boolean;
  vibeScore: { score: number; mood: string; color: string };
  submissions: Array<{ id: string; text: string; author: string; votes: number }>;
  song: Array<{ text: string; author: string; section: string }>;
}

// ── Crowd lyric suggestions → shown only to producer ─────────────────────────
function LyricSuggestionsInbox({ socket }: { socket: any }) {
  const [suggestions, setSuggestions] = useState<
    Array<{ userName: string; suggestion: string }>
  >([]);

  useEffect(() => {
    const handler = (data: any) =>
      setSuggestions((p) => [data, ...p].slice(0, 20));
    socket.on("crowd_suggestion_received", handler);
    return () => socket.off("crowd_suggestion_received", handler);
  }, [socket]);

  if (!suggestions.length) return null;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3 font-semibold">
        💡 Crowd Lyric Suggestions ({suggestions.length})
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-3 bg-black/30 border border-white/5 rounded-xl px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 truncate">"{s.suggestion}"</p>
              <p className="text-xs text-zinc-500 mt-0.5">— {s.userName}</p>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(s.suggestion)}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 bg-indigo-500/10 rounded-lg flex-shrink-0 transition"
            >
              Copy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ROOM
// ═══════════════════════════════════════════════════════════════════════════════
export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();

  const myName = searchParams.get("name") || "Anonymous";
  const urlRole = searchParams.get("role") || "participant";

  const isProducer   = urlRole === "host";
  const isSpectator  = urlRole === "spectator";
  const isParticipant = !isProducer && !isSpectator;
  const socketRole   = isSpectator ? "spectator" : "participant";

  // ONE socket, shared with all children via props
  const socket = useMemo(
    () =>
      io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
        autoConnect: true,
        transports: ["websocket", "polling"],
      }),
    []
  );

  const [myId, setMyId] = useState("");
  const [beatPlaying, setBeatPlaying] = useState(false);
  const [showVideoGrid, setShowVideoGrid] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [syncMetrics, setSyncMetrics] = useState({ offset: 0, fps: 60, dropped: 0 });
  const [networkLatency, setNetworkLatency] = useState(0);
  const [currentLyrics, setCurrentLyrics] = useState("");
  const [roulettePrompt, setRoulettePrompt] = useState<{
    theme: string; message: string;
  } | null>(null);
  const [rouletteProgress, setRouletteProgress] = useState<{
    votes: number; needed: number;
  } | null>(null);

  const [state, setState] = useState<RoomState>({
    participants: [], spectatorCount: 0, hostId: null,
    theme: "lofi heartbreak", currentQuestion: null, questionVotes: {},
    aiInsight: null, demoMode: false,
    vibeScore: { score: 50, mood: "NEUTRAL", color: "#6366f1" },
    submissions: [], song: [],
  });

  const [aiSuggestions, setAiSuggestions] = useState([
    { channelId: "kick", type: "volume" as const, suggestion: "Boost by 3dB", reason: "Increases punch", confidence: 87, appliedValue: -9 },
    { channelId: "bass", type: "volume" as const, suggestion: "Reduce by 2dB", reason: "Better headroom", confidence: 72, appliedValue: -8 },
  ]);
  const [crowdVotes] = useState([
    { channelId: "bass", preference: "Louder bass", percentage: 67, totalVotes: 23 },
  ]);

  // ── Socket: join + listen ───────────────────────────────────────────────────
  useEffect(() => {
    const join = () => {
      setMyId(socket.id ?? "");
      socket.emit("join_room", { roomId, name: myName, role: socketRole });
    };
    if (socket.connected) join();
    else socket.once("connect", join);

    socket.on("connect", () => setMyId(socket.id ?? ""));
    socket.on("room_state", (d: any) => setState((p) => ({ ...p, ...d })));
    // lyrics_updated comes from server when producer types
    socket.on("lyrics_updated", (lyrics: string) => setCurrentLyrics(lyrics));
    socket.on("beat_roulette_host_prompt", (d: any) => setRoulettePrompt(d));
    socket.on("roulette_progress", (d: any) => {
      setRouletteProgress(d);
      setTimeout(() => setRouletteProgress(null), 5000);
    });
    socket.on("theme_changed", (d: { theme: string }) => {
      setState((p) => ({ ...p, theme: d.theme }));
      setRoulettePrompt(null);
    });
    socket.on("roulette_declined", () => setRoulettePrompt(null));

    const ping = setInterval(() => {
      const t = Date.now();
      socket.emit("ping", t);
      socket.once("pong", () => setNetworkLatency(Date.now() - t));
    }, 3000);

    return () => {
      clearInterval(ping);
      ["connect","room_state","lyrics_updated","beat_roulette_host_prompt",
       "roulette_progress","theme_changed","roulette_declined"].forEach(
        (e) => socket.off(e)
      );
    };
  }, [socket, roomId, myName, socketRole]);

  const handleLaunchPoll = (pollType: string) => {
    const map: Record<string, { question: string; options: string[] }> = {
      tempo:  { question: "Tempo?",            options: ["Faster", "Slower", "Keep it"] },
      drop:   { question: "When to drop?",     options: ["Drop Now", "Build More", "Wait"] },
      bass:   { question: "Add something?",    options: ["More Bass", "More Melody", "Percussion"] },
      energy: { question: "Energy direction?", options: ["Build Up", "Chill Down", "Maintain"] },
    };
    const p = map[pollType] || map.tempo;
    socket.emit("producer_start_question", {
      roomId,
      question: { category: pollType, label: p.question, options: p.options },
    });
  };

  const vibeColor = state.vibeScore?.color || "#6366f1";

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="text-white"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${vibeColor}0d 0%, transparent 55%),
                     linear-gradient(to bottom, #09090b, #18181b)`,
        minHeight: "100vh",
      }}
    >


      {/* ── TOP NAV — fixed to top of viewport, always visible ───────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-30 bg-zinc-950 border-b border-white/5" style={{height: "56px"}}>
        <div className="px-4 h-full flex items-center justify-between gap-3 w-full">

          {/* Left: room identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base">🎵</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white leading-none">
                {isProducer ? "Producer Control" : isSpectator ? "Watching Live" : "Crowd Studio"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                <span className="font-mono text-indigo-400">{roomId}</span>
                {" · "}{state.theme}
                {" · "}{state.participants.length} in room
              </p>
            </div>
          </div>

          {/* Center: vibe */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold flex-shrink-0"
            style={{ borderColor: `${vibeColor}44`, background: `${vibeColor}11`, color: vibeColor }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: vibeColor }} />
            {state.vibeScore?.mood} · {state.vibeScore?.score}/100
          </div>

          {/* Right: name badge + stats */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-lg">
              <span className="text-sm">{isProducer ? "👑" : isSpectator ? "👀" : "🎤"}</span>
              <span className="text-xs font-bold text-white max-w-[72px] truncate">{myName}</span>
              <span
                className={`hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isProducer
                    ? "bg-yellow-500/20 text-yellow-400"
                    : isSpectator
                    ? "bg-zinc-600/30 text-zinc-400"
                    : "bg-indigo-500/20 text-indigo-400"
                }`}
              >
                {isProducer ? "PRODUCER" : isSpectator ? "SPECTATOR" : "CROWD"}
              </span>
            </div>
            <button
              onClick={() => setShowStats((v) => !v)}
              title="Toggle stats"
              className={`px-2.5 py-1.5 rounded-lg border text-xs transition ${
                showStats
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              📊
            </button>
          </div>
        </div>
      </nav>

      {/* ── SIDEBAR — fixed to left side, below nav ─────────────────────────── */}
      {showStats && (
        <div
          className="fixed left-0 bottom-0 z-20 overflow-y-auto bg-zinc-950 border-r border-white/10"
          style={{ top: "56px", width: "17rem" }}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">System Performance</p>
            <button onClick={() => setShowStats(false)} className="text-zinc-500 hover:text-white text-lg px-1 leading-none">×</button>
          </div>
          <SyncDashboard
            syncOffset={syncMetrics.offset} fps={syncMetrics.fps}
            droppedFrames={syncMetrics.dropped} networkLatency={networkLatency}
            participants={state.participants.length} spectators={state.spectatorCount}
          />
        </div>
      )}

      {/* ── MAIN CONTENT — offset by nav height, shifts right when sidebar open ── */}
      <div
        className="transition-all duration-200 overflow-y-auto"
        style={{
          paddingTop: "64px",
        marginLeft: showStats ? "17rem" : "0",
        minHeight: "100vh",
        }}
      >
           <div className="flex-1 min-w-0">

      {/* Beat Roulette modal */}
      {roulettePrompt && isProducer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-zinc-900 border-2 border-purple-500 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">🎰</div>
            <h3 className="text-lg font-bold text-purple-300 mb-1">Beat Roulette!</h3>
            <p className="text-sm text-zinc-300 mb-1">{roulettePrompt.message}</p>
            <p className="text-xs text-zinc-500 mb-5">
              Switch theme to{" "}
              <strong className="text-purple-300">{roulettePrompt.theme}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { socket.emit("beat_roulette_decline", { roomId }); setRoulettePrompt(null); }}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition"
              >
                Decline
              </button>
              <button
                onClick={() => socket.emit("beat_roulette_accept", { roomId, theme: roulettePrompt.theme })}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold transition"
              >
                Accept ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roulette progress toast */}
      {rouletteProgress && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/90 border border-purple-500/40 rounded-xl px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-purple-300">🎲</span>
          <div className="w-28 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${(rouletteProgress.votes / rouletteProgress.needed) * 100}%` }}
            />
          </div>
          <span className="text-zinc-400 text-xs">
            {rouletteProgress.votes}/{rouletteProgress.needed}
          </span>
        </div>
      )}

      {/* ── PAGE BODY ─────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5 w-full">

        {/* ════════════════════════════════════════
            PARTICIPANT VIEW
        ════════════════════════════════════════ */}
        {isParticipant && (
          <div className="space-y-5">

            {/* Welcome */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl">🎤</span>
              <div>
                <p className="font-bold text-indigo-300">You're in the crowd, {myName}!</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  React to what the producer plays · Vote in polls · Suggest lyrics · Hit the
                  instrument pads · Submit lines for the Lyric Battle
                </p>
              </div>
            </div>

            {/* 1. Reactions + polls + beat roulette */}
            <ParticipantPanel
              socket={socket} roomId={roomId}
              currentPoll={state.currentQuestion} theme={state.theme} myId={myId}
            />

            {/* 2. Live Lyric Canvas — READ ONLY
                The producer types in their canvas. Every word appears here in real time.
                You can react to it and send suggestions below. */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  🎤 Live Lyric Canvas
                </p>
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  Live view — producer is writing
                </span>
              </div>
              {/* ONE canvas, isHost=false = read only, auto-updates as producer types */}
              <LyricCanvas socket={socket} roomId={roomId} isHost={false} />

              {/* React to what you see */}
              <ReactionBar socket={socket} roomId={roomId} />

              {/* Suggest a lyric improvement to the producer */}
              <LyricSuggestionBox socket={socket} roomId={roomId} myName={myName} />
            </div>

            {/* 3. Instrument pads */}
            <CrowdInstrumentPad socket={socket} roomId={roomId} isHost={false} myName={myName} />

            {/* 4. Lyric Battle
                How it works:
                  - You write a lyric line and submit it to the battle pool
                  - The producer picks 2 lines from the pool and starts a battle
                  - Everyone votes — the winning line gets added to the song!
                  - Winner is shown when the timer ends */}
            <AILyricBattlePanel
              socket={socket} roomId={roomId}
              isHost={false} submissions={state.submissions || []}
            />

            {/* 5. Mood ring */}
            <MoodRing socket={socket} roomId={roomId} initialVibe={state.vibeScore} />
          </div>
        )}

        {/* ════════════════════════════════════════
            SPECTATOR VIEW
        ════════════════════════════════════════ */}
        {isSpectator && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">👀</div>
              <p className="font-semibold text-zinc-200">Watching as spectator</p>
              <p className="text-zinc-500 text-sm mt-1">Read-only — enjoy the session</p>
            </div>
            <MoodRing socket={socket} roomId={roomId} initialVibe={state.vibeScore} />
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wide font-semibold">🎤 Live Lyrics</p>
              <div className="min-h-[80px]">
                {currentLyrics ? (
                  <p className="text-zinc-200 whitespace-pre-wrap text-sm leading-loose">
                    {currentLyrics}
                  </p>
                ) : (
                  <p className="text-zinc-600 italic text-sm">Nothing written yet...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            PRODUCER VIEW
        ════════════════════════════════════════ */}
        {isProducer && (
          <div className="space-y-5">

            {/* Welcome banner */}
            <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <p className="font-bold text-yellow-300">You're the Producer, {myName}!</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Write lyrics · Play beats · Run polls · Start lyric battles · Demo mode adds bots to test everything
                </p>
              </div>
            </div>

            {/* Demo Mode — WHAT IT DOES:
                Adds 8 virtual bots to the room. They automatically:
                - React with emojis every few seconds (so Mood Ring changes)
                - Submit lyric lines to the battle pool (so you can test battles alone)
                - Vote in polls and battles
                Use this when testing solo — you don't need real participants. */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-white">🧪 Demo Mode</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {state.demoMode
                      ? `${state.participants.filter((p) => p.name.includes("(bot)")).length} bots active — reacting, voting, submitting battle lines`
                      : "Adds 8 bots so you can test reactions, polls, and battles solo"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    socket.emit("host_toggle_demo", { roomId, on: !state.demoMode })
                  }
                  className={`px-5 py-2 rounded-xl font-bold text-sm transition flex-shrink-0 ${
                    state.demoMode
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {state.demoMode ? "🛑 Stop Demo" : "▶ Start Demo"}
                </button>
              </div>
              {state.demoMode && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {state.participants
                    .filter((p) => p.name.includes("(bot)"))
                    .map((b) => (
                      <span
                        key={b.id}
                        className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-500"
                      >
                        🤖 {b.name}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Mood + Leaderboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <MoodRing socket={socket} roomId={roomId} initialVibe={state.vibeScore} />
              <Leaderboard socket={socket} roomId={roomId} myId={myId} />
            </div>

            {/* Beat controls */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-zinc-400 mb-4 font-semibold">🎛 Beat Controls</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={async () => {
                    if (!beatPlaying) { await startRoomBeat(state.theme); setBeatPlaying(true); }
                    else { stopRoomBeat(); setBeatPlaying(false); }
                  }}
                  className={`py-3 rounded-xl font-bold transition ${
                    beatPlaying
                      ? "bg-red-600 hover:bg-red-500"
                      : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  {beatPlaying ? "⏹ Stop Beat" : "▶ Play Beat"}
                </button>
                <button
                  onClick={() => setShowVideoGrid((v) => !v)}
                  className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold transition"
                >
                  {showVideoGrid ? "📹 Hide Video" : "📹 Video Grid"}
                </button>
              </div>
              <Visualizer
                isPlaying={beatPlaying} theme={state.theme}
                showMetrics={false} onMetricsUpdate={(m: any) => setSyncMetrics(m)}
              />
            </div>

            {/* Mix console */}
            <ProducerMixConsole
              onVolumeChange={(ch, vol) =>
                socket.emit("mixer_change", { roomId, channel: ch, volume: vol })
              }
              aiSuggestions={aiSuggestions}
              crowdVotes={crowdVotes}
              isPlaying={beatPlaying}
            />

            {/* Polls + AI Copilot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <CrowdFeedbackDashboard
                participantCount={state.participants.length}
                onLaunchPoll={handleLaunchPoll}
                socket={socket} roomId={roomId}
              />
              <AICopilotPanel
                onApplySuggestion={(id) =>
                  setAiSuggestions((p) => p.filter((s) => `${s.channelId}-${s.suggestion}` !== id))}
                onDismissSuggestion={(id) =>
                  setAiSuggestions((p) => p.filter((s) => `${s.channelId}-${s.suggestion}` !== id))}
              />
            </div>

            {/* Active poll results */}
            {state.currentQuestion && (
              <div className="bg-indigo-900/20 border-2 border-indigo-500 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-indigo-300">📊 {state.currentQuestion.label}</h3>
                  <span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">
                    {Math.max(0, Math.ceil((state.currentQuestion.endsAt - Date.now()) / 1000))}s left
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {state.currentQuestion.options.map((option: string) => {
                    const votes = state.questionVotes?.[option] || 0;
                    const total = Object.values(state.questionVotes || {}).reduce(
                      (a: number, b: any) => a + Number(b), 0
                    );
                    const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                    return (
                      <div key={option} className="relative py-3 px-4 bg-zinc-800 rounded-xl overflow-hidden">
                        <div
                          className="absolute inset-0 bg-indigo-500/20 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative">
                          <p className="font-semibold text-sm">{option}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{votes} votes · {pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── LYRIC CANVAS (producer) ───────────────────────────────────────
                This is where you write lyrics.
                Every keystroke is sent to all participants in real time.
                They see it appear live in their "Live Lyric Canvas" (read-only).
                There is only ONE canvas on this page — you write here, they read.
            ─────────────────────────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  🎤 Live Lyric Canvas
                </p>
                <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                  Only you can write — crowd sees every word live
                </span>
              </div>
              <LyricCanvas socket={socket} roomId={roomId} isHost={true} />
            </div>

            {/* Crowd suggestions appear here as they come in */}
            <LyricSuggestionsInbox socket={socket} />

            {/* ── LYRIC BATTLE ──────────────────────────────────────────────────
                How it works:
                1. Participants (and you) submit lyric lines to the battle pool
                2. You pick any 2 lines and press "⚔️ Start Battle"
                3. A 15-second vote opens — everyone picks their favourite
                4. The winning line gets added to the song automatically
                5. You can run multiple rounds to build the full song
            ─────────────────────────────────────────────────────────────────── */}
            <AILyricBattlePanel
              socket={socket} roomId={roomId}
              isHost={true} submissions={state.submissions || []}
            />

            {/* Instrument pads */}
            <CrowdInstrumentPad socket={socket} roomId={roomId} isHost={true} myName={myName} />

            {/* Voice recorder */}
            <VoiceRecorder
              isPlaying={beatPlaying} onStartRecording={() => {}}
              onStopRecording={(blob: Blob) =>
                socket.emit("vocal_recorded", { roomId, size: blob.size, timestamp: Date.now() })
              }
            />

            {/* Video grid */}
            {showVideoGrid && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
                <VideoGrid socket={socket} roomId={roomId} isHost={true} myId={myId} />
              </div>
            )}

            {/* Song built so far */}
            {state.song && state.song.length > 0 && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-zinc-400 mb-4 font-semibold">
                  🎵 Song Built This Session
                </p>
                <div className="space-y-2">
                  {state.song.map((line, i) => (
                    <div key={i} className="flex items-baseline gap-3">
                      <span className="text-[10px] text-zinc-600 w-14 flex-shrink-0 font-mono uppercase">
                        {line.section}
                      </span>
                      <p className="text-sm text-zinc-200 italic flex-1">"{line.text}"</p>
                      <span className="text-[10px] text-zinc-600">— {line.author}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3 font-semibold">
                👥 In Room ({state.participants.length})
                {state.spectatorCount > 0 && (
                  <span className="text-zinc-600 ml-2 font-normal">
                    · {state.spectatorCount} watching
                  </span>
                )}
              </p>
              {state.participants.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  Share{" "}
                  <span className="font-mono text-indigo-400">
                    localhost:3000/room/{roomId}?name=YourName
                  </span>{" "}
                  to invite
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {state.participants.map((u) => (
                    <span
                      key={u.id}
                      className={`px-3 py-1 rounded-full text-xs ${
                        u.id === myId
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : u.name.includes("(bot)")
                          ? "bg-zinc-800 text-zinc-600"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {u.id === state.hostId ? "👑 " : ""}
                      {u.name}
                      {u.id === myId ? " (you)" : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

        </div>{/* end flex-1 min-w-0 */}
      </div>{/* end main content wrapper */}
    </div>
  );
}

// ── Small helper components defined inline to avoid extra files ──────────────

function ReactionBar({ socket, roomId }: { socket: any; roomId: string }) {
  const [reacted, setReacted] = useState<string | null>(null);

  const react = (emoji: string) => {
    setReacted(emoji);
    socket.emit("send_reaction", { roomId, emoji });
    setTimeout(() => setReacted(null), 800);
  };

  return (
    <div className="mt-3 flex gap-2">
      {["🔥", "❤️", "🎵", "⚡", "😴"].map((emoji) => (
        <button
          key={emoji}
          onClick={() => react(emoji)}
          className={`flex-1 py-2.5 rounded-xl border text-lg transition-all ${
            reacted === emoji
              ? "border-indigo-400 bg-indigo-500/20 scale-110"
              : "border-white/10 bg-zinc-800/80 hover:scale-105 hover:bg-zinc-700"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function LyricSuggestionBox({
  socket, roomId, myName,
}: {
  socket: any; roomId: string; myName: string;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const send = () => {
    if (!text.trim()) return;
    socket.emit("submit_lyric_suggestion", {
      roomId, suggestion: text.trim(), userName: myName,
    });
    setSent(true);
    setText("");
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="mt-3">
      <p className="text-xs text-zinc-500 mb-2">Suggest a lyric to the producer:</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a line..."
          maxLength={120}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-600"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-sm font-bold transition"
        >
          Send
        </button>
      </div>
      {sent && <p className="text-xs text-emerald-400 mt-1.5">✓ Sent to the producer!</p>}
    </div>
  );
}
