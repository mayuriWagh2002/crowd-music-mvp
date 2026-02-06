import * as Tone from "tone";

/* ======================================================
   🎼 THEME DATA
====================================================== */

const PRESETS: Record<string, { bpm: number; chords: string[][] }> = {
  "lofi heartbreak": {
    bpm: 78,
    chords: [
      ["A3", "C4", "E4"],
      ["F3", "A3", "C4"],
      ["G3", "B3", "D4"],
      ["E3", "G3", "B3"],
    ],
  },
  romantic: {
    bpm: 92,
    chords: [
      ["C4", "E4", "G4"],
      ["A3", "C4", "E4"],
      ["F3", "A3", "C4"],
      ["G3", "B3", "D4"],
    ],
  },
  "happy pop": {
    bpm: 110,
    chords: [
      ["G3", "B3", "D4"],
      ["D3", "F#3", "A3"],
      ["E3", "G3", "B3"],
      ["C3", "E3", "G3"],
    ],
  },
};

/* ======================================================
   🔊 MULTI-CHANNEL AUDIO ENGINE
====================================================== */

let initialized = false;
let master: Tone.Gain | null = null;

// Individual channel synths
let kick: Tone.MembraneSynth | null = null;
let snare: Tone.NoiseSynth | null = null;
let hihat: Tone.MetalSynth | null = null;
let bass: Tone.MonoSynth | null = null;
let pad: Tone.PolySynth | null = null;

// Individual channel gains (for volume control)
let kickGain: Tone.Gain | null = null;
let snareGain: Tone.Gain | null = null;
let hihatGain: Tone.Gain | null = null;
let bassGain: Tone.Gain | null = null;
let padGain: Tone.Gain | null = null;

// Store original volumes before mute/solo
let originalVolumes = {
  kick: -12,
  snare: -8,
  hihat: -15,
  bass: -6,
  pad: -18,
};

// Channel states
let channelMutes = {
  kick: false,
  snare: false,
  hihat: false,
  bass: false,
  pad: false,
};

let channelSolos = {
  kick: false,
  snare: false,
  hihat: false,
  bass: false,
  pad: false,
};

let kickStyle: "tight" | "punchy" = "tight";
let energyLevel: "build" | "chill" = "chill";

async function initAudio() {
  if (!initialized) {
    await Tone.start();
    master = new Tone.Gain(1).toDestination();
    initialized = true;
  }
}

/* ======================================================
   🎚️ CHANNEL CONTROL FUNCTIONS (FIXED)
====================================================== */

/**
 * Set channel volume (in dB)
 * ✅ WORKING
 */
export function setChannelVolume(channel: string, volumeDb: number) {
  const gain = getChannelGain(channel);
  if (gain) {
    // Store the original volume
    originalVolumes[channel as keyof typeof originalVolumes] = volumeDb;
    
    // Convert dB to linear gain and apply
    const linearGain = Tone.dbToGain(volumeDb);
    gain.gain.rampTo(linearGain, 0.1);
    
    console.log(`✅ Set ${channel} volume to ${volumeDb}dB (gain: ${linearGain.toFixed(3)})`);
  }
}

/**
 * Mute/unmute a channel
 * ✅ FIXED - Now actually works
 */
export function setChannelMute(channel: string, muted: boolean) {
  channelMutes[channel as keyof typeof channelMutes] = muted;
  
  const gain = getChannelGain(channel);
  if (!gain) return;

  if (muted) {
    // Mute: Set gain to 0
    gain.gain.rampTo(0, 0.05);
    console.log(`🔇 Muted ${channel}`);
  } else {
    // Unmute: Restore original volume (unless solo'd)
    const anySolo = Object.values(channelSolos).some(s => s);
    const isSolo = channelSolos[channel as keyof typeof channelSolos];
    
    if (!anySolo || isSolo) {
      const originalVol = originalVolumes[channel as keyof typeof originalVolumes];
      const linearGain = Tone.dbToGain(originalVol);
      gain.gain.rampTo(linearGain, 0.05);
      console.log(`🔊 Unmuted ${channel} to ${originalVol}dB`);
    }
  }
}

