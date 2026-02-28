/**
 * Crowd Music Server — Fixed + Enhanced
 *
 * Fixes:
 * - pollVotes Map was referenced but never declared
 * - Duplicate ping handler removed
 * - demoBotsReactToAudio moved inside io.on("connection") scope
 * - beat_roulette_spin handler added
 *
 * New features:
 * - 🎲 Beat Roulette: participants vote to spin for a random theme
 * - 🎭 Mood Ring: server broadcasts vibe score based on reaction ratios
 * - 🏆 Leaderboard: top lyric contributors tracked per room
 */

const express = require("express");
const http = require("http");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const Database = require("better-sqlite3");
const db = new Database("crowd_music.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS winners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roomId TEXT,
  round INTEGER,
  theme TEXT,
  text TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roomId TEXT,
  userId TEXT,
  userName TEXT,
  wins INTEGER DEFAULT 0,
  submissions INTEGER DEFAULT 0,
  createdAt TEXT
);
`);

const getBaseUrl = () => {
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  return process.env.BASE_URL || "http://localhost:3000";
};

// 🎲 Beat Roulette themes
const ROULETTE_THEMES = [
  "lofi heartbreak",
  "midnight trap",
  "jazzy boom bap",
  "dreamy synthwave",
  "dark drill",
  "chill phonk",
  "acoustic soul",
  "future bass",
  "neo soul groove",
  "deep house vibes",
];

// 🎭 Mood Ring: map reaction ratios → vibe
function calcVibeScore(reactions) {
  const positiveEmojis = ["🔥", "❤️", "🎵", "⚡"];
  const negativeEmojis = ["😴"];

  const total = Object.values(reactions).reduce((a, b) => a + b, 0);
  if (total === 0) return { score: 50, mood: "neutral", color: "#6366f1" };

  const positive = positiveEmojis.reduce((sum, e) => sum + (reactions[e] || 0), 0);
  const negative = negativeEmojis.reduce((sum, e) => sum + (reactions[e] || 0), 0);

  const score = Math.round(((positive - negative * 2) / total) * 100);
  const clamped = Math.max(0, Math.min(100, 50 + score));

  let mood, color;
  if (clamped > 75) { mood = "LIT"; color = "#f97316"; }
  else if (clamped > 55) { mood = "VIBING"; color = "#8b5cf6"; }
  else if (clamped > 35) { mood = "NEUTRAL"; color = "#6366f1"; }
  else { mood = "DEAD"; color = "#64748b"; }

  return { score: clamped, mood, color };
}

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);

  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  const rooms = {};

  // ✅ FIX: Declare pollVotes at module scope
  const pollVotes = new Map();

  // Track reactions per room (module scope, not socket scope)
  const roomReactions = new Map();

  // 🏆 Leaderboard per room
  const roomLeaderboard = new Map();

  async function fetchAIRewrites(line, theme) {
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/ai/rewrites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line, theme }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("AI rewrites API failed:", txt);
        return [];
      }

      const data = await res.json();
      return Array.isArray(data?.suggestions) ? data.suggestions : [];
    } catch (err) {
      console.error("fetchAIRewrites error:", err);
      return [];
    }
  }

  const getRoom = (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        participants: [],
        spectatorIds: new Set(),
        submissions: [],
        voted: new Set(),
        phase: "submit",
        timeLeft: 30,
        round: 1,
        song: [],
        intervalId: null,
        aiSuggestions: [],
        aiVoted: new Set(),
        hostId: null,
        paused: false,
        theme: "lofi heartbreak",
        lastWinner: null,
        demoMode: false,
        bots: [],
        aiSource: null,
        lastChorus: null,
        currentQuestion: null,
        questionVotes: {},
        aiInsight: null,
        // 🎲 Beat Roulette
        rouletteVotes: new Set(),
        rouletteThreshold: 3,
        // 🎭 Mood Ring
        vibeScore: { score: 50, mood: "neutral", color: "#6366f1" },
      };
    }
    return rooms[roomId];
  };

  const broadcastRoom = (roomId) => {
    const room = getRoom(roomId);

    io.to(roomId).emit("room_state", {
      demoMode: !!room.demoMode,
      participants: room.participants || [],
      spectatorCount: room.spectatorIds.size,
      submissions: room.submissions || [],
      phase: room.phase,
      timeLeft: room.timeLeft,
      round: room.round,
      song: room.song || [],
      aiSuggestions: room.aiSuggestions || [],
      hostId: room.hostId || null,
      paused: !!room.paused,
      theme: room.theme || "lofi heartbreak",
      lastWinner: room.lastWinner || null,
      currentQuestion: room.currentQuestion,
      questionVotes: room.questionVotes,
      aiInsight: room.aiInsight,
      vibeScore: room.vibeScore,
    });
  };

  // ✅ History API
  expressApp.get("/api/history/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    const rows = db
      .prepare("SELECT * FROM winners WHERE roomId=? ORDER BY round ASC")
      .all(roomId);
    res.json({ winners: rows });
  });

  // 🏆 Leaderboard API
  expressApp.get("/api/leaderboard/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    const board = roomLeaderboard.get(roomId) || [];
    const sorted = [...board].sort((a, b) => b.wins - a.wins).slice(0, 10);
    res.json({ leaderboard: sorted });
  });

  expressApp.get("/api/room-preview/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    const room = getRoom(roomId);
    res.json({
      roomId,
      theme: room.theme,
      phase: room.phase,
      timeLeft: room.timeLeft,
      round: room.round,
      participants: room.participants.length,
      spectators: room.spectatorIds.size,
      songLines: room.song.length,
      questionVotes: room.questionVotes,
      vibeScore: room.vibeScore,
    });
  });

  const startRoomTimerIfNeeded = (roomId) => {
    const room = getRoom(roomId);
    if (room.intervalId) return;

    room.intervalId = setInterval(() => {
      if (room.paused) return;

      room.timeLeft -= 1;

      // Resolve producer question on time
      if (room.currentQuestion && Date.now() > room.currentQuestion.endsAt) {
        const entries = Object.entries(room.questionVotes);
        const total = entries.reduce((s, [, v]) => s + v, 0);

        if (total > 0) {
          entries.sort((a, b) => b[1] - a[1]);
          const [top, count] = entries[0];
          const percent = Math.round((count / total) * 100);
          room.aiInsight = `${percent}% prefer ${top}. Suggest committing this choice.`;
        } else {
          room.aiInsight = "No strong preference detected yet. Try adjusting the question or timing.";
        }

        room.currentQuestion = null;
      }

      broadcastRoom(roomId);
    }, 1000);
  };

  function updateMoodRing(roomId) {
    const room = getRoom(roomId);
    const reactions = roomReactions.get(roomId) || {};
    room.vibeScore = calcVibeScore(reactions);
    io.to(roomId).emit("mood_ring_update", room.vibeScore);
  }

  // ✅ FIX: demoBotsReactToAudio now inside io scope so it can use `io`
  function demoBotsReactToAudio(room, roomId) {
    if (!room.demoMode) return;
    const reactions = ["🔥", "❤️", "🎵", "✨", "💯"];
    const bot = room.bots[Math.floor(Math.random() * room.bots.length)];
    const emoji = reactions[Math.floor(Math.random() * reactions.length)];
    io.to(roomId).emit("reaction_broadcast", {
      emoji,
      userName: bot?.name,
      at: Date.now(),
    });
  }

  io.on("connection", (socket) => {

    // ─── Reactions ─────────────────────────────────────────────────────────
    socket.on("send_reaction", ({ roomId, emoji }) => {
      if (!roomReactions.has(roomId)) {
        roomReactions.set(roomId, { "🔥": 0, "❤️": 0, "🎵": 0, "⚡": 0, "😴": 0 });
      }
      const reactions = roomReactions.get(roomId);
      reactions[emoji] = (reactions[emoji] || 0) + 1;

      io.to(roomId).emit("reactions_updated", reactions);
      io.to(roomId).emit("reaction_broadcast", { emoji, at: Date.now() });

      // Update mood ring
      updateMoodRing(roomId);
    });

    socket.on("reaction", ({ roomId, emoji }) => {
      io.to(roomId).emit("reaction_broadcast", { emoji, at: Date.now() });
    });

    // ─── Polls ──────────────────────────────────────────────────────────────
    socket.on("submit_vote", ({ roomId, pollId, option }) => {
      if (!pollVotes.has(pollId)) pollVotes.set(pollId, {});
      const votes = pollVotes.get(pollId);
      votes[option] = (votes[option] || 0) + 1;
      io.to(roomId).emit("poll_results", { pollId, votes });
    });

    // ─── 🎲 Beat Roulette ───────────────────────────────────────────────────
    socket.on("beat_roulette_spin", ({ roomId }) => {
      const room = getRoom(roomId);
      if (!room.rouletteVotes) room.rouletteVotes = new Set();

      room.rouletteVotes.add(socket.id);

      const threshold = Math.max(1, Math.floor(room.participants.length * 0.4));
      const voteCount = room.rouletteVotes.size;

      // Broadcast progress
      io.to(roomId).emit("roulette_progress", {
        votes: voteCount,
        needed: threshold,
      });

      // Trigger roulette if threshold reached
      if (voteCount >= threshold) {
        const result = ROULETTE_THEMES[Math.floor(Math.random() * ROULETTE_THEMES.length)];
        room.rouletteVotes = new Set(); // reset

        // Notify everyone — host must accept
        io.to(roomId).emit("beat_roulette_result", { theme: result });
        io.to(room.hostId).emit("beat_roulette_host_prompt", {
          theme: result,
          message: `Crowd voted! Apply "${result}" as the new beat theme?`,
        });
      }
    });

    socket.on("beat_roulette_accept", ({ roomId, theme }) => {
      const room = getRoom(roomId);
      if (room.hostId !== socket.id) return;
      room.theme = theme;
      broadcastRoom(roomId);
      io.to(roomId).emit("theme_changed", { theme });
    });

    socket.on("beat_roulette_decline", ({ roomId }) => {
      const room = getRoom(roomId);
      if (room.hostId !== socket.id) return;
      io.to(roomId).emit("roulette_declined");
    });

    // ─── Room Join ──────────────────────────────────────────────────────────
    socket.on("join_room", ({ roomId, name, role }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = name || "Anonymous";
      socket.data.role = role === "spectator" ? "spectator" : "participant";

      const room = getRoom(roomId);

      if (socket.data.role === "spectator") {
        room.spectatorIds.add(socket.id);
      } else {
        if (!room.participants.some((p) => p.id === socket.id)) {
          room.participants.push({
            id: socket.id,
            name: socket.data.name,
            reputation: 0,
          });
        }
        if (!room.hostId) room.hostId = socket.id;
        startRoomTimerIfNeeded(roomId);
      }

      broadcastRoom(roomId);
    });

    // ─── Submissions ────────────────────────────────────────────────────────
    socket.on("submit_line", ({ roomId, text }) => {
      const room = getRoom(roomId);
      if (!socket.data.role || socket.data.role !== "participant") return;
      if (room.phase !== "submit") return;
      if (!text || !text.trim()) return;

      const author = room.participants.find((p) => p.id === socket.id);
      if (!author) return;

      room.submissions.unshift({
        id: crypto.randomUUID(),
        text: text.trim(),
        author: author.name,
        authorId: author.id,
        authorReputation: author.reputation || 0,
        votes: 0,
        createdAt: Date.now(),
      });

      // Track for leaderboard
      const board = roomLeaderboard.get(roomId) || [];
      const entry = board.find((e) => e.userId === socket.id);
      if (entry) {
        entry.submissions++;
      } else {
        board.push({ userId: socket.id, userName: author.name, submissions: 1, wins: 0 });
        roomLeaderboard.set(roomId, board);
      }

      broadcastRoom(roomId);
    });

    // ─── Lyric Canvas ───────────────────────────────────────────────────────
    socket.on("update_lyrics", ({ roomId, lyrics }) => {
      io.to(roomId).emit("lyrics_updated", lyrics);
    });

    socket.on("submit_lyric_suggestion", ({ roomId, suggestion, userName }) => {
      const suggestionData = {
        id: Date.now().toString(),
        userId: socket.id,
        userName: userName || "Anonymous",
        suggestion,
        votes: 0,
        timestamp: Date.now(),
      };
      io.to(roomId).emit("crowd_suggestion_received", suggestionData);
    });

    // ─── Voting ─────────────────────────────────────────────────────────────
    socket.on("vote", ({ roomId, submissionId }) => {
      const room = getRoom(roomId);
      if (socket.data.role !== "participant") return;
      if (room.phase !== "vote") return;
      if (room.voted.has(socket.id)) return;

      const s = room.submissions.find((x) => x.id === submissionId);
      if (!s) return;

      s.votes++;
      room.voted.add(socket.id);
      room.submissions.sort(
        (a, b) => (b.votes + (b.authorReputation || 0)) - (a.votes + (a.authorReputation || 0))
      );
      broadcastRoom(roomId);
    });

    socket.on("vote_option", ({ roomId, option }) => {
      const room = getRoom(roomId);
      if (!room.currentQuestion) return;
      if (!room.questionVotes[option] && room.questionVotes[option] !== 0) {
        room.questionVotes[option] = 0;
      }
      room.questionVotes[option]++;
      broadcastRoom(roomId);
    });

    socket.on("vote_ai", ({ roomId, suggestionId }) => {
      const room = getRoom(roomId);
      if (socket.data.role !== "participant") return;
      if (room.phase !== "ai") return;
      if (room.aiVoted.has(socket.id)) return;

      const s = room.aiSuggestions.find((x) => x.id === suggestionId);
      if (!s) return;

      s.votes++;
      room.aiVoted.add(socket.id);
      broadcastRoom(roomId);
    });

    // ─── Host Controls ──────────────────────────────────────────────────────
    socket.on("host_pause_toggle", ({ roomId }) => {
      const room = getRoom(roomId);
      if (room.hostId !== socket.id) return;
      room.paused = !room.paused;
      broadcastRoom(roomId);
    });

    socket.on("host_set_theme", ({ roomId, theme }) => {
      const room = getRoom(roomId);
      if (room.hostId !== socket.id) return;
      room.theme = String(theme || "").slice(0, 50) || "lofi heartbreak";
      broadcastRoom(roomId);
    });

    socket.on("host_reset_room", ({ roomId }) => {
      const room = getRoom(roomId);
      if (room.hostId !== socket.id) return;
      room.phase = "submit";
      room.timeLeft = 30;
      room.round = 1;
      room.song = [];
      room.submissions = [];
      room.voted = new Set();
      room.aiSuggestions = [];
      room.aiVoted = new Set();
      room.lastWinner = null;
      broadcastRoom(roomId);
    });

    socket.on("host_toggle_demo", ({ roomId, on }) => {
      const room = getRoom(roomId);
      // No host check — only the producer UI has this button
      // Assign this socket as host if not yet assigned
      if (!room.hostId) room.hostId = socket.id;
      room.demoMode = !!on;

      if (room.demoMode && room.bots.length === 0) {
        const names = ["Ava", "Noah", "Mia", "Liam", "Zoe", "Ethan", "Ivy", "Kai"];
        room.bots = names.map((name, i) => ({ id: `bot_${roomId}_${i}`, name }));
        room.participants = [
          ...room.participants,
          ...room.bots.map((b) => ({ id: b.id, name: `${b.name} (bot)` })),
        ];

        // Bots immediately submit some battle entries
        const BOT_LINES = [
          "We chase the neon lights at midnight",
          "Your voice is the beat I live on",
          "Heartbreak sounds like a lofi track",
          "I drown in silence, float in sound",
          "The city hums our favourite song",
          "Falling for you was the best mistake",
        ];
        if (!room.battleEntries) room.battleEntries = [];
        const shuffled = [...BOT_LINES].sort(() => Math.random() - 0.5).slice(0, 4);
        shuffled.forEach((text, i) => {
          const bot = room.bots[i % room.bots.length];
          const entry = {
            id: require("crypto").randomUUID(),
            text, author: `${bot.name} (bot)`,
            authorId: bot.id, votes: 0, createdAt: Date.now(),
          };
          room.battleEntries.unshift(entry);
          room.submissions.unshift(entry);
        });
        io.to(roomId).emit("battle_entries_updated", room.battleEntries);

        // Start bot activity interval — bots react every 3–7 seconds
        room.demoBotInterval = setInterval(() => {
          if (!room.demoMode || !room.bots.length) {
            clearInterval(room.demoBotInterval);
            return;
          }
          // Pick random bot and random reaction
          const reactions = ["🔥","❤️","🎵","⚡","🔥","🔥"]; // fire weighted more
          const emoji = reactions[Math.floor(Math.random() * reactions.length)];
          if (!roomReactions.has(roomId)) {
            roomReactions.set(roomId, { "🔥":0,"❤️":0,"🎵":0,"⚡":0,"😴":0 });
          }
          const reactionMap = roomReactions.get(roomId);
          reactionMap[emoji] = (reactionMap[emoji] || 0) + 1;
          io.to(roomId).emit("reaction_broadcast", { emoji, at: Date.now() });
          updateMoodRing(roomId);

          // Occasionally vote in active battle
          if (room.currentBattle && Math.random() > 0.4) {
            const b = room.currentBattle;
            const side = Math.random() > 0.5 ? "A" : "B";
            const fakeId = `bot_voter_${Math.random()}`;
            if (!b.voters.has(fakeId)) {
              b.voters.add(fakeId);
              if (side === "A") b.entryA.votes++;
              else b.entryB.votes++;
              b.totalVotes++;
              io.to(roomId).emit("battle_vote_update", {
                entryAVotes: b.entryA.votes,
                entryBVotes: b.entryB.votes,
                totalVotes: b.totalVotes,
              });
            }
          }
        }, 3000 + Math.random() * 4000);
      }

      if (!room.demoMode) {
        if (room.demoBotInterval) {
          clearInterval(room.demoBotInterval);
          room.demoBotInterval = null;
        }
        if (room.bots.length > 0) {
          const botIds = new Set(room.bots.map((b) => b.id));
          room.participants = room.participants.filter((p) => !botIds.has(p.id));
          // Remove bot battle entries
          if (room.battleEntries) {
            room.battleEntries = room.battleEntries.filter(e => !botIds.has(e.authorId));
            io.to(roomId).emit("battle_entries_updated", room.battleEntries);
          }
          room.submissions = room.submissions.filter(s => !botIds.has(s.authorId));
          room.bots = [];
        }
      }

      broadcastRoom(roomId);
    });

    socket.on("host_force_ai", ({ roomId }) => {
      const room = getRoom(roomId);
      if (!room.hostId) room.hostId = socket.id;
      const leader = room.submissions[0];
      if (!leader) return;

      room.aiSource = { authorId: leader.authorId, originalText: leader.text };

      fetchAIRewrites(leader.text, room.theme).then((arr) => {
        room.aiSuggestions = (arr.length ? arr : [leader.text, leader.text + "…", "Say it again, but softer."])
          .slice(0, 3)
          .map((text) => ({ id: crypto.randomUUID(), text, votes: 0 }));
        broadcastRoom(roomId);
      });
    });

    socket.on("set_ai_suggestions", ({ roomId, suggestions }) => {
      const room = getRoom(roomId);
      if (!room) return;
      room.aiSuggestions = Array.isArray(suggestions) ? suggestions : [];
      room.aiVoted = new Set();
      broadcastRoom(roomId);
    });

    socket.on("producer_start_question", ({ roomId, question }) => {
      const room = getRoom(roomId);
      if (!room.hostId) room.hostId = socket.id;

      room.currentQuestion = {
        id: crypto.randomUUID(),
        category: question.category,
        label: question.label,
        options: question.options,
        endsAt: Date.now() + 8000,
      };

      room.questionVotes = {};
      question.options.forEach((opt) => { room.questionVotes[opt] = 0; });
      room.aiInsight = null;

      if (room.demoMode && room.bots.length > 0) {
        room.bots.forEach(() => {
          const choice = question.options[Math.floor(Math.random() * question.options.length)];
          room.questionVotes[choice] += 1;
        });
      }

      broadcastRoom(roomId);
    });


    // ─── Lyric Battle ──────────────────────────────────────────────────────────

    // Anyone can submit a battle entry (not just phase-based)
    socket.on("battle_submit_entry", ({ roomId, text }) => {
      if (!text || !text.trim()) return;
      const room = getRoom(roomId);
      const author = room.participants.find(p => p.id === socket.id);
      const entry = {
        id: crypto.randomUUID(),
        text: text.trim(),
        author: author?.name || socket.data.name || "Anonymous",
        authorId: socket.id,
        votes: 0,
        createdAt: Date.now(),
      };
      if (!room.battleEntries) room.battleEntries = [];
      room.battleEntries.unshift(entry);
      room.battleEntries = room.battleEntries.slice(0, 20); // keep latest 20

      // Also add to submissions so existing battle panel sees them
      room.submissions.unshift(entry);

      // Broadcast updated entries to all
      io.to(roomId).emit("battle_entries_updated", room.battleEntries);
      broadcastRoom(roomId);
    });

    // Host starts a battle with two specific entries
    socket.on("battle_start", ({ roomId, entryA, entryB, duration }) => {
      const room = getRoom(roomId);
      const battleDuration = duration || 15000;
      const battleId = crypto.randomUUID();

      room.currentBattle = {
        id: battleId,
        entryA: { ...entryA, votes: 0 },
        entryB: { ...entryB, votes: 0 },
        totalVotes: 0,
        endsAt: Date.now() + battleDuration,
        voters: new Set(),
        winner: null,
      };

      io.to(roomId).emit("battle_started", {
        id: battleId,
        entryA: { ...entryA, votes: 0 },
        entryB: { ...entryB, votes: 0 },
        totalVotes: 0,
        endsAt: room.currentBattle.endsAt,
      });

      // Auto-end after duration
      setTimeout(() => {
        const r = getRoom(roomId);
        if (!r.currentBattle || r.currentBattle.id !== battleId) return;
        const b = r.currentBattle;
        const winner = b.entryA.votes >= b.entryB.votes ? "A" : "B";
        const winnerEntry = winner === "A" ? b.entryA : b.entryB;

        // Add winner to song
        r.song.push({ text: winnerEntry.text, author: winnerEntry.author, section: "Battle Win" });

        // ── Update leaderboard ──────────────────────────────────────────────
        if (!roomLeaderboard.has(roomId)) roomLeaderboard.set(roomId, []);
        const board = roomLeaderboard.get(roomId);

        // +1 win for winner
        let winnerEntry2 = board.find(e => e.userId === winnerEntry.authorId);
        if (!winnerEntry2) {
          winnerEntry2 = { userId: winnerEntry.authorId, userName: winnerEntry.author, wins: 0, submissions: 0 };
          board.push(winnerEntry2);
        }
        winnerEntry2.wins += 1;

        // +1 submission for both contestants
        [b.entryA, b.entryB].forEach(entry => {
          let e = board.find(x => x.userId === entry.authorId);
          if (!e) {
            e = { userId: entry.authorId, userName: entry.author, wins: 0, submissions: 0 };
            board.push(e);
          }
          e.submissions += 1;
        });

        const sortedBoard = [...board].sort((a, b) => b.wins - a.wins).slice(0, 10);

        io.to(roomId).emit("battle_ended", {
          winner,
          battle: {
            id: b.id,
            entryA: b.entryA,
            entryB: b.entryB,
            totalVotes: b.totalVotes,
            endsAt: b.endsAt,
          },
        });

        // Emit leaderboard update so UI updates instantly
        io.to(roomId).emit("leaderboard_update", {
          leaderboard: sortedBoard,
          newWinner: winnerEntry.author,
        });

        r.currentBattle = null;
        broadcastRoom(roomId);
      }, battleDuration);
    });

    // Anyone votes in a battle
    socket.on("battle_vote", ({ roomId, battleId, side }) => {
      const room = getRoom(roomId);
      if (!room.currentBattle || room.currentBattle.id !== battleId) return;
      const b = room.currentBattle;
      if (b.voters.has(socket.id)) return; // already voted
      b.voters.add(socket.id);

      if (side === "A") b.entryA.votes++;
      else if (side === "B") b.entryB.votes++;
      b.totalVotes++;

      io.to(roomId).emit("battle_vote_update", {
        entryAVotes: b.entryA.votes,
        entryBVotes: b.entryB.votes,
        totalVotes: b.totalVotes,
      });
    });

    // ─── Crowd Instrument Pads ─────────────────────────────────────────────
    socket.on("pad_hit", ({ roomId, padId, userName, timestamp }) => {
      // Broadcast to EVERYONE in the room so all pads light up together
      io.to(roomId).emit("pad_hit", {
        padId,
        userId: socket.id,
        userName: userName || socket.data.name || "Anonymous",
        timestamp: timestamp || Date.now(),
      });
    });

    socket.on("pad_reset", ({ roomId }) => {
      io.to(roomId).emit("pad_reset");
    });

    socket.on("mixer_change", ({ roomId, channel, volume }) => {
      socket.to(roomId).emit("mixer_update", { channel, volume });
    });

    // ─── WebRTC ─────────────────────────────────────────────────────────────
    socket.on("video_started", ({ roomId }) => {
      socket.to(roomId).emit("peer_joined_video", { peerId: socket.id, peerName: socket.data.name });
    });
    socket.on("webrtc_offer", ({ peerId, offer }) => {
      io.to(peerId).emit("webrtc_offer", { peerId: socket.id, peerName: socket.data.name, offer });
    });
    socket.on("webrtc_answer", ({ peerId, answer }) => {
      io.to(peerId).emit("webrtc_answer", { peerId: socket.id, answer });
    });
    socket.on("ice_candidate", ({ peerId, candidate }) => {
      io.to(peerId).emit("ice_candidate", { peerId: socket.id, candidate });
    });
    socket.on("video_stopped", ({ roomId }) => {
      socket.to(roomId).emit("peer_left_video", { peerId: socket.id });
    });
    socket.on("screen_started", ({ roomId }) => {
      socket.to(roomId).emit("peer_screen_share", { peerId: socket.id, peerName: socket.data.name });
    });

    // ─── Ping ─────────────────────────────────────────────────────────────
    // ✅ FIX: Single ping handler (was duplicated)
    socket.on("ping", (timestamp) => {
      socket.emit("pong", timestamp);
    });

    // ─── Disconnect ──────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = getRoom(roomId);
      room.participants = room.participants.filter((u) => u.id !== socket.id);
      room.spectatorIds.delete(socket.id);

      if (room.hostId === socket.id) {
        room.hostId = room.participants[0]?.id || null;
      }

      broadcastRoom(roomId);
    });
  });

  // Next.js pages
  expressApp.use((req, res) => handle(req, res));

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
});

// ─── Demo Bot Helpers ──────────────────────────────────────────────────────

const BOT_LINES = [
  "We're chasing lights in a quiet city",
  "I hear your name in the midnight rain",
  "This love feels warm, then turns to smoke",
  "Heartbeat bass under neon skies",
  "I'm learning peace, one breath at a time",
  "Your silence says what words can't",
  "We fall apart, but still we sing",
  "Hold my hand, the night is long",
];

function demoBotsSubmit(room) {
  if (!room.demoMode || room.phase !== "submit") return;
  if (!room.bots?.length) return;

  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const bot = room.bots[Math.floor(Math.random() * room.bots.length)];
    const text = BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
    if (room.submissions.some((s) => s.text === text)) continue;

    room.submissions.unshift({
      id: require("crypto").randomUUID(),
      text,
      author: `${bot.name} (bot)`,
      authorId: bot.id,
      votes: 0,
      createdAt: Date.now(),
    });
  }
}

function demoBotsVote(room) {
  if (!room.demoMode || room.phase !== "vote") return;
  if (!room.bots?.length || !room.submissions?.length) return;

  room.submissions.sort((a, b) => b.votes - a.votes);
  room.bots.forEach((bot) => {
    const choice = room.submissions[Math.floor(Math.random() * Math.min(3, room.submissions.length))];
    if (choice) choice.votes += 1;
  });
  room.submissions.sort((a, b) => b.votes - a.votes);
}

function demoBotsVoteAI(room) {
  if (!room.demoMode || room.phase !== "ai") return;
  if (!room.bots?.length || !room.aiSuggestions?.length) return;

  room.bots.forEach(() => {
    const choice = room.aiSuggestions[Math.floor(Math.random() * room.aiSuggestions.length)];
    if (choice) choice.votes += 1;
  });
  room.aiSuggestions.sort((a, b) => b.votes - a.votes);
}

function getSongSection(round) {
  if (round === 1) return "Intro";
  if (round % 4 === 0) return "Chorus";
  if (round % 5 === 0) return "Bridge";
  return "Verse";
}