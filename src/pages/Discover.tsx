import { albums } from "@/data/library";
import { AlbumCard } from "@/components/AlbumCard";
import { usePlayer } from "@/context/PlayerContext";
import { Play } from "lucide-react";
import heroImg from "@/assets/hero-listening.jpg";

const Discover = () => {
  const { playQueue } = usePlayer();
  const featured = albums[0];
  const newReleases = albums.slice(0, 4);
  const editorsChoice = albums.slice(2);

  return (
    <div className="pb-12">
      {/* Hero */}
      <section className="relative">
        <div className="relative h-[52vh] min-h-[380px] w-full overflow-hidden">
          <img src={heroImg} alt="The listening room" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
          <div className="absolute inset-0 bg-gradient-spotlight" />
          <div className="absolute inset-0 flex items-end">
            <div className="px-6 md:px-10 pb-10 max-w-3xl animate-fade-up">
              <div className="text-[10px] uppercase tracking-[0.4em] text-primary mb-3">
                Editor’s Pick · {featured.genre}
              </div>
              <h1 className="font-display text-5xl md:text-7xl leading-[0.95]">
                {featured.title}
              </h1>
              <p className="mt-3 text-muted-foreground italic">
                by <span className="text-foreground">{featured.artist}</span> — {featured.description}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => playQueue(featured.tracks, 0)}
                  className="inline-flex items-center gap-2 bg-gold text-primary-foreground px-5 py-2.5 rounded-sm shadow-gold hover:scale-[1.02] transition-transform"
                >
                  <Play className="h-4 w-4" />
                  <span className="text-sm uppercase tracking-[0.2em] font-medium">Play album</span>
                </button>
                <a
                  href={`/album/${featured.id}`}
                  className="text-sm uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors px-2"
                >
                  View details
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* New releases */}
      <section className="px-6 md:px-10 mt-10">
        <SectionHeader eyebrow="This week" title="New & Noteworthy" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6">
          {newReleases.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </div>
      </section>

      {/* Editor's choice */}
      <section className="px-6 md:px-10 mt-14">
        <SectionHeader eyebrow="Curated" title="From the Editors" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6">
          {editorsChoice.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </div>
      </section>
    </div>
  );
};

const SectionHeader = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="flex items-end justify-between border-b border-border pb-4">
    <div>
      <div className="text-[10px] uppercase tracking-[0.35em] text-primary">{eyebrow}</div>
      <h2 className="font-display text-3xl md:text-4xl mt-1">{title}</h2>
    </div>
    <div className="hidden md:block text-xs uppercase tracking-[0.25em] text-muted-foreground">
      View all →
    </div>
  </div>
);

export default Discover;
