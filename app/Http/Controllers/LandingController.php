<?php

namespace App\Http\Controllers;

use App\Models\ExerciseItem;
use App\Models\FlashcardUnit;
use App\Models\LibraryNode;
use App\Models\PlacementQuestion;
use App\Models\ReadingDocument;
use App\Models\TedTalk;
use App\Models\Topic;
use App\Support\Faq;
use App\Support\PublicSeo;
use App\Support\Release;
use App\Support\Toman;
use App\Support\TopicCard;
use App\Support\TopicCover;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public landing (owner rewrite 2026-11-25).
 *
 * The page sells one monthly subscription. It shows exactly three summary
 * claims (learner count, listening hours, six levels), a small mixed shelf
 * of real podcast and TED content (metadata and covers only), the level
 * table, the benefit list, and the offer. No lesson body, glossary,
 * transcript, audio URL, sample link, or authenticated reader URL travels
 * to this page.
 *
 * Owner-supplied marketing decisions live in config/site.php: the 16,355
 * learner figure and the 990,000 → 641,000 monthly offer. Listening hours
 * and content counts are measured from the database (cached hourly outside
 * tests).
 */
class LandingController extends Controller
{
    public function index(Request $request): Response
    {
        $stats = app()->environment('testing')
            ? $this->contentStats()
            : Cache::remember('landing:content-stats:v3', now()->addHour(), fn (): array => $this->contentStats());

        $learners = max(0, (int) config('site.marketing.learners', 0));

        $compareAt = max(1, (int) config('site.marketing.offer.compare_at_toman', 990000));
        $price = (int) config('site.marketing.offer.price_toman', 641000);
        $price = max(0, min($price, $compareAt));
        $discount = (int) round((1 - ($price / $compareAt)) * 100);

        $offer = [
            'price_label' => Toman::format($price),
            'compare_label' => Toman::format($compareAt),
            'discount_percent' => $discount,
        ];

        // Real content proof: both kinds of library item, metadata only.
        // Newest first, and never behind the paid reader URL.
        $podcasts = Topic::query()
            ->where('topics.status', 'published')
            ->whereHas('lessons', fn ($lessons) => $lessons->where('status', 'published'))
            ->with([
                'category',
                'lessons' => fn ($lessons) => $lessons
                    ->where('status', 'published')
                    ->orderBy('level')
                    ->select(['id', 'topic_id', 'level', 'estimated_minutes']),
            ])
            ->orderByDesc('topics.published_at')
            ->orderByDesc('topics.id')
            ->limit(2)
            ->get()
            ->map(fn (Topic $topic): array => TopicCard::preview($topic))
            ->all();

        $talks = TedTalk::query()
            ->published()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(2)
            ->get(['id', 'title_en', 'speaker', 'area', 'duration_seconds', 'cover_path'])
            ->map(fn (TedTalk $talk): array => [
                'title_en' => (string) $talk->title_en,
                'speaker' => (string) ($talk->speaker ?? ''),
                'area_label' => $talk->areaLabel(),
                'minutes' => $talk->estimatedMinutes(),
                'cover_url' => TopicCover::url($talk->cover_path),
            ])
            ->all();

        $faqs = Faq::landing();

        $seoDescription = 'تنها پادکست استاندارد یادگیری زبان انگلیسی؛ هر پادکست در شش سطح استاندارد A1 تا C2، '
            .'با روش منحصربه‌فرد آموزش واژگان فست انگلیش. اشتراک ماهیانه از '.$offer['price_label'].'.';

        return Inertia::render('Landing/Index', [
            'stats' => [
                'learners' => $learners,
                'listeningHours' => (int) $stats['listeningHours'],
                'levels' => 6,
            ],
            'podcasts' => $podcasts,
            'talks' => $talks,
            'offer' => $offer,
            'faqs' => $faqs,
            'releasePublished' => Release::published(),
            'downloadUrl' => Release::metadata()['file_url'],
            'urls' => [
                'start' => route('login'),
                'login' => route('login'),
                'register' => route('register'),
                'download' => route('download'),
                'install' => route('install'),
                'faq' => route('trust.faq'),
                'support' => route('trust.support'),
            ],
            'seo' => PublicSeo::page(
                'Fast English | تنها پادکست استاندارد یادگیری زبان انگلیسی',
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
                            'description' => 'اپلیکیشن یادگیری زبان انگلیسی با پادکست‌های شش‌سطحی، آموزش واژگان، داستان، آیلتس، Inside Reading و TED Talk.',
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
     * Measured content facts for the three landing claims and the SEO
     * description. Only listening hours are rendered; the remaining counts
     * keep the description honest without adding more visible statistics.
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
            'stories' => (int) (clone $readable)->where('track', 'story')->count(),
            'ielts' => (int) (clone $readable)->where('track', 'ielts')->count(),
            'inside' => (int) (clone $readable)->where('track', 'inside_reading')->count(),
            'placementQuestions' => (int) PlacementQuestion::query()
                ->whereHas('test', fn ($tests) => $tests->where('status', 'published')->where('is_current', true))
                ->count(),
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
}
