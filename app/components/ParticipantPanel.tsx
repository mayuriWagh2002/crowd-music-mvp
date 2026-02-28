"use client";

import { useEffect, useState, useCallback } from "react";

interface ParticipantPanelProps {
  socket: any;
  roomId: string;
  currentPoll: any;
  theme?: string;
  myId?: string;
}

const REACTIONS = [
  { emoji: "🔥", label: "Fire", desc: "This is LIT" },
  { emoji: "❤️", label: "Love", desc: "Loving this" },
  { emoji: "🎵", label: "Vibe", desc: "Good vibe" },
  { emoji: "⚡", label: "Energy", desc: "High energy" },
  { emoji: "😴", label: "Bored", desc: "Need change" },
] as const;

export default function ParticipantPanel({
  socket, roomId, currentPoll, theme = "lofi heartbreak", myId,
}: ParticipantPanelProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOption, setVotedOption] = useState<string | null>(null);
  const [pollResults, setPollResults] = useState<Record<string, number>>({});
  const [recentReaction, setRecentReaction] = useState<string | null>(null);
  const [reactionCooldown, setReactionCooldown] = useState(false);
  const [reactionFeedback, setReactionFeedback] = useState<string | null>(null);
  const [lyricSuggestion, setLyricSuggestion] = useState("");
  const [suggestionSent, setSuggestionSent] = useState(false);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [rouletteProgress, setRouletteProgress] = useState<{ votes: number; needed: number } | null>(null);
  const [incomingEmojis, setIncomingEmojis] = useState<Array<{ emoji: string; id: number; x: number }>>([]);

  // Reset vote when poll changes
  useEffect(() => {
    setHasVoted(false);
    setVotedOption(null);
    setPollResults({});
  }, [currentPoll?.id]);

  useEffect(() => {
    if (!socket) return;

    // Live poll results
    socket.on("poll_results", (data: any) => setPollResults(data.votes || {}));

    // Other people's reactions float in
    socket.on("reaction_broadcast", (data: { emoji: string }) => {
      const id = Date.now() + Math.random();
      const x = 10 + Math.random() * 80;
      setIncomingEmojis(prev => [...prev, { emoji: data.emoji, id, x }]);
      setTimeout(() => setIncomingEmojis(prev => prev.filter(r => r.id !== id)), 2500);
    });

    // Beat roulette events
    socket.on("beat_roulette_result", (data: { theme: string }) => {
      setRouletteResult(data.theme);
      setRouletteSpinning(false);
      setTimeout(() => setRouletteResult(null), 5000);
    });
    socket.on("roulette_progress", (data: { votes: number; needed: number }) => {
      setRouletteProgress(data);
    });
    socket.on("roulette_declined", () => {
      setRouletteResult(null);
      setRouletteSpinning(false);
      setRouletteProgress(null);
    });

    return () => {
      socket.off("poll_results");
      socket.off("reaction_broadcast");
      socket.off("beat_roulette_result");
      socket.off("roulette_progress");
      socket.off("roulette_declined");
    };
  }, [socket]);

  // ── Send reaction ──────────────────────────────────────────────────────────
  const sendReaction = useCallback((emoji: string, label: string) => {
    if (reactionCooldown) return;
    socket.emit("send_reaction", { roomId, emoji });
    setRecentReaction(emoji);
    setReactionFeedback(`${emoji} ${label} sent!`);
    setReactionCooldown(true);
    setTimeout(() => { setRecentReaction(null); setReactionCooldown(false); setReactionFeedback(null); }, 900);
  }, [reactionCooldown, socket, roomId]);

  // ── Vote on poll ───────────────────────────────────────────────────────────
  const vote = useCallback((option: string) => {
    if (hasVoted || !currentPoll) return;
    socket.emit("vote_option", { roomId, option });
    setHasVoted(true);
    setVotedOption(option);
  }, [hasVoted, currentPoll, socket, roomId]);

  // ── Suggest lyric ──────────────────────────────────────────────────────────
  const submitSuggestion = () => {
    if (!lyricSuggestion.trim()) return;
    socket.emit("submit_lyric_suggestion", {
      roomId, suggestion: lyricSuggestion.trim(), userName: "Participant",
    });
    setSuggestionSent(true);
    setLyricSuggestion("");
    setTimeout(() => setSuggestionSent(false), 3000);
  };

  // ── Beat Roulette ──────────────────────────────────────────────────────────
  const spinRoulette = () => {
    if (rouletteSpinning) return;
    setRouletteSpinning(true);
    socket.emit("beat_roulette_spin", { roomId });
  };

  const totalVotes = Object.values(pollResults).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-6 overflow-hidden relative">

      {/* Floating incoming reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        {incomingEmojis.map(({ emoji, id, x }) => (
          <div key={id} className="absolute text-2xl"
            style={{ left: `${x}%`, bottom: "10%", animation: "floatUp 2.5s ease-out forwards" }}>
            {emoji}
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
        🎤 Participant Controls
      </h3>
      <p className="text-xs text-zinc-500 mb-5">
        Theme: <span className="text-zinc-300">{theme}</span>
      </p>

      {/* ── 1. REACTIONS ──────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-3">
          🔥 Send Live Reactions
          <span className="ml-2 text-zinc-600 normal-case font-normal">— visible to everyone in the room</span>
        </p>
        <div className="flex gap-2">
          {REACTIONS.map(({ emoji, label, desc }) => (
            <button key={emoji} onClick={() => sendReaction(emoji, label)}
              disabled={reactionCooldown} title={desc}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all duration-200
                ${recentReaction === emoji
                  ? "border-indigo-400 bg-indigo-500/20 scale-110"
                  : "border-white/10 bg-zinc-800/50 hover:bg-zinc-700/50 hover:scale-105"
                } ${reactionCooldown && recentReaction !== emoji ? "opacity-40" : ""} active:scale-95`}>
              <span className="text-2xl leading-none">{emoji}</span>
              <span className="text-[10px] text-zinc-500">{label}</span>
            </button>
          ))}
        </div>
        {reactionFeedback && (
          <p className="text-xs text-emerald-400 mt-2 text-center">{reactionFeedback}</p>
        )}
      </section>

      {/* ── 2. POLL VOTING ────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-3">
          📊 Producer Poll
          <span className="ml-2 text-zinc-600 normal-case font-normal">— vote to guide the session</span>
        </p>
        {currentPoll ? (
          <div className="bg-black/30 border border-indigo-500/30 rounded-xl p-4">
            <p className="text-sm font-semibold text-indigo-300 mb-3">{currentPoll.label || currentPoll.question}</p>
            <div className="space-y-2">
              {(currentPoll.options || []).map((option: string) => {
                const votes = pollResults[option] || 0;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                return (
                  <button key={option} onClick={() => vote(option)} disabled={hasVoted}
                    className={`relative w-full py-3 px-4 rounded-lg border text-left text-sm transition-all overflow-hidden
                      ${votedOption === option ? "border-indigo-400 bg-indigo-600/30 font-semibold"
                        : hasVoted ? "border-white/5 bg-zinc-800/30 opacity-60 cursor-not-allowed"
                        : "border-white/10 bg-zinc-800/50 hover:bg-zinc-700/50 hover:border-indigo-400/50 cursor-pointer"}`}>
                    {hasVoted && <div className="absolute inset-0 bg-indigo-500/10 transition-all duration-700" style={{ width: `${pct}%` }} />}
                    <div className="relative flex justify-between">
                      <span>{option}</span>
                      {hasVoted && <span className="text-xs text-zinc-400">{votes} ({pct}%)</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {hasVoted && <p className="text-xs text-emerald-400 text-center mt-3">✓ Vote recorded for "{votedOption}"</p>}
          </div>
        ) : (
          <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">🎛️</div>
            <p className="text-sm text-zinc-500">Waiting for producer to launch a poll...</p>
            <p className="text-xs text-zinc-600 mt-1">The producer will ask you to vote on tempo, drops, energy, etc.</p>
          </div>
        )}
      </section>

      {/* ── 3. LYRIC SUGGESTION ───────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-3">
          💡 Suggest a Lyric
          <span className="ml-2 text-zinc-600 normal-case font-normal">— producer sees these in their inbox</span>
        </p>
        <div className="flex gap-2">
          <input type="text" value={lyricSuggestion}
            onChange={e => setLyricSuggestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitSuggestion()}
            placeholder="Type a lyric line or word..."
            maxLength={120}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5
                       text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-600" />
          <button onClick={submitSuggestion} disabled={!lyricSuggestion.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-sm font-semibold transition">
            Send
          </button>
        </div>
        {suggestionSent && <p className="text-xs text-emerald-400 mt-2">✓ Your suggestion was sent to the producer's inbox!</p>}
      </section>

      {/* ── 4. BEAT ROULETTE ──────────────────────────────────────────────── */}
      <section>
        <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-3">
          🎲 Beat Roulette
          <span className="ml-2 text-zinc-600 normal-case font-normal">— vote to spin for a random beat theme</span>
        </p>
        <div className="bg-black/30 border border-white/5 rounded-xl p-4">
          {rouletteProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">Votes to trigger spin</span>
                <span className="text-purple-400">{rouletteProgress.votes}/{rouletteProgress.needed}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 transition-all rounded-full"
                  style={{ width: `${(rouletteProgress.votes / rouletteProgress.needed) * 100}%` }} />
              </div>
            </div>
          )}

          {rouletteResult ? (
            <div className="text-center py-2">
              <div className="text-3xl mb-2 animate-bounce">🎰</div>
              <p className="text-sm font-semibold text-purple-300">Landed on: {rouletteResult}</p>
              <p className="text-xs text-zinc-500 mt-1">Producer will decide whether to accept</p>
            </div>
          ) : (
            <button onClick={spinRoulette} disabled={rouletteSpinning}
              className={`w-full py-3 rounded-lg text-sm font-semibold transition-all
                ${rouletteSpinning ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"}`}>
              {rouletteSpinning
                ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">🎰</span>Waiting for more votes...</span>
                : "🎲 Vote to Spin Beat Roulette"}
            </button>
          )}
          <p className="text-[10px] text-zinc-600 text-center mt-2">
            40% of participants need to vote to trigger the spin
          </p>
        </div>
      </section>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
