"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  userId: string;
  userName: string;
  wins: number;
  submissions: number;
}

interface LeaderboardProps {
  roomId: string;
  socket: any;
  myId?: string;
}

const RANK_ICONS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export default function Leaderboard({ roomId, socket, myId }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"wins" | "submissions">("wins");
  const [newWinner, setNewWinner] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/leaderboard/${roomId}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    // Server can emit leaderboard_update when a round ends
    socket.on("leaderboard_update", (data: { leaderboard: LeaderboardEntry[]; newWinner?: string }) => {
      setEntries(data.leaderboard);
      if (data.newWinner) {
        setNewWinner(data.newWinner);
        setTimeout(() => setNewWinner(null), 4000);
      }
    });

    return () => socket.off("leaderboard_update");
  }, [socket]);

  const sorted = [...entries].sort((a, b) =>
    tab === "wins" ? b.wins - a.wins : b.submissions - a.submissions
  );

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🏆 Leaderboard
          </h3>
          <p className="text-xs text-zinc-400">Top lyric contributors this session</p>
        </div>

        <div className="flex bg-black/30 rounded-lg p-0.5 gap-0.5 border border-white/5">
          {(["wins", "submissions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-xs transition capitalize ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* New winner toast */}
      {newWinner && (
        <div className="mb-3 bg-yellow-500/20 border border-yellow-400/40 rounded-xl p-3 
                        text-center animate-bounce">
          <p className="text-sm font-semibold text-yellow-300">
            🎉 New winner: {newWinner}!
          </p>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="text-center py-6 text-zinc-500 text-sm">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">🎤</div>
          <p className="text-sm text-zinc-500">No contributions yet</p>
          <p className="text-xs text-zinc-600 mt-1">Submit lyrics to appear here!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.slice(0, 8).map((entry, i) => {
            const isMe = entry.userId === myId;
            const value = tab === "wins" ? entry.wins : entry.submissions;

            return (
              <div
                key={entry.userId}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition
                  ${isMe
                    ? "bg-indigo-900/30 border border-indigo-500/40"
                    : "bg-black/20 border border-white/5 hover:bg-black/30"
                  }
                  ${i === 0 ? "ring-1 ring-yellow-400/30" : ""}
                `}
              >
                <span className="text-lg w-7 text-center flex-shrink-0">
                  {RANK_ICONS[i] || `${i + 1}`}
                </span>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${
                    isMe ? "text-indigo-300" : "text-white"
                  }`}>
                    {entry.userName}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-indigo-400 font-normal">(you)</span>
                    )}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`text-lg font-black font-mono ${
                    i === 0 ? "text-yellow-400" :
                    i === 1 ? "text-zinc-300" :
                    i === 2 ? "text-amber-600" :
                    "text-zinc-400"
                  }`}>
                    {value}
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    {tab === "wins" ? "wins" : "lines"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 text-xs text-zinc-500 text-center">
        Leaderboard resets each session
      </div>
    </div>
  );
}
