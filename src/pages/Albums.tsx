import { albums } from "@/data/library";
import { AlbumCard } from "@/components/AlbumCard";

const Albums = () => {
  return (
    <div className="px-6 md:px-10 py-10 pb-16">
      <div className="border-b border-border pb-5">
        <div className="text-[10px] uppercase tracking-[0.35em] text-primary">Collection</div>
        <h1 className="font-display text-5xl md:text-6xl mt-1">Albums</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          The complete library, presented as it was meant to be heard — in full.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10 mt-10">
        {albums.map((a) => (
          <AlbumCard key={a.id} album={a} />
        ))}
      </div>
    </div>
  );
};

export default Albums;
