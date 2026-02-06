"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";


export default function Lobby() {
  const params = useParams<{ roomId: string }>();
  const roomId = String(params.roomId);

  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState<string>("");

  const refresh = async () => {
    try {
      setErr("");
      const res = await fetch(`/api/room-preview/${roomId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setInfo(data);
    } catch (e: any) {
      setErr("Could not load room preview. Is the server running?");
      setInfo(null);
    }
  };



  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500); // live-ish preview
    return () => clearInterval(t);
  }, [roomId]);

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    alert("✅ Copied!");
  };

  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen p-8 text-white bg-gradient-to-b from-[#0B0E14] via-[#0F172A] to-black">
      <div className="max-w-3xl mx-auto">
        <div className="bg-black/50 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-semibold">🎧 Music Room Lobby</h1>
              <p className="text-gray-300 mt-1">
                Room: <span className="font-mono text-white">{roomId}</span>
              </p>
            </div>

            <button
              onClick={refresh}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              ↻ Refresh
            </button>
          </div>

          {err ? (
            <p className="mt-6 text-red-300">{err}</p>
          ) : !info ? (
            <p className="mt-6 text-gray-400">Loading live room status…</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card label="Theme" value={info.theme} />
              <Card label="Round" value={String(info.round)} />
              <Card label="Phase" value={`${info.phase} (${info.timeLeft}s)`} />
              <Card
                label="Live"
                value={`${info.participants} participants • ${info.spectators} spectators`}
              />
              <Card label="Song lines" value={String(info.songLines)} />
              <Card label="Tip" value="Share & invite friends to vote live" />
            </div>
          )}

          <div className="mt-8 flex gap-3 flex-wrap">
            <Link
              href={`/room/${roomId}`}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold"
            >
              🚀 Join as Participant
            </Link>

            <Link
              href={`/room/${roomId}?mode=watch`}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold"
            >
              👀 Watch as Spectator
            </Link>

            <Link
              href={`/room/${roomId}`}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              Open Room
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => copyLink(`${base}/room/${roomId}`)}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              🔗 Copy participant link
            </button>
            <button
              onClick={() => copyLink(`${base}/room/${roomId}?mode=watch`)}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              👀 Copy spectator link
            </button>
          </div>

          <div className="mt-8 text-sm text-gray-300">
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">
              How it works
            </div>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Participants submit one lyric line (submit phase)</li>
              <li>Crowd votes live (vote phase)</li>
              <li>AI remixes the winner → crowd picks final (AI phase)</li>
            </ol>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-5">
          Tip: Use this lobby link in your demo — it looks premium and explains the product fast.
        </p>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/60 border border-white/10 rounded-2xl p-4 shadow-sm">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { useParams } from "next/navigation";

// export default function Lobby() {
//   const params = useParams();
//   const roomId = String(params.roomId);

//   const [info, setInfo] = useState<any>(null);

//   useEffect(() => {
//     fetch(`/api/room-preview/${roomId}`)
//       .then((r) => r.json())
//       .then(setInfo)
//       .catch(() => setInfo(null));
//   }, [roomId]);

//   return (
//     <div className="min-h-screen p-10 bg-gradient-to-b from-[#0B0E14] via-[#0F172A] to-black text-white">
//       <div className="max-w-3xl mx-auto bg-black/50 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
//         <h1 className="text-3xl font-semibold">🎧 Music Room</h1>
//         <p className="text-gray-300 mt-2">Room: <span className="font-mono">{roomId}</span></p>

//         {!info ? (
//           <p className="mt-6 text-gray-400">Loading room status…</p>
//         ) : (
//           <div className="mt-6 grid grid-cols-2 gap-4">
//             <div className="bg-black/60 rounded-xl p-4 border border-white/5">
//               <div className="text-xs text-gray-400">Theme</div>
//               <div className="font-semibold">{info.theme}</div>
//             </div>
//             <div className="bg-black/60 rounded-xl p-4 border border-white/5">
//               <div className="text-xs text-gray-400">Round</div>
//               <div className="font-semibold">{info.round}</div>
//             </div>
//             <div className="bg-black/60 rounded-xl p-4 border border-white/5">
//               <div className="text-xs text-gray-400">Phase</div>
//               <div className="font-semibold">{info.phase} ({info.timeLeft}s)</div>
//             </div>
//             <div className="bg-black/60 rounded-xl p-4 border border-white/5">
//               <div className="text-xs text-gray-400">Live</div>
//               <div className="font-semibold">
//                 {info.participants} participants • {info.spectators} spectators
//               </div>
//             </div>
//           </div>
//         )}

//         <div className="mt-8 flex gap-3 flex-wrap">
//           <Link
//             href={`/room/${roomId}`}
//             className="px-5 py-3 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED]"
//           >
//             Join as Participant
//           </Link>

//           <Link
//             href={`/room/${roomId}?mode=watch`}
//             className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
//           >
//             Watch as Spectator
//           </Link>
//         </div>

//         <div className="mt-8 text-sm text-gray-300">
//           <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">How it works</div>
//           <ol className="list-decimal ml-5 space-y-1">
//             <li>Submit a lyric line</li>
//             <li>Vote together</li>
//             <li>AI remixes → crowd picks final → song grows</li>
//           </ol>
//         </div>
//       </div>
//     </div>
//   );
// }
