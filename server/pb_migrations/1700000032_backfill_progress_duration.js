// server/pb_migrations/1700000032_backfill_progress_duration.js
// Backfill lesson_progress.duration_seconds to authoritative lesson duration
// where lesson's audio_duration_seconds differs. Safe monotonic update.

migrate(
  (app) => {
    let lessons = [];
    try {
      lessons = app.findRecordsByFilter('lessons', 'audio_duration_seconds > 0', '', 0, 0);
    } catch (_) {}
    const byId = {};
    for (let i = 0; i < lessons.length; i++) {
      const l = lessons[i];
      if (!l) continue;
      byId[String(l.id)] = Number(l.get('audio_duration_seconds') || 0);
    }
    let progresses = [];
    try {
      progresses = app.findRecordsByFilter('lesson_progress', 'duration_seconds > 0', '', 0, 0);
    } catch (_) {}
    for (let j = 0; j < progresses.length; j++) {
      const p = progresses[j];
      if (!p) continue;
      const lid = String(p.get('lesson') || '');
      const auth = byId[lid];
      if (!auth || !(auth > 0)) continue;
      const stored = Number(p.get('duration_seconds') || 0);
      if (stored !== auth) {
        p.set('duration_seconds', auth);
        const furthest = Number(p.get('furthest_seconds') || 0);
        const wasCompleted = Boolean(p.get('completed'));
        const shouldComplete = furthest >= auth * 0.9;
        if (shouldComplete && !wasCompleted) {
          p.set('completed', true);
          if (!p.get('completed_at')) p.set('completed_at', new Date().toISOString());
        }
        try {
          app.save(p);
        } catch (_) {}
      }
    }
  },
  (app) => {
    // No reverse — stale values are not recoverable precisely
  },
);
