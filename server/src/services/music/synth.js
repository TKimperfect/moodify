// Generates ORIGINAL sample audio for the invented development songs.
// Every clip is composed by this code from the song's own data (tempo,
// energy, intensity, moods), so there are no copyright or licensing
// questions and nothing has to be downloaded.
//
// Output: a 30-second mono WAV file (16-bit, 22,050 samples per second).

export const SAMPLE_RATE = 22050;
export const CLIP_SECONDS = 30;

const MINOR_MOODS = new Set(['sad', 'lonely', 'anxious', 'empty', 'angry', 'nostalgic']);

// Small deterministic random number generator: same song, same music.
function seededRandom(text) {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.codePointAt(0), 16777619) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);

function wave(shape, phase) {
  const x = phase - Math.floor(phase);
  if (shape === 'triangle') return 4 * Math.abs(x - 0.5) - 1;
  if (shape === 'soft-square') return Math.tanh(Math.sin(2 * Math.PI * x) * 3) * 0.8;
  return Math.sin(2 * Math.PI * x);
}

// Adds one note into the buffer.
// "sustain" notes (pads) hold their volume; others fade a little while they ring.
function addNote(buffer, { start, length, hz, amp, shape = 'sine', attack = 0.01, release = 0.2, detune = 0, harmonics = 0, sustain = false }) {
  const first = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const last = Math.min(buffer.length, Math.floor((start + length + release) * SAMPLE_RATE));
  for (let i = first; i < last; i += 1) {
    const t = i / SAMPLE_RATE - start;
    let envelope = t < attack ? t / attack : 1;
    if (!sustain) envelope *= Math.exp(-Math.min(t, length) * (0.6 / Math.max(length, 0.05)));
    if (t > length) envelope *= Math.max(0, 1 - (t - length) / release);
    let sample = wave(shape, hz * t) + (detune ? wave(shape, hz * (1 + detune) * t) : 0);
    if (harmonics) sample += harmonics * Math.sin(2 * Math.PI * hz * 2 * t);
    buffer[i] += sample * amp * envelope;
  }
}

function addKick(buffer, start, amp) {
  const first = Math.floor(start * SAMPLE_RATE);
  const last = Math.min(buffer.length, first + Math.floor(0.25 * SAMPLE_RATE));
  let phase = 0;
  for (let i = first; i < last; i += 1) {
    const t = (i - first) / SAMPLE_RATE;
    phase += (45 + 90 * Math.exp(-t * 30)) / SAMPLE_RATE;
    buffer[i] += Math.sin(2 * Math.PI * phase) * Math.exp(-t * 14) * amp;
  }
}

function addNoiseHit(buffer, start, amp, decay, random, tone = 0) {
  const first = Math.floor(start * SAMPLE_RATE);
  const last = Math.min(buffer.length, first + Math.floor((5 / decay) * SAMPLE_RATE));
  let previous = 0;
  for (let i = first; i < last; i += 1) {
    const t = (i - first) / SAMPLE_RATE;
    const noise = random() * 2 - 1;
    const bright = noise - previous; // simple high-pass: crisper "tss"
    previous = noise;
    const body = tone ? Math.sin(2 * Math.PI * tone * t) * 0.6 : 0;
    buffer[i] += (bright * 0.7 + body) * Math.exp(-t * decay) * amp;
  }
}

