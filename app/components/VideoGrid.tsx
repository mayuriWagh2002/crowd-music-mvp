"use client";

import { useEffect, useRef, useState } from "react";
import { VideoStreamManager, PeerConnection } from "@/app/lib/videoStream";

interface VideoGridProps {
  socket: any;
  roomId: string;
  isHost: boolean;
  myId: string;
}

export default function VideoGrid({ socket, roomId, isHost, myId }: VideoGridProps) {
  const [videoManager] = useState(() => new VideoStreamManager());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<PeerConnection[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [error, setError] = useState<string>("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Setup video stream callbacks
  useEffect(() => {
    videoManager.onStream((peerId, stream) => {
      console.log("New stream from peer:", peerId);
      setRemotePeers([...videoManager.getPeers()]);
    });

    videoManager.onRemove((peerId) => {
      console.log("Peer removed:", peerId);
      setRemotePeers([...videoManager.getPeers()]);
    });

    return () => {
      videoManager.cleanup();
    };
  }, [videoManager]);

  // WebRTC signaling
  useEffect(() => {
    socket.on("webrtc_offer", async ({ peerId, offer, peerName }: any) => {
      await videoManager.createPeerConnection(peerId, peerName, socket);
      await videoManager.handleOffer(peerId, offer, socket);
    });

    socket.on("webrtc_answer", async ({ peerId, answer }: any) => {
      await videoManager.handleAnswer(peerId, answer);
    });

    socket.on("ice_candidate", async ({ peerId, candidate }: any) => {
      await videoManager.handleIceCandidate(peerId, candidate);
    });

    socket.on("peer_joined_video", async ({ peerId, peerName }: any) => {
      await videoManager.createPeerConnection(peerId, peerName, socket);
      await videoManager.createOffer(peerId, socket);
    });

    socket.on("peer_left_video", ({ peerId }: any) => {
      videoManager.removePeer(peerId);
      setRemotePeers([...videoManager.getPeers()]);
    });

    return () => {
      socket.off("webrtc_offer");
      socket.off("webrtc_answer");
      socket.off("ice_candidate");
      socket.off("peer_joined_video");
      socket.off("peer_left_video");
    };
  }, [socket, videoManager]);

  // Display local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Display screen share
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const toggleCamera = async () => {
    setError("");
    
    if (!cameraEnabled) {
      try {
        const stream = await videoManager.startLocalStream({
          audio: false, // Set to false to avoid audio feedback
          video: true,
        });
        setLocalStream(stream);
        setCameraEnabled(true);
        socket.emit("video_started", { roomId });
      } catch (err: any) {
        console.error("Failed to start camera:", err);
        
        // Better error messages
        if (err.name === "NotFoundError") {
          setError("No camera found. Please connect a camera and try again.");
        } else if (err.name === "NotAllowedError") {
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotReadableError") {
          setError("Camera is already in use by another application.");
        } else {
          setError("Could not access camera. Please check permissions.");
        }
      }
    } else {
      videoManager.stopLocalStream();
      setLocalStream(null);
      setCameraEnabled(false);
      socket.emit("video_stopped", { roomId });
    }
  };

  const toggleScreenShare = async () => {
    setError("");
    
    if (!screenEnabled) {
      try {
        const stream = await videoManager.startScreenShare();
        setScreenStream(stream);
        setScreenEnabled(true);
        socket.emit("screen_started", { roomId });
      } catch (err: any) {
        console.error("Failed to start screen share:", err);
        if (err.name !== "NotAllowedError") {
          setError("Could not start screen sharing.");
        }
        // User cancelled - don't show error
      }
    } else {
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      setScreenStream(null);
      setScreenEnabled(false);
      socket.emit("screen_stopped", { roomId });
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={toggleCamera}
          className={`px-4 py-2 rounded-xl font-semibold transition ${
            cameraEnabled
              ? "bg-red-600 hover:bg-red-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {cameraEnabled ? "📷 Stop Camera" : "📷 Start Camera"}
        </button>

        {isHost && (
          <button
            onClick={toggleScreenShare}
            className={`px-4 py-2 rounded-xl font-semibold transition ${
              screenEnabled
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {screenEnabled ? "🖥 Stop Sharing" : "🖥 Share Screen"}
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 text-sm text-red-200">
          <p className="font-semibold mb-1">⚠️ Error</p>
          <p>{error}</p>
          <p className="text-xs mt-2 text-red-300">
            Tip: Check your browser settings and make sure no other app is using your camera.
          </p>
        </div>
      )}

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Local Video */}
        {localStream && (
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-white/10">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 px-3 py-1 rounded-lg text-sm">
              You {isHost && "(Host)"}
            </div>
            <div className="absolute top-2 right-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Screen Share */}
        {screenStream && (
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video border-2 border-indigo-500 md:col-span-2">
            <video
              ref={screenVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 px-3 py-1 rounded-lg text-sm">
              🖥 Your Screen
            </div>
          </div>
        )}

        {/* Remote Participants */}
        {remotePeers.map((peer) => (
          <RemoteVideo key={peer.id} peer={peer} />
        ))}
      </div>

      {/* Status */}
      {!localStream && !screenStream && remotePeers.length === 0 && (
        <div className="text-center py-12 text-zinc-400 bg-zinc-900/50 rounded-xl border border-white/5">
          <p className="text-sm">📹 No video feeds active</p>
          <p className="text-xs mt-2">Click "Start Camera" to begin streaming</p>
        </div>
      )}
    </div>
  );
}

function RemoteVideo({ peer }: { peer: PeerConnection }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-white/10">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/70 px-3 py-1 rounded-lg text-sm">
        {peer.name}
      </div>
      <div className="absolute top-2 right-2">
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
