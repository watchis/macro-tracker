import { normalizeSearchText } from '../data/foodAliases';

/** Prefer official-name hits over alias or category hits of the same shape. */
const ALIAS_PENALTY = 10;
const CATEGORY_PENALTY = 20;

export type FoodSearchable = {
  name: string;
  aliases?: readonly string[];
  categoryLabel?: string;
};

/**
 * Lower is better. Scores how precisely `needle` matches a single text field
 * (already expected to contain the needle after normalization).
 *
 * Tiers: exact → leading whole token/phrase → leading compound suffix
 * (popcorn) → leading token prefix (cornish) → later whole token → later
 * compound / prefix → embedded substring (acorn).
 */
function scoreField(haystack: string, needle: string): number | null {
  const hay = normalizeSearchText(haystack);
  if (!needle || !hay.includes(needle)) return null;
  if (hay === needle) return 0;

  if (hay.startsWith(needle)) {
    const after = hay[needle.length];
    if (after === undefined || /[^a-z0-9]/.test(after)) return 1;
  }

  let best = Infinity;
  const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);

  tokens.forEach((token, index) => {
    const position = Math.min(index, 20) * 0.01;
    if (token === needle) {
      best = Math.min(best, (index === 0 ? 1 : 4) + position);
      return;
    }
    if (token.length <= needle.length) return;
    // Compound suffix (popcorn): require a real stem before the needle so
    // short accidents like "acorn" stay in the embedded-substring tier.
    if (token.endsWith(needle) && token.length - needle.length >= 2) {
      best = Math.min(best, (index === 0 ? 2 : 5) + position);
      return;
    }
    if (token.startsWith(needle)) {
      best = Math.min(best, (index === 0 ? 3 : 6) + position);
      return;
    }
    if (token.includes(needle)) {
      best = Math.min(best, 7 + position);
    }
  });

  if (best !== Infinity) return best;

  // Contiguous multi-word phrase that is not token-aligned (rare).
  const index = hay.indexOf(needle);
  const beforeOk = index === 0 || /[^a-z0-9]/.test(hay[index - 1]!);
  const after = hay[index + needle.length];
  const afterOk = after === undefined || /[^a-z0-9]/.test(after);
  if (beforeOk && afterOk) return 4 + Math.min(index, 50) * 0.01;
  return 8 + Math.min(index, 50) * 0.01;
}

/**
 * Relevance score for a food against a search query. `null` means no match.
 * Lower scores rank first.
 */
export function foodSearchScore(item: FoodSearchable, query: string): number | null {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return 0;

  let best: number | null = null;
  const consider = (score: number | null) => {
    if (score === null) return;
    if (best === null || score < best) best = score;
  };

  consider(scoreField(item.name, needle));
  for (const alias of item.aliases ?? []) {
    const score = scoreField(alias, needle);
    if (score !== null) consider(score + ALIAS_PENALTY);
  }
  if (item.categoryLabel) {
    const score = scoreField(item.categoryLabel, needle);
    if (score !== null) consider(score + CATEGORY_PENALTY);
  }
  return best;
}

/** Sort comparator: higher match precision first, then shorter name, then A–Z. */
export function compareFoodSearchRelevance(
  a: FoodSearchable,
  b: FoodSearchable,
  query: string,
): number {
  const scoreA = foodSearchScore(a, query) ?? Number.POSITIVE_INFINITY;
  const scoreB = foodSearchScore(b, query) ?? Number.POSITIVE_INFINITY;
  if (scoreA !== scoreB) return scoreA - scoreB;

  const nameA = normalizeSearchText(a.name);
  const nameB = normalizeSearchText(b.name);
  if (nameA.length !== nameB.length) return nameA.length - nameB.length;
  return nameA.localeCompare(nameB);
}

export function sortByFoodSearchRelevance<T extends FoodSearchable>(
  items: readonly T[],
  query: string,
): T[] {
  const needle = query.trim();
  if (!needle) return [...items];
  return [...items].sort((a, b) => compareFoodSearchRelevance(a, b, needle));
}
