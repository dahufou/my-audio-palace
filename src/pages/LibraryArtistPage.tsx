import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { aurum } from "@/lib/aurum";
import { ArrowLeft, ImageOff } from "lucide-react";

const LibraryArtistPage = () => {
  const { id = "" } = useParams<{ id: string }>();
  const artist = useQuery({
    queryKey: ["aurum", "artist", id],
    queryFn: () => aurum.artist(id),
    enabled: !!id,
  });

  return (
    <AppLayout>
      <div className="px-6 md:px-10 py-10 pb-16">
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Library
        </Link>

        {artist.data && (
          <>
            <div className="mt-6 border-b border-border pb-5">
              <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Artist</div>
              <h1 className="font-display text-5xl md:text-6xl mt-1">{artist.data.name}</h1>
              <p className="text-muted-foreground mt-2">
                {artist.data.albums.length} albums
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10 mt-10">
              {artist.data.albums.map((al) => (
                <Link
                  key={al.id}
                  to={`/library/album/${al.id}`}
                  className="group block animate-fade-up"
                >
                  <div className="relative aspect-square overflow-hidden rounded-sm shadow-album bg-muted">
                    <AlbumCover
                      albumId={al.id}
                      artistName={artist.data.name}
                      title={al.title}
                      hasCover={al.has_cover}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      iconClassName="h-8 w-8"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="font-display text-lg leading-tight line-clamp-1">{al.title}</div>
                    {al.year && (
                      <div className="text-xs text-muted-foreground mt-0.5">{al.year}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default LibraryArtistPage;
