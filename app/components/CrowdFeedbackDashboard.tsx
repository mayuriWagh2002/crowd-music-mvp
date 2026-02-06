"use client";

import { useState, useEffect } from "react";

interface ReactionCount {
  emoji: string;
  count: number;
}

interface CrowdFeedbackProps {
  participantCount: number;
  onLaunchPoll: (pollType: string) => void;
  socket?: any; // ← ADD THIS
  roomId?: string; // ← ADD THIS
}

export default function CrowdFeedbackDashboard({
  participantCount,
  onLaunchPoll,
  socket, // ← ADD THIS
  roomId, // ← ADD THIS
}: CrowdFeedbackProps) {
  const [reactions, setReactions] = useState<Record<string, number>>({
    "🔥": 0,
    "❤️": 0,
    "🎵": 0,
    "🎵": 0,
    "⚡": 0,
    "😴": 0,
  });

  const [energyLevel, setEnergyLevel] = useState(65);
  const [crowdMood, setCrowdMood] = useState<"ENGAGED" | "NEUTRAL" | "BORED">("ENGAGED");

  // ✅ FIXED: Only listen to socket if it exists
  useEffect(() => {
    if (!socket) {
      // If no socket, use simulated data (for demo)
      const interval = setInterval(() => {
        setReactions(prev => {
          const newReactions = { ...prev };
          Object.keys(newReactions).forEach(emoji => {
            newReactions[emoji] = Math.max(0, newReactions[emoji] + Math.floor(Math.random() * 3 - 1));
          });
          return newReactions;
        });
      }, 3000);

      return () => clearInterval(interval);
    }

    // Listen for real reactions from server
    socket.on("reactions_updated", (newReactions: Record<string, number>) => {
      setReactions(newReactions);
    });

    return () => {
      socket.off("reactions_updated");
    };
  }, [socket]);

  // Update mood based on energy
  useEffect(() => {
    if (energyLevel > 70) setCrowdMood("ENGAGED");
    else if (energyLevel > 40) setCrowdMood("NEUTRAL");
    else setCrowdMood("BORED");
  }, [energyLevel]);

  // Simulate energy changes (would be real in production)
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergyLevel(prev => {
        const change = Math.random() * 10 - 5;
        return Math.max(0, Math.min(100, prev + change));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getMoodColor = () => {
    switch (crowdMood) {
      case "ENGAGED": return "text-green-400";
      case "NEUTRAL": return "text-yellow-400";
      case "BORED": return "text-red-400";
    }
  };

  const getMoodIcon = () => {
    switch (crowdMood) {
      case "ENGAGED": return "🎉";
      case "NEUTRAL": return "😐";
      case "BORED": return "😴";
    }
  };

  const totalReactions = Object.values(reactions).reduce((sum, count) => sum + count, 0);

  const pollOptions = [
    { id: "tempo", label: "Tempo: Faster/Slower?", icon: "⏱️" },
    { id: "drop", label: "Drop: Now/Build More?", icon: "💥" },
    { id: "bass", label: "Add: More Bass/More Melody?", icon: "🎵" },
    { id: "energy", label: "Energy: Build/Chill?", icon: "⚡" },
  ];

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">👥 Crowd Feedback</h2>
          <p className="text-xs text-zinc-400">
            Live insights from {participantCount} participants
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">Live</span>
        </div>
      </div>

      {/* Real-time Reactions */}
      <div className="bg-black/30 rounded-xl p-4 mb-4 border border-white/5">
        <h3 className="text-sm font-semibold mb-3 text-zinc-300">
          Real-time Reactions <span className="text-xs text-zinc-500">({totalReactions} total)</span>
        </h3>
        
        <div className="flex items-center justify-around">
          {Object.entries(reactions).map(([emoji, count]) => (
            <div key={emoji} className="text-center">
              <div className="text-3xl mb-1">{emoji}</div>
              <div className="text-sm font-semibold">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Energy Meter */}
      <div className="bg-black/30 rounded-xl p-4 mb-4 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-zinc-300">Energy Meter</h3>
          <span className="text-xs text-zinc-500">{energyLevel.toFixed(0)}%</span>
        </div>

        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${energyLevel}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">Crowd is feeling:</p>
            <p className={`text-sm font-semibold ${getMoodColor()}`}>
              {getMoodIcon()} {crowdMood}
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-zinc-500">Suggestion:</p>
            <p className="text-sm text-zinc-300">
              {crowdMood === "ENGAGED" && "Maintain current energy"}
              {crowdMood === "NEUTRAL" && "Consider building energy"}
              {crowdMood === "BORED" && "Increase energy or change direction"}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Polls */}
      <div className="bg-black/30 rounded-xl p-4 border border-white/5">
        <h3 className="text-sm font-semibold mb-3 text-zinc-300">
          Quick Polls <span className="text-xs text-zinc-500">(Launch when needed)</span>
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {pollOptions.map((poll) => (
            <button
              key={poll.id}
              onClick={() => onLaunchPoll(poll.id)}
              className="flex items-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-left"
            >
              <span className="text-lg">{poll.icon}</span>
              <span className="text-xs">{poll.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-zinc-500">
            💡 Tip: Launch polls when you want crowd input on a specific decision
          </p>
        </div>
      </div>

      {/* Engagement Timeline */}
      <div className="mt-4 bg-black/30 rounded-xl p-4 border border-white/5">
        <h3 className="text-sm font-semibold mb-3 text-zinc-300">Engagement Timeline</h3>
        
        <div className="relative h-20 bg-zinc-900 rounded-lg overflow-hidden">
          {/* Mini engagement graph */}
          <svg className="w-full h-full" preserveAspectRatio="none">
            <polyline
              points="0,80 10,70 20,60 30,40 40,35 50,45 60,30 70,25 80,40 90,50 100,45"
              fill="none"
              stroke="rgb(99, 102, 241)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points="0,80 10,70 20,60 30,40 40,35 50,45 60,30 70,25 80,40 90,50 100,45"
              fill="url(#gradient)"
              opacity="0.2"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgb(99, 102, 241)" />
                <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Time markers */}
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 text-[10px] text-zinc-500">
            <span>2m ago</span>
            <span>1m ago</span>
            <span>Now</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Peak engagement: 0:45-1:15</span>
          <span className="text-emerald-400">+23% vs average</span>
        </div>
      </div>

      {/* Producer Controls */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">You control when to ask for feedback</span>
          <button className="text-indigo-400 hover:text-indigo-300 transition">
            Configure Polls →
          </button>
        </div>
      </div>
    </div>
  );
}
