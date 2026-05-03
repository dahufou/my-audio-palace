import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { aurum, getAurumBase, setAurumBase, type AlbumSummary } from "@/lib/aurum";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Server } from "lucide-react";
import { AlbumCover } from "@/components/AlbumCover";

const LibraryPage = () => {
  const [q, setQ] = useState("");
  const [base, setBase] = useState(getAurumBase());
  const [editing, setEditing] = useState(false);

  const stats = useQuery({
    queryKey: ["aurum", "stats", base],
    queryFn: () => aurum.stats(),
    retry: 0,
  });

  const albums = useQuery({
    queryKey: ["aurum", "albums", q, base],
    queryFn: () => aurum.albums({ q: q || undefined, limit: 200 }),
    retry: 0,
  });

  return (
    <AppLayout>
      <div className="px-6 md:px-10 py-10 pb-16">
        <div className="border-b border-border pb-5">
          <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Aurum Server</div>
          <h1 className="font-display text-5xl md:text-6xl mt-1">Library</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Live from your home server — every album indexed, every cover served.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Server className="h-4 w-4 text-primary" />
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAurumBase(base);
                    setEditing(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={base}
                    onChange={(e) => setBase(e.target.value)}
                    className="h-8 w-72"
                  />
                  <Button size="sm" type="submit">Save</Button>
                </form>
              ) : (
                <>
                  <span className="font-mono text-foreground">{base}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs uppercase tracking-widest text-primary hover:underline"
                  >
                    change
                  </button>
                </>
              )}
            </div>

            {stats.data && (
              <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span><b className="text-foreground">{stats.data.artists}</b> artists</span>
                <span><b className="text-foreground">{stats.data.albums}</b> albums</span>
                <span><b className="text-foreground">{stats.data.tracks}</b> tracks</span>
              </div>
            )}
            {stats.isError && (
              <span className="text-xs text-destructive">
                Cannot reach server. Check URL & that you're on the same network.
              </span>
            )}
          </div>

          <div className="mt-5 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search albums or artists..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {albums.isLoading && (
          <div className="mt-10 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-x-3 gap-y-6">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-muted rounded-sm" />
                <div className="h-3 bg-muted mt-2 w-3/4 rounded-sm" />
                <div className="h-2.5 bg-muted mt-1.5 w-1/2 rounded-sm" />
              </div>
            ))}
          </div>
        )}

        {albums.data && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-x-3 gap-y-6 mt-10">
            {albums.data.items.map((a) => (
              <LiveAlbumCard key={a.id} album={a} />
            ))}
            {albums.data.items.length === 0 && (
              <p className="text-muted-foreground col-span-full">No albums match.</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function LiveAlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <Link to={`/library/album/${album.id}`} className="group block animate-fade-up">
      <div className="relative aspect-square overflow-hidden rounded-sm shadow-album bg-muted">
        <AlbumCover
          albumId={album.id}
          artistName={album.artist_name}
          title={album.title}
          hasCover={album.has_cover}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <div className="mt-2">
        <div className="text-[13px] font-medium leading-tight line-clamp-1">{album.title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
          {album.artist_name}
          {album.year ? <> · <span className="text-muted-foreground/70">{album.year}</span></> : null}
        </div>
      </div>
    </Link>
  );
}

export default LibraryPage;
