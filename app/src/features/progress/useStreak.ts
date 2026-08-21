// app/src/features/progress/useStreak.ts
// Draft — honest streak derived from lesson_progress.last_played_at (spike 038).
// No new endpoint, client-derived, UTC midnight deterministic.

import { useMemo } from 'react';

export function useStreak(lastPlayedAts: (string | null)[]): number {
  return useMemo(() => {
    const days = new Set<string>();
    for (const ts of lastPlayedAts) {
      if (!ts) continue;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) continue;
      // UTC midnight for deterministic streak
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
      days.add(key);
    }
    const sorted = Array.from(days).sort();
    // Consecutive day check
    let streak = 0;
    let prev: string | null = null;
    for (const day of sorted) {
      if (!prev) streak = 1;
      else {
        const [y, m, d] = day.split('-').map(Number);
        const [py, pm, pd] = prev.split('-').map(Number);
        const cur = Date.UTC(y, m - 1, d);
        const prv = Date.UTC(py, pm - 1, pd);
        if (cur - prv === 86400000) streak += 1;
        else if (cur !== prv) streak = 1;
      }
      prev = day;
    }
    return streak;
  }, [lastPlayedAts]);
}
