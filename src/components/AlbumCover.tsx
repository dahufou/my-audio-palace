import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { fetchAlbumCover, getInstantCover, type CoverInput } from "@/lib/albumCovers";

type Props = {
  albumId: string;
  artistName: string;
  title: string;
  hasCover: boolean;
  alt?: string;
  className?: string;
  /** Tailwind icon size used for the empty fallback. */
  iconClassName?: string;
};

/**
 * Affiche la pochette d'un album avec cascade :
 *   Aurum local → Deezer → iTunes → Cover Art Archive.
 * Cache localStorage géré dans `lib/albumCovers`.
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
  const input: CoverInput = { albumId, artistName, title, hasCover };
  const [src, setSrc] = useState<string | null>(() => getInstantCover(input));
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setErrored(false);
    const instant = getInstantCover(input);
    if (instant) {
      setSrc(instant);
      return;
    }
    setSrc(null);
    fetchAlbumCover(input).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId, artistName, title, hasCover]);

  if (!src || errored) {
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
      className={className}
      onError={() => {
        // Si l'image locale Aurum échoue ET qu'on n'a pas encore tenté le web,
        // on relance la cascade en ignorant has_cover.
        if (hasCover) {
          fetchAlbumCover({ ...input, hasCover: false }).then((url) => {
            if (url) setSrc(url);
            else setErrored(true);
          });
        } else {
          setErrored(true);
        }
      }}
    />
  );
}
