import Artwork from '../ui/Artwork.jsx';
import SongTags from './SongTags.jsx';
import LikeButton from './LikeButton.jsx';
import SongActions from '../player/SongActions.jsx';
import SourceLinks from './SourceLinks.jsx';
import AddToPlaylist from '../account/AddToPlaylist.jsx';

// Compact song card used on Discover and the homepage.
export default function SongTile({ song, note, list, as: Tag = 'li' }) {
  return (
    <Tag className="window flex gap-3.5 p-3 transition-colors hover:border-silver">
      <Artwork song={song} className="w-20 shrink-0 self-start sm:w-24" />
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-frost">{song.title}</h3>
            <p className="truncate text-sm text-silver">{song.artist}</p>
          </div>
          <LikeButton song={song} />
        </div>
        {note && <p className="mt-2 text-sm leading-snug text-chrome">{note}</p>}
        {song.genres?.length > 0 && <SongTags song={song} className="mt-2" />}
        {song.album && <p className="mt-1 truncate text-xs text-silver">{song.album}{song.year ? ` · ${song.year}` : ''}</p>}
        <div className="mt-auto space-y-2 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <SongActions song={song} list={list} compact={!song.external} />
            <AddToPlaylist song={song} />
          </div>
          <SourceLinks song={song} />
        </div>
      </div>
    </Tag>
  );
}
