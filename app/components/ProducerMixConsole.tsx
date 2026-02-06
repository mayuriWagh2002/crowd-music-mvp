"use client";

import { useState, useEffect } from "react";
import { setChannelVolume, setChannelMute, setChannelSolo, resetAllChannels } from "@/app/lib/musicEngine";

interface Channel {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  level: number;
  color: string;
}

interface AISuggestion {
  channelId: string;
  type: "volume" | "eq" | "timing";
  suggestion: string;
  reason: string;
  confidence: number;
  appliedValue?: number;
}

interface CrowdVote {
  channelId: string;
  preference: string;
  percentage: number;
  totalVotes: number;
}

interface MixConsoleProps {
  onVolumeChange: (channelId: string, volume: number) => void;
  aiSuggestions?: AISuggestion[];
  crowdVotes?: CrowdVote[];
  isPlaying: boolean;
}

const handleResetAll = () => {
  // 1. Call the audio engine
  resetAllChannels();
  
  // 2. Reset UI state
  setChannels([
    { id: "kick", volume: -12, muted: false, solo: false },
    { id: "snare", volume: -8, muted: false, solo: false },
    { id: "hihat", volume: -15, muted: false, solo: false },
    { id: "bass", volume: -6, muted: false, solo: false },
    { id: "pad", volume: -18, muted: false, solo: false },
  ]);
  
  // 3. Show confirmation
  alert("♻️ All channels reset to defaults");
};