/**
 * Solo/unsolo a channel
 * ✅ FIXED - Now actually works
 */
export function setChannelSolo(channel: string, solo: boolean) {
  channelSolos[channel as keyof typeof channelSolos] = solo;
  
  // Check if ANY channel is solo'd
  const anySolo = Object.values(channelSolos).some(s => s);
  
  // Update all channels
  Object.keys(channelMutes).forEach(ch => {
    const gain = getChannelGain(ch);
    if (!gain) return;

    const isMuted = channelMutes[ch as keyof typeof channelMutes];
    const isSolo = channelSolos[ch as keyof typeof channelSolos];

    if (isMuted) {
      // If muted, keep at 0
      gain.gain.rampTo(0, 0.05);
    } else if (anySolo) {
      // If any channel is solo'd
      if (isSolo) {
        // This channel is solo'd - restore volume
        const originalVol = originalVolumes[ch as keyof typeof originalVolumes];
        gain.gain.rampTo(Tone.dbToGain(originalVol), 0.05);
        console.log(`⭐ Solo ${ch} at ${originalVol}dB`);
      } else {
        // This channel is NOT solo'd - mute it
        gain.gain.rampTo(0, 0.05);
      }
    } else {
      // No solos active - restore all unmuted channels
      const originalVol = originalVolumes[ch as keyof typeof originalVolumes];
      gain.gain.rampTo(Tone.dbToGain(originalVol), 0.05);
      console.log(`🔊 Restored ${ch} to ${originalVol}dB`);
    }
  });
}

/**
 * Get the gain node for a specific channel
 */
function getChannelGain(channel: string): Tone.Gain | null {
  switch (channel) {
    case "kick": return kickGain;
    case "snare": return snareGain;
    case "hihat": return hihatGain;
    case "bass": return bassGain;
    case "pad": return padGain;
    default: return null;
  }
}

/**
 * Reset all channels to default
 * ✅ WORKING
 */
export function resetAllChannels() {
  // Reset volumes
  setChannelVolume("kick", -12);
  setChannelVolume("snare", -8);
  setChannelVolume("hihat", -15);
  setChannelVolume("bass", -6);
  setChannelVolume("pad", -18);

  // Reset mutes and solos
  Object.keys(channelMutes).forEach(ch => {
    channelMutes[ch as keyof typeof channelMutes] = false;
    channelSolos[ch as keyof typeof channelSolos] = false;
  });

  // Restore all gains
  Object.keys(originalVolumes).forEach(ch => {
    const gain = getChannelGain(ch);
    if (gain) {
      const vol = originalVolumes[ch as keyof typeof originalVolumes];
      gain.gain.rampTo(Tone.dbToGain(vol), 0.1);
    }
  });

  console.log("🔄 Reset all channels to default");
}

/* ======================================================
   🎵 BEAT ENGINE (Enhanced Multi-Channel)
====================================================== */

let beatRunning = false;
let beatLoop: Tone.Loop | null = null;
let chordLoop: Tone.Loop | null = null;

