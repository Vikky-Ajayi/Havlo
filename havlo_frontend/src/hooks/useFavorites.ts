import { useState, useCallback } from 'react';

const STORAGE_KEY = 'havlo_uk_favorites';

function readStorage(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeStorage(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // quota exceeded or private browsing — fail silently
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(readStorage);

  const toggle = useCallback((rightmoveId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(rightmoveId)) {
        next.delete(rightmoveId);
      } else {
        next.add(rightmoveId);
      }
      writeStorage(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (rightmoveId: string) => favorites.has(rightmoveId),
    [favorites],
  );

  const favoriteIds = [...favorites];

  return { favorites, toggle, isFavorite, count: favorites.size, favoriteIds };
}
