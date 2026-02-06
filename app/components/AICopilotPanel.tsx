"use client";

import { useState } from "react";

interface AISuggestion {
  id: string;
  priority: "high" | "medium" | "low";
  category: "mix" | "arrangement" | "sound-design" | "crowd-requested";
  title: string;
  description: string;
  reason: string;
  confidence: number;
  impact: string;
}

interface MixAnalysis {
  energy: number;
  frequencyBalance: string;
  rhythmicComplexity: string;
  crowdEngagement: number;
}

interface AICopilotProps {
  onApplySuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

export default function AICopilotPanel({
  onApplySuggestion,
  onDismissSuggestion,
}: AICopilotProps) {
  const [analysis] = useState<MixAnalysis>({
    energy: 65,
    frequencyBalance: "Bass-heavy",
    rhythmicComplexity: "Simple",
    crowdEngagement: 78,
  });

  const [suggestions, setSuggestions] = useState<AISuggestion[]>([
    {
      id: "sug1",
      priority: "high",
      category: "arrangement",
      title: "Add hi-hat variation at bar 8",
      description: "Introduce a half-time hi-hat pattern starting at bar 8",
      reason: "Creates anticipation and signals upcoming energy shift. This technique is used in 73% of successful drops in this genre.",
      confidence: 87,
      impact: "Increases perceived energy by ~15%",
    },
    {
      id: "sug2",
      priority: "medium",
      category: "mix",
      title: "Reduce bass by 2dB",
      description: "Lower bass channel from -6dB to -8dB",
      reason: "Current bass level is masking mid-range frequencies. Reduction will improve clarity and create better headroom for vocals.",
      confidence: 72,
      impact: "Improved clarity in 300-800Hz range",
    },
    {
      id: "sug3",
      priority: "medium",
      category: "crowd-requested",
      title: "Increase tempo from 78 to 82 BPM",
      description: "Gradual tempo increase over 8 bars",
      reason: "64% of crowd voted for faster tempo. However, current tempo matches genre conventions better.",
      confidence: 58,
      impact: "Higher crowd satisfaction, may lose genre authenticity",
    },
    {
      id: "sug4",
      priority: "low",
      category: "sound-design",
      title: "Add reverb tail to snare",
      description: "Apply 1.2s reverb with 30% wet mix to snare hits",
      reason: "Creates sense of space and depth. Complements the current ambient pad layer.",
      confidence: 65,
      impact: "Adds depth and atmosphere",
    },
  ]);

  const handleApply = (suggestionId: string) => {
    onApplySuggestion(suggestionId);
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const handleDismiss = (suggestionId: string) => {
    onDismissSuggestion(suggestionId);
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const handlePreview = (suggestionId: string) => {
    alert(`Preview feature - would demonstrate: ${suggestionId}`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "mix": return "🎚️";
      case "arrangement": return "🎼";
      case "sound-design": return "🔊";
      case "crowd-requested": return "👥";
      default: return "💡";
    }
  };

  return (
    <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1">🤖 AI Copilot</h2>
        <p className="text-xs text-zinc-400">
          Intelligent suggestions based on genre analysis, crowd feedback, and mixing principles
        </p>
      </div>

      {/* Current Analysis */}
      <div className="bg-black/30 rounded-xl p-4 mb-6 border border-white/5">
        <h3 className="text-sm font-semibold mb-3 text-zinc-300">Current Analysis</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Energy Level</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${analysis.energy}%` }}
                />
              </div>
              <span className="text-sm font-semibold">{analysis.energy}/100</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1">Crowd Engagement</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all"
                  style={{ width: `${analysis.crowdEngagement}%` }}
                />
              </div>
              <span className="text-sm font-semibold">{analysis.crowdEngagement}%</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500">Frequency Balance</p>
            <p className="text-sm font-semibold text-orange-400">{analysis.frequencyBalance}</p>
          </div>

          <div>
            <p className="text-xs text-zinc-500">Rhythmic Complexity</p>
            <p className="text-sm font-semibold text-blue-400">{analysis.rhythmicComplexity}</p>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="space-y-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-zinc-300">
            💡 Suggestions ({suggestions.length})
          </h3>
          {suggestions.length > 0 && (
            <button
              onClick={() => setSuggestions([])}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Dismiss All
            </button>
          )}
        </div>

        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <p className="text-sm">No active suggestions</p>
            <p className="text-xs mt-1">AI is analyzing your mix...</p>
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-black/30 rounded-xl p-4 border border-white/5 hover:border-white/10 transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCategoryIcon(suggestion.category)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(suggestion.priority)}`} />
                      <span className="text-xs uppercase tracking-wide text-zinc-500">
                        {suggestion.priority} Priority
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold">{suggestion.title}</h4>
                  </div>
                </div>

                {/* Confidence Badge */}
                <div className="bg-indigo-900/30 px-2 py-1 rounded text-xs">
                  <span className="text-indigo-400">{suggestion.confidence}%</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-300 mb-2">{suggestion.description}</p>

              {/* Reason */}
              <div className="bg-zinc-900/50 rounded-lg p-3 mb-3 border-l-2 border-indigo-500">
                <p className="text-xs text-zinc-400 mb-1">Why this suggestion:</p>
                <p className="text-xs text-zinc-300">{suggestion.reason}</p>
              </div>

              {/* Impact */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-zinc-500">Expected impact:</span>
                <span className="text-xs text-emerald-400">{suggestion.impact}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handlePreview(suggestion.id)}
                  className="flex-1 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/30 rounded text-xs transition text-emerald-300"
                >
                  Preview
                </button>
                <button
                  onClick={() => handleApply(suggestion.id)}
                  className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-xs font-semibold transition"
                >
                  Apply
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Learning Indicator */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-zinc-400">AI is actively learning from your decisions</span>
          </div>
          <button className="text-indigo-400 hover:text-indigo-300 transition">
            View History
          </button>
        </div>
      </div>
    </div>
  );
}
