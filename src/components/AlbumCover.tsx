import { useState } from "react";
import { ImageOff } from "lucide-react";
import { aurum } from "@/lib/aurum";

type Props = {
  albumId: string;
  artistName: string;
  title: string;
  hasCover: boolean;
  alt?: string;
  className?: string;
  iconClassName?: string;
};

/**
 * Affiche la pochette d'un album.
 *  - Si has_cover : on tape /covers/:id (extraite des fichiers locaux).
 *  - Sinon : /albums/:id/external-cover (cascade côté serveur Aurum).
 *  - Si tout échoue : icône fallback.
 *
 * Toute la logique (cache, rate-limit, cascade Spotify→Deezer→iTunes→CAA)
 * est gérée côté serveur Aurum.
 */
export function AlbumCover({
  albumId,
  artistName,
  title,
  hasCover,
  alt,
  className = "h-full w-full object-cover",
  iconClassName = "h-6 w-6",
}: Props) {
  // 0 = local, 1 = external, 2 = donne ta langue au chat
  const [stage, setStage] = useState<0 | 1 | 2>(hasCover ? 0 : 1);

  const src =
    stage === 0
      ? aurum.coverUrl(albumId)
      : stage === 1
      ? aurum.externalCoverUrl(albumId)
      : null;

  if (!src) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        <ImageOff className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? `${title} — ${artistName}`}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : 2))}
    />
  );
}