const handleSaveMix = () => {
  // 1. Collect current state
  const mixData = channels.map(ch => ({
    id: ch.id,
    volume: ch.volume,
    muted: ch.muted,
    solo: ch.solo,
  }));
  
  // 2. Save to localStorage
  localStorage.setItem("savedMix", JSON.stringify(mixData));
  
  // 3. Show confirmation
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
};
export default function ProducerMixConsole({
  onVolumeChange,
  aiSuggestions = [],
  crowdVotes = [],
  isPlaying,
}: MixConsoleProps) {
  const [channels, setChannels] = useState<Channel[]>([
    { id: "kick", name: "Kick", volume: -12, muted: false, solo: false, level: 65, color: "bg-red-500" },
    { id: "snare", name: "Snare", volume: -8, muted: false, solo: false, level: 58, color: "bg-orange-500" },
    { id: "hihat", name: "Hi-Hat", volume: -15, muted: false, solo: false, level: 45, color: "bg-yellow-500" },
    { id: "bass", name: "Bass", volume: -6, muted: false, solo: false, level: 72, color: "bg-blue-500" },
    { id: "pad", name: "Pad", volume: -18, muted: false, solo: false, level: 38, color: "bg-purple-500" },
  ]);

  const [activeSuggestion, setActiveSuggestion] = useState<AISuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [saved, setSaved] = useState(false);

  // Simulate audio levels (would connect to real audio analysis)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setChannels(prev => prev.map(ch => ({
        ...ch,
        level: ch.muted ? 0 : 30 + Math.random() * 70,
      })));
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  /**
   * ✅ WORKING: Volume fader
   */
  const handleVolumeChange = (channelId: string, newVolume: number) => {
    // Update local state
    setChannels(prev => prev.map(ch =>
      ch.id === channelId ? { ...ch, volume: newVolume } : ch
    ));

    // Update actual audio engine
    setChannelVolume(channelId, newVolume);

    // Notify parent
    onVolumeChange(channelId, newVolume);
  };

  /**
   * ✅ WORKING: Mute button
   */
  const toggleMute = (channelId: string) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === channelId) {
        const newMuted = !ch.muted;
        // Update audio engine
        setChannelMute(channelId, newMuted);
        return { ...ch, muted: newMuted };
      }
      return ch;
    }));
  };

  /**
   * ✅ WORKING: Solo button
   */
  const toggleSolo = (channelId: string) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === channelId) {
        const newSolo = !ch.solo;
        // Update audio engine
        setChannelSolo(channelId, newSolo);
        return { ...ch, solo: newSolo };
      }
      return ch;
    }));
  };

  /**
   * ✅ WORKING: Apply AI suggestion
   */
  const applySuggestion = (suggestion: AISuggestion) => {
    if (suggestion.type === "volume" && suggestion.appliedValue !== undefined) {
      handleVolumeChange(suggestion.channelId, suggestion.appliedValue);
    }
    setActiveSuggestion(null);
  };

  /**
   * ✅ WORKING: Reset all faders
   */
  const handleResetAll = () => {
    // Reset audio engine
    resetAllChannels();

    // Reset UI
    setChannels([
      { id: "kick", name: "Kick", volume: -12, muted: false, solo: false, level: 65, color: "bg-red-500" },
      { id: "snare", name: "Snare", volume: -8, muted: false, solo: false, level: 58, color: "bg-orange-500" },
      { id: "hihat", name: "Hi-Hat", volume: -15, muted: false, solo: false, level: 45, color: "bg-yellow-500" },
      { id: "bass", name: "Bass", volume: -6, muted: false, solo: false, level: 72, color: "bg-blue-500" },
      { id: "pad", name: "Pad", volume: -18, muted: false, solo: false, level: 38, color: "bg-purple-500" },
    ]);
  };

  /**
   * ✅ WORKING: Save mix
   */
  const handleSaveMix = () => {
    // Save to localStorage
    const mixData = channels.map(ch => ({
      id: ch.id,
      volume: ch.volume,
      muted: ch.muted,
      solo: ch.solo,
    }));

    localStorage.setItem("savedMix", JSON.stringify(mixData));

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /**
   * ✅ WORKING: Preview suggestion
   */
  const previewSuggestion = (suggestion: AISuggestion) => {
    if (suggestion.type === "volume" && suggestion.appliedValue !== undefined) {
      // Temporarily apply the change
      const originalVolume = channels.find(ch => ch.id === suggestion.channelId)?.volume;
      
      handleVolumeChange(suggestion.channelId, suggestion.appliedValue);

      // Revert after 3 seconds
      setTimeout(() => {
        if (originalVolume !== undefined) {
          handleVolumeChange(suggestion.channelId, originalVolume);
        }
      }, 3000);
    }
  };

  const getSuggestionForChannel = (channelId: string) => {
    return aiSuggestions.find(s => s.channelId === channelId);
  };

  const getCrowdVoteForChannel = (channelId: string) => {
    return crowdVotes.find(v => v.channelId === channelId);
  };

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">🎛️ Producer Mix Console</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Full control over every element • AI & crowd provide suggestions
          </p>
        </div>
        
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition"
        >
          {showSuggestions ? "Hide" : "Show"} Suggestions
        </button>
      </div>

      {/* Channel Strips */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {channels.map((channel) => {
          const suggestion = getSuggestionForChannel(channel.id);
          const crowdVote = getCrowdVoteForChannel(channel.id);
          
          return (
            <div key={channel.id} className="flex flex-col">
              {/* Channel Header */}
              <div className="text-center mb-2">
                <p className="text-sm font-semibold">{channel.name}</p>
                <p className="text-xs text-zinc-500">{channel.volume.toFixed(1)} dB</p>
              </div>

              {/* Level Meter */}
              <div className="h-48 bg-black/50 rounded-lg p-2 mb-3 relative overflow-hidden">
                {/* Active level */}
                <div className="absolute inset-2 flex flex-col-reverse">
                  <div
                    className={`${channel.color} transition-all duration-100 rounded-sm`}
                    style={{ height: `${channel.level}%` }}
                  />
                  
                  {/* Peak markers */}
                  <div className="absolute inset-0 flex flex-col justify-between py-1">
                    <div className="h-px bg-red-500/30" />
                    <div className="h-px bg-yellow-500/30" />
                    <div className="h-px bg-green-500/30" />
                  </div>
                </div>

                {/* Level value */}
                <div className="absolute top-1 right-1 text-[10px] font-mono text-zinc-400">
                  {channel.level.toFixed(0)}
                </div>
              </div>

              {/* Fader */}
              <div className="relative mb-3 px-2">
                <input
                  type="range"
                  min="-60"
                  max="0"
                  step="0.5"
                  value={channel.volume}
                  onChange={(e) => handleVolumeChange(channel.id, parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:w-4
                           [&::-webkit-slider-thumb]:h-4
                           [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-indigo-500
                           [&::-webkit-slider-thumb]:cursor-pointer
                           [&::-webkit-slider-thumb]:hover:bg-indigo-400
                           [&::-webkit-slider-thumb]:transition"
                  disabled={channel.muted}
                />
              </div>

              {/* Controls */}
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => toggleMute(channel.id)}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                    channel.muted
                      ? "bg-red-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                  title="Mute this channel"
                >
                  M
                </button>
                <button
                  onClick={() => toggleSolo(channel.id)}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                    channel.solo
                      ? "bg-yellow-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                  title="Solo this channel"
                >
                  S
                </button>
              </div>

              {/* Suggestions indicator */}
              {showSuggestions && (suggestion || crowdVote) && (
                <div className="space-y-1">
                  {suggestion && (
                    <div className="bg-indigo-900/30 border border-indigo-500/30 rounded p-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-indigo-400">🤖 AI</span>
                        <span className="text-[10px] text-indigo-300">{suggestion.confidence}%</span>
                      </div>
                      <p className="text-[10px] text-indigo-200 mb-1">{suggestion.suggestion}</p>
                      <button
                        onClick={() => setActiveSuggestion(suggestion)}
                        className="w-full py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-[10px] transition"
                      >
                        Review
                      </button>
                    </div>
                  )}
                  
                  {crowdVote && (
                    <div className="bg-emerald-900/30 border border-emerald-500/30 rounded p-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-emerald-400">👥 Crowd</span>
                        <span className="text-[10px] text-emerald-300">{crowdVote.percentage}%</span>
                      </div>
                      <p className="text-[10px] text-emerald-200">{crowdVote.preference}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Master Section */}
      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-zinc-400">Master:</span>
              <span className="ml-2 font-semibold">0.0 dB</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleResetAll}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition"
                title="Reset all faders to default"
              >
                Reset All
              </button>
              <button 
                onClick={handleSaveMix}
                className={`px-3 py-1.5 rounded text-xs transition ${
                  saved 
                    ? "bg-green-600" 
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
                title="Save current mix settings"
              >
                {saved ? "✓ Saved!" : "Save Mix"}
              </button>
            </div>
          </div>

          <div className="text-xs text-zinc-400">
            {aiSuggestions.length} AI suggestions • {crowdVotes.length} crowd votes
          </div>
        </div>
      </div>

      {/* Suggestion Modal */}
      {activeSuggestion && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
             onClick={() => setActiveSuggestion(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">🤖 AI Suggestion</h3>
            
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-xs text-zinc-400">Channel</p>
                <p className="text-sm font-semibold capitalize">{activeSuggestion.channelId}</p>
              </div>
              
              <div>
                <p className="text-xs text-zinc-400">Suggestion</p>
                <p className="text-sm">{activeSuggestion.suggestion}</p>
              </div>
              
              <div>
                <p className="text-xs text-zinc-400">Reason</p>
                <p className="text-sm text-zinc-300">{activeSuggestion.reason}</p>
              </div>
              
              <div>
                <p className="text-xs text-zinc-400">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all"
                      style={{ width: `${activeSuggestion.confidence}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{activeSuggestion.confidence}%</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActiveSuggestion(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  previewSuggestion(activeSuggestion);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
              >
                Preview (3s)
              </button>
              <button
                onClick={() => applySuggestion(activeSuggestion)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
