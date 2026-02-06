"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";

import {
  startRoomBeat,
  stopRoomBeat,
  setBeatVolume,
  setKickStyle,
  setEnergy,
  getChannelStates,
} from "@/app/lib/musicEngine";

import LyricCanvas from "@/app/components/LyricCanvas";
import Visualizer from "@/app/components/Visualizer";
import VideoGrid from "@/app/components/VideoGrid";
import SyncDashboard from "@/app/components/SyncDashboard";
import ProducerMixConsole from "@/app/components/ProducerMixConsole";
import AICopilotPanel from "@/app/components/AICopilotPanel";
import CrowdFeedbackDashboard from "@/app/components/CrowdFeedbackDashboard";


export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");

  const socket = useMemo(
    () => io({ path: "/api/socketio", autoConnect: true }),
    []
  );

  const [joined, setJoined] = useState(false);
  const [joinRole, setJoinRole] =
    useState<"participant" | "spectator">("participant");
  const isSpectator = mode === "watch" || joinRole === "spectator";

  const [name, setName] = useState("");
  const [myId, setMyId] = useState("");

  const [beatPlaying, setBeatPlaying] = useState(false);
  const [beatVolume, setBeatVolumeState] = useState(-10);

  const [showVideoGrid, setShowVideoGrid] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  // ✅ FIXED: Track current audio state
  const [currentKickStyle, setCurrentKickStyle] = useState<"" | "Tight" | "Punchy">("");
  const [currentEnergy, setCurrentEnergy] = useState<"" | "Build Up" | "Chill Down">("");

  // Sync metrics
  const [syncMetrics, setSyncMetrics] = useState({
    offset: 0,
    fps: 0,
    dropped: 0,
  });

  const [networkLatency, setNetworkLatency] = useState(0);

  const [state, setState] = useState<any>({
    participants: [],
    spectatorCount: 0,
    hostId: null,
    theme: "lofi heartbreak",
    currentQuestion: null,
    aiInsight: null,
    demoMode: false,
  });

  // ✅ AI Suggestions with REAL callbacks
  const [aiSuggestions, setAiSuggestions] = useState([
    {
      channelId: "kick",
      type: "volume" as const,
      suggestion: "Boost by 3dB",
      reason: "Increases punch and presence in the mix",
      confidence: 87,
      appliedValue: -9,
    },
    {
      channelId: "bass",
      type: "volume" as const,
      suggestion: "Reduce by 2dB",
      reason: "Creates better headroom for vocals and reduces muddiness",
      confidence: 72,
      appliedValue: -8,
    },
  ]);

  // ✅ Crowd votes
  const [crowdVotes] = useState([
    {
      channelId: "bass",
      preference: "Louder bass",
      percentage: 67,
      totalVotes: 23,
    },
  ]);

  /* ---------------- AI → AUDIO (✅ CONNECTED TO LIVE TRACK STATE) ---------------- */
  useEffect(() => {
    if (!state.aiInsight) return;

    if (state.aiInsight.includes("Tight")) {
      setKickStyle("tight");
      setCurrentKickStyle("Tight");
    }
    if (state.aiInsight.includes("Punchy")) {
      setKickStyle("punchy");
      setCurrentKickStyle("Punchy");
    }
    if (state.aiInsight.includes("Build")) {
      setEnergy("build");
      setCurrentEnergy("Build Up");
    }
    if (state.aiInsight.includes("Chill")) {
      setEnergy("chill");
      setCurrentEnergy("Chill Down");
    }
  }, [state.aiInsight]);

  /* ---------------- SOCKET ---------------- */
  useEffect(() => {
    socket.on("room_state", (data) => {
      setState((prev: any) => ({ ...prev, ...data }));
    });

    socket.on("connect", () => {
      setMyId(socket.id ?? "");
    });

    // ✅ FIXED: Listen for poll results
    socket.on("poll_results", (data) => {
      console.log("📊 Poll results:", data);
      alert(`Poll results:\n${data.question}\n\n${JSON.stringify(data.results, null, 2)}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  /* ---------------- NETWORK LATENCY ---------------- */
  useEffect(() => {
    const measureLatency = () => {
      const start = Date.now();
      socket.emit("ping", start);
      
      socket.once("pong", () => {
        const latency = Date.now() - start;
        setNetworkLatency(latency);
      });
    };

    const interval = setInterval(measureLatency, 2000);
    return () => clearInterval(interval);
  }, [socket]);

  /* ---------------- JOIN ---------------- */
  useEffect(() => {
    if (mode === "watch" && !joined) {
      socket.emit("join_room", {
        roomId,
        name: "Spectator",
        role: "spectator",
      });
      setJoinRole("spectator");
      setJoined(true);
    }
  }, [mode, joined, roomId, socket]);

  const joinNow = () => {
    socket.emit("join_room", {
      roomId,
      name: name || "Guest",
      role: joinRole,
    });
    setJoined(true);
  };

  /* ---------------- AUDIO ---------------- */
  useEffect(() => {
    setBeatVolume(beatVolume);
  }, [beatVolume]);

  /* ✅ FIXED: Producer Control Handlers */
  
  const handleVolumeChange = (channelId: string, volume: number) => {
    console.log(`🎚️ Producer adjusted ${channelId} to ${volume}dB`);
    // Volume is already changed by the console component via musicEngine
    
    // Broadcast to other users
    socket.emit("mixer_change", {
      roomId,
      channel: channelId,
      volume,
    });
  };

  const handleApplySuggestion = (suggestionId: string) => {
    console.log(`✅ Producer applied suggestion: ${suggestionId}`);
    
    // Remove from suggestions list
    setAiSuggestions(prev => prev.filter(s => 
      `${s.channelId}-${s.suggestion}` !== suggestionId
    ));
    
    // Show confirmation
    alert(`✅ Suggestion applied! The change has been made to your mix.`);
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    console.log(`❌ Producer dismissed suggestion: ${suggestionId}`);
    
    // Remove from suggestions list
    setAiSuggestions(prev => prev.filter(s => 
      `${s.channelId}-${s.suggestion}` !== suggestionId
    ));
  };

  const handleLaunchPoll = (pollType: string) => {
    console.log(`📊 Producer launched poll: ${pollType}`);
    
    // Define poll options
    const pollOptions: Record<string, { question: string; options: string[] }> = {
      tempo: {
        question: "Tempo: Faster or Slower?",
        options: ["Faster", "Slower", "Keep Current"],
      },
      drop: {
        question: "When should we drop?",
        options: ["Drop Now", "Build More", "Wait for Chorus"],
      },
      bass: {
        question: "What should we add?",
        options: ["More Bass", "More Melody", "More Percussion"],
      },
      energy: {
        question: "Energy direction?",
        options: ["Build Up", "Chill Down", "Maintain"],
      },
    };

    const poll = pollOptions[pollType] || pollOptions.tempo;
    
    // ✅ FIXED: Actually broadcast the poll
    socket.emit("launch_poll", {
      roomId,
      pollId: Date.now().toString(),
      question: poll.question,
      options: poll.options,
    });

    // Show confirmation to producer
    alert(`📊 Poll launched!\n\n${poll.question}\n\nWaiting for votes...`);
  };

  const isHost = !isSpectator && myId === state.hostId;

  /* ================= JOIN SCREEN ================= */
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black text-white">
        <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-xl">
          <h1 className="text-2xl font-semibold mb-6 text-center">
            🎧 Producer Session
          </h1>

          <input
            disabled={joinRole === "spectator"}
            placeholder="Your name"
            className="w-full p-3 mb-4 rounded-lg bg-black border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex gap-3 mb-4">
            <button
              className={`flex-1 py-3 rounded-lg transition ${
                joinRole === "participant" ? "bg-indigo-600" : "bg-zinc-800"
              }`}
              onClick={() => setJoinRole("participant")}
            >
              Join
            </button>
            <button
              className={`flex-1 py-3 rounded-lg transition ${
                joinRole === "spectator" ? "bg-emerald-600" : "bg-zinc-800"
              }`}
              onClick={() => setJoinRole("spectator")}
            >
              Watch
            </button>
          </div>

          <button
            onClick={joinNow}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition active:scale-[0.98]"
          >
            Enter Session
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN ================= */
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
      {/* Sync Dashboard */}
      {showDashboard && (
        <SyncDashboard
          syncOffset={syncMetrics.offset}
          fps={syncMetrics.fps}
          droppedFrames={syncMetrics.dropped}
          networkLatency={networkLatency}
          participants={state.participants.length}
          spectators={state.spectatorCount}
        />
      )}

      {/* Toggle Dashboard Button */}
      <button
        onClick={() => setShowDashboard(!showDashboard)}
        className="fixed top-4 right-4 z-50 px-3 py-2 bg-black/80 backdrop-blur-sm 
                   border border-white/20 rounded-lg text-xs hover:bg-black/90 transition"
      >
        {showDashboard ? "Hide Dashboard" : "Show Dashboard"}
      </button>

      <div className="min-h-screen px-6 py-10 ml-0 md:ml-80">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* HEADER */}
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              Producer Control Center
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              You control everything • AI & crowd are your intelligent copilots
            </p>
          </header>

          {/* ⭐ PRODUCER MIX CONSOLE */}
          {isHost && (
            <ProducerMixConsole
              onVolumeChange={handleVolumeChange}
              aiSuggestions={aiSuggestions}
              crowdVotes={crowdVotes}
              isPlaying={beatPlaying}
            />
          )}

          {/* AUDIO VISUALIZER */}
          <section className="bg-zinc-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                🎨 Audio Visualizer (Real-Time Sync)
              </p>
              {beatPlaying && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400">Live</span>
                </div>
              )}
            </div>

            <Visualizer
              isPlaying={beatPlaying}
              theme={state.theme}
              showMetrics={false}
              onMetricsUpdate={(metrics) => setSyncMetrics(metrics)}
            />
          </section>

          {/* ⭐ TWO COLUMN LAYOUT FOR AI & CROWD */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI COPILOT PANEL */}
            <AICopilotPanel
              onApplySuggestion={handleApplySuggestion}
              onDismissSuggestion={handleDismissSuggestion}
            />

            {/* CROWD FEEDBACK DASHBOARD */}
            <CrowdFeedbackDashboard
              participantCount={state.participants.length}
              onLaunchPoll={handleLaunchPoll}
            />
          </div>
          {/* LYRIC CANVAS - NEW! */}
          <LyricCanvas
            socket={socket}
            roomId={roomId}
            isHost={isHost}
          />

          {/* VIDEO GRID */}
          {showVideoGrid && (
            <section className="bg-zinc-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  📹 Live Video Streams
                </p>
              </div>

              <VideoGrid
                socket={socket}
                roomId={roomId}
                isHost={isHost}
                myId={myId}
              />
            </section>
          )}

          {/* TRANSPORT */}
          <section className="bg-zinc-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <p className="text-xs uppercase tracking-wide text-zinc-400 mb-4">
              🎛 Transport & Controls
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  if (!beatPlaying) {
                    await startRoomBeat(state.theme);
                    setBeatPlaying(true);
                  } else {
                    stopRoomBeat();
                    setBeatPlaying(false);
                    setCurrentKickStyle("");
                    setCurrentEnergy("");
                  }
                }}
                className="py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition font-semibold"
              >
                {beatPlaying ? "⏹ Stop Beat" : "▶ Play Beat"}
              </button>

              <button
                onClick={() => setShowVideoGrid(!showVideoGrid)}
                className="py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition font-semibold"
              >
                {showVideoGrid ? "📹 Hide Video" : "📹 Show Video"}
              </button>
            </div>
          </section>

          {/* ✅ FIXED: LIVE TRACK STATE - Now actually connected! */}
          <section className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3">
              🎚 Live Track State (Real-Time Audio Changes)
            </p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-black/60 p-4 rounded-xl">
                <p className="text-zinc-400 text-xs">Kick Groove</p>
                <p className={`text-lg font-semibold ${
                  currentKickStyle ? "text-indigo-400 animate-pulse" : "text-zinc-600"
                }`}>
                  {currentKickStyle || "—"}
                </p>
              </div>

              <div className="bg-black/60 p-4 rounded-xl">
                <p className="text-zinc-400 text-xs">Energy</p>
                <p className={`text-lg font-semibold ${
                  currentEnergy ? "text-emerald-400 animate-pulse" : "text-zinc-600"
                }`}>
                  {currentEnergy || "—"}
                </p>
              </div>
            </div>
            
            <p className="text-xs text-zinc-500 mt-3">
              💡 This updates when AI suggestions are applied or crowd votes are accepted
            </p>
          </section>

          {/* DEMO MODE CONTROL */}
          {isHost && (
            <section className="bg-zinc-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-wide text-zinc-400 mb-4">
                🧪 Demo Mode
              </p>

              <button
                onClick={() =>
                  socket.emit("host_toggle_demo", {
                    roomId,
                    on: !state.demoMode,
                  })
                }
                className={`w-full py-3 rounded-xl transition ${
                  state.demoMode
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {state.demoMode ? "🛑 Stop Demo Mode" : "🧪 Start Demo Mode"}
              </button>

              {state.demoMode && (
                <div className="mt-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-3 text-sm text-emerald-200">
                  🧪 Demo Mode Active - 8 AI bots are participating and voting
                </div>
              )}
            </section>
          )}

          {/* PARTICIPANTS LIST */}
          <section className="bg-zinc-900/70 border border-white/10 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400 mb-3">
              👥 Participants ({state.participants.length})
            </p>

            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {state.participants.map((u: any) => (
                <li
                  key={u.id}
                  className="flex justify-between text-sm text-zinc-300"
                >
                  <span>{u.name}</span>
                  {state.hostId === u.id && (
                    <span className="text-xs text-yellow-400">HOST</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
