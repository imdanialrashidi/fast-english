// shared/lib/search-rank.ts
// Draft — vocabulary-aware ranking for library discovery (spike 037).
// 3 weighted fields: titleFa exact > title substring > vocab term
// No stemming, deterministic, q≤60.

export interface RankInput {
  title: string;
  titleFa: string;
  vocabTerms: string[];
}

export function rankScore(q: string, input: RankInput): number {
  const query = q.trim().toLowerCase();
  if (!query) return 0;
  let score = 0;
  if (input.titleFa.toLowerCase() === query) score += 3;
  else if (input.title.toLowerCase().includes(query) || input.titleFa.toLowerCase().includes(query))
    score += 2;
  if (input.vocabTerms.some((t) => t.toLowerCase() === query)) score += 1;
  // transcript preview would be +0.5 if available
  return score;
}
