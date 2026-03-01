"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";

import { startRoomBeat, stopRoomBeat } from "@/app/lib/musicEngine";
import VoiceRecorder from "@/app/components/VoiceRecorder";
import LyricCanvas from "@/app/components/LyricCanvas";
import Visualizer from "@/app/components/Visualizer";
import VideoGrid from "@/app/components/VideoGrid";
import SyncDashboard from "@/app/components/SyncDashboard";
import ProducerMixConsole from "@/app/components/ProducerMixConsole";
import AICopilotPanel from "@/app/components/AICopilotPanel";
import CrowdFeedbackDashboard from "@/app/components/CrowdFeedbackDashboard";
import MoodRing from "@/app/components/MoodRing";
import Leaderboard from "@/app/components/Leaderboard";
import ParticipantPanel from "@/app/components/ParticipantPanel";
import AILyricBattlePanel from "@/app/components/AILyricBattlePanel";
import CrowdInstrumentPad from "@/app/components/CrowdInstrumentPad";
import HypeMeter from "@/app/components/HypeMeter";

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

// ── Host sees lyric suggestions from crowd ───────────────────────────────────
function LyricSuggestionsInbox({ socket }: { socket: any }) {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; userName: string; suggestion: string }>>([]);
  useEffect(() => {
    socket.on("crowd_suggestion_received", (data: any) =>
      setSuggestions(p => [data, ...p].slice(0, 20)));
    return () => socket.off("crowd_suggestion_received");
  }, [socket]);
  if (!suggestions.length) return null;
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3">💡 Crowd Suggestions ({suggestions.length})</p>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start gap-3 bg-black/30 rounded-xl px-3 py-2.5 border border-white/5">
            <div className="flex-1">
              <p className="text-sm text-zinc-200">"{s.suggestion}"</p>
              <p className="text-xs text-zinc-500 mt-0.5">— {s.userName}</p>
            </div>
            <button onClick={() => navigator.clipboard?.writeText(s.suggestion)}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 bg-indigo-500/10 rounded-lg">
              Copy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Room ────────────────────────────────────────────────────────────────
