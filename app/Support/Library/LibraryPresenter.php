<?php

namespace App\Support\Library;

use App\Models\FlashcardBook;
use App\Models\LibraryNode;
use App\Models\ReadingProgress;

/**
 * One shape per shelf card. The hub, every browse level and the reader's
 * breadcrumb read the same keys, so a new track does not grow a second
 * presenter. Counts are denormalised in `meta` when the catalog is seeded
 * and refreshed by the importer; the presenter never parses a document to
 * paint a card.
 */
final class LibraryPresenter
{
    private const TRACK_LABELS = [
        'story' => 'استوری‌بوک',
        'ielts' => 'کمبریج آیلتس',
        'inside_reading' => 'اینساید ریدینگ',
    ];

    /**
     * The four shelf items. AEF is still the existing coursebook shelf; its
     * count comes from the coursebook tables, not from library_nodes.
     *
     * @return list<array<string, mixed>>
     */
    public static function shelf(): array
    {
        $aefBooks = FlashcardBook::query()
            ->where('status', 'published')
            ->withCount('units')
            ->get();
        $aefUnits = (int) $aefBooks->sum('units_count');

        $storyBooks = LibraryNode::query()->track('story')->where('kind', 'book')->visible()->get();
        $storyReady = $storyBooks->filter(fn (LibraryNode $node): bool => $node->isReadable())->count();

        $ieltsPassages = LibraryNode::query()->track('ielts')->where('kind', 'passage')->visible()->get();
        $ieltsReady = $ieltsPassages->filter(fn (LibraryNode $node): bool => $node->isReadable())->count();

        $irReadings = LibraryNode::query()->track('inside_reading')->where('kind', 'reading')->visible()->get();
        $irReady = $irReadings->filter(fn (LibraryNode $node): bool => $node->isReadable())->count();

        return [
            [
                'key' => 'aef',
                'title_fa' => 'کتاب',
                'title_en' => 'American English File',
                'subtitle_fa' => 'گرامر و تمرین',
                'description_fa' => 'شش کتاب دوره، از استارتر تا ۵؛ هر یونیت یک درس کوتاه و تمرین‌های همان‌جا.',
                'cover_url' => '/images/books/aef/collection.webp',
                'url' => route('books.aef'),
                'chips' => [$aefBooks->count().' کتاب', $aefUnits.' یونیت', 'A1 تا C1'],
                'ready' => $aefBooks->count(),
                'total' => $aefBooks->count(),
                'status' => 'ready',
            ],
            [
                'key' => 'story',
                'title_fa' => 'استوری‌بوک',
                'title_en' => 'Oxford Bookworms',
                'subtitle_fa' => 'داستان با صدا و تصویر',
                'description_fa' => 'بیست داستان در پنج سطح؛ تصویر، خوانش هم‌زمان، هایلایت جمله و واژه‌های پیش از خواندن.',
                'cover_url' => '/images/books/story/collection.webp',
                'url' => route('library.track', ['track' => 'story']),
                'chips' => [$storyBooks->count().' داستان', 'A2 تا C2', $storyReady.' آماده'],
                'ready' => $storyReady,
                'total' => $storyBooks->count(),
                'status' => $storyReady > 0 ? 'ready' : 'preparing',
            ],
            [
                'key' => 'ielts',
                'title_fa' => 'کمبریج آیلتس',
                'title_en' => 'Cambridge IELTS',
                'subtitle_fa' => 'ریدینگ آکادمیک و جنرال',
                'description_fa' => 'کتاب‌های ۱۹ تا ۲۱؛ تست، پسیج و سوال‌های واقعی با واژه‌های سخت و توضیح پاسخ.',
                'cover_url' => '/images/books/ielts/collection.webp',
                'url' => route('library.track', ['track' => 'ielts']),
                'chips' => ['۳ کتاب', $ieltsPassages->count().' پسیج', $ieltsReady.' آماده'],
                'ready' => $ieltsReady,
                'total' => $ieltsPassages->count(),
                'status' => $ieltsReady > 0 ? 'ready' : 'preparing',
            ],
            [
                'key' => 'inside_reading',
                'title_fa' => 'اینساید ریدینگ',
                'title_en' => 'Inside Reading',
                'subtitle_fa' => 'خواندن با صدای اصلی',
                'description_fa' => 'پنج سطح از Intro تا ۴؛ واژه‌های سخت هر پاراگراف، صدای اصلی کتاب و هایلایت جمله.',
                'cover_url' => '/images/books/inside-reading/collection.webp',
                'url' => route('library.track', ['track' => 'inside-reading']),
                'chips' => ['۵ سطح', $irReadings->count().' ریدینگ', $irReady.' آماده'],
                'ready' => $irReady,
                'total' => $irReadings->count(),
                'status' => $irReady > 0 ? 'ready' : 'preparing',
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function card(LibraryNode $node, ?ReadingProgress $progress = null): array
    {
        $children = isset($node->children_count) ? (int) $node->children_count : 0;
        $readable = $node->isReadable();
        $ready = $readable || $children > 0;

        return [
            'id' => $node->id,
            'track' => $node->track,
            'kind' => $node->kind,
            'title_en' => $node->title_en,
            'title_fa' => $node->title_fa,
            'subtitle_fa' => $node->subtitle_fa,
            'level' => $node->level,
            'cover_url' => $node->cover_path,
            'url' => $node->url(),
            'readable' => $readable,
            'status' => $ready ? 'ready' : 'preparing',
            'chips' => self::chips($node, $children),
            'progress' => $progress === null ? null : [
                'page_key' => $progress->page_key,
                'position_ms' => $progress->position_ms,
                'completed' => $progress->completed_at !== null,
            ],
        ];
    }

    /** @return list<string> */
    private static function chips(LibraryNode $node, int $children): array
    {
        $meta = is_array($node->meta) ? $node->meta : [];
        $chips = [];

        if ($node->level !== null) {
            $chips[] = $node->level;
        }

        if ($node->kind === 'level') {
            if (isset($meta['stage'])) {
                array_unshift($chips, (string) $meta['stage']);
            }
            if ($children > 0) {
                $chips[] = $children.' کتاب';
            }
        }

        if ($node->kind === 'book') {
            if (isset($meta['pages']) && (int) $meta['pages'] > 0) {
                $chips[] = (int) $meta['pages'].' قاب';
                if (isset($meta['minutes']) && (int) $meta['minutes'] > 0) {
                    $chips[] = (int) $meta['minutes'].' دقیقه';
                }
            } else {
                if (isset($meta['author'])) {
                    $chips[] = (string) $meta['author'];
                }
                if (isset($meta['pdf_pages'])) {
                    $chips[] = (int) $meta['pdf_pages'].' صفحه';
                }
            }
        }

        if ($node->kind === 'variant' && isset($meta['year'])) {
            $chips[] = (string) $meta['year'];
        }

        if ($node->kind === 'test') {
            $chips[] = $children.' پسیج';
        }

        if ($node->kind === 'passage') {
            $chips[] = isset($meta['question_count']) ? (int) $meta['question_count'].' سوال' : 'در حال آماده‌سازی';
        }

        if ($node->kind === 'unit') {
            $chips[] = $children.' ریدینگ';
        }

        if ($node->kind === 'reading') {
            $chips[] = isset($meta['gloss']) ? (string) $meta['gloss'] : 'واژه‌نامه';
        }

        return array_values(array_unique($chips));
    }

    /** @return list<array{title: string, url: string|null}> */
    public static function breadcrumbs(LibraryNode $node): array
    {
        $crumbs = [];

        foreach ([...$node->ancestors(), $node] as $item) {
            $crumbs[] = [
                'title' => (string) ($item->title_fa ?: $item->title_en ?: $item->slug),
                'url' => $item->is($node) ? null : $item->url(),
            ];
        }

        return $crumbs;
    }

    public static function trackLabel(string $track): string
    {
        return self::TRACK_LABELS[$track] ?? $track;
    }

    /**
     * The tabs above every books screen. They are links, not client state,
     * so back/refresh and a shared URL land on the same shelf.
     *
     * @return list<array{key: string, label: string, url: string, active: bool}>
     */
    public static function tabs(string $active): array
    {
        return [
            ['key' => 'all', 'label' => 'همه', 'url' => route('books.index'), 'active' => $active === 'all'],
            ['key' => 'aef', 'label' => 'کتاب', 'url' => route('books.aef'), 'active' => $active === 'aef'],
            ['key' => 'story', 'label' => 'استوری‌بوک', 'url' => route('library.track', ['track' => 'story']), 'active' => $active === 'story'],
            ['key' => 'ielts', 'label' => 'آیلتس', 'url' => route('library.track', ['track' => 'ielts']), 'active' => $active === 'ielts'],
            ['key' => 'inside_reading', 'label' => 'اینساید ریدینگ', 'url' => route('library.track', ['track' => 'inside-reading']), 'active' => $active === 'inside_reading'],
        ];
    }
}
