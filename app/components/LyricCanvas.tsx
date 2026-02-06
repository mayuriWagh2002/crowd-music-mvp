"use client";

import { useState, useEffect } from "react";

interface LyricSuggestion {
  id: string;
  userId: string;
  userName: string;
  suggestion: string;
  votes: number;
}

interface LyricCanvasProps {
  socket: any;
  roomId: string;
  isHost: boolean;
}

export default function LyricCanvas({ socket, roomId, isHost }: LyricCanvasProps) {
  const [lyrics, setLyrics] = useState([
    { section: "Verse 1", lines: ["", "", "", ""] },
    { section: "Chorus", lines: ["", "", "", ""] },
  ]);

  const [isEditing, setIsEditing] = useState(true);
  const [crowdSuggestions, setCrowdSuggestions] = useState<LyricSuggestion[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    socket.on("lyrics_updated", (newLyrics: any) => {
      setLyrics(newLyrics);
    });

    socket.on("crowd_suggestion_received", (suggestion: LyricSuggestion) => {
      setCrowdSuggestions(prev => [...prev, suggestion]);
    });

    return () => {
      socket.off("lyrics_updated");
      socket.off("crowd_suggestion_received");
    };
  }, [socket]);

  const updateLine = (sectionIdx: number, lineIdx: number, text: string) => {
    const newLyrics = [...lyrics];
    newLyrics[sectionIdx].lines[lineIdx] = text;
    setLyrics(newLyrics);

    // Broadcast to everyone
    if (socket && roomId) {
      socket.emit("update_lyrics", {
        roomId,
        lyrics: newLyrics,
      });
    }

    // ✅ FIXED: Generate AI suggestion ALWAYS (not just in demo mode)
    if (text.length > 3) {
      setTimeout(() => generateAISuggestion(text), 300);
    } else if (text.length === 0) {
      // Clear suggestions when line is empty
      setAiSuggestions([]);
    }
  };

  const generateAISuggestion = (line: string) => {
    const words = line.trim().split(" ");
    const lastWord = words[words.length - 1]?.toLowerCase() || "";
    
    const suggestions: string[] = [];
    
    // Expanded rhyme dictionary
    const rhymes: Record<string, string[]> = {
      night: ["light", "sight", "flight", "right", "might", "bright", "fight", "tight"],
      day: ["way", "say", "play", "stay", "gray", "ray", "may", "bay"],
      love: ["above", "dove", "shove", "of", "enough"],
      heart: ["part", "start", "art", "chart", "smart", "dart"],
      time: ["rhyme", "climb", "prime", "sublime", "crime", "lime"],
      life: ["strife", "knife", "wife", "rife", "fife"],
      dream: ["stream", "beam", "team", "seem", "cream", "gleam"],
      pain: ["rain", "gain", "chain", "strain", "main", "brain"],
      soul: ["goal", "whole", "role", "control", "stroll", "bowl"],
      mind: ["find", "kind", "blind", "behind", "rewind", "grind"],
      fire: ["desire", "higher", "wire", "inspire", "retire", "choir"],
      sky: ["fly", "high", "by", "try", "why", "cry"],
      feel: ["real", "deal", "heal", "reveal", "steel", "wheel"],
      know: ["show", "flow", "grow", "below", "glow", "throw"],
      sound: ["found", "ground", "around", "profound", "bound", "mound"],
      you: ["through", "true", "blue", "new", "view", "knew"],
      me: ["free", "see", "be", "tree", "key", "sea"],
      away: ["stay", "day", "say", "way", "play", "gray"],
      alone: ["own", "shown", "known", "tone", "zone", "phone"],
      tears: ["years", "fears", "cheers", "ears", "peers"],
      eyes: ["lies", "skies", "tries", "flies", "cries", "ties"],
      hand: ["stand", "land", "band", "sand", "grand", "planned"],
      face: ["place", "space", "grace", "race", "trace", "embrace"],
      smile: ["while", "mile", "style", "trial", "aisle"],
      world: ["unfurled", "swirled", "hurled", "pearled"],
      down: ["town", "crown", "brown", "frown", "gown"],
      breathe: ["leave", "believe", "achieve", "receive", "weave"],
    };

    // 1. Rhyme suggestion
    if (rhymes[lastWord]) {
      const rhymeList = rhymes[lastWord].slice(0, 5).join(", ");
      suggestions.push(`💡 Rhymes with "${lastWord}": ${rhymeList}`);
    }

    // 2. Line length feedback
    if (line.length > 15 && line.length < 50) {
      suggestions.push(`✨ Perfect line length! Great flow.`);
    } else if (line.length > 70) {
      suggestions.push(`⚠️ Line is getting long. Consider splitting.`);
    } else if (line.length > 5 && line.length < 15) {
      suggestions.push(`💭 Short and punchy! Works great for impact.`);
    }

    // 3. Emotional words detection
    const emotionalWords = ["lost", "found", "love", "hate", "pain", "heart", "soul", "dream", "hope", "fear", "lonely", "happy", "sad", "cry", "tears", "smile"];
    const hasEmotion = emotionalWords.some(word => line.toLowerCase().includes(word));
    if (hasEmotion) {
      suggestions.push(`❤️ Strong emotional impact! This resonates.`);
    }

    // 4. Metaphor detection
    const metaphors = ["light", "dark", "fire", "ice", "ocean", "mountain", "sky", "stars", "rain", "storm"];
    const hasMetaphor = metaphors.some(word => line.toLowerCase().includes(word));
    if (hasMetaphor) {
      suggestions.push(`🌟 Nice imagery! Vivid metaphor.`);
    }

    // 5. Action words
    const actionWords = ["running", "fighting", "dancing", "falling", "rising", "breaking", "burning", "flying"];
    const hasAction = actionWords.some(word => line.toLowerCase().includes(word));
    if (hasAction) {
      suggestions.push(`⚡ Dynamic action! Creates movement.`);
    }

    // 6. Syllable count approximation (simple)
    const syllables = words.length * 2; // rough estimate
    if (syllables >= 8 && syllables <= 12) {
      suggestions.push(`🎵 Good rhythm! ~${syllables} syllables.`);
    }

    // Update suggestions (keep unique)
    if (suggestions.length > 0) {
      setAiSuggestions(prev => {
        const combined = [...suggestions, ...prev];
        const unique = Array.from(new Set(combined));
        return unique.slice(0, 6); // Keep max 6
      });
    }
  };

  const acceptCrowdSuggestion = (suggestion: LyricSuggestion) => {
    setCrowdSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    alert(`✅ Accepted: ${suggestion.suggestion}`);
  };

  const addSection = () => {
    setLyrics(prev => [
      ...prev,
      { section: `Section ${prev.length + 1}`, lines: ["", "", "", ""] },
    ]);
  };

  const startDemoMode = () => {
    setDemoMode(true);
    
    const demoLyrics = [
      {
        section: "Verse 1",
        lines: [
          "Lost in the city lights tonight",
          "Searching for meaning in the moonlight",
          "Every step feels like a fight",
          "But I know I'll be alright",
        ],
      },
      {
        section: "Chorus",
        lines: [
          "We're dancing in the rain",
          "Washing away the pain",
          "Nothing left to explain",
          "We'll never be the same",
        ],
      },
    ];
    
    setLyrics(demoLyrics);

    // Generate AI suggestions for demo lyrics
    setAiSuggestions([
      "💡 Rhymes with 'night': light, sight, flight, bright",
      "✨ Great emotional flow in verse 1!",
      "💭 Consider adding a bridge after chorus",
    ]);

    // Add crowd suggestion after 2 seconds
    setTimeout(() => {
      setCrowdSuggestions([
        {
          id: "demo1",
          userId: "demo",
          userName: "Music Fan",
          suggestion: "Change 'moonlight' to 'starlight' for better imagery",
          votes: 5,
        },
      ]);
    }, 2000);
  };

  const clearDemo = () => {
    setDemoMode(false);
    setLyrics([
      { section: "Verse 1", lines: ["", "", "", ""] },
      { section: "Chorus", lines: ["", "", "", ""] },
    ]);
    setAiSuggestions([]);
    setCrowdSuggestions([]);
  };

  const totalLines = lyrics.reduce((acc, s) => acc + s.lines.filter(l => l).length, 0);

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            🎤 Live Lyric Canvas
            {demoMode && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                DEMO MODE
              </span>
            )}
          </h2>
          <p className="text-sm text-zinc-400">
            {isHost ? "Write lyrics with AI assistance - type to get instant suggestions" : "View lyrics and suggest improvements"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isHost && (
            <>
              {!demoMode ? (
                <button
                  onClick={startDemoMode}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-semibold transition"
                >
                  🎬 Demo Mode
                </button>
              ) : (
                <button
                  onClick={clearDemo}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition"
                >
                  ✕ Clear Demo
                </button>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400">Live</span>
          </div>
        </div>
      </div>

      {/* Grid Layout: Lyrics + AI Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lyrics Section (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {lyrics.map((section, sectionIdx) => (
            <div
              key={sectionIdx}
              className="bg-black/30 rounded-xl p-5 border border-white/5"
            >
              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-indigo-400">
                  [{section.section}]
                </h3>
                {isHost && (
                  <button
                    className="text-xs text-zinc-500 hover:text-white transition"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? "✓ Done" : "✏️ Edit"}
                  </button>
                )}
              </div>

              {/* Lines */}
              <div className="space-y-3">
                {section.lines.map((line, lineIdx) => (
                  <div key={lineIdx} className="relative">
                    {isHost && isEditing ? (
                      <input
                        type="text"
                        value={line}
                        onChange={(e) =>
                          updateLine(sectionIdx, lineIdx, e.target.value)
                        }
                        placeholder={`Line ${lineIdx + 1}... (start typing for AI help)`}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3
                                 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500
                                 focus:border-transparent placeholder:text-zinc-600
                                 transition-all duration-200"
                      />
                    ) : (
                      <p className="text-base leading-relaxed text-zinc-200 px-4 py-3 bg-zinc-800/50 rounded-lg">
                        {line || (
                          <span className="text-zinc-600 italic">
                            (Empty line)
                          </span>
                        )}
                      </p>
                    )}
                    
                    {/* Character count */}
                    {isHost && isEditing && line && (
                      <span className="absolute right-2 top-2 text-xs text-zinc-600">
                        {line.length} chars
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add Section Button */}
          {isHost && (
            <button
              onClick={addSection}
              className="w-full py-4 border-2 border-dashed border-zinc-700 rounded-xl
                       text-sm text-zinc-500 hover:border-indigo-500 hover:text-indigo-400
                       transition-all duration-200 hover:bg-indigo-500/5"
            >
              + Add Section (Bridge, Verse 2, etc.)
            </button>
          )}
        </div>

        {/* AI & Suggestions Panel (1/3 width) */}
        <div className="space-y-4">
          {/* AI Suggestions */}
          <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-indigo-400">
                🤖 AI Assistant
              </h3>
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="text-xs text-zinc-500 hover:text-white"
              >
                {showAIPanel ? "−" : "+"}
              </button>
            </div>

            {showAIPanel && (
              <>
                {aiSuggestions.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {aiSuggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="bg-black/30 rounded-lg p-3 text-sm text-zinc-300
                                 border border-indigo-500/20 animate-fadeIn"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-black/20 rounded-lg p-4 text-center">
                    <p className="text-xs text-zinc-500 italic mb-2">
                      ✍️ Start typing in any line...
                    </p>
                    <p className="text-xs text-zinc-600">
                      AI will suggest rhymes, check flow, and provide writing tips!
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Crowd Suggestions */}
          {crowdSuggestions.length > 0 && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 text-emerald-400">
                👥 Crowd Suggestions ({crowdSuggestions.length})
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {crowdSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-black/30 rounded-lg p-3 border border-emerald-500/20"
                  >
                    <p className="text-xs text-zinc-500 mb-1">
                      From {suggestion.userName}:
                    </p>
                    <p className="text-emerald-300 text-sm mb-2">{suggestion.suggestion}</p>
                    {isHost && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptCrowdSuggestion(suggestion)}
                          className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 
                                   rounded text-xs transition"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => setCrowdSuggestions(prev => prev.filter(s => s.id !== suggestion.id))}
                          className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 
                                   rounded text-xs transition"
                        >
                          ✗ Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participant Suggestion Button */}
          {!isHost && (
            <div>
              <button
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl
                         font-semibold transition-all duration-200 active:scale-[0.98]"
                onClick={() => {
                  const suggestion = prompt("Suggest a lyric or improvement:");
                  if (suggestion && socket) {
                    socket.emit("submit_lyric_suggestion", {
                      roomId,
                      suggestion,
                      userName: "Participant",
                    });
                  }
                }}
              >
                💡 Suggest Improvement
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="bg-black/30 rounded-xl p-4 border border-white/5">
            <h4 className="text-xs font-semibold text-zinc-400 mb-3">Session Stats</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Lines written:</span>
                <span className="text-white font-semibold">{totalLines}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">AI suggestions:</span>
                <span className="text-indigo-400 font-semibold">{aiSuggestions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Crowd input:</span>
                <span className="text-emerald-400 font-semibold">{crowdSuggestions.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Text */}
      {isHost && totalLines === 0 && !demoMode && (
        <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-sm">
          <p className="text-blue-300">
            💡 <strong>Quick start:</strong> Click "Demo Mode" to see it with example lyrics, 
            or start typing in any line to get instant AI suggestions!
          </p>
        </div>
      )}
    </div>
  );
}