export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();

  const myName = searchParams.get("name") || "Anonymous";
  const urlRole = searchParams.get("role") || "participant";

  // Role is set from URL — never changes after page load
  const isProducer = urlRole === "host";
  const isSpectator = urlRole === "spectator";
  const isParticipant = !isProducer && !isSpectator;
  const socketRole = isSpectator ? "spectator" : "participant";

  // Single socket — passed to ALL child components so they all share the same connection
  const socket = useMemo(() =>
    io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      autoConnect: true,
      transports: ["websocket", "polling"],
    }), []);

  const [myId, setMyId] = useState("");
  const [beatPlaying, setBeatPlaying] = useState(false);
  const [showVideoGrid, setShowVideoGrid] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false); // default hidden — cleaner UI
  const [syncMetrics, setSyncMetrics] = useState({ offset: 0, fps: 60, dropped: 0 });
  const [networkLatency, setNetworkLatency] = useState(0);
  // currentLyrics in Room — synced here so header/spectator can read it too
  const [currentLyrics, setCurrentLyrics] = useState("");
  const [roulettePrompt, setRoulettePrompt] = useState<{ theme: string; message: string } | null>(null);
  const [rouletteProgress, setRouletteProgress] = useState<{ votes: number; needed: number } | null>(null);

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

  // ── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const doJoin = () => {
      setMyId(socket.id ?? "");
      socket.emit("join_room", { roomId, name: myName, role: socketRole });
    };
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);

    socket.on("connect", () => setMyId(socket.id ?? ""));
    socket.on("room_state", (data: any) => setState(prev => ({ ...prev, ...data })));
    // Sync lyrics here so spectator view and header both get it
    socket.on("lyrics_updated", (lyrics: string) => setCurrentLyrics(lyrics));
    socket.on("beat_roulette_host_prompt", (data: any) => setRoulettePrompt(data));
    socket.on("roulette_progress", (data: any) => {
      setRouletteProgress(data);
      setTimeout(() => setRouletteProgress(null), 5000);
    });
    socket.on("theme_changed", (data: { theme: string }) => {
      setState(prev => ({ ...prev, theme: data.theme }));
      setRoulettePrompt(null);
    });
    socket.on("roulette_declined", () => setRoulettePrompt(null));

    const pingInterval = setInterval(() => {
      const t = Date.now();
      socket.emit("ping", t);
      socket.once("pong", () => setNetworkLatency(Date.now() - t));
    }, 3000);

    return () => {
      clearInterval(pingInterval);
      ["connect","room_state","lyrics_updated","beat_roulette_host_prompt",
       "roulette_progress","theme_changed","roulette_declined"].forEach(e => socket.off(e));
    };
  }, [socket, roomId, myName, socketRole]);

  const handleVolumeChange = (channelId: string, volume: number) =>
    socket.emit("mixer_change", { roomId, channel: channelId, volume });

  const handleLaunchPoll = (pollType: string) => {
    const opts: Record<string, { question: string; options: string[] }> = {
      tempo:  { question: "Tempo: Faster or Slower?",   options: ["Faster", "Slower", "Keep Current"] },
      drop:   { question: "When should we drop?",        options: ["Drop Now", "Build More", "Wait for Chorus"] },
      bass:   { question: "What should we add?",         options: ["More Bass", "More Melody", "More Percussion"] },
      energy: { question: "Energy direction?",           options: ["Build Up", "Chill Down", "Maintain"] },
    };
    const p = opts[pollType] || opts.tempo;
    socket.emit("producer_start_question", {
      roomId, question: { category: pollType, label: p.question, options: p.options },
    });
  };

  const vibeColor = state.vibeScore?.color || "#6366f1";

  return (
    <div className="min-h-screen text-white bg-zinc-950">

      {/* HypeMeter fullscreen overlay */}
      <HypeMeter socket={socket} roomId={roomId}
        currentLyric={state.submissions?.[0]?.text || state.song?.slice(-1)[0]?.text}
        currentTheme={state.theme} vibeScore={state.vibeScore} />

      {/* Stats panel — fixed left, only when shown */}
      {showDashboard && (
        <div className="fixed top-0 left-0 bottom-0 w-72 z-40 overflow-y-auto">
          <SyncDashboard syncOffset={syncMetrics.offset} fps={syncMetrics.fps}
            droppedFrames={syncMetrics.dropped} networkLatency={networkLatency}
            participants={state.participants.length} spectators={state.spectatorCount} />
        </div>
      )}

      {/* ── TOP NAVBAR ── clean, no overlap ─────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">

          {/* Left: room info */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg">🎵</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {isProducer ? "Producer Control" : isSpectator ? "Watching Live" : "Crowd Studio"}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                <span className="font-mono text-indigo-400">{roomId}</span>
                {" · "}{state.theme}
                {" · "}{state.participants.length} in room
              </p>
            </div>
          </div>

          {/* Center: vibe score */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold flex-shrink-0"
            style={{ borderColor: `${vibeColor}44`, background: `${vibeColor}11`, color: vibeColor }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: vibeColor }} />
            {state.vibeScore?.mood} · {state.vibeScore?.score}/100
          </div>

          {/* Right: identity + stats toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-xs">
              <span>{isProducer ? "👑" : isSpectator ? "👀" : "🎤"}</span>
              <span className="font-semibold text-white max-w-[80px] truncate">{myName}</span>
              <span className={`hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isProducer ? "bg-yellow-500/20 text-yellow-400"
                : isSpectator ? "bg-zinc-600/30 text-zinc-400"
                : "bg-indigo-500/20 text-indigo-400"}`}>
                {isProducer ? "PRODUCER" : isSpectator ? "SPECTATOR" : "PARTICIPANT"}
              </span>
            </div>
            <button onClick={() => setShowDashboard(v => !v)}
              className="px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-xs hover:bg-zinc-800 transition">
              📊
            </button>
          </div>
        </div>
      </nav>

      {/* Beat Roulette popup */}
      {roulettePrompt && isProducer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-zinc-900 border-2 border-purple-500 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">🎰</div>
            <h3 className="text-lg font-bold text-purple-300 mb-2">Beat Roulette!</h3>
            <p className="text-sm text-zinc-300 mb-4">{roulettePrompt.message}</p>
            <p className="text-xs text-zinc-500 mb-4">Accept to change the beat theme to <strong className="text-purple-300">{roulettePrompt.theme}</strong></p>
            <div className="flex gap-3">
              <button onClick={() => { socket.emit("beat_roulette_decline", { roomId }); setRoulettePrompt(null); }}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition">Decline</button>
              <button onClick={() => socket.emit("beat_roulette_accept", { roomId, theme: roulettePrompt.theme })}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold transition">Accept ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* Roulette progress toast */}
      {rouletteProgress && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/90 border border-purple-500/40 rounded-xl px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-purple-300">🎲 Roulette:</span>
          <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${(rouletteProgress.votes / rouletteProgress.needed) * 100}%` }} />
          </div>
          <span className="text-zinc-400 text-xs">{rouletteProgress.votes}/{rouletteProgress.needed}</span>
        </div>
      )}

      {/* ── PAGE CONTENT ─────────────────────────────────────────────────── */}
      <main className={`max-w-5xl mx-auto px-4 py-6 space-y-5 ${showDashboard ? "ml-72" : ""}`}>

        {/* ══════════════════════════════════
            PARTICIPANT VIEW
        ══════════════════════════════════ */}
        {isParticipant && (
          <div className="space-y-5">
            {/* What you can do */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl mt-0.5">🎤</span>
              <div>
                <p className="font-bold text-indigo-300">Hey {myName}, you're in the crowd!</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  React with emojis · Vote on producer polls · Suggest lyrics to the producer · 
                  Play instrument pads · Submit lines for the Lyric Battle
                </p>
              </div>
            </div>

            {/* 1. Reactions + Poll + Beat Roulette */}
            <ParticipantPanel socket={socket} roomId={roomId}
              currentPoll={state.currentQuestion} theme={state.theme} myId={myId} />

            {/* 2. Live lyrics — read only, updates as producer types */}
            <LyricCanvas socket={socket} roomId={roomId} isHost={false} />

            {/* 3. Instrument pads */}
            <CrowdInstrumentPad socket={socket} roomId={roomId} isHost={false} myName={myName} />

            {/* 4. Battle — submit entries + vote */}
            <AILyricBattlePanel socket={socket} roomId={roomId}
              isHost={false} submissions={state.submissions || []} />

            {/* 5. Mood Ring */}
            <MoodRing socket={socket} roomId={roomId} initialVibe={state.vibeScore} />
          </div>
        )}

        {/* ══════════════════════════════════
            SPECTATOR VIEW
        ══════════════════════════════════ */}
        {isSpectator && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">👀</div>
              <p className="text-zinc-300 font-semibold">You're watching as a spectator</p>
              <p className="text-zinc-500 text-sm mt-1">Sit back and watch the session unfold in real time</p>
            </div>
            <MoodRing socket={socket} roomId={roomId} initialVibe={state.vibeScore} />
            {/* Live lyrics display */}
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
              <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wide font-semibold">🎤 Live Lyrics</p>
              <div className="min-h-[80px]">
                {currentLyrics
                  ? <p className="text-zinc-200 whitespace-pre-wrap text-sm leading-loose">{currentLyrics}</p>
                  : <p className="text-zinc-600 italic text-sm">Nothing written yet...</p>}
              </div>
            </div>
            {/* Participants list */}
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wide">👥 In Room ({state.participants.length})</p>
              <div className="flex flex-wrap gap-2">
                {state.participants.map(u => (
                  <span key={u.id} className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-300">
                    {u.id === state.hostId ? "👑 " : ""}{u.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            PRODUCER VIEW
        ══════════════════════════════════ */}
        {isProducer && (
          <div className="space-y-5">

            {/* ── DEMO MODE BANNER — what it does ─────────────────────── */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-bold text-white">🧪 Demo Mode</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Adds 8 virtual bots who auto-vote on polls, submit battle entries, and react — 
                    so you can test all features solo without real participants
                  </p>
                </div>
                <button
                  onClick={() => socket.emit("host_toggle_demo", { roomId, on: !state.demoMode })}
                  className={`px-5 py-2 rounded-xl font-bold text-sm transition flex-shrink-0 ${
                    state.demoMode
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
                  {state.demoMode ? "🛑 Stop Demo" : "▶ Start Demo"}
                </button>
              </div>
              {state.demoMode && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.participants.filter(p => p.name.includes("(bot)")).map(b => (
                    <span key={b.id} className="px-2 py-0.5 bg-zinc-800 rounded-full text-[10px] text-zinc-500">
                      🤖 {b.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── ROW: Mood + Leaderboard ──────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <MoodRing socket={socket} roomId={roomId} initialVibe={state.vibeScore} />
              <Leaderboard socket={socket} roomId={roomId} myId={myId} />
            </div>

            {/* ── BEAT CONTROLS ────────────────────────────────────────── */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3 font-semibold">🎛 Beat Controls</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={async () => {
                    if (!beatPlaying) { await startRoomBeat(state.theme); setBeatPlaying(true); }
                    else { stopRoomBeat(); setBeatPlaying(false); }
                  }}
                  className={`py-3 rounded-xl font-bold transition ${beatPlaying ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500"}`}>
                  {beatPlaying ? "⏹ Stop Beat" : "▶ Play Beat"}
                </button>
                <button onClick={() => setShowVideoGrid(v => !v)}
                  className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold transition">
                  {showVideoGrid ? "📹 Hide Video" : "📹 Video Grid"}
                </button>
              </div>
              <Visualizer isPlaying={beatPlaying} theme={state.theme as any}
                showMetrics={false} onMetricsUpdate={(m: any) => setSyncMetrics(m)} />
            </div>

            {/* ── Mix Console ───────────────────────────────────────────── */}
            <ProducerMixConsole
              onVolumeChange={handleVolumeChange}
              aiSuggestions={aiSuggestions}
              crowdVotes={crowdVotes}
              isPlaying={beatPlaying}
            />

            {/* ── Polls + AI Copilot ────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <CrowdFeedbackDashboard
                participantCount={state.participants.length}
                onLaunchPoll={handleLaunchPoll}
                socket={socket} roomId={roomId}
              />
              <AICopilotPanel
                onApplySuggestion={(id: string) =>
                  setAiSuggestions(p => p.filter(s => `${s.channelId}-${s.suggestion}` !== id))}
                onDismissSuggestion={(id: string) =>
                  setAiSuggestions(p => p.filter(s => `${s.channelId}-${s.suggestion}` !== id))}
              />
            </div>

            {/* ── Active Poll results ───────────────────────────────────── */}
            {state.currentQuestion && (
              <div className="bg-indigo-900/20 border-2 border-indigo-500 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-indigo-300">📊 {state.currentQuestion.label}</h3>
                  <span className="text-sm text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded-lg">
                    {Math.max(0, Math.ceil((state.currentQuestion.endsAt - Date.now()) / 1000))}s left
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {state.currentQuestion.options.map((option: string) => {
                    const votes = state.questionVotes?.[option] || 0;
                    const total = Object.values(state.questionVotes || {}).reduce((a: number, b: any) => a + Number(b), 0);
                    const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                    return (
                      <div key={option} className="relative py-3 px-4 bg-zinc-800 rounded-xl overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/20 transition-all duration-700" style={{ width: `${pct}%` }} />
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

            {/* ── LYRIC CANVAS — Producer writes, everyone sees live ────── */}
            {/* This is ONE canvas. Producer types here → instantly synced to participants */}
            <LyricCanvas socket={socket} roomId={roomId} isHost={true} />

            {/* Crowd's lyric suggestions appear here */}
            <LyricSuggestionsInbox socket={socket} />

            {/* ── Lyric Battle ─────────────────────────────────────────── */}
            <AILyricBattlePanel socket={socket} roomId={roomId}
              isHost={true} submissions={state.submissions || []} />

            {/* ── Instrument Pads ──────────────────────────────────────── */}
            <CrowdInstrumentPad socket={socket} roomId={roomId} isHost={true} myName={myName} />

            {/* ── Voice Recorder ───────────────────────────────────────── */}
            <VoiceRecorder isPlaying={beatPlaying} onStartRecording={() => {}}
              onStopRecording={(blob: Blob) =>
                socket.emit("vocal_recorded", { roomId, size: blob.size, timestamp: Date.now() })} />

            {/* ── Video Grid ───────────────────────────────────────────── */}
            {showVideoGrid && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
                <VideoGrid socket={socket} roomId={roomId} isHost={true} myId={myId} />
              </div>
            )}

            {/* ── Song built so far ─────────────────────────────────────── */}
            {state.song && state.song.length > 0 && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3 font-semibold">🎵 Song Built This Session</p>
                <div className="space-y-2">
                  {state.song.map((line, i) => (
                    <div key={i} className="flex items-baseline gap-3">
                      <span className="text-xs text-zinc-600 w-16 flex-shrink-0">{line.section}</span>
                      <p className="text-sm text-zinc-200 italic">"{line.text}"</p>
                      <span className="text-xs text-zinc-600">— {line.author}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Participants list ─────────────────────────────────────── */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3 font-semibold">
                👥 In Room ({state.participants.length})
                {state.spectatorCount > 0 && <span className="text-zinc-600 ml-2 font-normal">· {state.spectatorCount} watching</span>}
              </p>
              {state.participants.length === 0
                ? <p className="text-sm text-zinc-600">Share the room code <span className="font-mono text-indigo-400">{roomId}</span> to invite people</p>
                : <div className="flex flex-wrap gap-2">
                    {state.participants.map(u => (
                      <span key={u.id} className={`px-3 py-1 rounded-full text-xs ${
                        u.id === myId ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-zinc-800 text-zinc-300"}`}>
                        {u.id === state.hostId ? "👑 " : ""}{u.name}{u.id === myId ? " (you)" : ""}
                      </span>
                    ))}
                  </div>}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
