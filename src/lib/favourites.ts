import { useCallback, useEffect, useState } from "react";

const KEY = "aurum_favourites_v1";
const EVT = "aurum:favourites-changed";

type FavKind = "track" | "album" | "artist";
export type FavItem = { kind: FavKind; id: string; addedAt: number };

function load(): FavItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: FavItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function useFavourites() {
  const [items, setItems] = useState<FavItem[]>(() => load());

  useEffect(() => {
    const onChange = () => setItems(load());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const isFav = useCallback(
    (kind: FavKind, id: string) => items.some((i) => i.kind === kind && i.id === id),
    [items],
  );

  const toggle = useCallback(
    (kind: FavKind, id: string) => {
      const exists = items.some((i) => i.kind === kind && i.id === id);
      const next = exists
        ? items.filter((i) => !(i.kind === kind && i.id === id))
        : [...items, { kind, id, addedAt: Date.now() }];
      save(next);
      setItems(next);
    },
    [items],
  );

  const remove = useCallback(
    (kind: FavKind, id: string) => {
      const next = items.filter((i) => !(i.kind === kind && i.id === id));
      save(next);
      setItems(next);
    },
    [items],
  );

  const clear = useCallback(() => {
    save([]);
    setItems([]);
  }, []);

  return { items, isFav, toggle, remove, clear };
}
