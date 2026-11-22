<?php

namespace Database\Seeders;

use App\Models\LibraryNode;
use Illuminate\Database\Seeder;

/**
 * The browsing skeleton for the three reading tracks. This seeder carries
 * titles, levels, order and cover paths only — never book text. A readable
 * leaf stays `preparing` until `library:import` attaches a published,
 * versioned document, so an empty shelf can never pretend to be a book.
 */
class LibraryCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $this->story();
        $this->ielts();
        $this->insideReading();
    }

    private function fa(int $number): string
    {
        return str_replace(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'], (string) $number);
    }

    private function node(string $track, string $slug, string $kind, array $attributes): LibraryNode
    {
        $existing = LibraryNode::query()->where('track', $track)->where('slug', $slug)->first();

        if ($existing === null) {
            return LibraryNode::query()->create(
                $attributes + ['track' => $track, 'slug' => $slug, 'kind' => $kind],
            );
        }

        // A node that already owns a document is content, not a skeleton
        // row: the catalog may move it or change its level, but it must not
        // reset the imported title, cover, status or counts.
        if ($existing->document()->exists()) {
            $attributes = array_intersect_key($attributes, array_flip(['parent_id', 'level', 'sort_order']));
        }

        $existing->fill($attributes)->save();

        return $existing;
    }

    private function story(): void
    {
        $root = $this->node('story', 'story', 'series', [
            'title_en' => 'Story Books',
            'title_fa' => 'استوری‌بوک',
            'subtitle_fa' => 'Oxford Bookworms Library',
            'cover_path' => '/images/books/story/collection.webp',
            'sort_order' => 1,
            'status' => 'published',
            'meta' => ['series' => 'Oxford Bookworms Library'],
        ]);

        $levels = [
            ['a2', 'Starter', 'A2', ['A2', 'B1'], 1, [
                ['a-pretty-face', 'A Pretty Face', 'چهرهٔ زیبا', 'John Escott', 25],
                ['drive-into-danger', 'Drive into Danger', 'رانندگی به‌سوی خطر', 'Rosemary Border', 16],
                ['girl-on-a-motorcycle', 'Girl on a Motorcycle', 'دختری روی موتورسیکلت', 'John Escott', 18],
                ['police-tv', 'Police TV', 'پلیس تلویزیون', 'Tim Vicary', 27],
            ]],
            ['b1', 'Stage 1', 'B1', ['B1', 'B2'], 2, [
                ['a-ghost-in-love', 'A Ghost in Love', 'روحی عاشق', 'Michael Dean', 34],
                ['goodbye-mr-hollywood', 'Goodbye Mr Hollywood', 'خداحافظ آقای هالیوود', 'John Escott', 33],
                ['london', 'London', 'لندن', 'John Escott', 26],
                ['love-or-money', 'Love or Money', 'عشق یا پول', 'Rowena Akinyemi', 33],
            ]],
            ['b2', 'Stage 2', 'B2', ['B2', 'C1'], 3, [
                ['alices-adventures-in-wonderland', "Alice's Adventures in Wonderland", 'آلیس در سرزمین عجایب', 'Lewis Carroll', 31],
                ['anne-of-green-gables', 'Anne of Green Gables', 'آنی شرلی', 'L. M. Montgomery', 62],
                ['cries-from-the-heart', 'Cries from the Heart', 'فریادهایی از دل', 'Jennifer Bassett', 32],
                ['henry-viii-and-his-six-wives', 'Henry VIII and His Six Wives', 'هنری هشتم و شش همسرش', 'Janet Hardy-Gould', 32],
            ]],
            ['c1', 'Stage 3', 'C1', ['C1', 'C2'], 4, [
                ['ethan-frome', 'Ethan Frome', 'ایتن فروم', 'Edith Wharton', 43],
                ['goldfish', 'Goldfish', 'ماهی قرمز', 'Raymond Chandler', 37],
                ['a-christmas-carol', 'A Christmas Carol', 'سرود کریسمس', 'Charles Dickens', 40],
                ['as-the-inspector-said', 'As the Inspector Said', 'همان‌طور که بازرس گفت', 'John Escott', 42],
            ]],
            ['c2', 'Stage 4', 'C2', ['C1', 'C2'], 5, [
                ['lorna-doone', 'Lorna Doone', 'لورنا دون', 'R. D. Blackmore', 18],
                ['a-tale-of-two-cities', 'A Tale of Two Cities', 'داستان دو شهر', 'Charles Dickens', 48],
                ['disasters', 'Disasters', 'فاجعه‌ها', 'Mary McIntosh', 48],
                ['the-african-queen', 'The African Queen', 'ملکهٔ آفریقا', 'C. S. Forester', 45],
            ]],
        ];

        foreach ($levels as [$slug, $stage, $cefr, $band, $order, $books]) {
            $level = $this->node('story', 'story/'.$slug, 'level', [
                'parent_id' => $root->id,
                'title_en' => $stage,
                'title_fa' => $stage,
                'subtitle_fa' => 'سطح '.$cefr,
                'level' => $cefr,
                'sort_order' => $order,
                'status' => 'published',
                'meta' => ['stage' => $stage, 'cefr' => $cefr, 'band' => $band, 'book_count' => count($books)],
            ]);

            foreach ($books as $index => [$bookSlug, $titleEn, $titleFa, $author, $pages]) {
                $this->node('story', 'story/'.$slug.'/'.$bookSlug, 'book', [
                    'parent_id' => $level->id,
                    'title_en' => $titleEn,
                    'title_fa' => $titleFa,
                    'subtitle_fa' => $author,
                    'level' => $cefr,
                    'cover_path' => '/images/books/story/'.$bookSlug.'.webp',
                    'sort_order' => $index + 1,
                    'status' => 'preparing',
                    'meta' => [
                        'stage' => $stage,
                        'cefr' => $cefr,
                        'band' => $band,
                        'author' => $author,
                        'pdf_pages' => $pages,
                    ],
                ]);
            }
        }
    }

    private function ielts(): void
    {
        $root = $this->node('ielts', 'ielts', 'series', [
            'title_en' => 'Cambridge IELTS',
            'title_fa' => 'کمبریج آیلتس',
            'subtitle_fa' => '19 تا 21 · ریدینگ',
            'cover_path' => '/images/books/ielts/collection.webp',
            'sort_order' => 3,
            'status' => 'published',
        ]);

        $books = [
            ['19', 'Cambridge IELTS 19', ['academic' => 'Academic', 'general' => 'General Training']],
            ['20', 'Cambridge IELTS 20', ['academic' => 'Academic']],
            ['21', 'Cambridge IELTS 21', ['academic' => 'Academic']],
        ];

        foreach ($books as $bookIndex => [$year, $title, $variants]) {
            $faYear = str_replace(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'], $year);
            $book = $this->node('ielts', 'ielts/'.$year, 'book', [
                'parent_id' => $root->id,
                'title_en' => $title,
                'title_fa' => 'کمبریج آیلتس '.$faYear,
                'level' => 'B2-C2',
                'cover_path' => '/images/books/ielts/'.$year.'.webp',
                'sort_order' => $bookIndex + 1,
                'status' => 'published',
                'meta' => ['year' => (int) $year, 'variants' => array_keys($variants)],
            ]);

            foreach ($variants as $variantSlug => $variantTitle) {
                $variant = $this->node('ielts', 'ielts/'.$year.'/'.$variantSlug, 'variant', [
                    'parent_id' => $book->id,
                    'title_en' => $variantTitle,
                    'title_fa' => $variantSlug === 'general' ? 'جنرال' : 'آکادمیک',
                    'subtitle_fa' => 'ریدینگ',
                    'level' => 'B2-C2',
                    'cover_path' => '/images/books/ielts/'.$year.'-'.$variantSlug.'.webp',
                    'sort_order' => $variantSlug === 'academic' ? 1 : 2,
                    'status' => 'published',
                    'meta' => ['year' => (int) $year, 'variant' => $variantSlug],
                ]);

                $sectionWord = $variantSlug === 'general' ? 'section' : 'passage';

                foreach (range(1, 4) as $testNumber) {
                    $testSlug = 'ielts/'.$year.'/'.$variantSlug.'/test-'.$testNumber;
                    $test = $this->node('ielts', $testSlug, 'test', [
                        'parent_id' => $variant->id,
                        'title_en' => 'Test '.$testNumber,
                        'title_fa' => 'تست '.$this->fa($testNumber),
                        'level' => 'B2-C2',
                        'sort_order' => $testNumber,
                        'status' => 'published',
                        'meta' => ['test' => $testNumber, 'sections' => 3],
                    ]);

                    foreach (range(1, 3) as $passageNumber) {
                        $this->node('ielts', $testSlug.'/'.$sectionWord.'-'.$passageNumber, 'passage', [
                            'parent_id' => $test->id,
                            'title_en' => ($variantSlug === 'general' ? 'Section ' : 'Passage ').$passageNumber,
                            'title_fa' => ($variantSlug === 'general' ? 'بخش ' : 'پسیج ').$this->fa($passageNumber),
                            'level' => 'B2-C2',
                            'sort_order' => $passageNumber,
                            'status' => 'preparing',
                            'meta' => ['test' => $testNumber, 'passage' => $passageNumber, 'variant' => $variantSlug],
                        ]);
                    }
                }
            }
        }
    }

    private function insideReading(): void
    {
        $root = $this->node('inside_reading', 'inside-reading', 'series', [
            'title_en' => 'Inside Reading',
            'title_fa' => 'اینساید ریدینگ',
            'subtitle_fa' => 'Intro تا Level 4',
            'cover_path' => '/images/books/inside-reading/collection.webp',
            'sort_order' => 4,
            'status' => 'published',
        ]);

        $levels = [
            ['intro', 'Intro', 'B1', ['B1', 'B2'], 'معنی فارسی'],
            ['1', 'Level 1', 'B1', ['B1', 'B2'], 'معنی فارسی'],
            ['2', 'Level 2', 'B2', ['B2', 'C1'], 'تعریف سادهٔ انگلیسی'],
            ['3', 'Level 3', 'B2', ['B2', 'C1'], 'تعریف سادهٔ انگلیسی'],
            ['4', 'Level 4', 'B2', ['B2', 'C1'], 'تعریف سادهٔ انگلیسی'],
        ];

        foreach ($levels as $index => [$slug, $title, $cefr, $band, $gloss]) {
            $level = $this->node('inside_reading', 'inside-reading/'.$slug, 'level', [
                'parent_id' => $root->id,
                'title_en' => $title,
                'title_fa' => $title === 'Intro' ? 'مقدماتی' : 'سطح '.$this->fa((int) $slug),
                'subtitle_fa' => $gloss,
                'level' => $cefr,
                'sort_order' => $index + 1,
                'status' => 'published',
                'meta' => ['cefr' => $cefr, 'band' => $band, 'gloss' => $gloss, 'units' => 10],
            ]);

            foreach (range(1, 10) as $unitNumber) {
                $unitSlug = 'inside-reading/'.$slug.'/unit-'.$unitNumber;
                $unit = $this->node('inside_reading', $unitSlug, 'unit', [
                    'parent_id' => $level->id,
                    'title_en' => 'Unit '.$unitNumber,
                    'title_fa' => 'یونیت '.$this->fa($unitNumber),
                    'level' => $cefr,
                    'sort_order' => $unitNumber,
                    'status' => 'preparing',
                    'meta' => ['unit' => $unitNumber],
                ]);

                foreach (range(1, 2) as $readingNumber) {
                    $this->node('inside_reading', $unitSlug.'/reading-'.$readingNumber, 'reading', [
                        'parent_id' => $unit->id,
                        'title_en' => 'Reading '.$readingNumber,
                        'title_fa' => 'ریدینگ '.$this->fa($readingNumber),
                        'level' => $cefr,
                        'sort_order' => $readingNumber,
                        'status' => 'preparing',
                        'meta' => ['reading' => $readingNumber],
                    ]);
                }
            }
        }
    }
}
