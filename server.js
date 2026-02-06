/**
 * Crowd Music Server
 *
 * Core flow:
 * 1. Participants submit lyric lines (submit phase)
 * 2. Crowd votes live (vote phase)
 * 3. AI rewrites top line → crowd votes (ai phase)
 * 4. Winning line is added to the song
 *
 * Supports:
 * - Spectator (watch-only) mode
 * - Demo Mode with bot participants
 * - Real-time reactions
 * - Host / conductor controls
 */

const express = require("express");
const http = require("http");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// ✅ Persistence (MVP)
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
`);

const getBaseUrl = () => {
  // Render provides this
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;

  // fallback
  return process.env.BASE_URL || "http://localhost:3000";
};

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);

  const io = new Server(server, {
    path: "/api/socketio",
    cors: { origin: "*" },
  });

  const rooms = {};

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

        aiSource: null, // ✅ HERE ONLY

        lastChorus: null,

        currentQuestion: null,
        questionVotes: {},
        aiInsight: null,
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

      // ✅ MUST INCLUDE THIS
      aiSuggestions: room.aiSuggestions || [],

      hostId: room.hostId || null,
      paused: !!room.paused,
      theme: room.theme || "lofi heartbreak",
      lastWinner: room.lastWinner || null,

      currentQuestion: room.currentQuestion,
      aiInsight: room.aiInsight,
    });
  };


  // ✅ history API
  expressApp.get("/api/history/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    const rows = db
      .prepare("SELECT * FROM winners WHERE roomId=? ORDER BY round ASC")
      .all(roomId);
    res.json({ winners: rows });
  });

  const startRoomTimerIfNeeded = (roomId) => {
    const room = getRoom(roomId);
    if (room.intervalId) return;

   room.intervalId = setInterval(() => {
  if (room.paused) return;

  room.timeLeft -= 1;

  /* ⭐ FIX 1: Resolve producer question ON TIME */
 if (
  room.currentQuestion &&
  Date.now() > room.currentQuestion.endsAt
) {
  const entries = Object.entries(room.questionVotes);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total > 0) {
    entries.sort((a, b) => b[1] - a[1]);
    const [top, count] = entries[0];
    const percent = Math.round((count / total) * 100);

    room.aiInsight = `${percent}% prefer ${top}. Suggest committing this choice.`;
  } else {
    // ✅ fallback when no votes
    room.aiInsight =
      "No strong preference detected yet. Try adjusting the question or timing.";
  }

  room.currentQuestion = null;
}


  broadcastRoom(roomId);
}, 1000);
  };

  io.on("connection", (socket) => {
    socket.on("set_ai_suggestions", ({ roomId, suggestions }) => {
      const room = getRoom(roomId);
      if (!room) return;

      room.aiSuggestions = Array.isArray(suggestions) ? suggestions : [];
      room.aiVoted = new Set();

      broadcastRoom(roomId);
    });

    // Track reactions per room
const roomReactions = new Map();

socket.on("send_reaction", ({ roomId, emoji }) => {
  // Initialize if needed
  if (!roomReactions.has(roomId)) {
    roomReactions.set(roomId, {
      "🔥": 0,
      "❤️": 0,
      "🎵": 0,
      "⚡": 0,
      "😴": 0,
    });
  }

  // Increment count
  const reactions = roomReactions.get(roomId);
  reactions[emoji] = (reactions[emoji] || 0) + 1;

  // Broadcast to everyone in room
  io.to(roomId).emit("reactions_updated", reactions);
  
  console.log(`Reaction ${emoji} in room ${roomId}:`, reactions);
});

socket.on("submit_vote", ({ roomId, pollId, option }) => {
  // Track votes
  if (!pollVotes.has(pollId)) {
    pollVotes.set(pollId, {});
  }

  const votes = pollVotes.get(pollId);
  votes[option] = (votes[option] || 0) + 1;

  // Send results back to producer
  io.to(roomId).emit("poll_results", {
    pollId,
    votes,
  });
  
  console.log(`Vote in room ${roomId}:`, option, votes);
});
    socket.on("reaction", ({ roomId, emoji }) => {
      const room = getRoom(roomId);
      if (!room) return;

      // spectators + participants both allowed
      io.to(roomId).emit("reaction_broadcast", {
        emoji,
        at: Date.now(),
      });
    });
    socket.on("host_toggle_demo", ({ roomId, on }) => {
      const room = getRoom(roomId);
      if (room.hostId !== socket.id) return;

      room.demoMode = !!on;

      // create bots only once
      if (room.demoMode && room.bots.length === 0) {
        const names = [
          "Ava", "Noah", "Mia", "Liam", "Zoe", "Ethan", "Ivy", "Kai",
          "Nova", "Aria", "Jay", "Leo"
        ];

        // Create 8 bots
        room.bots = names.slice(0, 8).map((name, i) => ({
          id: `bot_${roomId}_${i}`,
          name,
        }));

        // Show them in participants list (as if they joined)
        room.participants = [
          ...room.participants,
          ...room.bots.map((b) => ({ id: b.id, name: `${b.name} (bot)` })),
        ];
      }

      // turning off demo mode doesn't remove humans; we can remove bots from list
      if (!room.demoMode && room.bots.length > 0) {
        const botIds = new Set(room.bots.map((b) => b.id));
        room.participants = room.participants.filter((p) => !botIds.has(p.id));
        room.bots = [];
      }

      broadcastRoom(roomId);
    });
    socket.on("join_room", ({ roomId, name, role }) => {
      socket.join(roomId);

      socket.data.roomId = roomId;
      socket.data.name = name || "Anonymous";
      socket.data.role = role === "spectator" ? "spectator" : "participant";

      const room = getRoom(roomId);

      if (socket.data.role === "spectator") {
        room.spectatorIds.add(socket.id);
      } else {
        // ✅ PREVENT DUPLICATE JOIN
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
    socket.on("submit_line", ({ roomId, text }) => {
      const room = getRoom(roomId);

      // 🔍 Debug safety
      if (!socket.data.role) {
        console.warn("❌ submit rejected: role missing");
        return;
      }

      if (socket.data.role !== "participant") {
        console.warn("❌ submit rejected: not participant");
        return;
      }

      if (room.phase !== "submit") {
        console.warn("❌ submit rejected: wrong phase", room.phase);
        return;
      }

      if (!text || !text.trim()) return;

      const author = room.participants.find(
        (p) => p.id === socket.id
      );

      if (!author) {
        console.warn("❌ submit rejected: author not in room");
        return;
      }

      room.submissions.unshift({
        id: crypto.randomUUID(),
        text: text.trim(),
        author: author.name,
        authorId: author.id,
        authorReputation: author.reputation || 0,
        votes: 0,
        createdAt: Date.now(),
      });

      console.log("✅ submission accepted:", text.trim());

      broadcastRoom(roomId);
    });

    // ========================================
// LYRIC CANVAS EVENTS
// ========================================

socket.on("update_lyrics", ({ roomId, lyrics }) => {
  console.log(`📝 Lyrics updated in room ${roomId}`);
  
  // Broadcast to everyone in the room
  io.to(roomId).emit("lyrics_updated", lyrics);
});

socket.on("submit_lyric_suggestion", ({ roomId, suggestion, userName }) => {
  console.log(`💡 Lyric suggestion in room ${roomId} from ${userName}`);
  
  const suggestionData = {
    id: Date.now().toString(),
    userId: socket.id,
    userName: userName || "Anonymous",
    suggestion: suggestion,
    votes: 0,
    timestamp: Date.now(),
  };
  
  // Send to everyone in the room
  io.to(roomId).emit("crowd_suggestion_received", suggestionData);
});
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
        (a, b) =>
          (b.votes + (b.authorReputation || 0)) -
          (a.votes + (a.authorReputation || 0))
      );

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
    // ✅ Host controls
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

      // ✅ Reset the session (DO NOT wipe participants/spectators)
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
    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = getRoom(roomId);

      // remove participant
      room.participants = room.participants.filter((u) => u.id !== socket.id);

      // remove spectator
      room.spectatorIds.delete(socket.id);

      // host reassignment
      if (room.hostId === socket.id) {
        room.hostId = room.participants[0]?.id || null;
      }

      broadcastRoom(roomId);
    });
    socket.on("host_force_ai", ({ roomId }) => {
      const room = getRoom(roomId);
      if (room.hostId !== socket.id) return;
      const leader = room.submissions[0];
      if (!leader) return;

      room.aiSource = {
        authorId: leader.authorId,
        originalText: leader.text,
      };


      fetchAIRewrites(leader.text, room.theme).then((arr) => {
        room.aiSuggestions = (arr.length ? arr : [leader.text, leader.text + "…", "Say it again, but softer."])
          .slice(0, 3)
          .map((text) => ({ id: crypto.randomUUID(), text, votes: 0 }));
        broadcastRoom(roomId);
      });
    });
   
  socket.on("producer_start_question", ({ roomId, question }) => {
  const room = getRoom(roomId);
  if (room.hostId !== socket.id) return;

  room.currentQuestion = {
    id: crypto.randomUUID(),
    category: question.category,
    label: question.label,
    options: question.options,
    endsAt: Date.now() + 8000,
  };

  room.questionVotes = {};
  question.options.forEach(opt => {
    room.questionVotes[opt] = 0;
  });

  room.aiInsight = null;

  // ✅ DEMO MODE AUTO VOTING
  if (room.demoMode && room.bots.length > 0) {
    room.bots.forEach(() => {
      const choice =
        question.options[Math.floor(Math.random() * question.options.length)];
      room.questionVotes[choice] += 1;
    });
  }

  broadcastRoom(roomId);
});



  socket.on("vote_option", ({ roomId, option }) => {
  const room = getRoom(roomId);
  if (!room.currentQuestion) return;

  room.questionVotes[option]++;
  broadcastRoom(roomId);
});

// In your socket handlers, add:
socket.on("ping", (timestamp) => {
  socket.emit("pong", {
    clientTimestamp: timestamp,
    serverTimestamp: Date.now(),
  });
});


// Add after your existing socket handlers

// WebRTC Signaling
socket.on("video_started", ({ roomId }) => {
  socket.to(roomId).emit("peer_joined_video", {
    peerId: socket.id,
    peerName: socket.data.name,
  });
});

socket.on("webrtc_offer", ({ peerId, offer }) => {
  io.to(peerId).emit("webrtc_offer", {
    peerId: socket.id,
    peerName: socket.data.name,
    offer,
  });
});

socket.on("webrtc_answer", ({ peerId, answer }) => {
  io.to(peerId).emit("webrtc_answer", {
    peerId: socket.id,
    answer,
  });
});

socket.on("ice_candidate", ({ peerId, candidate }) => {
  io.to(peerId).emit("ice_candidate", {
    peerId: socket.id,
    candidate,
  });
});

socket.on("video_stopped", ({ roomId }) => {
  socket.to(roomId).emit("peer_left_video", {
    peerId: socket.id,
  });
});

socket.on("screen_started", ({ roomId }) => {
  socket.to(roomId).emit("peer_screen_share", {
    peerId: socket.id,
    peerName: socket.data.name,
  });
});

// Ping/Pong for latency measurement (if not already added)
socket.on("ping", (timestamp) => {
  socket.emit("pong", { timestamp });
});

// Call this periodically when demo mode is on


  });

  // ✅ Lobby preview API (uses spectatorIds.size)
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
    });
  });
  // Next handles pages
  expressApp.use((req, res) => handle(req, res));
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
  

});

const BOT_LINES = [
  "We’re chasing lights in a quiet city",
  "I hear your name in the midnight rain",
  "This love feels warm, then turns to smoke",
  "Heartbeat bass under neon skies",
  "I’m learning peace, one breath at a time",
  "Your silence says what words can’t",
  "We fall apart, but still we sing",
  "Hold my hand, the night is long",
];

function demoBotsSubmit(room) {
  if (!room.demoMode || room.phase !== "submit") return;
  if (!room.bots?.length) return;

  // submit 2–3 lines per submit phase (not spam)
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const bot = room.bots[Math.floor(Math.random() * room.bots.length)];
    const text = BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];

    // prevent duplicate same text
    if (room.submissions.some((s) => s.text === text)) continue;

    room.submissions.unshift({
      id: crypto.randomUUID(),
      text,
      author: `${bot.name} (bot)`,
      authorId: bot.id,   // ⭐ REQUIRED
      votes: 0,
      createdAt: Date.now(),
    });
  }
}

function demoBotsVote(room) {
  if (!room.demoMode || room.phase !== "vote") return;
  if (!room.bots?.length) return;
  if (!room.submissions?.length) return;

  // each bot votes randomly (weighted toward top)
  room.submissions.sort((a, b) => b.votes - a.votes);

  room.bots.forEach((bot) => {
    // one vote per bot
    const choice = room.submissions[Math.floor(Math.random() * Math.min(3, room.submissions.length))];
    if (choice) choice.votes += 1;
  });

  room.submissions.sort((a, b) => b.votes - a.votes);
}

function demoBotsVoteAI(room) {
  if (!room.demoMode || room.phase !== "ai") return;
  if (!room.bots?.length) return;
  if (!room.aiSuggestions?.length) return;

  // bots vote AI suggestions
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

// Add to your demo bots logic
function demoBotsReactToAudio(room) {
  if (!room.demoMode) return;
  
  // Bots "react" to musical moments
  const reactions = ["🔥", "❤️", "🎵", "✨", "💯"];
  
  // Random bot reacts every 2-5 seconds
  const bot = room.bots[Math.floor(Math.random() * room.bots.length)];
  const emoji = reactions[Math.floor(Math.random() * reactions.length)];
  
  io.to(room.roomId).emit("reaction_broadcast", {
    emoji,
    userName: bot.name,
    at: Date.now(),
  });
}