export async function startRoomBeat(theme: string) {
  await initAudio();
  stopRoomBeat();

  const preset = PRESETS[theme] || PRESETS["lofi heartbreak"];
  Tone.Transport.bpm.value = preset.bpm;

  // Create individual channels with separate gain controls

  // KICK
  kickGain = new Tone.Gain(Tone.dbToGain(originalVolumes.kick)).connect(master!);
  kick = new Tone.MembraneSynth({
    envelope: { attack: 0.001, decay: 0.2 },
  }).connect(kickGain);

  // SNARE
  snareGain = new Tone.Gain(Tone.dbToGain(originalVolumes.snare)).connect(master!);
  snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.2 },
  }).connect(snareGain);

  // HI-HAT
  hihatGain = new Tone.Gain(Tone.dbToGain(originalVolumes.hihat)).connect(master!);
  hihat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05 },
    resonance: 3000,
  }).connect(hihatGain);

  // BASS
  bassGain = new Tone.Gain(Tone.dbToGain(originalVolumes.bass)).connect(master!);
  bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 },
  }).connect(bassGain);

  // PAD
  padGain = new Tone.Gain(Tone.dbToGain(originalVolumes.pad)).connect(master!);
  pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 1, release: 2 },
  }).connect(padGain);

  let step = 0;

  // Beat pattern loop
  beatLoop = new Tone.Loop((time) => {
    // Kick on every beat
    kick!.triggerAttackRelease("C2", "8n", time);

    // Snare on 2 and 4
    if (step % 4 === 2) {
      snare!.triggerAttackRelease("16n", time);
    }

    // Hi-hat on every 8th note
    if (step % 2 === 0) {
     hihat!.triggerAttackRelease("16n", time);
    }

    // Bass note
    const bassNote = preset.chords[Math.floor(step / 4) % preset.chords.length][0];
    bass!.triggerAttackRelease(bassNote, "4n", time);

    step++;
  }, "4n");

  // Chord progression loop
  chordLoop = new Tone.Loop((time) => {
    const chordIndex = Math.floor(step / 16) % preset.chords.length;
    pad!.triggerAttackRelease(preset.chords[chordIndex], "1m", time);
  }, "1m");

  beatLoop.start(0);
  chordLoop.start(0);
  Tone.Transport.start();
  beatRunning = true;

  console.log("▶️ Beat started");
}

export function stopRoomBeat() {
  beatLoop?.stop();
  beatLoop?.dispose();
  beatLoop = null;

  chordLoop?.stop();
  chordLoop?.dispose();
  chordLoop = null;

  kick?.dispose();
  snare?.dispose();
  hihat?.dispose();
  bass?.dispose();
  pad?.dispose();

  kickGain?.dispose();
  snareGain?.dispose();
  hihatGain?.dispose();
  bassGain?.dispose();
  padGain?.dispose();

  kick = null;
  snare = null;
  hihat = null;
  bass = null;
  pad = null;

  kickGain = null;
  snareGain = null;
  hihatGain = null;
  bassGain = null;
  padGain = null;

  Tone.Transport.stop();
  Tone.Transport.cancel();
  beatRunning = false;

  console.log("⏹️ Beat stopped");
}

export function isBeatRunning() {
  return beatRunning;
}

/* ======================================================
   🎚️ ORIGINAL CONTROL FUNCTIONS (Keep for compatibility)
====================================================== */

export function setBeatVolume(v: number) {
  if (master) {
    master.gain.value = Tone.dbToGain(v);
  }
}

export function setKickStyle(style: "tight" | "punchy") {
  kickStyle = style;

  if (!kick) return;

  if (style === "tight") {
    kick.envelope.decay = 0.12;
    setChannelVolume("kick", -9);
  } else {
    kick.envelope.decay = 0.6;
    setChannelVolume("kick", -3);
  }

  console.log(`🥁 Kick style: ${style}`);
}

export function setEnergy(level: "build" | "chill") {
  energyLevel = level;

  if (Tone.Transport.state === "started") {
    Tone.Transport.bpm.rampTo(level === "build" ? 92 : 72, 1);
  }

  if (pad && padGain) {
    pad.set({
      envelope: {
        attack: level === "build" ? 1 : 2.5,
        release: level === "build" ? 2 : 4,
      },
    });

    setChannelVolume("pad", level === "build" ? -14 : -20);
  }

  console.log(`⚡ Energy: ${level}`);
}

/* ======================================================
   📊 CHANNEL ANALYSIS (For real-time feedback)
====================================================== */

export function getChannelLevels() {
  return {
    kick: kickGain?.gain.value || 0,
    snare: snareGain?.gain.value || 0,
    hihat: hihatGain?.gain.value || 0,
    bass: bassGain?.gain.value || 0,
    pad: padGain?.gain.value || 0,
  };
}

export function getChannelStates() {
  return {
    mutes: { ...channelMutes },
    solos: { ...channelSolos },
    volumes: { ...originalVolumes },
  };
}

// Export for debugging
export function debugChannels() {
  console.log("=== CHANNEL DEBUG ===");
  console.log("Volumes:", originalVolumes);
  console.log("Mutes:", channelMutes);
  console.log("Solos:", channelSolos);
  console.log("Current gains:", getChannelLevels());
}