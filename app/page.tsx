"use client";

import { useState } from "react";

export default function Home() {
  const [roomId, setRoomId] = useState("");

  const go = () => {
    const id = roomId.trim() || crypto.randomUUID().slice(0, 6);
    window.location.href = `/room/${id}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-2xl p-6">
        <h1 className="text-2xl font-bold">Crowd Music MVP</h1>
        <p className="text-gray-600 mt-2">
          Create/join a room and collaboratively write + vote on lyrics live.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            className="border rounded-lg px-3 py-2 flex-1"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room id (optional)"
          />
          <button className="px-4 py-2 rounded-lg bg-black text-white" onClick={go}>
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
