<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Models\Plan;
use App\Models\Topic;
use App\Support\Faq;
use App\Support\Levels;
use App\Support\PublicSeo;
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
 * - Plan cards show the active plan's Persian name, duration, and its
 *   server-formatted toman price. The "from" label reads the cheapest
 *   active plan from the same collection, so the public copy cannot drift
 *   from checkout. No raw integer amount crosses the Inertia boundary.
 * - Hero preview stages the real sample (cover, title, level, opening
 *   paragraph) and plays the sample's own stream with a real transport —
 *   never a mock player, never autoplay, and no fabricated testimonials,
 *   counts, ratings, or claims. With no published sample the empty preview
 *   is not rendered and sample links are not offered.
 * - Sales switch (config sales.enabled, off by default): when off, the
 *   plan cards still show their prices, the CTA is disabled, and a calm
 *   notice explains that sales are not open yet.
 */
class LandingController extends Controller
{
    public function index(Request $request): Response
    {
        $plans = Plan::query()
            ->where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('id')
            ->get(['id', 'name_fa', 'price_toman', 'duration_days']);

        // The "from" line quotes the cheapest active plan. Only formatted
        // labels cross the Inertia boundary; raw integer amounts do not.
        $fromPrice = $plans->min('price_toman');

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

        $faqs = Faq::landing($sample !== null);

        // M0 Inertia transport (ADR-0002): the same gating and the same
        // fields as the Blade landing. Props are an allowlist — never
        // bodies, glossaries, raw amounts, or private paths. Prices cross
        // only as server-formatted Persian labels. The only audio URL is
        // the public sample's own stream, which /sample already serves to
        // guests.
        return Inertia::render('Landing/Index', array_merge($preview, [
            'featured' => $featured->map(fn (Topic $topic) => TopicCard::preview($topic))->all(),
            'plans' => $plans->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'name_fa' => $plan->name_fa,
                'price_label' => Toman::format((int) $plan->price_toman),
                'duration_days' => $plan->duration_days,
            ])->all(),
            'faqs' => $faqs,
            'salesOn' => (bool) config('sales.enabled', false),
            'plansFromLabel' => $fromPrice === null ? null : Toman::format((int) $fromPrice),
            // The hero's primary action follows reality: while no real APK
            // exists, the sample is primary and /download is informational.
            // Once published, the landing's main download action points at
            // the real APK file (one click), while /download keeps the
            // metadata/checksum details.
            'releasePublished' => Release::published(),
            'downloadUrl' => Release::metadata()['file_url'],
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
            // description, social tags, and JSON-LD before React runs.
            'seo' => PublicSeo::page(
                'Fast English: انگلیسی را با داستان کوتاه بخوان و بشنو',
                'Fast English: متن‌های کوتاه انگلیسی در سطح A1 تا C2 با صوت همان نسخه؛ بخوان و بشنو، سرعت را تنظیم کن و واژه بساز.',
                route('landing'),
                [
                    '@context' => 'https://schema.org',
                    '@graph' => [
                        PublicSeo::organization(),
                        [
                            '@type' => 'WebSite',
                            '@id' => route('landing').'#website',
                            'url' => route('landing'),
                            'name' => 'Fast English',
                            'inLanguage' => 'fa-IR',
                            'publisher' => ['@id' => route('landing').'#organization'],
                        ],
                        [
                            '@type' => 'SoftwareApplication',
                            'name' => 'Fast English',
                            'applicationCategory' => 'EducationalApplication',
                            'operatingSystem' => 'Android, Web',
                            'inLanguage' => 'fa-IR',
                            'description' => 'یادگیری انگلیسی با متن‌های کوتاه و صوت همراه آن در شش سطح A1 تا C2.',
                            'url' => route('download'),
                            'image' => PublicSeo::absolute(PublicSeo::DEFAULT_IMAGE),
                        ],
                        Faq::schema($faqs),
                    ],
                ],
            ),
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
        $payload = ReadingPayload::for($sample);
        $coverUrl = $payload['topic']['cover_url'];

        // Article copy stays English (the lesson is English); the SERP
        // description is Persian because the audience and page chrome are.
        $summary = $sample->topic->summary_public;
        if ($summary === null || trim($summary) === '') {
            $summary = Str::limit(trim((string) preg_replace('/\s+/u', ' ', $sample->body_en)), 150);
        }

        $title = $sample->title_en.' ('.$sample->level.'): نمونهٔ رایگان متن و صوت | Fast English';
        $metaDescription = 'نمونهٔ رایگان Fast English: متن و صوت درس «'.$sample->title_en.'» در سطح '.$sample->level.'. بدون ثبت‌نام بخوان و بشنو.';
        $image = $coverUrl ?? PublicSeo::DEFAULT_IMAGE;
        $publishedAt = $sample->published_at?->toAtomString();
        $modifiedAt = $sample->updated_at?->toAtomString();

        $article = [
            '@type' => 'Article',
            'headline' => $sample->title_en,
            'description' => $summary,
            'image' => PublicSeo::absolute($image),
            'inLanguage' => 'en',
            'isAccessibleForFree' => true,
            'mainEntityOfPage' => route('sample'),
            'isPartOf' => ['@id' => route('landing').'#website'],
            'author' => [
                '@type' => 'Organization',
                '@id' => route('landing').'#organization',
                'name' => 'Fast English',
                'url' => route('landing'),
            ],
            'publisher' => [
                '@type' => 'Organization',
                '@id' => route('landing').'#organization',
                'name' => 'Fast English',
                'url' => route('landing'),
                'logo' => [
                    '@type' => 'ImageObject',
                    'url' => PublicSeo::absolute('/icons/icon-512.png'),
                    'width' => 512,
                    'height' => 512,
                ],
            ],
        ];
        if ($publishedAt !== null) {
            $article['datePublished'] = $publishedAt;
        }
        if ($modifiedAt !== null) {
            $article['dateModified'] = $modifiedAt;
        }

        return Inertia::render('Sample/Show', array_merge($payload, [
            'sampleLevels' => $sampleLevels,
            'seo' => PublicSeo::page(
                $title,
                $metaDescription,
                route('sample'),
                ['@context' => 'https://schema.org', ...$article],
                'article',
                $image,
                'تصویر جلد درس '.$sample->title_en,
                $coverUrl !== null ? 800 : null,
                $coverUrl !== null ? 450 : null,
            ),
        ]));
    }
}
