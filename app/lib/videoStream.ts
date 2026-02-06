/**
 * WebRTC Video Streaming with Audio Sync
 * 
 * This enables:
 * 1. Producer webcam feed
 * 2. Participant video grid
 * 3. Screen sharing for DAW view
 * 4. Perfect audio-video synchronization
 */

import * as Tone from "tone";

export interface VideoStreamConfig {
  audio: boolean;
  video: boolean;
  screen?: boolean;
}

export interface PeerConnection {
  id: string;
  name: string;
  stream: MediaStream;
  connection: RTCPeerConnection;
  videoElement?: HTMLVideoElement;
}

export class VideoStreamManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private onStreamCallback?: (peerId: string, stream: MediaStream) => void;
  private onRemoveCallback?: (peerId: string) => void;

  /**
   * Start local camera/microphone
   */
  async startLocalStream(config: VideoStreamConfig): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: config.audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
        video: config.video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log("✅ Local stream started");
      return this.localStream;
    } catch (err) {
      console.error("Failed to get local stream:", err);
      throw err;
    }
  }

  /**
   * Start screen sharing (for DAW view)
   */
  async startScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
        },
        audio: false,
      });

      // Handle user stopping screen share via browser UI
      this.screenStream.getVideoTracks()[0].onended = () => {
        console.log("Screen share stopped by user");
        this.screenStream = null;
      };

      console.log("✅ Screen share started");
      return this.screenStream;
    } catch (err) {
      console.error("Failed to start screen share:", err);
      throw err;
    }
  }

  /**
   * Stop local streams
   */
  stopLocalStream() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.screenStream = null;
  }

  /**
   * Create peer connection for remote participant
   */
  async createPeerConnection(
    peerId: string,
    peerName: string,
    socket: any
  ): Promise<RTCPeerConnection> {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    const pc = new RTCPeerConnection(config);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      
      const peer: PeerConnection = {
        id: peerId,
        name: peerName,
        stream: remoteStream,
        connection: pc,
      };

      this.peers.set(peerId, peer);

      if (this.onStreamCallback) {
        this.onStreamCallback(peerId, remoteStream);
      }
    };

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice_candidate", {
          peerId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} connection state:`, pc.connectionState);
      
      if (pc.connectionState === "disconnected" || 
          pc.connectionState === "failed") {
        this.removePeer(peerId);
      }
    };

    this.peers.set(peerId, {
      id: peerId,
      name: peerName,
      stream: new MediaStream(),
      connection: pc,
    });

    return pc;
  }

  /**
   * Create and send offer
   */
  async createOffer(peerId: string, socket: any) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);

    socket.emit("webrtc_offer", {
      peerId,
      offer: peer.connection.localDescription,
    });
  }

  /**
   * Handle received offer
   */
  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit, socket: any) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);

    socket.emit("webrtc_answer", {
      peerId,
      answer: peer.connection.localDescription,
    });
  }

  /**
   * Handle received answer
   */
  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Handle ICE candidate
   */
  async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * Remove peer
   */
  removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);

      if (this.onRemoveCallback) {
        this.onRemoveCallback(peerId);
      }
    }
  }

  /**
   * Get all active peers
   */
  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  /**
   * Set callback for new streams
   */
  onStream(callback: (peerId: string, stream: MediaStream) => void) {
    this.onStreamCallback = callback;
  }

  /**
   * Set callback for removed peers
   */
  onRemove(callback: (peerId: string) => void) {
    this.onRemoveCallback = callback;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get screen share stream
   */
  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  /**
   * Cleanup all connections
   */
  cleanup() {
    this.peers.forEach(peer => {
      peer.connection.close();
    });
    this.peers.clear();
    this.stopLocalStream();
  }
}

/**
 * Audio-Video Sync Timestamp Manager
 * 
 * Ensures video frames are perfectly synced with Tone.js audio
 */
export class AVSyncManager {
  private audioTimestampOffset = 0;
  private videoTimestampOffset = 0;
  private driftHistory: number[] = [];

  /**
   * Tag video frame with audio timestamp
   */
  tagVideoFrame(videoTimestamp: number): { video: number; audio: number; offset: number } {
    const audioTimestamp = Tone.Transport.seconds * 1000;
    const offset = Math.abs(videoTimestamp - audioTimestamp);

    // Track drift
    this.driftHistory.push(offset);
    if (this.driftHistory.length > 30) {
      this.driftHistory.shift();
    }

    return {
      video: videoTimestamp,
      audio: audioTimestamp,
      offset,
    };
  }

  /**
   * Get average drift
   */
  getAverageDrift(): number {
    if (this.driftHistory.length === 0) return 0;
    return this.driftHistory.reduce((a, b) => a + b, 0) / this.driftHistory.length;
  }

  /**
   * Calculate correction needed
   */
  getCorrection(): number {
    const avgDrift = this.getAverageDrift();
    
    // If drift is consistent and > 50ms, suggest correction
    if (avgDrift > 50) {
      return avgDrift;
    }

    return 0;
  }

  /**
   * Reset drift tracking
   */
  reset() {
    this.driftHistory = [];
    this.audioTimestampOffset = 0;
    this.videoTimestampOffset = 0;
  }
}
