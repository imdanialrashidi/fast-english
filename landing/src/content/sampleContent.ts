// landing/src/content/sampleContent.ts
// Canonical public-sample content for the Landing (Business Configuration
// slice). Single source of truth for the sample LESSON TEXT on the Landing:
// SamplePage and the home SampleLesson section both render from here.
//
// The app's live `/sample` route serves a real database-backed lesson with
// `is_public_sample = true` (server/pb_hooks/lesson_routes.pb.js). The
// deterministic relationship is enforced by
// landing/src/content/sampleContent.test.ts, which asserts this exact text
// equals the transcript of the committed demo content package
// (content-packages/typical-workday-sample/transcripts/b1.md). To change
// the public sample, update BOTH this constant and the demo package, or
// replace the demo package with the owner-approved launch sample.
//
// The demo package is NOT the final production content library; final
// launch-content quantity remains HUMAN INPUT REQUIRED.

export const SAMPLE_LEVEL = 'B1' as const;

export const SAMPLE_TITLE_EN = 'A Typical Workday';
export const SAMPLE_TITLE_FA = 'یک روز کاری معمولی';

/** Exact English paragraphs shown on the Landing and promised to `/sample`. */
export const SAMPLE_PARAGRAPHS_EN: readonly string[] = [
  'Sara starts her day at half past seven. She drinks a cup of tea, checks her email, and leaves the house at a quarter to nine. Her office is in the city centre, so she takes the metro every morning.',
  'In the evening, Sara spends an hour with her English podcast. She listens to one lesson, repeats a few sentences, and then writes two short paragraphs in her notebook.',
] as const;
