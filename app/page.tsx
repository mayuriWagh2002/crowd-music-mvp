"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const WORDS = ["BEAT", "VIBE", "DROP", "FLOW", "BASS", "WAVE", "SOUL", "FIRE"];

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  // Create room
  const [producerName, setProducerName] = useState("");

  // Room code starts empty — generated client-side only to avoid SSR mismatch
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    // Only runs in the browser, never on the server — no hydration mismatch
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    setRoomCode(`${word}-${num}`);
  }, []);

  // Join room
  const [participantName, setParticipantName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinRole, setJoinRole] = useState<"participant" | "spectator">("participant");
  const [error, setError] = useState("");

  // ── Create room as producer ─────────────────────────────────────────────────
  const handleCreate = () => {
    if (!producerName.trim()) return;
    // Navigate: /room/[roomCode]?name=...&role=host
    router.push(
      `/room/${roomCode}?name=${encodeURIComponent(producerName.trim())}&role=host`
    );
  };

  // ── Join existing room ──────────────────────────────────────────────────────
  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!participantName.trim()) { setError("Please enter your name."); return; }
    if (!code) { setError("Please enter a room code."); return; }
    setError("");
    router.push(
      `/room/${code}?name=${encodeURIComponent(participantName.trim())}&role=${joinRole}`
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                        bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="text-4xl font-black tracking-tight">CrowdStudio</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Make music with your crowd — live, together
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-zinc-900 border border-white/10 rounded-2xl p-1 mb-6">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              tab === "create"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🎛️ I'm the Producer
          </button>
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              tab === "join"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🎤 I'm in the Crowd
          </button>
        </div>

        {/* ── PRODUCER TAB ─────────────────────────────────────────────────── */}
        {tab === "create" && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Create a Room</h2>
              <p className="text-sm text-zinc-400">
                You'll control the mix, lyrics, and polls. Share your room code with the crowd.
              </p>
            </div>

            {/* What the producer gets */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["🎛️", "Mix Console"],
                ["✍️", "Lyric Canvas"],
                ["📊", "Launch Polls"],
                ["⚔️", "Lyric Battles"],
                ["🎲", "Beat Roulette"],
                ["🤖", "AI Copilot"],
              ].map(([emoji, label]) => (
                <div key={label} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                  <span>{emoji}</span>
                  <span className="text-zinc-400">{label}</span>
                </div>
              ))}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Your Producer Name
              </label>
              <input
                type="text"
                value={producerName}
                onChange={(e) => setProducerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. DJ Nova"
                maxLength={30}
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                           text-base focus:outline-none focus:ring-2 focus:ring-indigo-500
                           placeholder:text-zinc-600"
              />
            </div>

            {/* Room code preview */}
            <div className="bg-black/40 border border-indigo-500/30 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Your Room Code</p>
              {roomCode ? (
                <p className="text-3xl font-black font-mono text-indigo-400 tracking-widest">
                  {roomCode}
                </p>
              ) : (
                <div className="h-9 flex items-center justify-center">
                  <div className="w-36 h-7 bg-zinc-800 rounded-lg animate-pulse" />
                </div>
              )}
              <p className="text-xs text-zinc-500 mt-2">
                Share this with your crowd so they can join
              </p>
            </div>

            <button
              onClick={handleCreate}
              disabled={!producerName.trim() || !roomCode}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                         disabled:cursor-not-allowed rounded-xl font-bold text-base
                         transition-all active:scale-[0.98]"
            >
              🎛️ Create Room & Go Live
            </button>
          </div>
        )}

        {/* ── PARTICIPANT TAB ───────────────────────────────────────────────── */}
        {tab === "join" && (
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Join a Room</h2>
              <p className="text-sm text-zinc-400">
                Get the room code from the producer and join the session.
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="e.g. Ava"
                maxLength={30}
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                           text-base focus:outline-none focus:ring-2 focus:ring-indigo-500
                           placeholder:text-zinc-600"
              />
            </div>

            {/* Room code */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="e.g. BEAT-4729"
                maxLength={12}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                           text-base font-mono tracking-widest uppercase
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           placeholder:text-zinc-600 placeholder:font-sans placeholder:tracking-normal"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>

            {/* Role picker */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                How do you want to join?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setJoinRole("participant")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    joinRole === "participant"
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-white/10 bg-zinc-800/50 hover:border-white/20"
                  }`}
                >
                  <div className="text-2xl mb-1">🎤</div>
                  <div className="text-sm font-semibold">Participant</div>
                  <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    React · vote · suggest lyrics · play pads
                  </div>
                </button>

                <button
                  onClick={() => setJoinRole("spectator")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    joinRole === "spectator"
                      ? "border-zinc-500 bg-zinc-500/10"
                      : "border-white/10 bg-zinc-800/50 hover:border-white/20"
                  }`}
                >
                  <div className="text-2xl mb-1">👀</div>
                  <div className="text-sm font-semibold">Spectator</div>
                  <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Watch the session · no controls
                  </div>
                </button>
              </div>
            </div>

            {/* What participants can do */}
            {joinRole === "participant" && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["🔥", "Send reactions"],
                  ["📊", "Vote on polls"],
                  ["✍️", "Suggest lyrics"],
                  ["🎲", "Spin Beat Roulette"],
                  ["🥁", "Play instrument pads"],
                  ["⚔️", "Vote in battles"],
                ].map(([emoji, label]) => (
                  <div key={label} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                    <span>{emoji}</span>
                    <span className="text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={!participantName.trim() || !joinCode.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                         disabled:cursor-not-allowed rounded-xl font-bold text-base
                         transition-all active:scale-[0.98]"
            >
              {joinRole === "participant" ? "🎤 Join Session" : "👀 Watch Session"}
            </button>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          No account needed · rooms are live only · data resets when session ends
        </p>
      </div>
    </div>
  );
}
