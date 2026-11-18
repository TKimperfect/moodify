import { songRepository } from '../repositories/song.repository.js';
import { sampleAudioFile, providersStatus, searchExternal } from '../services/music/music.service.js';
import { HttpError } from '../lib/httpError.js';

export async function getSampleAudio(req, res) {
  const song = await songRepository.findById(req.valid.params.id);
  if (!song || song.playback?.source !== 'sample') throw new HttpError(404, 'No sample audio for this song');
  const file = await sampleAudioFile(song);
  // sendFile supports "Range" requests, which audio players use for seeking.
  res.sendFile(file, {
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}

export function getProviders(req, res) {
  res.json({ providers: providersStatus() });
}

export async function getExternalSearch(req, res) {
  const songs = await searchExternal(req.valid.query);
  res.json({ songs, count: songs.length, provider: req.valid.query.source });
}