export function composeSong(song) {
  const random = seededRandom(song.id);
  const energy = song.energy / 100;
  const intensity = song.intensity / 100;
  const minorCount = song.moods.filter((mood) => MINOR_MOODS.has(mood)).length;
  const minor = minorCount * 2 >= song.moods.length;
  const bpm = Math.min(170, Math.max(56, song.bpm));
  const beat = 60 / bpm;
  const bar = beat * 4;
  const root = 45 + Math.floor(random() * 12); // somewhere between A2 and G#3

  // Chord progressions (semitone offsets and chord quality).
  const progression = minor
    ? [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']] // i - VI - III - VII
    : [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']]; // I - V - vi - IV
  const scale = minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]; // pentatonic

  const buffer = new Float32Array(SAMPLE_RATE * CLIP_SECONDS);
  const bars = Math.ceil(CLIP_SECONDS / bar);
  const drums = energy >= 0.45;
  const stepsPerBeat = energy < 0.35 ? 1 : energy < 0.7 ? 2 : 4;
  const restChance = 0.55 - energy * 0.35;
  const motif = Array.from({ length: 8 }, () => scale[Math.floor(random() * scale.length)] + (random() < 0.3 ? 12 : 0));

  for (let b = 0; b < bars; b += 1) {
    const start = b * bar;
    const [offset, quality] = progression[b % progression.length];
    const chordRoot = root + offset;
    const third = quality === 'm' ? 3 : 4;

    // Pad: soft, sustained chord. Each chord fades out while the next one
    // fades in, so there is no gap between chords.
    const padAttack = 0.25 + (1 - energy) * 0.6;
    for (const interval of [0, third, 7]) {
      addNote(buffer, {
        start,
        length: bar,
        hz: midiToHz(chordRoot + 12 + interval),
        amp: 0.05 + (1 - energy) * 0.03,
        attack: padAttack,
        release: padAttack + 0.4,
        sustain: true,
        detune: 0.003,
        harmonics: energy * 0.3,
      });
    }

    // Bass: on every beat when energetic, every two beats when calm.
    const bassStep = energy < 0.4 ? 2 : 1;
    for (let k = 0; k < 4; k += bassStep) {
      addNote(buffer, {
        start: start + k * beat,
        length: beat * bassStep * 0.9,
        hz: midiToHz(chordRoot - 12 + (k === 2 && energy > 0.6 ? 7 : 0)),
        amp: 0.16 + energy * 0.08,
        shape: 'triangle',
        attack: 0.01,
        release: 0.08,
      });
    }

    // Melody / arpeggio built from a repeating motif.
    const steps = 4 * stepsPerBeat;
    for (let s = 0; s < steps; s += 1) {
      if (random() < restChance) continue;
      const note = root + 24 + motif[(b * steps + s) % motif.length] + (b % 4 === 3 ? 2 : 0);
      addNote(buffer, {
        start: start + (s * beat) / stepsPerBeat,
        length: (beat / stepsPerBeat) * (energy < 0.35 ? 1.6 : 0.8),
        hz: midiToHz(note),
        amp: 0.05 + intensity * 0.05,
        shape: energy > 0.75 ? 'soft-square' : 'triangle',
        attack: 0.005,
        release: 0.15 + (1 - energy) * 0.4,
      });
    }

    // Drums.
    if (drums && b > 0) {
      for (let k = 0; k < 4; k += 1) {
        const at = start + k * beat;
        if (k % 2 === 0 || energy > 0.75) addKick(buffer, at, 0.5 + energy * 0.2);
        if (energy > 0.6 && k % 2 === 1) addNoiseHit(buffer, at, 0.16, 18, random, 190);
        for (let h = 0; h < 2; h += 1) addNoiseHit(buffer, at + (h * beat) / 2, 0.035 + energy * 0.03, 45, random);
      }
    }
  }

  // Master: gentle low-pass (darker when calm), fades, normalise, soft clip.
  const cutoff = 0.12 + energy * 0.5;
  let smooth = 0;
  let peak = 0;
  const fadeIn = SAMPLE_RATE * 1.5;
  const fadeOut = SAMPLE_RATE * 2.5;
  const drive = 1 + intensity * 1.5 + (song.moods.includes('angry') ? 1 : 0);
  for (let i = 0; i < buffer.length; i += 1) {
    smooth += cutoff * (buffer[i] - smooth);
    let sample = Math.tanh(smooth * drive) / Math.tanh(drive);
    if (i < fadeIn) sample *= i / fadeIn;
    if (i > buffer.length - fadeOut) sample *= (buffer.length - i) / fadeOut;
    buffer[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const gain = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < buffer.length; i += 1) buffer[i] *= gain;
  return buffer;
}

// Packs samples into a standard WAV file.
export function encodeWav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16); // header size
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return bytes;
}

export function renderSongWav(song) {
  return encodeWav(composeSong(song));
}
