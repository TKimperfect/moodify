// Finds Deezer songs in the database that the latest import no longer
// offers: songs from an older playlist search (for example one whose search
// words were replaced) and songs whose language could not be found out.
// sources: which imports to check ("playlist" = language playlists, "muse" =
// the MuSe dataset; MuSe only when its file was read, or every MuSe song
// would look old). Songs someone saved, rated or listened to are always kept.
export function staleSongIds(dbRows, currentIds, usedIds, { sources = ['playlist'] } = {}) {
  const current = new Set(currentIds);
  const used = new Set(usedIds);
  return dbRows
    .filter((row) => row.provider === 'deezer' && sources.includes(row.mood_source))
    .filter((row) => !current.has(row.id) && !used.has(row.id))
    .map((row) => row.id);
}
