"use client";

interface ParticipantPanelProps {
  socket: any;
  roomId: string;
  currentPoll: any;
}

export default function ParticipantPanel({ 
  socket, 
  roomId, 
  currentPoll 
}: ParticipantPanelProps) {
  
  const sendReaction = (emoji: string) => {
    socket.emit("send_reaction", {
      roomId,
      emoji,
      timestamp: Date.now(),
    });
  };

  const vote = (option: string) => {
    socket.emit("submit_vote", {
      roomId,
      pollId: currentPoll.id,
      option,
    });
  };

  return (
    <div className="bg-zinc-900/70 p-6 rounded-2xl">
      <h3 className="text-lg font-semibold mb-4">
        🎤 Participant Controls
      </h3>

      {/* Reaction Buttons */}
      <div className="mb-6">
        <p className="text-sm text-zinc-400 mb-3">Send Reactions:</p>
        <div className="flex gap-3">
          <button
            onClick={() => sendReaction("🔥")}
            className="text-3xl hover:scale-110 transition"
          >
            🔥
          </button>
          <button
            onClick={() => sendReaction("❤️")}
            className="text-3xl hover:scale-110 transition"
          >
            ❤️
          </button>
          <button
            onClick={() => sendReaction("🎵")}
            className="text-3xl hover:scale-110 transition"
          >
            🎵
          </button>
          <button
            onClick={() => sendReaction("⚡")}
            className="text-3xl hover:scale-110 transition"
          >
            ⚡
          </button>
          <button
            onClick={() => sendReaction("😴")}
            className="text-3xl hover:scale-110 transition"
          >
            😴
          </button>
        </div>
      </div>

      {/* Active Poll */}
      {currentPoll && (
        <div className="bg-black/30 p-4 rounded-xl">
          <p className="font-semibold mb-3">{currentPoll.question}</p>
          <div className="space-y-2">
            {currentPoll.options.map((option: string) => (
              <button
                key={option}
                onClick={() => vote(option)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {!currentPoll && (
        <div className="bg-black/30 p-4 rounded-xl text-center">
          <p className="text-sm text-zinc-500">
            Waiting for producer to launch a poll...
          </p>
        </div>
      )}
    </div>
  );
}