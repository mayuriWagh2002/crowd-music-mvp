"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const socket = useMemo(() => io({ path: "/api/socketio" }), []);

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [line, setLine] = useState("");
  const [myId, setMyId] = useState<string>("");


const shareRoom = async () => {
  const url = `${window.location.origin}/room/${roomId}`;
  await navigator.clipboard.writeText(url);
  alert("🔗 Room link copied!");
};



  const [state, setState] = useState<any>({
    users: [],
    submissions: [],
    phase: "submit",
    timeLeft: 30,
    round: 1,
    song: [],
    aiSuggestions: [],
    hostId: null,
    paused: false,
    theme: "lofi heartbreak",
    lastWinner: null,
  });

useEffect(() => {
  const onRoomState = (data: any) => setState(data);
 const onConnect = () => setMyId(socket.id ?? "");


  socket.on("room_state", onRoomState);
  socket.on("connect", onConnect);

  return () => {
    socket.off("room_state", onRoomState);
    socket.off("connect", onConnect);
    socket.disconnect(); // IMPORTANT: no return value
  };
}, [socket]);



  /* 🎨 Phase-based background */
 const bg =
  state.phase === "submit"
    ? "from-rose-600 via-amber-500/30 to-black"
    : state.phase === "vote"
    ? "from-fuchsia-600 via-violet-600/30 to-black"
    : "from-cyan-500 via-teal-500/30 to-black";

    const phaseTotalTime =
  state.phase === "submit"
    ? 30
    : state.phase === "vote"
    ? 15
    : 10;

const progressPercent = Math.max(
  0,
  Math.min(100, (state.timeLeft / phaseTotalTime) * 100)
);


  const phaseLabel =
    state.phase === "submit"
      ? "✍ SUBMIT"
      : state.phase === "vote"
      ? "⭐ VOTE"
      : "🤖 AI PICK";

  const isHost = myId && state.hostId === myId;

  const fullSongText = state.song.join("\n");

const copySong = async () => {
  if (!fullSongText) return;
  await navigator.clipboard.writeText(fullSongText);
  alert("🎵 Song copied to clipboard!");
};

