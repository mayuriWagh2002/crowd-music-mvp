"use client";

import { useEffect, useState, useCallback } from "react";

interface MemoryCard {
  id: string;
  type: "theme" | "lyric" | "mood" | "crowd_moment";
  content: string;
  subtext?: string;
  emoji: string;
  color: string;
  sessionDate: string;
  roomId: string;
  energy?: number; // 0–100
}

interface ThemeMemoryProps {
  socket: any;
  roomId: string;
  isHost: boolean;
  currentTheme?: string;
  currentLyric?: string;
  vibeScore?: number;
}

const CARD_COLORS = {
  theme:        { bg: "#1e1b4b", border: "#6366f1", text: "#a5b4fc", emoji: "🎵" },
  lyric:        { bg: "#1a1200", border: "#f59e0b", text: "#fde68a", emoji: "✍️" },
  mood:         { bg: "#0c1a0c", border: "#22c55e", text: "#86efac", emoji: "🌡️" },
  crowd_moment: { bg: "#1a0a1a", border: "#ec4899", text: "#f9a8d4", emoji: "👥" },
};

// Seed cards so the deck isn't empty first launch
const SEED_CARDS: MemoryCard[] = [
  {
    id: "seed1", type: "theme", content: "midnight trap",
    subtext: "Dark energy, 808s rolling",
    emoji: "🌙", color: "#6366f1",
    sessionDate: "Yesterday", roomId: "past", energy: 72,
  },
  {
    id: "seed2", type: "lyric", content: "We're chasing lights in a quiet city",
    subtext: "High-voted, Verse 1",
    emoji: "✍️", color: "#f59e0b",
    sessionDate: "2 days ago", roomId: "past", energy: 68,
  },
  {
    id: "seed3", type: "mood", content: "VIBING",
    subtext: "Score: 78/100 · 23 reactions",
    emoji: "🔥", color: "#22c55e",
    sessionDate: "Last session", roomId: "past", energy: 78,
  },
  {
    id: "seed4", type: "crowd_moment", content: "40% voted for the drop",
    subtext: "Build More won the poll",
    emoji: "💥", color: "#ec4899",
    sessionDate: "3 days ago", roomId: "past", energy: 85,
  },
  {
    id: "seed5", type: "theme", content: "jazzy boom bap",
    subtext: "Crowd roulette winner",
    emoji: "🎷", color: "#6366f1",
    sessionDate: "Last week", roomId: "past", energy: 61,
  },
  {
    id: "seed6", type: "lyric", content: "Your silence says what words can't",
    subtext: "Bot fan-favourite",
    emoji: "💬", color: "#f59e0b",
    sessionDate: "Last week", roomId: "past", energy: 55,
  },
];

