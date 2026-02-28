"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface LyricCanvasProps {
  socket: any;
  roomId: string;
  isHost: boolean;
}

const RHYMES: Record<string, string[]> = {
  night:  ["light","sight","flight","right","bright","tight"],
  love:   ["above","dove","shove","glove"],
  fire:   ["higher","desire","wire","entire","inspire"],
  pain:   ["rain","again","remain","vain","chain","brain"],
  heart:  ["start","apart","art","smart","part","dark"],
  soul:   ["whole","control","roll","goal","hole","cold"],
  dream:  ["seem","stream","team","scream","beam"],
  time:   ["rhyme","climb","prime","crime","lime"],
  sky:    ["fly","high","why","try","cry","die"],
  mind:   ["find","kind","blind","behind","grind"],
  blood:  ["flood","mud","bud","thud","drug"],
  touch:  ["much","such","rush","crush","hush"],
};

function getLastWord(text: string) {
  return text.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g,"") || "";
}

export default function LyricCanvas({ socket, roomId, isHost }: LyricCanvasProps) {
  const [lyrics, setLyrics] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [rhymes, setRhymes] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [synced, setSynced] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const broadcastTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket) return;

    // ── Participants receive live lyrics from host ──────────────────────────
    // This is the key fix: both "lyrics_updated" and "update_lyrics" are handled
    const handleLyricsUpdate = (newLyrics: string) => {
      if (!isHost) {
        setLyrics(newLyrics);
        const words = newLyrics.trim().split(/\s+/).filter(Boolean);
        setWordCount(words.length);
        setLineCount(newLyrics.split("\n").filter(l => l.trim()).length);
      }
    };

    socket.on("lyrics_updated", handleLyricsUpdate);

    // ── Crowd suggestions shown to host ───────────────────────────────────
    socket.on("crowd_suggestion_received", (data: any) => {
      setSuggestions(prev => {
        if (prev.some(s => s.id === data.id)) return prev;
        return [data, ...prev].slice(0, 15);
      });
    });

    return () => {
      socket.off("lyrics_updated", handleLyricsUpdate);
      socket.off("crowd_suggestion_received");
    };
  }, [socket, isHost]);

  // ── Host types → broadcast ─────────────────────────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isHost) return;
    const val = e.target.value;
    setLyrics(val);

    const words = val.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
    setLineCount(val.split("\n").filter(l => l.trim()).length);
    setRhymes(RHYMES[getLastWord(val)] || []);

    // Debounced broadcast to all participants
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    broadcastTimer.current = setTimeout(() => {
      socket.emit("update_lyrics", { roomId, lyrics: val });
      setSynced(true);
      setTimeout(() => setSynced(false), 2000);
    }, 250);
  }, [isHost, socket, roomId]);

  const insertRhyme = (word: string) => {
    if (!isHost || !textareaRef.current) return;
    const el = textareaRef.current;
    const pos = el.selectionStart;
    const newVal = lyrics.slice(0, pos) + word + lyrics.slice(el.selectionEnd);
    setLyrics(newVal);
    socket.emit("update_lyrics", { roomId, lyrics: newVal });
    setTimeout(() => { el.selectionStart = el.selectionEnd = pos + word.length; el.focus(); }, 0);
  };

  const applySuggestion = (s: any) => {
    if (!isHost) return;
    const newVal = lyrics + (lyrics.endsWith("\n") || !lyrics ? "" : "\n") + s.suggestion;
    setLyrics(newVal);
    socket.emit("update_lyrics", { roomId, lyrics: newVal });
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
  };

  const analyzeWithAI = async () => {
    if (!lyrics.trim() || isAnalyzing) return;
    setIsAnalyzing(true); setAiResult(null);
    try {
      const res = await fetch("/api/ai/rewrites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line: lyrics, theme: "current session" }),
      });
      const data = await res.json();
      setAiResult(Array.isArray(data?.suggestions) ? data.suggestions[0] : "AI unavailable.");
    } catch { setAiResult("AI service unavailable."); }
    finally { setIsAnalyzing(false); }
  };

  const section = lineCount === 0 ? "" : lineCount <= 2 ? "Intro" : lineCount <= 6 ? "Verse" : lineCount <= 10 ? "Chorus" : "Bridge";

  return (
    <div className="bg-zinc-900/90 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🎤 Live Lyric Canvas
            {isHost
              ? <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">You are writing</span>
              : <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">Live view</span>}
          </h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span>{wordCount} words</span>
            <span>·</span>
            <span>{lineCount} lines</span>
            {section && <><span>·</span><span className="text-zinc-400">{section}</span></>}
            {synced && isHost && <><span>·</span><span className="text-emerald-500">✓ synced</span></>}
          </div>
        </div>
        {isHost && (
          <div className="flex gap-2">
            <button onClick={analyzeWithAI} disabled={isAnalyzing || !lyrics.trim()}
              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-40 rounded-lg text-xs font-medium transition">
              {isAnalyzing ? "Analyzing..." : "🤖 AI Rewrite"}
            </button>
            <button onClick={() => { setLyrics(""); socket.emit("update_lyrics", { roomId, lyrics: "" }); }}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition">
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="p-6 space-y-4">
        {/* Main textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={lyrics}
            onChange={handleChange}
            readOnly={!isHost}
            placeholder={isHost
              ? "Start writing lyrics here...\n\nThe crowd sees every word as you type."
              : "Waiting for the producer to start writing..."}
            rows={10}
            className={`w-full bg-black/40 border rounded-xl px-5 py-4 text-base leading-relaxed resize-none focus:outline-none transition
              ${isHost
                ? "border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder:text-zinc-600 cursor-text"
                : "border-zinc-800 text-zinc-200 placeholder:text-zinc-600 cursor-default"}`}
            style={{ fontFamily: "Georgia, serif", minHeight: "220px" }}
          />
          {!isHost && lyrics && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-emerald-400">live</span>
            </div>
          )}
        </div>

        {/* Rhyme suggestions */}
        {isHost && rhymes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">Rhymes:</span>
            {rhymes.map(w => (
              <button key={w} onClick={() => insertRhyme(w)}
                className="px-3 py-1 bg-zinc-800 hover:bg-indigo-600 border border-zinc-700 hover:border-indigo-500 rounded-full text-xs transition">
                {w}
              </button>
            ))}
          </div>
        )}

        {/* AI result */}
        {aiResult && (
          <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <p className="text-xs font-semibold text-indigo-400 uppercase">🤖 AI Suggestion</p>
              <button onClick={() => setAiResult(null)} className="text-zinc-600 hover:text-zinc-400 text-xs">✕</button>
            </div>
            <p className="text-sm text-indigo-200 italic mb-3">"{aiResult}"</p>
            {isHost && (
              <button onClick={() => {
                const newVal = lyrics + "\n" + aiResult;
                setLyrics(newVal);
                socket.emit("update_lyrics", { roomId, lyrics: newVal });
                setAiResult(null);
              }} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs transition">
                Add to canvas →
              </button>
            )}
          </div>
        )}

        {/* Crowd suggestions (host only) */}
        {isHost && suggestions.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">💡 Crowd Suggestions ({suggestions.length})</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {suggestions.map(s => (
                <div key={s.id} className="flex items-start gap-3 bg-black/30 border border-white/5 rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm text-zinc-200">"{s.suggestion}"</p>
                    <p className="text-xs text-zinc-500 mt-0.5">— {s.userName}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => applySuggestion(s)}
                      className="px-3 py-1 bg-zinc-700 hover:bg-indigo-600 rounded-lg text-xs transition">Add</button>
                    <button onClick={() => setSuggestions(p => p.filter(x => x.id !== s.id))}
                      className="px-2 py-1 text-zinc-600 hover:text-zinc-400 rounded-lg text-xs transition">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Song section guide (host only) */}
        {isHost && (
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5">
            {[["Intro","1–2","text-zinc-400"],["Verse","3–6","text-blue-400"],["Chorus","7–10","text-purple-400"],["Bridge","11+","text-orange-400"]].map(([label, lines, color]) => (
              <div key={label} className={`text-center py-2 rounded-lg bg-black/20 border ${section === label ? "border-white/20 bg-white/5" : "border-transparent"}`}>
                <p className={`text-xs font-semibold ${color}`}>{label}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{lines} lines</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
