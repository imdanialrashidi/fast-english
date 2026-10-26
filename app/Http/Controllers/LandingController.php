<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\Plan;
use App\Models\Topic;
use App\Support\Levels;
use App\Support\ReadingPayload;
use App\Support\Release;
use App\Support\Toman;
use App\Support\TopicCard;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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
 * - Hero preview stages the real sample (cover, title, level, opening
 *   paragraph) and plays the sample's own stream with a real transport —
 *   never a mock player, never autoplay, and no fabricated testimonials,
 *   counts, ratings, or claims.
 * - Sales switch (config sales.enabled, off by default): when off, the
 *   plan list shows «در دست آماده‌سازی» and no purchase CTA is rendered.
 */
class LandingController extends Controller
{
    /**
     * Landing FAQ rows. One server source feeds both the visible
     * accordion and the FAQPage structured data, so SEO copy can never
     * drift from what a visitor reads.
     *
     * @var list<array{q: string, a: string}>
     */
    private const FAQS = [
        [
            'q' => 'بدون اشتراک می‌توانم امتحان کنم؟',
            'a' => 'بله. نمونه واقعی همیشه رایگان است و بدون ثبت‌نام باز می‌شود.',
        ],
        [
            'q' => 'سطح‌ها یعنی چه؟',
            'a' => 'شش سطح از A1 تا C2. هر مطلب نسخه خودش را در هر سطح دارد و متن و صوت همیشه از یک نسخه‌اند.',
        ],
        [
            'q' => 'واژه‌ها چطور مرور می‌شوند؟',
            'a' => 'هر واژه‌ای که ذخیره کنی سر موعد با کارت مرور برمی‌گردد؛ دوباره، سخت، خوب یا آسان را خودت ثبت می‌کنی.',
        ],
    ];

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
                // Cards read only level + estimated_minutes; the FK stays
                // so lessons still match their topics. Levels travel in
                // CEFR order, the same order the library uses.
                ->where('status', 'published')
                ->orderByRaw(Levels::orderExpression())
                ->select(['id', 'topic_id', 'level', 'estimated_minutes']),
            ])
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get();

        // The hero preview plays the same public sample the /sample page
        // serves. ReadingPayload owns the opening-paragraph slice and the
        // sample's own stream URL.
        $preview = ReadingPayload::preview($sample);

        // M0 Inertia transport (ADR-0002): the same gating and the same
        // fields as the Blade landing. Props are an allowlist — never
        // bodies, glossaries, amounts, or private paths. The only audio
        // URL is the public sample's own stream, which /sample already
        // serves to guests.
        return Inertia::render('Landing/Index', array_merge($preview, [
            'featured' => $featured->map(fn (Topic $topic) => TopicCard::preview($topic))->all(),
            'plans' => $plans->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'name_fa' => $plan->name_fa,
                'duration_days' => $plan->duration_days,
            ])->all(),
            'faqs' => self::FAQS,
            'salesOn' => (bool) config('sales.enabled', false),
            'singlePackageLabel' => Toman::format(299000),
            // The hero's primary action follows reality: while no real APK
            // exists, the sample is primary and /download is informational.
            'releasePublished' => Release::published(),
            // Guest-only funnel: the landing never links into the
            // authenticated app. Plan interest goes through registration;
            // the primary conversion is the download page.
            'urls' => [
                'sample' => route('sample'),
                'register' => route('register'),
                'download' => route('download'),
                'faq' => route('trust.faq'),
            ],
            // Server-rendered in app.blade.php so crawlers see the title,
            // description, Open Graph tags, and JSON-LD before React runs.
            'seo' => [
                'title' => 'Fast English — انگلیسی را با داستان کوتاه بخوان و بشنو',
                'description' => 'Fast English — متن‌های کوتاه انگلیسی در سطح A1 تا C2 با صوت همان نسخه؛ بخوان و بشنو، سرعت را تنظیم کن و واژه بساز.',
                'canonical' => route('landing'),
                'json_ld' => [
                    '@context' => 'https://schema.org',
                    '@graph' => [
                        [
                            '@type' => 'WebSite',
                            '@id' => route('landing').'#website',
                            'url' => route('landing'),
                            'name' => 'Fast English',
                            'inLanguage' => 'fa-IR',
                        ],
                        [
                            '@type' => 'SoftwareApplication',
                            'name' => 'Fast English',
                            'applicationCategory' => 'EducationalApplication',
                            'operatingSystem' => 'Android',
                            'inLanguage' => 'fa-IR',
                            'description' => 'یادگیری انگلیسی با متن‌های کوتاه و صوت همراه آن در شش سطح A1 تا C2.',
                            'url' => route('download'),
                        ],
                        [
                            '@type' => 'FAQPage',
                            'mainEntity' => array_map(fn (array $faq) => [
                                '@type' => 'Question',
                                'name' => $faq['q'],
                                'acceptedAnswer' => [
                                    '@type' => 'Answer',
                                    'text' => $faq['a'],
                                ],
                            ], self::FAQS),
                        ],
                    ],
                ],
            ],
        ]));
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

        $topicParam = $request->query('topic');
        $topicSlug = is_string($topicParam) ? trim($topicParam) : '';
        $levelParam = $request->query('level');
        $level = is_string($levelParam) ? strtoupper(trim($levelParam)) : '';

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

        // The sample is public content, so it gets its own crawler
        // metadata. The canonical deliberately drops ?topic/?level so
        // every level variant consolidates onto the sample entry.
        $description = $sample->topic->summary_public;
        if ($description === null || trim($description) === '') {
            $description = Str::limit(trim((string) preg_replace('/\s+/u', ' ', $sample->body_en)), 150);
        }

        return Inertia::render('Sample/Show', array_merge(ReadingPayload::for($sample), [
            'sampleLevels' => $sampleLevels,
            'seo' => [
                'title' => $sample->title_en.' ('.$sample->level.') — نمونه رایگان Fast English',
                'description' => $description,
                'canonical' => route('sample'),
                'json_ld' => [
                    '@context' => 'https://schema.org',
                    '@type' => 'Article',
                    'headline' => $sample->title_en,
                    'description' => $description,
                    'inLanguage' => 'en',
                    'isAccessibleForFree' => true,
                    'mainEntityOfPage' => route('sample'),
                    'author' => ['@type' => 'Organization', 'name' => 'Fast English'],
                    'publisher' => ['@type' => 'Organization', 'name' => 'Fast English'],
                ],
            ],
        ]));
    }
}
