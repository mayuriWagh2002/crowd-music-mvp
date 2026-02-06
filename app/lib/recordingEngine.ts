import * as Tone from "tone";

export class SessionRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private canvasStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;

  async startRecording(canvas: HTMLCanvasElement) {
    try {
      // Capture canvas as video stream
      this.canvasStream = canvas.captureStream(60); // 60 FPS

      // Capture audio from Tone.js
      const dest = Tone.getDestination();
      const mediaStreamDest = dest.context.createMediaStreamDestination();
      dest.connect(mediaStreamDest);
      this.audioStream = mediaStreamDest.stream;

      // Combine video and audio
      const combinedStream = new MediaStream([
        ...this.canvasStream.getVideoTracks(),
        ...this.audioStream.getAudioTracks(),
      ]);

      // Create recorder
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;

      console.log("✅ Recording started");
    } catch (err) {
      console.error("Failed to start recording:", err);
      throw err;
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error("Not recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: "video/webm",
        });
        
        this.isRecording = false;
        console.log("✅ Recording stopped");
        resolve(blob);
      };

      this.mediaRecorder.stop();

      // Stop streams
      this.canvasStream?.getTracks().forEach((track) => track.stop());
      this.audioStream?.getTracks().forEach((track) => track.stop());
    });
  }

  downloadRecording(blob: Blob, filename: string = "session-recording.webm") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      duration: this.recordedChunks.length,
    };
  }
}