const downloadSong = () => {
  if (!fullSongText) return;
  const blob = new Blob([fullSongText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `crowd-song-${roomId}.txt`;
  a.click();

  URL.revokeObjectURL(url);
};


  /* ================= JOIN SCREEN ================= */
  if (!joined) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center text-white transition-colors duration-700`}
      >
        <div className="bg-gray-900/80 backdrop-blur p-8 rounded-2xl w-full max-w-md shadow-xl border border-white/10">
          <h1 className="text-2xl font-bold mb-2">🎵 Join the Crowd</h1>
          <p className="text-gray-400 mb-6">
            Room ID: <span className="font-semibold">{roomId}</span>
          </p>

          <input
            className="w-full p-3 rounded-lg bg-black border border-gray-700 mb-4"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-semibold"
            onClick={() => {
              socket.emit("join_room", { roomId, name });
              setJoined(true);
            }}
          >
            Enter Session 🚀
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN ROOM ================= */
  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${bg} text-white p-6 transition-colors duration-700`}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
  <div>
    <h1 className="text-3xl font-bold">🎶 Crowd Music Session</h1>
    <p className="text-gray-400">
      Room <span className="font-semibold">{roomId}</span> •{" "}
      {state.users.length} people • Theme:{" "}
      <span className="font-semibold">{state.theme}</span>
    </p>
  </div>

  <button
    onClick={shareRoom}
    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
  >
    🔗 Share Room
  </button>
</div>

      </div>

      {/* Host Controls */}
      {isHost && (
        <div className="mb-6 bg-black/50 backdrop-blur-md backdrop-blur rounded-xl p-4 flex flex-wrap gap-3 justify-between border border-white/10">
          <div className="font-semibold">🎛 Conductor Mode</div>

          <div className="flex gap-2 flex-wrap">
            <select
              className="bg-black border border-gray-700 rounded-lg px-3 py-2"
              value={state.theme}
              onChange={(e) =>
                socket.emit("host_set_theme", { roomId, theme: e.target.value })
              }
            >
              <option>lofi heartbreak</option>
              <option>happy pop</option>
              <option>rap battle</option>
              <option>romantic</option>
              <option>motivational</option>
            </select>

            <button
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700"
              onClick={() => socket.emit("host_pause_toggle", { roomId })}
            >
              {state.paused ? "▶ Resume" : "⏸ Pause"}
            </button>

            <button
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700"
              onClick={() => socket.emit("host_reset_room", { roomId })}
            >
              ♻ Reset
            </button>
          </div>
        </div>
      )}

      {/* Phase + Timer + Progress */}
<div className="mb-6 bg-black/50 backdrop-blur-md rounded-2xl p-5 border border-white/10">
  <div className="flex items-center justify-between mb-3">
    <div>
      <div className="text-xs text-gray-400">Round</div>
      <div className="text-xl font-bold">{state.round}</div>
    </div>

    <div className="text-center">
      <div className="text-xs text-gray-400">Phase</div>
      <div className="text-2xl font-bold">{phaseLabel}</div>
    </div>

    <div className="text-right">
      <div className="text-xs text-gray-400">Time Left</div>
      <div className="text-xl font-bold">{state.timeLeft}s</div>
    </div>
  </div>

  {/* Progress Bar */}
  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
    <div
      className={`h-full transition-all duration-1000 ease-linear
        ${
          state.phase === "submit"
            ? "bg-gradient-to-r from-rose-500 to-amber-400"
            : state.phase === "vote"
            ? "bg-gradient-to-r from-fuchsia-500 to-violet-500"
            : "bg-gradient-to-r from-cyan-400 to-teal-400"
        }
      `}
      style={{ width: `${progressPercent}%` }}
    />
  </div>
  <p className="text-xs text-gray-400 mt-2 text-center">
  {state.phase === "submit"
    ? "Drop your best line before time runs out"
    : state.phase === "vote"
    ? "Vote wisely — the crowd decides"
    : "Pick the best AI remix"}
</p>

</div>


      {/* 🏆 Winner Celebration */}
      {state.lastWinner && (
        <div className="mb-6 p-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.25)] animate-[winnerPop_0.6s_ease-out]">
          <div className="font-bold text-lg">
            🏆 Round {state.lastWinner.round} Complete
          </div>
          <div className="mt-2 text-lg">
  Winning line: “{state.lastWinner.text}”
</div>
<div className="text-xs text-gray-300 mt-2">
  This line has been added to the song timeline.
</div>
        </div>
      )}

      {/* 🎼 Song Timeline */}
      <div className="mb-6 bg-black/50 backdrop-blur-md backdrop-blur rounded-2xl p-5 border border-white/10">
        <h2 className="font-semibold mb-4">🎼 Song Timeline</h2>

        {state.song.length === 0 ? (
          <p className="text-gray-400">No winning lines yet.</p>
        ) : (
          <div className="space-y-3">
            {state.song.map((lineText: string, idx: number) => (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-white rounded-full mt-1" />
                  {idx !== state.song.length - 1 && (
                    <div className="w-px h-10 bg-white/20 mt-2" />
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-400">Round {idx + 1}</div>
                  <div className="text-lg">{lineText}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🎵 Export Song */}
<div className="mb-6 bg-black/50 backdrop-blur-md rounded-2xl p-5 border border-white/10">
  <h2 className="font-semibold mb-3">🎵 Export Song</h2>

  {state.song.length === 0 ? (
    <p className="text-gray-400">No song to export yet.</p>
  ) : (
    <div className="flex gap-3 flex-wrap">
      <button
        onClick={copySong}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 hover:opacity-90"
      >
        📋 Copy Lyrics
      </button>

      <button
        onClick={downloadSong}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 hover:opacity-90"
      >
        ⬇ Download .txt
      </button>
    </div>
  )}
</div>


      {/* 🎧 The Crowd */}
<div className="mb-6 bg-black/50 backdrop-blur-md rounded-2xl p-5 border border-white/10">
  <div className="flex items-center justify-between mb-3">
    <h2 className="font-semibold text-lg">🎧 The Crowd</h2>
    <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
      {state.users.length} online
    </span>
  </div>


  {state.users.length === 0 ? (
    <p className="text-gray-400">Waiting for people to join…</p>
  ) : (
    <ul className="space-y-2">
      {state.users.map((u: any) => (
        <li
          key={u.id}
          className="flex items-center justify-between bg-black/60 px-4 py-2 rounded-xl"
        >
          <span className="font-medium">{u.name}</span>

          {state.hostId === u.id && (
            <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-2 py-1 rounded-full font-semibold">
              HOST
            </span>
          )}
        </li>
      ))}
    </ul>
  )}
</div>


      {/* ✍ Drop a Line */}
      <div className="bg-black/50 backdrop-blur-md backdrop-blur rounded-xl p-4 border border-white/10">
        <h2 className="font-semibold mb-3">✍ Drop a Line</h2>
        <div className="flex gap-3">
          <input
            disabled={state.phase !== "submit"}
            className="flex-1 p-3 rounded-lg bg-black border border-gray-700 disabled:opacity-50"
            placeholder="Write one line…"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          />
          <button
            disabled={state.phase !== "submit"}
            className="px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            onClick={() => {
              socket.emit("submit_line", { roomId, text: line });
              setLine("");
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* ⭐ Voting */}
      <div className="mt-8 bg-black/50 backdrop-blur-md backdrop-blur rounded-xl p-6 border border-white/10">
        <h2 className="font-semibold mb-4">⭐ Pick the Winner</h2>

        {state.submissions.map((s: any) => (
          <button
            key={s.id}
            disabled={state.phase !== "vote"}
            onClick={() => socket.emit("vote", { roomId, submissionId: s.id })}
            className="w-full mt-2 bg-black/60 hover:bg-black p-4 rounded-xl flex justify-between disabled:opacity-50"
          >
            <span>{s.text}</span>
            <span>⭐ {s.votes}</span>
          </button>
        ))}
      </div>

      {/* 🤖 AI Remix */}
      {state.phase === "ai" && (
        <div className="mt-8 bg-black/50 backdrop-blur-md backdrop-blur rounded-xl p-6 border border-white/10">
          <h2 className="font-semibold mb-4">🤖 Crowd + AI Remix</h2>

          {state.aiSuggestions.map((s: any) => (
            <button
              key={s.id}
              onClick={() =>
                socket.emit("vote_ai", { roomId, suggestionId: s.id })
              }
              className="w-full mt-2 bg-black/60 hover:bg-black p-4 rounded-xl flex justify-between"
            >
              <span>{s.text}</span>
              <span>⭐ {s.votes}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
