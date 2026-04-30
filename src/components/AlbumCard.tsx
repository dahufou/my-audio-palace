import { Link } from "react-router-dom";
import type { Album } from "@/data/library";
import { Play } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";

export const AlbumCard = ({ album }: { album: Album }) => {
  const { playQueue } = usePlayer();
  return (
    <div className="group animate-fade-up">
      <div className="relative aspect-square overflow-hidden rounded-sm shadow-album">
        <Link to={`/album/${album.id}`}>
          <img
            src={album.cover}
            alt={`${album.title} by ${album.artist}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            playQueue(album.tracks, 0);
          }}
          className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-gold text-primary-foreground flex items-center justify-center shadow-gold opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
          aria-label={`Play ${album.title}`}
        >
          <Play className="h-4 w-4 translate-x-[1px]" />
        </button>
      </div>
      <Link to={`/album/${album.id}`} className="block mt-3">
        <div className="font-display text-lg leading-tight">{album.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {album.artist} · <span className="text-muted-foreground/70">{album.year}</span>
        </div>
      </Link>
    </div>
  );
};