export default function ThemeMemory({
  socket,
  roomId,
  isHost,
  currentTheme,
  currentLyric,
  vibeScore,
}: ThemeMemoryProps) {
  const [deck, setDeck] = useState<MemoryCard[]>(SEED_CARDS);
  const [drawnCard, setDrawnCard] = useState<MemoryCard | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [filterType, setFilterType] = useState<MemoryCard["type"] | "all">("all");
  const [savedCount, setSavedCount] = useState(0);
  const [showDeck, setShowDeck] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  // Save current session data as a card
  const saveToMemory = useCallback(
    (type: MemoryCard["type"], content: string, subtext?: string, energy?: number) => {
      const cfg = CARD_COLORS[type];
      const card: MemoryCard = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        content,
        subtext,
        emoji: cfg.emoji,
        color: cfg.border,
        sessionDate: "Just now",
        roomId,
        energy,
      };
      setDeck((prev) => [card, ...prev]);
      setSavedCount((c) => c + 1);
      return card;
    },
    [roomId]
  );

  // Auto-save current theme when it changes
  useEffect(() => {
    if (currentTheme) {
      saveToMemory("theme", currentTheme, `Active theme · room ${roomId}`, vibeScore);
    }
  }, [currentTheme]);

  // Auto-save winning lyrics
  useEffect(() => {
    if (!socket) return;
    socket.on("battle_ended", (data: any) => {
      const winner = data.winner === "A" ? data.battle?.entryA : data.battle?.entryB;
      if (winner?.text) {
        saveToMemory("lyric", winner.text, `Battle winner · by ${winner.author}`, 90);
      }
    });
    socket.on("mood_ring_update", (data: { mood: string; score: number }) => {
      if (data.score > 75) {
        saveToMemory(
          "mood",
          data.mood,
          `Score ${data.score}/100 · peak vibe`,
          data.score
        );
      }
    });
    return () => {
      socket.off("battle_ended");
      socket.off("mood_ring_update");
    };
  }, [socket, saveToMemory]);

  const drawCard = useCallback(() => {
    const filtered = filterType === "all" ? deck : deck.filter((c) => c.type === filterType);
    if (filtered.length === 0) return;

    setIsDrawing(true);
    setDrawnCard(null);

    // Animated draw delay
    setTimeout(() => {
      const card = filtered[Math.floor(Math.random() * filtered.length)];
      setDrawnCard(card);
      setIsDrawing(false);
    }, 600);
  }, [deck, filterType]);

  const applyCard = (card: MemoryCard) => {
    if (!socket || !isHost) return;

    if (card.type === "theme") {
      socket.emit("host_set_theme", { roomId, theme: card.content });
      setApplyFeedback(`Theme changed to "${card.content}"`);
    } else if (card.type === "lyric") {
      socket.emit("submit_lyric_suggestion", {
        roomId,
        suggestion: card.content,
        userName: "Theme Memory",
      });
      setApplyFeedback(`Lyric suggestion submitted`);
    } else {
      setApplyFeedback(`Inspiration noted!`);
    }

    setTimeout(() => setApplyFeedback(null), 2500);
  };

  const filteredDeck = filterType === "all" ? deck : deck.filter((c) => c.type === filterType);

  const typeCount = (type: MemoryCard["type"]) => deck.filter((c) => c.type === type).length;

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🃏 Theme Memory
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {deck.length} cards from past sessions · draw for inspiration
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedCount > 0 && (
            <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-lg">
              +{savedCount} saved
            </span>
          )}
          <button
            onClick={() => setShowDeck(!showDeck)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition"
          >
            {showDeck ? "Hide Deck" : "View Deck"}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(["all", "theme", "lyric", "mood", "crowd_moment"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterType === type
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {type === "all"
                ? `All (${deck.length})`
                : `${CARD_COLORS[type].emoji} ${type.replace("_", " ")} (${typeCount(type)})`}
            </button>
          ))}
        </div>

        {/* Drawn card */}
        <div className="relative mb-5">
          {isDrawing ? (
            <div
              className="w-full rounded-2xl border-2 border-white/10 p-6 h-44
                         flex items-center justify-center animate-pulse"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              <div className="text-3xl animate-spin">🃏</div>
            </div>
          ) : drawnCard ? (
            <div
              className="w-full rounded-2xl border-2 p-6 transition-all"
              style={{
                background: CARD_COLORS[drawnCard.type].bg,
                borderColor: drawnCard.color,
                boxShadow: `0 0 30px ${drawnCard.color}22`,
              }}
            >
              {/* Card type badge */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs uppercase tracking-widest font-bold px-2 py-1 rounded"
                  style={{
                    color: CARD_COLORS[drawnCard.type].text,
                    background: `${drawnCard.color}22`,
                  }}
                >
                  {drawnCard.emoji} {drawnCard.type.replace("_", " ")}
                </span>
                {drawnCard.energy !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${drawnCard.energy}%`,
                          background: drawnCard.color,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-mono"
                      style={{ color: CARD_COLORS[drawnCard.type].text }}
                    >
                      {drawnCard.energy}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <p
                className="text-xl font-bold leading-tight mb-2"
                style={{ color: CARD_COLORS[drawnCard.type].text }}
              >
                "{drawnCard.content}"
              </p>
              {drawnCard.subtext && (
                <p className="text-xs text-zinc-500 mb-1">{drawnCard.subtext}</p>
              )}
              <p className="text-xs text-zinc-600">{drawnCard.sessionDate}</p>

              {/* Apply button */}
              {isHost && (drawnCard.type === "theme" || drawnCard.type === "lyric") && (
                <button
                  onClick={() => applyCard(drawnCard)}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: `${drawnCard.color}33`,
                    color: CARD_COLORS[drawnCard.type].text,
                    border: `1px solid ${drawnCard.color}44`,
                  }}
                >
                  {drawnCard.type === "theme" ? "Apply Theme →" : "Submit as Lyric Suggestion →"}
                </button>
              )}
            </div>
          ) : (
            <div
              className="w-full rounded-2xl border-2 border-dashed border-white/10 p-6 h-44
                         flex flex-col items-center justify-center text-center"
            >
              <div className="text-3xl mb-2">🃏</div>
              <p className="text-sm text-zinc-400">Draw a card for inspiration</p>
              <p className="text-xs text-zinc-600 mt-1">
                {filteredDeck.length} card{filteredDeck.length !== 1 ? "s" : ""} in the filtered deck
              </p>
            </div>
          )}

          {/* Apply feedback toast */}
          {applyFeedback && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-zinc-800 
                           border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white
                           whitespace-nowrap shadow-lg">
              ✓ {applyFeedback}
            </div>
          )}
        </div>

        {/* Draw button */}
        <button
          onClick={drawCard}
          disabled={filteredDeck.length === 0}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600
                     hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40
                     rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
        >
          🃏 Draw Card
        </button>

        {/* Deck view */}
        {showDeck && (
          <div className="mt-5 space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
              Full Deck ({filteredDeck.length})
            </p>
            {filteredDeck.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 bg-black/30 rounded-lg px-3 py-2.5
                           border border-white/5 hover:border-white/10 transition cursor-pointer"
                onClick={() => setDrawnCard(card)}
              >
                <span className="text-lg">{card.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">"{card.content}"</p>
                  <p className="text-[10px] text-zinc-600">{card.sessionDate}</p>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    color: CARD_COLORS[card.type].text,
                    background: `${CARD_COLORS[card.type].border}22`,
                  }}
                >
                  {card.type.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
