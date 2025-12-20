const express = require("express");
const http = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);

  const io = new Server(server, {
    path: "/api/socketio",
    cors: { origin: "*" },
  });

  const rooms = {};

  const getRoom = (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        submissions: [],
        voted: new Set(),

        phase: "submit", // "submit" | "vote" | "ai"
        timeLeft: 30,
        round: 1,
        song: [],
        intervalId: null,

        aiSuggestions: [],
        aiVoted: new Set(),

        // ✅ Host/Conductor
        hostId: null,
        paused: false,
        theme: "lofi heartbreak",

        // ✅ Winner celebration
        lastWinner: null,
      };
    }
    return rooms[roomId];
  };

  const broadcastRoom = (roomId) => {
    const room = getRoom(roomId);
    io.to(roomId).emit("room_state", {
      users: room.users,
      submissions: room.submissions,
      phase: room.phase,
      timeLeft: room.timeLeft,
      round: room.round,
      song: room.song,
      aiSuggestions: room.aiSuggestions,

      hostId: room.hostId,
      paused: room.paused,
      theme: room.theme,
      lastWinner: room.lastWinner,
    });
  };

  const makeFakeAISuggestions = (line, theme) => {
    const clean = (line || "").trim();
    const t = (theme || "lofi heartbreak").toLowerCase();
    if (!clean) return [];

    const pack =
      t.includes("rap")
        ? [
            `🎤 ${clean} — I flip the script, I change the game.`,
            `🔥 ${clean} — bass so heavy, remember my name.`,
            `⚡ ${clean} — bars hit hard, no room for shame.`,
          ]
        : t.includes("happy")
        ? [
            `🌈 ${clean} — and now we dance into the light.`,
            `✨ ${clean} — sunshine in my chest tonight.`,
            `🎉 ${clean} — everything feels so right.`,
          ]
        : t.includes("romantic")
        ? [
            `💞 ${clean} — your name stays on my lips.`,
            `🌹 ${clean} — my heart forgets its grip.`,
            `🕯️ ${clean} — love turns the whole eclipse.`,
          ]
        : t.includes("motiv")
        ? [
            `🚀 ${clean} — I rise again, I won’t break.`,
            `💪 ${clean} — every fall is what I take.`,
            `🌟 ${clean} — I’m the spark the night can’t shake.`,
          ]
        : [
            `🎶 ${clean}, but I’m still holding on…`,
            `✨ ${clean} — and tonight I choose myself.`,
            `💔 ${clean}, yet the beat keeps moving on.`,
          ];

    return pack.map((text) => ({
      id: crypto.randomUUID(),
      text,
      votes: 0,
    }));
  };

  const startRoomTimerIfNeeded = (roomId) => {
    const room = getRoom(roomId);
    if (room.intervalId) return;

    room.intervalId = setInterval(() => {
      // ✅ Pause support
      if (room.paused) {
        broadcastRoom(roomId);
        return;
      }

      room.timeLeft -= 1;

      if (room.timeLeft <= 0) {
        if (room.phase === "submit") {
          room.phase = "vote";
          room.timeLeft = 15;
          room.voted = new Set();

          room.submissions.sort(
            (a, b) => (b.votes - a.votes) || (a.createdAt - b.createdAt)
          );
        } else if (room.phase === "vote") {
          const leader = room.submissions[0];
          room.aiSuggestions = leader
            ? makeFakeAISuggestions(leader.text, room.theme)
            : [];
          room.aiVoted = new Set();

          room.phase = "ai";
          room.timeLeft = 10;
        } else if (room.phase === "ai") {
          const aiWinner = room.aiSuggestions.sort((a, b) => b.votes - a.votes)[0];

          if (aiWinner) {
            room.song.push(aiWinner.text);
            room.lastWinner = { round: room.round, text: aiWinner.text };

            // auto-clear winner card after 6s
            setTimeout(() => {
              const r = getRoom(roomId);
              r.lastWinner = null;
              broadcastRoom(roomId);
            }, 6000);
          }

          room.round += 1;
          room.phase = "submit";
          room.timeLeft = 30;

          room.submissions = [];
          room.voted = new Set();
          room.aiSuggestions = [];
          room.aiVoted = new Set();
        }
      }

      broadcastRoom(roomId);
    }, 1000);
  };

  io.on("connection", (socket) => {
    socket.on("join_room", ({ roomId, name }) => {
      socket.join(roomId);
      socket.data.name = name;
      socket.data.roomId = roomId;

      const room = getRoom(roomId);
      room.users.push({ id: socket.id, name });

      // ✅ first user becomes host
      if (!room.hostId) room.hostId = socket.id;

      startRoomTimerIfNeeded(roomId);
      broadcastRoom(roomId);
    });

    socket.on("submit_line", ({ roomId, text }) => {
      const room = getRoom(roomId);
      if (room.phase !== "submit") return;
      if (!text || !text.trim()) return;

      room.submissions.unshift({
        id: crypto.randomUUID(),
        text: text.trim(),
        author: socket.data.name || "Anonymous",
        votes: 0,
        createdAt: Date.now(),
      });

      broadcastRoom(roomId);
    });

    socket.on("vote", ({ roomId, submissionId }) => {
      const room = getRoom(roomId);
      if (room.phase !== "vote") return;
      if (room.voted.has(socket.id)) return;

      const s = room.submissions.find((x) => x.id === submissionId);
      if (!s) return;

      s.votes++;
      room.voted.add(socket.id);

      room.submissions.sort(
        (a, b) => (b.votes - a.votes) || (a.createdAt - b.createdAt)
      );

      broadcastRoom(roomId);
    });

    socket.on("vote_ai", ({ roomId, suggestionId }) => {
      const room = getRoom(roomId);
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
      room.users = room.users.filter((u) => u.id !== socket.id);

      // if host leaves, give host to first remaining user
      if (room.hostId === socket.id) {
        room.hostId = room.users[0]?.id || null;
      }

      // stop timer if room empty
      if (room.users.length === 0 && room.intervalId) {
        clearInterval(room.intervalId);
        room.intervalId = null;
      }

      broadcastRoom(roomId);
    });
  });

  expressApp.use((req, res) => handle(req, res));

  const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

});
