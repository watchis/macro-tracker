import { useEffect, useState } from 'react';
import {
  queryStarterFoods,
  STARTER_MANIFEST,
  type StarterPage,
  type StarterQuery,
} from '../data/starterCatalog';

const DEFAULT_LIMIT = 40;

/**
 * Loads a paginated / filtered slice of the whole-foods starter catalog.
 * Category files are fetched on demand and cached in memory.
 */
export function useStarterFoodPage(options: StarterQuery): {
  page: StarterPage | null;
  loading: boolean;
  error: string | null;
} {
  const query = options.query ?? '';
  const categoryId = options.categoryId ?? null;
  const offset = options.offset ?? 0;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const requestKey = `${query}::${categoryId ?? ''}::${offset}::${limit}`;

  const [result, setResult] = useState<{
    key: string;
    page: StarterPage | null;
    error: string | null;
  }>({ key: '', page: null, error: null });

  useEffect(() => {
    let cancelled = false;

    queryStarterFoods({ query, categoryId, offset, limit })
      .then((page) => {
        if (!cancelled) setResult({ key: requestKey, page, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            page: null,
            error: err instanceof Error ? err.message : 'Failed to load foods.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, categoryId, offset, limit, requestKey]);

  const loading = result.key !== requestKey;

  return {
    page: loading ? null : result.page,
    loading,
    error: loading ? null : result.error,
  };
}

export function useStarterCategories() {
  return STARTER_MANIFEST.categories;
}

export type { StarterPage };
