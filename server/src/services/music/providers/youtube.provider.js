// YouTube: a search link only. Embedding a specific video would need the
// YouTube Data API and a key; a search link needs nothing and is always allowed.
export const youtubeProvider = {
  id: 'youtube',
  searchLink(song) {
    const query = encodeURIComponent(`${song.title} ${song.artist}`);
    return { provider: 'youtube', label: 'Search on YouTube', url: `https://www.youtube.com/results?search_query=${query}` };
  },
};
