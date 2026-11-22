<?php

namespace App\Http\Controllers;

use App\Models\ExerciseItem;
use App\Models\FlashcardUnit;
use App\Models\Lesson;
use App\Models\LibraryNode;
use App\Models\PlacementQuestion;
use App\Models\ReadingDocument;
use App\Models\TedTalk;
use App\Support\Faq;
use App\Support\PublicSeo;
use App\Support\ReadingPayload;
use App\Support\Release;
use App\Support\Toman;
use App\Support\TopicCover;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S8 landing (scope §6, PUB-01), rewritten for the owner instruction of
 * 2026-11-22.
 *
 * The page sells one paid path. It carries no free-sample link, no
 * trial, and no public audio. Two kinds of claim appear:
 * - owner-supplied marketing decisions in `config/site.php`: the 16,355
 *   learner figure and the 990,000 → 641,000 toman offer;
 * - measured library facts read from the database in contentStats():
 *   reading texts, words, listening hours, AEF units, exercises, and
 *   TED Talks.
 *
 * Only formatted price labels cross the Inertia boundary; raw toman
 * integers stay server-side. No lesson body, glossary, audio URL, or
 * authenticated app URL travels with this page.
 */
class LandingController extends Controller
{
    public function index(Request $request): Response
    {
        $stats = app()->environment('testing')
            ? $this->contentStats()
            : Cache::remember('landing:content-stats:v2', now()->addHour(), fn (): array => $this->contentStats());

        $learners = max(0, (int) config('site.marketing.learners', 0));

        $compareAt = max(1, (int) config('site.marketing.offer.compare_at_toman', 990000));
        $price = (int) config('site.marketing.offer.price_toman', 641000);
        $duration = max(1, (int) config('site.marketing.offer.duration_days', 90));

        // Never render a negative or absurd discount if staff edit the
        // config into an impossible pair.
        $price = max(0, min($price, $compareAt));
        $discount = (int) round((1 - ($price / $compareAt)) * 100);

        $offer = [
            'price_label' => Toman::format($price),
            'compare_label' => Toman::format($compareAt),
            // Daily value framing is a factual division of the owner's
            // price by the access window, formatted server-side.
            'per_day_label' => Toman::format((int) round($price / $duration)),
            'discount_percent' => $discount,
            'duration_days' => $duration,
        ];

        // Three real talks prove the library without leaking audio or a
        // paid transcript. The card's video link points at the public
        // TED source; the in-app talk page stays behind the paid gate.
        $talks = TedTalk::query()
            ->published()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get(['id', 'title_en', 'speaker', 'area', 'duration_seconds', 'cover_path', 'source_url'])
            ->map(fn (TedTalk $talk): array => [
                'title_en' => (string) $talk->title_en,
                'speaker' => (string) ($talk->speaker ?? ''),
                'area_label' => $talk->areaLabel(),
                'minutes' => $talk->estimatedMinutes(),
                'cover_url' => TopicCover::url($talk->cover_path),
                'source_url' => (string) $talk->source_url,
            ])
            ->all();

        $faqs = Faq::landing();

        $seoDescription = 'Fast English: خواندن و شنیدن هم‌زمان در شش سطح A1 تا C2؛ '
            .number_format($stats['texts']).' متن و سخنرانی، '
            .number_format($stats['words']).' کلمه و '
            .$stats['listeningHours'].' ساعت صدا. اشتراک از '.$offer['price_label'].'.';

        return Inertia::render('Landing/Index', [
            'stats' => [...$stats, 'learners' => $learners],
            'talks' => $talks,
            'offer' => $offer,
            'faqs' => $faqs,
            // The download action follows the real release metadata. A
            // guest always gets a working path even while the APK is
            // unpublished: registration opens the library.
            'releasePublished' => Release::published(),
            'downloadUrl' => Release::metadata()['file_url'],
            'urls' => [
                'register' => route('register'),
                'download' => route('download'),
                'install' => route('install'),
                'faq' => route('trust.faq'),
                'support' => route('trust.support'),
            ],
            // Server-rendered in app.blade.php so crawlers see the title,
            // description, social tags, and JSON-LD before React runs.
            'seo' => PublicSeo::page(
                'Fast English | انگلیسی را با متن، صدا و TED Talk یاد بگیر',
                $seoDescription,
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
                            'description' => 'کتابخانهٔ خواندن و شنیدن انگلیسی در شش سطح A1 تا C2، همراه با TED Talks، کتاب American English File، واژه‌نامه و مرور زمان‌بندی‌شده.',
                            'url' => route('landing'),
                            'image' => PublicSeo::absolute(PublicSeo::DEFAULT_IMAGE),
                        ],
                        Faq::schema($faqs),
                    ],
                ],
            ),
        ]);
    }

    /**
     * Measured content facts for the landing. The costly part is the TED
     * word count (it walks the stored sentence arrays), so the result is
     * cached for an hour outside tests; a publish/edit is visible on the
     * next cache window.
     *
     * @return array{levels: int, texts: int, words: int, listeningHours: int, units: int, exercises: int, talks: int, talkWords: int, talkHours: int, stories: int, ielts: int, inside: int, placementQuestions: int}
     */
    private function contentStats(): array
    {
        $talkSeconds = (int) TedTalk::query()->published()->sum('duration_seconds');
        $talkCount = (int) TedTalk::query()->published()->count();

        $talkWords = 0;
        foreach (TedTalk::query()->published()->select(['id', 'segments'])->cursor() as $talk) {
            $talkWords += $this->sentenceWords($talk->segments);
        }

        $publishedDocuments = ReadingDocument::query()->whereNotNull('published_at');
        $libraryWords = (int) (clone $publishedDocuments)->sum('word_count');
        $libraryMs = (int) (clone $publishedDocuments)->sum('duration_ms');

        $readable = LibraryNode::query()
            ->whereHas('document', fn ($documents) => $documents->whereNotNull('published_at'));
        $readings = (int) (clone $readable)->count();

        $stories = (int) (clone $readable)->where('track', 'story')->count();
        $ielts = (int) (clone $readable)->where('track', 'ielts')->count();
        $inside = (int) (clone $readable)->where('track', 'inside_reading')->count();

        $placementQuestions = (int) PlacementQuestion::query()
            ->whereHas('test', fn ($tests) => $tests->where('status', 'published')->where('is_current', true))
            ->count();

        return [
            'levels' => 6,
            'texts' => $readings + $talkCount,
            'words' => $libraryWords + $talkWords,
            'listeningHours' => (int) round((($libraryMs / 1000) + $talkSeconds) / 3600),
            'units' => (int) FlashcardUnit::query()->count(),
            'exercises' => (int) ExerciseItem::query()->count(),
            'talks' => $talkCount,
            'talkWords' => $talkWords,
            'talkHours' => (int) round($talkSeconds / 3600),
            'stories' => $stories,
            'ielts' => $ielts,
            'inside' => $inside,
            'placementQuestions' => $placementQuestions,
        ];
    }

    /**
     * TED `segments` is [[{t, text}, ...], ...]. Count only the words that
     * are actually rendered as sentences; malformed rows are ignored.
     */
    private function sentenceWords(mixed $segments): int
    {
        if (! is_array($segments)) {
            return 0;
        }

        $count = 0;
        foreach ($segments as $paragraph) {
            foreach ((array) $paragraph as $sentence) {
                $text = is_array($sentence) ? (string) ($sentence['text'] ?? '') : '';
                $count += str_word_count($text);
            }
        }

        return $count;
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
