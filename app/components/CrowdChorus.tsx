"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface WordSubmission {
  word: string;
  userId: string;
  userName: string;
  votes: number;
}

interface ChorusRound {
  id: string;
  prompt: string;
  words: WordSubmission[];
  result: string | null;
  endsAt: number;
  phase: "submitting" | "voting" | "revealing" | "done";
}

interface CrowdChorusProps {
  socket: any;
  roomId: string;
  isHost: boolean;
  myId: string;
  myName?: string;
  theme?: string;
}

const ROUND_PROMPTS = [
  "What does tonight FEEL like?",
  "One word for this beat:",
  "Describe the vibe in one word:",
  "What are we chasing right now?",
  "One word that fits this moment:",
  "How does this make you feel?",
];

const WORD_COLORS = [
  "#f97316", "#8b5cf6", "#06b6d4", "#22c55e",
  "#ec4899", "#fbbf24", "#ef4444", "#3b82f6",
];

export default function CrowdChorus({
  socket,
  roomId,
  isHost,
  myId,
  myName = "Participant",
  theme = "lofi heartbreak",
}: CrowdChorusProps) {
  const [round, setRound] = useState<ChorusRound | null>(null);
  const [myWord, setMyWord] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [generatedLines, setGeneratedLines] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wordCloud, setWordCloud] = useState<Array<{ word: string; size: number; color: string; x: number; y: number }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Timer
  useEffect(() => {
    if (!round || round.phase === "done") return;
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000)));
    }, 200);
    return () => clearInterval(interval);
  }, [round]);

  // Build word cloud from submissions
  useEffect(() => {
    if (!round?.words?.length) return;
    const maxVotes = Math.max(...round.words.map((w) => w.votes), 1);
    const cloud = round.words.slice(0, 20).map((w, i) => ({
      word: w.word,
      size: 12 + ((w.votes / maxVotes) * 28),
      color: WORD_COLORS[i % WORD_COLORS.length],
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
    }));
    setWordCloud(cloud);
  }, [round?.words]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on("chorus_round_started", (data: ChorusRound) => {
      setRound(data);
      setMyWord("");
      setSubmitted(false);
      setMyVote(null);
      setIsGenerating(false);
      setTimeLeft(Math.ceil((data.endsAt - Date.now()) / 1000));
      setTimeout(() => inputRef.current?.focus(), 100);
    });

    socket.on("chorus_word_added", (data: { words: WordSubmission[] }) => {
      setRound((prev) => prev ? { ...prev, words: data.words } : prev);
    });

    socket.on("chorus_phase_changed", (data: { phase: ChorusRound["phase"]; endsAt: number; words?: WordSubmission[] }) => {
      setRound((prev) =>
        prev ? { ...prev, phase: data.phase, endsAt: data.endsAt, words: data.words || prev.words } : prev
      );
      if (data.phase === "revealing") setIsGenerating(true);
    });

    socket.on("chorus_line_generated", (data: { line: string; allLines: string[] }) => {
      setIsGenerating(false);
      setGeneratedLines(data.allLines);
      setRound((prev) => prev ? { ...prev, result: data.line, phase: "done" } : prev);
    });

    return () => {
      socket.off("chorus_round_started");
      socket.off("chorus_word_added");
      socket.off("chorus_phase_changed");
      socket.off("chorus_line_generated");
    };
  }, [socket]);

  const startRound = useCallback(() => {
    const prompt = ROUND_PROMPTS[Math.floor(Math.random() * ROUND_PROMPTS.length)];
    socket.emit("chorus_start_round", { roomId, prompt, submitDuration: 12000, voteDuration: 8000 });
  }, [socket, roomId]);

  const submitWord = useCallback(() => {
    const word = myWord.trim().split(" ")[0].toLowerCase();
    if (!word || submitted || !round) return;
    setSubmitted(true);
    socket.emit("chorus_submit_word", { roomId, roundId: round.id, word, userName: myName });
  }, [myWord, submitted, round, socket, roomId, myName]);

  const voteWord = useCallback((word: string) => {
    if (myVote || !round) return;
    setMyVote(word);
    socket.emit("chorus_vote_word", { roomId, roundId: round.id, word });
  }, [myVote, round, socket, roomId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submitWord();
  };

  const topWords = round?.words
    ?.sort((a, b) => b.votes - a.votes)
    .slice(0, 8) || [];

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🎼 Crowd Chorus
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Everyone submits a word · AI weaves them into a chorus line
          </p>
        </div>
        <div className="flex items-center gap-3">
          {round && round.phase !== "done" && (
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-black text-lg font-mono
              ${timeLeft <= 3 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-zinc-800 text-zinc-300"}
            `}>
              {timeLeft}
            </div>
          )}
          {isHost && (!round || round.phase === "done") && (
            <button
              onClick={startRound}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600
                         hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-sm 
                         font-bold transition-all active:scale-95"
            >
              🎼 Start Round
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* No round yet */}
        {!round && (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">🎼</div>
            <p className="text-sm text-zinc-400 mb-1">Crowd Chorus is ready</p>
            <p className="text-xs text-zinc-600">
              {isHost ? "Start a round and let everyone contribute a word" : "Waiting for the producer to start a round…"}
            </p>
            {generatedLines.length > 0 && (
              <div className="mt-6 text-left space-y-2">
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Past Chorus Lines</p>
                {generatedLines.map((line, i) => (
                  <div key={i} className="bg-violet-900/20 border border-violet-500/20 rounded-xl px-4 py-3">
                    <p className="text-sm text-violet-200 italic">"{line}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submitting phase */}
        {round?.phase === "submitting" && (
          <div>
            <div className="text-center mb-6">
              <p className="text-lg font-semibold text-white mb-1">{round.prompt}</p>
              <p className="text-xs text-zinc-500">
                {round.words.length} word{round.words.length !== 1 ? "s" : ""} submitted
              </p>
            </div>

            {!submitted ? (
              <div className="flex gap-3 mb-6">
                <input
                  ref={inputRef}
                  type="text"
                  value={myWord}
                  onChange={(e) => setMyWord(e.target.value.split(" ")[0])}
                  onKeyDown={handleKeyDown}
                  maxLength={20}
                  placeholder="your word…"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 
                             text-base focus:outline-none focus:ring-2 focus:ring-violet-500
                             placeholder:text-zinc-600"
                />
                <button
                  onClick={submitWord}
                  disabled={!myWord.trim()}
                  className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40
                             rounded-xl font-semibold transition active:scale-95"
                >
                  Submit
                </button>
              </div>
            ) : (
              <div className="bg-violet-900/20 border border-violet-500/30 rounded-xl p-4 mb-6 text-center">
                <p className="text-violet-300 font-semibold">
                  ✓ You submitted: <span className="text-white">"{myWord}"</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">Waiting for others…</p>
              </div>
            )}

            {/* Live word cloud */}
            {round.words.length > 0 && (
              <div
                className="relative w-full h-32 bg-black/30 rounded-xl border border-white/5 overflow-hidden"
              >
                {wordCloud.map((w, i) => (
                  <span
                    key={i}
                    className="absolute font-bold select-none pointer-events-none"
                    style={{
                      left: `${w.x}%`,
                      top: `${w.y}%`,
                      fontSize: `${w.size}px`,
                      color: w.color,
                      transform: "translate(-50%, -50%)",
                      textShadow: `0 0 10px ${w.color}66`,
                      opacity: 0.85,
                    }}
                  >
                    {w.word}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Voting phase */}
        {round?.phase === "voting" && (
          <div>
            <div className="text-center mb-5">
              <p className="text-sm text-zinc-400">Vote for the word that fits best:</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {topWords.map((w) => (
                <button
                  key={w.word}
                  onClick={() => voteWord(w.word)}
                  disabled={!!myVote}
                  className={`
                    relative py-4 rounded-xl border-2 font-bold text-lg transition-all
                    ${myVote === w.word
                      ? "border-violet-400 bg-violet-500/20 scale-105"
                      : myVote
                      ? "border-white/5 bg-black/20 opacity-50"
                      : "border-white/10 bg-black/30 hover:border-violet-400/50 hover:bg-violet-500/10 active:scale-95"}
                  `}
                >
                  <span className="block text-white">{w.word}</span>
                  {myVote && (
                    <span className="block text-xs text-zinc-500 mt-1 font-normal">
                      {w.votes} vote{w.votes !== 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Revealing / Generating */}
        {(round?.phase === "revealing" || isGenerating) && (
          <div className="text-center py-10">
            <div className="text-4xl mb-4 animate-spin" style={{ display: "inline-block" }}>
              🎵
            </div>
            <p className="text-sm text-zinc-300 mb-1">AI is weaving your words together…</p>
            <p className="text-xs text-zinc-600">
              Top words: {topWords.slice(0, 4).map((w) => w.word).join(", ")}
            </p>
          </div>
        )}

        {/* Result */}
        {round?.phase === "done" && round.result && (
          <div className="text-center py-4">
            <p className="text-xs uppercase tracking-widest text-violet-400 mb-3">
              🎼 Your crowd-written chorus line:
            </p>
            <div className="bg-gradient-to-r from-violet-900/30 to-fuchsia-900/30 
                           border border-violet-500/30 rounded-2xl p-6 mb-4">
              <p className="text-2xl font-bold text-white leading-tight">
                "{round.result}"
              </p>
              <p className="text-xs text-zinc-500 mt-3">
                Built from {round.words.length} words · theme: {theme}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {topWords.slice(0, 6).map((w) => (
                <span
                  key={w.word}
                  className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400"
                >
                  {w.word} ×{w.votes}
                </span>
              ))}
            </div>
            {isHost && (
              <button
                onClick={startRound}
                className="mt-6 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold transition"
              >
                Next Round ↗
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
