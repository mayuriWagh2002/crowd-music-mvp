import * as Tone from "tone";

/**
 * Simple "Music Room" beat generator
 * - different tempo + chord vibe per theme
 * - plays locally in the browser (no API)
 */

const PRESETS: Record<
  string,
  {
    bpm: number;
    chords: string[][];
    kick: string;
    hatRate: Tone.Unit.Time;
  }
> = {
  "lofi heartbreak": {
    bpm: 78,
    chords: [
      ["A3", "C4", "E4"],
      ["F3", "A3", "C4"],
      ["G3", "B3", "D4"],
      ["E3", "G3", "B3"],
    ],
    kick: "C2",
    hatRate: "8n",
  },
  romantic: {
    bpm: 92,
    chords: [
      ["C4", "E4", "G4"],
      ["A3", "C4", "E4"],
      ["F3", "A3", "C4"],
      ["G3", "B3", "D4"],
    ],
    kick: "C2",
    hatRate: "8n",
  },
  "rap battle": {
    bpm: 122,
    chords: [
      ["E3", "B3"],
      ["G3", "D4"],
      ["A3", "E4"],
      ["B2", "F#3"],
    ],
    kick: "C2",
    hatRate: "16n",
  },
  "happy pop": {
    bpm: 110,
    chords: [
      ["G3", "B3", "D4"],
      ["D3", "F#3", "A3"],
      ["E3", "G3", "B3"],
      ["C3", "E3", "G3"],
    ],
    kick: "C2",
    hatRate: "8n",
  },
  motivational: {
    bpm: 100,
    chords: [
      ["D3", "F#3", "A3"],
      ["G3", "B3", "D4"],
      ["A3", "C#4", "E4"],
      ["B2", "F#3", "D4"],
    ],
    kick: "C2",
    hatRate: "8n",
  },
};

let isStarted = false;

let chordLoop: Tone.Loop | null = null;
let hatLoop: Tone.Loop | null = null;

let poly: Tone.PolySynth<Tone.Synth> | null = null;
let kick: Tone.MembraneSynth | null = null;
let hat: Tone.NoiseSynth | null = null;

export async function startRoomBeat(theme: string) {
  const preset = PRESETS[theme] || PRESETS["lofi heartbreak"];

  // Must be called from a user gesture click
  await Tone.start();

  if (!poly) {
    poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, release: 1.2 },
    }).toDestination();

    kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 8,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.1 },
    }).toDestination();

    hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).toDestination();
  }

  Tone.Transport.bpm.value = preset.bpm;

  // Dispose old loops
  if (chordLoop) chordLoop.dispose();
  if (hatLoop) hatLoop.dispose();

  let chordStep = 0;

  chordLoop = new Tone.Loop((time) => {
    const chord = preset.chords[chordStep % preset.chords.length];
    poly?.triggerAttackRelease(chord, "2n", time, 0.35);

    // Kick on chord start
    kick?.triggerAttackRelease(preset.kick, "8n", time, 0.4);

    chordStep++;
  }, "2n");

  hatLoop = new Tone.Loop((time) => {
    hat?.triggerAttackRelease("16n", time, 0.08);
  }, preset.hatRate);

  chordLoop.start(0);
  hatLoop.start(0);

  if (!isStarted) {
    Tone.Transport.start();
    isStarted = true;
  }
}

export function stopRoomBeat() {
  chordLoop?.stop();
  hatLoop?.stop();
  Tone.Transport.stop();
  isStarted = false;
}

export function isBeatRunning() {
  return isStarted;
}
