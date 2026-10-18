<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\Plan;
use App\Models\Topic;
use App\Support\Sentences;
use App\Support\Toman;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S8 landing (scope §6, PUB-01): the public introduction to Fast English.
 *
 * - The promise, a link to the real S1 sample, how it works, the plan
 *   list from the database, install/download links, and an FAQ link.
 * - Plan cards show names + durations only, never amounts; the 299000
 *   toman single-package note is the owner-approved commercial input
 *   (limited-time label, no countdown, no end date). Fixture amounts
 *   never appear on the public landing (no price claims from TEST).
 * - Hero preview stages the real sample (title, level, cover, first three
 *   sentences) with a link into /sample — no mock player, no
 *   fabricated testimonials, counts, ratings, or claims.
 * - Sales switch (config sales.enabled, off by default): when off, the
 *   plan list shows «در دست آماده‌سازی» and no purchase CTA is rendered.
 */
class LandingController extends Controller
{
    public function index(Request $request): Response
    {
        $plans = Plan::query()
            ->where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('id')
            ->get(['id', 'name_fa', 'duration_days']);

        $sample = Lesson::query()
            ->where('is_public_sample', true)
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published'))
            ->with('topic')
            ->orderBy('id')
            ->first();

        // A small editorial selection of representative lessons.
        $featured = Topic::query()
            ->where('status', 'published')
            ->whereHas('lessons', fn ($lessons) => $lessons->where('status', 'published'))
            ->with(['lessons' => fn ($lessons) => $lessons
                ->where('status', 'published')
                ->orderBy('id'),
            ])
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get();

        // M0 Inertia transport (ADR-0002): the same gating and the same
        // fields as the Blade landing. Props are an allowlist — never
        // bodies, glossaries, audio URLs, amounts, or private paths.
        return Inertia::render('Landing/Index', [
            'sample' => $sample ? [
                'title_en' => $sample->title_en,
                'level' => $sample->level,
                'duration_seconds' => $sample->duration_seconds,
                'cover_url' => $sample->topic->cover_path
                    ? '/storage/'.$sample->topic->cover_path
                    : null,
                'reader_url' => route('sample', ['topic' => $sample->topic->slug, 'level' => $sample->level]),
            ] : null,
            'sampleSentences' => $sample ? $this->previewSentences($sample->body_en) : [],
            'featured' => $featured->map(fn (Topic $topic) => [
                'title_en' => $topic->title_en,
                'url' => route('reader.show', $topic),
                'cover_url' => $topic->cover_path ? '/storage/'.$topic->cover_path : null,
                'first_level' => $topic->lessons->pluck('level')->filter()->values()->first(),
                'extra_levels' => max(0, $topic->lessons->pluck('level')->filter()->count() - 1),
                'levels_fa' => $topic->lessons->pluck('level')->filter()->values()->implode('، '),
                'minutes' => (int) $topic->lessons->sum('estimated_minutes'),
            ])->all(),
            'plans' => $plans->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'name_fa' => $plan->name_fa,
                'duration_days' => $plan->duration_days,
            ])->all(),
            'salesOn' => (bool) config('sales.enabled', false),
            'singlePackageLabel' => Toman::format(299000),
            'urls' => [
                'sample' => route('sample'),
                'library' => route('app.home'),
                'subscribe' => route('subscribe.index'),
                'register' => route('register'),
                'download' => route('download'),
                'faq' => route('trust.faq'),
            ],
        ]);
    }

    /**
     * Public sample experience (scope §6, /sample): no login, no premium
     * leak, no learner shell. Renders the designated public-sample lesson
     * — resolved by the existing is_public_sample flag, never a hardcoded
     * id/slug/title — in the public marketing layout with its audio.
     *
     * Optional ?topic= + ?level= select among the flagged lessons (the
     * learner reader redirects ineligible sample hits here with both).
     * Draft, archived, or non-flagged lessons never resolve here — 404
     * with the neutral preparing message when no public sample exists.
     * Props mirror the reader allowlist for exactly this lesson: no other
     * lesson's body, glossary, or audio URL travels with the page.
     */
    public function sample(Request $request): Response
    {
        $first = Lesson::query()
            ->where('is_public_sample', true)
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published'))
            ->orderBy('id')
            ->first();

        if ($first === null) {
            abort(404);
        }

        $topicSlug = trim((string) $request->query('topic', ''));
        $level = strtoupper(trim((string) $request->query('level', '')));

        $sample = $first;
        if ($topicSlug !== '' || $level !== '') {
            $candidate = Lesson::query()
                ->where('is_public_sample', true)
                ->where('status', 'published')
                ->whereHas('topic', fn ($topics) => $topics
                    ->where('status', 'published')
                    ->when($topicSlug !== '', fn ($q) => $q->where('slug', $topicSlug)))
                ->when($level !== '', fn ($q) => $q->where('level', $level))
                ->orderBy('id')
                ->first();

            if ($candidate === null) {
                abort(404);
            }
            $sample = $candidate;
        }

        $sample->loadMissing('topic');

        $sampleLevels = Lesson::query()
            ->where('is_public_sample', true)
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published')->where('id', $sample->topic->id))
            ->orderBy('id')
            ->pluck('level')
            ->all();

        $prepared = \App\Support\Reading::prepared($sample);
        $sentences = $prepared['sentences'];
        $cues = $prepared['cues'];
        $cuesUsable = $prepared['cuesUsable'];
        $paragraphs = $prepared['paragraphs'];

        return Inertia::render('Sample/Show', [
            'topic' => [
                'slug' => $sample->topic->slug,
                'title_en' => $sample->topic->title_en,
                'summary_public' => $sample->topic->summary_public,
                'cover_url' => $sample->topic->cover_path ? '/storage/'.$sample->topic->cover_path : null,
            ],
            'lesson' => [
                'id' => $sample->id,
                'title_en' => $sample->title_en,
                'level' => $sample->level,
                'estimated_minutes' => (int) $sample->estimated_minutes,
                'duration_seconds' => (int) $sample->duration_seconds,
                'audio_revision' => (int) $sample->audio_revision,
                'audio_url' => route('media.lesson.audio', $sample),
            ],
            'sampleLevels' => $sampleLevels,
            'sentences' => $sentences,
            'paragraphs' => $paragraphs,
            'cues' => $cues,
            'cuesUsable' => $cuesUsable,
            'glossary' => $prepared['glossary'],
        ]);
    }

    /**
     * First three real sentences of the sample body for the hero
     * preview. Splits on sentence boundaries so lines end cleanly;
     * falls back to paragraphs. Real lesson text only — never
     * placeholder copy.
     *
     * @return list<string>
     */
    private function previewSentences(string $body): array
    {
        $chunks = preg_split('/(?<=[.!?])\s+/', $body) ?: [];
        $sentences = [];
        foreach ($chunks as $chunk) {
            $line = trim((string) $chunk);
            if ($line === '') {
                continue;
            }
            $sentences[] = $line;
            if (count($sentences) === 3) {
                break;
            }
        }
        if (count($sentences) < 3) {
            $paragraphs = preg_split('/\R{2,}|\R/', $body) ?: [];
            foreach ($paragraphs as $paragraph) {
                $line = trim((string) $paragraph);
                if ($line === '' || in_array($line, $sentences, true)) {
                    continue;
                }
                $sentences[] = mb_strimwidth($line, 0, 140, '…');
                if (count($sentences) === 3) {
                    break;
                }
            }
        }

        return $sentences;
    }
}
