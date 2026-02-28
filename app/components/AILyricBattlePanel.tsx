"use client";

import { useEffect, useState, useCallback } from "react";

interface BattleEntry {
  id: string;
  text: string;
  author: string;
  votes: number;
}

interface BattleState {
  id: string;
  entryA: BattleEntry;
  entryB: BattleEntry;
  totalVotes: number;
  endsAt: number;
  winner?: "A" | "B" | null;
}

interface Props {
  socket: any;
  roomId: string;
  isHost: boolean;
  submissions?: BattleEntry[];
}

export default function AILyricBattlePanel({ socket, roomId, isHost, submissions = [] }: Props) {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [myVote, setMyVote] = useState<"A" | "B" | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [winnerHistory, setWinnerHistory] = useState<Array<{ text: string; author: string; round: number }>>([]);
  const [roundCount, setRoundCount] = useState(0);
  const [entries, setEntries] = useState<BattleEntry[]>([]);
  const [myEntry, setMyEntry] = useState("");
  const [entrySent, setEntrySent] = useState(false);
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);
  const [lastWinnerMsg, setLastWinnerMsg] = useState<string | null>(null);

  // Merge server entries + prop submissions, deduplicate
  useEffect(() => {
    if (submissions.length > 0) {
      setEntries(prev => {
        const ids = new Set(prev.map(e => e.id));
        const newOnes = submissions.filter(s => !ids.has(s.id));
        return newOnes.length ? [...prev, ...newOnes] : prev;
      });
    }
  }, [submissions]);

  useEffect(() => {
    if (!socket) return;

    socket.on("battle_started", (data: BattleState) => {
      setBattle(data);
      setMyVote(null);
      setLastWinnerMsg(null);
      setTimeLeft(Math.ceil((data.endsAt - Date.now()) / 1000));
    });

    socket.on("battle_vote_update", (data: { entryAVotes: number; entryBVotes: number; totalVotes: number }) => {
      setBattle(prev => prev ? {
        ...prev,
        entryA: { ...prev.entryA, votes: data.entryAVotes },
        entryB: { ...prev.entryB, votes: data.entryBVotes },
        totalVotes: data.totalVotes,
      } : prev);
    });

    socket.on("battle_ended", (data: { winner: "A" | "B"; battle: BattleState }) => {
      const w = data.winner === "A" ? data.battle.entryA : data.battle.entryB;
      setBattle(prev => prev ? { ...prev, winner: data.winner } : prev);
      setRoundCount(r => r + 1);
      setWinnerHistory(prev => [
        { text: w.text, author: w.author, round: roundCount + 1 },
        ...prev.slice(0, 4)
      ]);
      setLastWinnerMsg(`"${w.text}" — by ${w.author}`);
      // Clear battle after 4 seconds
      setTimeout(() => {
        setBattle(null);
      }, 4000);
    });

    socket.on("battle_entries_updated", (updatedEntries: BattleEntry[]) => {
      setEntries(updatedEntries);
    });

    return () => {
      socket.off("battle_started");
      socket.off("battle_vote_update");
      socket.off("battle_ended");
      socket.off("battle_entries_updated");
    };
  }, [socket, roundCount]);

  // Countdown timer
  useEffect(() => {
    if (!battle || battle.winner) return;
    const iv = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((battle.endsAt - Date.now()) / 1000)));
    }, 200);
    return () => clearInterval(iv);
  }, [battle]);

  const submitEntry = () => {
    if (!myEntry.trim()) return;
    socket.emit("battle_submit_entry", { roomId, text: myEntry.trim() });
    setMyEntry("");
    setEntrySent(true);
    setTimeout(() => setEntrySent(false), 3000);
  };

  const startRandomBattle = useCallback(() => {
    if (entries.length < 2) return;
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    socket.emit("battle_start", {
      roomId, entryA: shuffled[0], entryB: shuffled[1], duration: 15000,
    });
  }, [socket, roomId, entries]);

  const startPickedBattle = () => {
    const a = entries.find(e => e.id === pickedA);
    const b = entries.find(e => e.id === pickedB);
    if (!a || !b || a.id === b.id) return;
    socket.emit("battle_start", { roomId, entryA: a, entryB: b, duration: 15000 });
    setPickedA(null);
    setPickedB(null);
  };

  const castVote = (side: "A" | "B") => {
    if (myVote || !battle || battle.winner) return;
    setMyVote(side);
    socket.emit("battle_vote", { roomId, battleId: battle.id, side });
  };

  const pct = (v: number, t: number) => t > 0 ? Math.round((v / t) * 100) : 50;
  const pctA = battle ? pct(battle.entryA.votes, battle.totalVotes) : 50;
  const pctB = battle ? pct(battle.entryB.votes, battle.totalVotes) : 50;

  return (
    <div className="bg-zinc-900/90 border border-white/10 rounded-2xl overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              ⚔️ Lyric Battle
              {battle && !battle.winner && (
                <span className={`text-sm font-black font-mono w-8 h-8 flex items-center justify-center rounded-full
                  ${timeLeft <= 3 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-zinc-800 text-white"}`}>
                  {timeLeft}
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {battle
                ? battle.winner
                  ? "Battle over — winner crowned!"
                  : "Vote now! Best lyric wins and gets added to the song."
                : isHost
                  ? "Collect lyric lines below, then start a battle. Winner goes into the song."
                  : "Submit a lyric line. Producer picks two to battle. Crowd votes. Winner goes into the song."}
            </p>
          </div>

          {/* Host quick-start random battle */}
          {isHost && !battle && entries.length >= 2 && (
            <button onClick={startRandomBattle}
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600
                         hover:from-orange-500 hover:to-red-500 rounded-xl text-sm font-bold transition active:scale-95">
              🎲 Random Battle
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── WINNER FLASH ──────────────────────────────────────────────── */}
        {lastWinnerMsg && !battle && (
          <div className="bg-yellow-950/40 border border-yellow-500/30 rounded-xl p-4 text-center">
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide mb-1">👑 Battle Winner — Added to Song!</p>
            <p className="text-white text-sm italic">{lastWinnerMsg}</p>
          </div>
        )}

        {/* ── ACTIVE BATTLE ─────────────────────────────────────────────── */}
        {battle && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400 font-bold w-8 text-right">{pctA}%</span>
              <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-blue-500 transition-all duration-500 rounded-full" style={{ width: `${pctA}%` }} />
                <div className="h-full bg-orange-500 transition-all duration-500 flex-1 rounded-full" />
              </div>
              <span className="text-xs text-orange-400 font-bold w-8">{pctB}%</span>
            </div>

            {/* Two entries side by side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Entry A */}
              <button onClick={() => castVote("A")}
                disabled={!!myVote || !!battle.winner}
                className={`relative p-4 rounded-2xl border-2 text-left transition-all
                  ${battle.winner === "A" ? "border-yellow-400 bg-yellow-400/10 scale-[1.02]"
                    : myVote === "A" ? "border-blue-500 bg-blue-500/15 scale-[1.01]"
                    : !myVote && !battle.winner ? "border-blue-500/40 bg-blue-500/8 hover:border-blue-400 hover:scale-[1.01] cursor-pointer"
                    : "border-white/5 bg-zinc-800/40 opacity-50 cursor-default"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Side A</span>
                  {battle.winner === "A" && <span className="text-base">👑</span>}
                  {myVote === "A" && !battle.winner && <span className="text-[10px] text-blue-400">✓ your vote</span>}
                </div>
                <p className="text-sm leading-relaxed text-white mb-2">"{battle.entryA.text}"</p>
                <p className="text-[10px] text-zinc-500">— {battle.entryA.author}</p>
                {!myVote && !battle.winner && (
                  <div className="mt-2 text-xs text-blue-400 font-semibold">Tap to vote →</div>
                )}
              </button>

              {/* Entry B */}
              <button onClick={() => castVote("B")}
                disabled={!!myVote || !!battle.winner}
                className={`relative p-4 rounded-2xl border-2 text-left transition-all
                  ${battle.winner === "B" ? "border-yellow-400 bg-yellow-400/10 scale-[1.02]"
                    : myVote === "B" ? "border-orange-500 bg-orange-500/15 scale-[1.01]"
                    : !myVote && !battle.winner ? "border-orange-500/40 bg-orange-500/8 hover:border-orange-400 hover:scale-[1.01] cursor-pointer"
                    : "border-white/5 bg-zinc-800/40 opacity-50 cursor-default"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Side B</span>
                  {battle.winner === "B" && <span className="text-base">👑</span>}
                  {myVote === "B" && !battle.winner && <span className="text-[10px] text-orange-400">✓ your vote</span>}
                </div>
                <p className="text-sm leading-relaxed text-white mb-2">"{battle.entryB.text}"</p>
                <p className="text-[10px] text-zinc-500">— {battle.entryB.author}</p>
                {!myVote && !battle.winner && (
                  <div className="mt-2 text-xs text-orange-400 font-semibold">Tap to vote →</div>
                )}
              </button>
            </div>

            {/* Status line */}
            <p className="text-center text-xs text-zinc-500">
              {battle.winner
                ? `Side ${battle.winner} wins with ${battle.totalVotes} total votes — lyric added to song ✓`
                : myVote
                  ? `✓ Voted · ${battle.totalVotes} vote${battle.totalVotes !== 1 ? "s" : ""} so far`
                  : `${battle.totalVotes} vote${battle.totalVotes !== 1 ? "s" : ""} so far — tap a side to vote`}
            </p>
          </div>
        )}

        {/* ── NO ACTIVE BATTLE ──────────────────────────────────────────── */}
        {!battle && (
          <>
            {/* Step indicator */}
            <div className="flex items-start gap-3 text-xs text-zinc-500 bg-black/20 rounded-xl p-3 border border-white/5">
              <div className="flex gap-2 flex-wrap">
                <span className="text-zinc-400">① Everyone submits lyric lines below</span>
                <span>→</span>
                <span className="text-zinc-400">
                  {isHost ? "② You pick two to battle (or hit Random)" : "② Producer picks two lines to battle"}
                </span>
                <span>→</span>
                <span className="text-zinc-400">③ Crowd votes for 15 seconds</span>
                <span>→</span>
                <span className="text-zinc-400">④ Winner gets added to the song</span>
              </div>
            </div>

            {/* Submit input */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
                ✍️ {isHost ? "Add a line to the pool" : "Submit your lyric line"}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={myEntry}
                  onChange={e => setMyEntry(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitEntry()}
                  placeholder="Write one lyric line..."
                  maxLength={120}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5
                             text-sm focus:outline-none focus:ring-2 focus:ring-orange-500
                             placeholder:text-zinc-600 text-white"
                />
                <button onClick={submitEntry} disabled={!myEntry.trim()}
                  className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40
                             rounded-xl text-sm font-bold transition active:scale-95">
                  Add
                </button>
              </div>
              {entrySent && (
                <p className="text-xs text-emerald-400 mt-1.5">
                  ✓ Your line is in the pool! {isHost ? "Now pick two and start the battle." : "Wait for the producer to start the battle."}
                </p>
              )}
            </div>

            {/* Entry pool */}
            {entries.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                <div className="text-3xl mb-2">✍️</div>
                <p className="text-sm">No lines yet</p>
                <p className="text-xs mt-1 text-zinc-700">Type a lyric line above and hit Add to fill the pool</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Battle Pool — {entries.length} line{entries.length !== 1 ? "s" : ""}
                  </p>
                  {isHost && entries.length >= 2 && (
                    <p className="text-xs text-orange-400">
                      {pickedA && pickedB ? "Ready — click Battle!" : "Pick A and B to battle"}
                    </p>
                  )}
                  {!isHost && entries.length >= 2 && (
                    <p className="text-xs text-zinc-600">Waiting for producer to start...</p>
                  )}
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {entries.map(e => (
                    <div key={e.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition
                        ${pickedA === e.id ? "border-blue-500 bg-blue-500/10"
                          : pickedB === e.id ? "border-orange-500 bg-orange-500/10"
                          : "border-white/5 bg-black/30"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200">"{e.text}"</p>
                        <p className="text-xs text-zinc-600 mt-0.5">— {e.author}</p>
                      </div>
                      {isHost && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setPickedA(pickedA === e.id ? null : e.id)}
                            title="Set as Side A"
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition
                              ${pickedA === e.id ? "bg-blue-600 text-white" : "bg-zinc-800 text-blue-400 hover:bg-zinc-700"}`}>
                            A
                          </button>
                          <button
                            onClick={() => setPickedB(pickedB === e.id ? null : e.id)}
                            title="Set as Side B"
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition
                              ${pickedB === e.id ? "bg-orange-600 text-white" : "bg-zinc-800 text-orange-400 hover:bg-zinc-700"}`}>
                            B
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Host: start picked battle */}
                {isHost && pickedA && pickedB && pickedA !== pickedB && (
                  <button onClick={startPickedBattle}
                    className="w-full mt-3 py-3 bg-gradient-to-r from-blue-600 to-orange-600
                               hover:from-blue-500 hover:to-orange-500 rounded-xl font-bold text-sm transition active:scale-95">
                    ⚔️ Start Battle: A vs B
                  </button>
                )}

                {entries.length === 1 && (
                  <p className="text-xs text-center text-zinc-600 mt-2">
                    Need at least 2 lines to start a battle
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── WINNER HISTORY ────────────────────────────────────────────── */}
        {winnerHistory.length > 0 && (
          <div className="border-t border-white/5 pt-4">
            <p className="text-xs text-zinc-600 uppercase tracking-wide mb-2">
              Past Winners — added to song
            </p>
            <div className="space-y-1.5">
              {winnerHistory.map((w, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs">
                  <span className="text-yellow-500 flex-shrink-0">👑</span>
                  <span className="text-zinc-300 italic">"{w.text}"</span>
                  <span className="text-zinc-600 flex-shrink-0">— {w.author}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
