// Provider for the invented development songs: original generated audio.
import { CLIP_SECONDS } from '../synth.js';

export const sampleProvider = {
  id: 'sample',
  playback(song) {
    return {
      status: 'preview',
      source: 'sample',
      audio_url: `/api/audio/sample/${song.id}.wav`,
      duration_s: CLIP_SECONDS,
      label: 'Original sample audio · 30s',
      links: [],
    };
  },
};
