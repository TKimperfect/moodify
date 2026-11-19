// Finds songs from an older Deezer playlist import that the latest import no
// longer contains (for example songs that came from a search word we
// replaced). Songs someone saved, rated or listened to are always kept.
export function staleSongIds(dbRows, currentIds, usedIds) {
  const current = new Set(currentIds);
  const used = new Set(usedIds);
  return dbRows
    .filter((row) => row.provider === 'deezer' && row.mood_source === 'playlist')
    .filter((row) => !current.has(row.id) && !used.has(row.id))
    .map((row) => row.id);
}
