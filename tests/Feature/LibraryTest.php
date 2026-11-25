<?php

use App\Models\LibraryNode;
use App\Models\ReadingDocument;
use Database\Seeders\LibraryCatalogSeeder;
use Illuminate\Support\Facades\File;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ContentFixtures;

// The reading shelf and its three tracks (owner decisions 2026-11-21): the
// hierarchy is data, a leaf is readable only with a published document, and
// the IELTS key never reaches the page before a submission.

function libraryDocument(array $document, LibraryNode $node, array $overrides = []): ReadingDocument
{
    return ReadingDocument::query()->create($overrides + [
        'node_id' => $node->id,
        'schema_version' => '1.0',
        'revision' => 1,
        'document' => $document,
        'checksum' => hash('sha256', (string) json_encode($document)),
        'page_count' => 1,
        'question_count' => 0,
        'word_count' => 10,
        'duration_ms' => null,
        'published_at' => now(),
    ]);
}

function libraryNode(string $track, string $slug, string $kind = 'book', array $overrides = []): LibraryNode
{
    $root = LibraryNode::query()->firstOrCreate(
        ['track' => $track, 'slug' => $track],
        ['kind' => 'series', 'title_en' => $track, 'title_fa' => $track, 'status' => 'published', 'sort_order' => 1],
    );

    return LibraryNode::query()->create($overrides + [
        'parent_id' => $root->id,
        'track' => $track,
        'kind' => $kind,
        'slug' => $slug,
        'title_en' => $slug,
        'title_fa' => $slug,
        'level' => 'A2',
        'status' => 'published',
        'sort_order' => 1,
    ]);
}

test('the reading shelf is visible to learners while the reader stays paid-only', function () {
    $this->get(route('books.index'))->assertRedirect();

    $this->actingAs(ContentFixtures::student())
        ->get(route('books.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Books/Index'));

    $this->actingAs(ContentFixtures::subscribedStudent())
        ->get(route('books.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Books/Index')
            ->has('collections', 4)
            ->where('collections.0.key', 'aef')
            ->where('collections.1.key', 'story')
            ->where('collections.2.key', 'ielts')
            ->where('collections.3.key', 'inside_reading')
            ->has('tabs', 5));
});

test('the story catalog drills from levels to books without inventing content', function () {
    $this->seed(LibraryCatalogSeeder::class);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('library.track', ['track' => 'story']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Library/Browse')
            ->where('track', 'story')
            ->has('children', 5)
            ->where('children.0.kind', 'level'));

    $this->actingAs($student)
        ->get('/app/books/story/a2')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('children', 4)
            ->where('children.3.title_en', 'Police TV'));

    $this->actingAs($student)
        ->get('/app/books/story/a2/police-tv')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Library/Browse')
            ->has('children', 0)
            ->where('node.status', 'preparing'));
});

test('a story leaf with a published document renders its pages and saves progress', function () {
    $this->seed(LibraryCatalogSeeder::class);
    $node = LibraryNode::query()->where('slug', 'story/a2/police-tv')->firstOrFail();

    libraryDocument([
        'schema_version' => '1.0',
        'meta' => ['kind' => 'story', 'level_cefr' => 'A2'],
        'chapters' => [[
            'id' => 'ch1',
            'title_en' => 'Chapter 1',
            'audio' => null,
            'pages' => [[
                'id' => 'p1',
                'number' => 1,
                'text_en' => 'Dan is angry. He is a police officer.',
                'panel_index' => null,
                'image' => null,
                'alt_fa' => null,
                'audio' => null,
                'words' => [
                    ['word' => 'angry', 'meaning_fa' => 'عصبانی', 'start_utf16' => 7, 'end_utf16' => 12],
                ],
                'sentences' => [
                    ['start_utf16' => 0, 'end_utf16' => 14, 'start_ms' => null, 'end_ms' => null, 'text_fa' => null],
                ],
            ]],
        ]],
    ], $node);
    $node->update(['status' => 'published']);

    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get('/app/books/story/a2/police-tv')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Library/Reader')
            ->where('node.track', 'story')
            ->has('chapters', 1)
            ->where('chapters.0.pages.0.words.0.meaning_fa', 'عصبانی')
            ->has('questions', 0));

    $this->actingAs($student)
        ->postJson(route('library.progress', ['node' => $node->id]), [
            'page_key' => 'p1',
            'position_ms' => 1200,
        ])
        ->assertNoContent();

    $this->assertDatabaseHas('reading_progress', [
        'user_id' => $student->id,
        'node_id' => $node->id,
        'page_key' => 'p1',
        'position_ms' => 1200,
    ]);
});

test('an IELTS passage hides the key until submission and then explains the evidence', function () {
    $this->seed(LibraryCatalogSeeder::class);
    $node = LibraryNode::query()->where('slug', 'ielts/19/academic/test-1/passage-1')->firstOrFail();

    libraryDocument([
        'schema_version' => '1.0',
        'meta' => ['kind' => 'ielts'],
        'passage' => [
            'title_en' => 'A short passage',
            'paragraphs' => [[
                'id' => 'A',
                'label' => 'A',
                'text_en' => 'Cities plant trees. A mature tree cools the air.',
                'words' => [
                    ['word' => 'mature', 'definition_en' => 'fully grown', 'start_utf16' => 22, 'end_utf16' => 28],
                ],
                'sentences' => [
                    ['start_utf16' => 0, 'end_utf16' => 18, 'start_ms' => null, 'end_ms' => null, 'text_fa' => 'شهرها درخت می‌کارند.'],
                ],
            ]],
        ],
        'questions' => [[
            'id' => 'q1',
            'number' => 1,
            'type' => 'tfng',
            'prompt' => 'A mature tree cools the air.',
            'options' => [],
            'answer' => 'TRUE',
            'accepted' => ['TRUE'],
            'explanation_fa' => 'پاراگراف A همین را می‌گوید.',
            'evidence' => ['page_key' => 'A', 'start_utf16' => 20, 'end_utf16' => 48],
        ]],
    ], $node);
    $node->update(['status' => 'published']);

    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get('/app/books/ielts/19/academic/test-1/passage-1')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Library/Reader')
            ->where('node.track', 'ielts')
            ->has('questions', 1)
            ->where('questions.0.prompt', 'A mature tree cools the air.')
            ->missing('questions.0.answer')
            ->missing('questions.0.explanation_fa')
            ->missing('questions.0.evidence'));

    $response = $this->actingAs($student)
        ->postJson(route('library.attempts', ['node' => $node->id]), [
            'answers' => ['q1' => 'TRUE'],
        ])
        ->assertOk()
        ->assertJsonPath('score', 1)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('items.0.is_correct', true)
        ->assertJsonPath('items.0.explanation_fa', 'پاراگراف A همین را می‌گوید.')
        ->assertJsonPath('items.0.evidence.page_key', 'A');

    expect($response->json('items.0.correct'))->toBe('TRUE');

    $this->assertDatabaseHas('reading_attempts', [
        'user_id' => $student->id,
        'node_id' => $node->id,
        'score' => 1,
        'total' => 1,
    ]);
});

test('private library media is only served for a readable node', function () {
    $node = libraryNode('story', 'story/demo', 'book', ['status' => 'published']);

    $this->actingAs(ContentFixtures::subscribedStudent())
        ->get(route('library.audio', ['node' => $node->id, 'file' => 'missing.mp3']))
        ->assertNotFound();
});

test('the importer validates a pack and publishes a versioned document', function () {
    $node = libraryNode('story', 'story/import-demo', 'book');
    $directory = sys_get_temp_dir().'/fe-library-pack-'.uniqid();
    mkdir($directory);

    $pack = [
        'schema_version' => '1.0',
        'track' => 'story',
        'node' => [
            'slug' => 'story/import-demo',
            'title_en' => 'Import demo',
            'title_fa' => 'نمونهٔ ورود',
            'level' => 'A2',
        ],
        'document' => [
            'schema_version' => '1.0',
            'meta' => ['kind' => 'story', 'level_cefr' => 'A2'],
            'chapters' => [[
                'id' => 'ch1',
                'title_en' => 'Chapter 1',
                'audio' => null,
                'pages' => [[
                    'id' => 'p1',
                    'number' => 1,
                    'text_en' => 'A short page.',
                    'words' => [['word' => 'short', 'meaning_fa' => 'کوتاه', 'start_utf16' => 2, 'end_utf16' => 7]],
                    'sentences' => [['start_utf16' => 0, 'end_utf16' => 13, 'start_ms' => null, 'end_ms' => null]],
                ]],
            ]],
        ],
    ];
    file_put_contents($directory.'/pack.json', json_encode($pack, JSON_UNESCAPED_UNICODE));

    $this->artisan('library:import', ['path' => $directory, '--publish' => true])->assertExitCode(0);

    $this->assertDatabaseHas('reading_documents', [
        'node_id' => $node->id,
        'revision' => 1,
        'page_count' => 1,
        'published_at' => now(),
    ]);
    expect($node->fresh()->status)->toBe('published');

    unlink($directory.'/pack.json');
    rmdir($directory);
});

test('re-running the catalog never unpublishes an imported book', function () {
    $this->seed(LibraryCatalogSeeder::class);
    $node = LibraryNode::query()->where('slug', 'story/a2/police-tv')->firstOrFail();
    $directory = sys_get_temp_dir().'/fe-library-catalog-'.uniqid();
    mkdir($directory);

    $pack = [
        'schema_version' => '1.0',
        'track' => 'story',
        'node' => [
            'slug' => 'story/a2/police-tv',
            'title_en' => 'Owner title',
            'title_fa' => 'عنوان کارفرما',
            'level' => 'A2',
        ],
        'document' => [
            'schema_version' => '1.0',
            'meta' => ['kind' => 'story'],
            'chapters' => [[
                'id' => 'ch1',
                'pages' => [[
                    'id' => 'p1',
                    'text_en' => 'One page.',
                    'words' => [],
                    'sentences' => [],
                ]],
            ]],
        ],
    ];
    file_put_contents($directory.'/pack.json', json_encode($pack, JSON_UNESCAPED_UNICODE));

    $this->artisan('library:import', ['path' => $directory, '--publish' => true])->assertExitCode(0);
    $this->seed(LibraryCatalogSeeder::class);

    $node->refresh();
    expect($node->status)->toBe('published')
        ->and($node->title_en)->toBe('Owner title')
        ->and($node->document?->published_at)->not->toBeNull();

    unlink($directory.'/pack.json');
    rmdir($directory);
});

test('a late sheet lights up its mapped frames without touching the revision', function () {
    $node = libraryNode('story', 'story/sheet-demo', 'book');
    $document = libraryDocument([
        'schema_version' => '1.0',
        'meta' => [
            'kind' => 'story',
            'panel_map' => [['frame_id' => 'f1', 'panel_index' => 3, 'alt_fa' => 'تصویر سوم']],
        ],
        'chapters' => [[
            'id' => 'ch1',
            'pages' => [[
                'id' => 'f1',
                'text_en' => 'One page.',
                'words' => [],
                'sentences' => [],
            ]],
        ]],
    ], $node);

    $path = tempnam(sys_get_temp_dir(), 'fe-sheet-').'.png';
    file_put_contents($path, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='));

    $this->artisan('library:sheet', ['book' => 'story/sheet-demo', 'file' => $path])->assertExitCode(0);

    $document->refresh();
    expect($document->revision)->toBe(1)
        ->and($document->document['meta']['sheet']['file'])->toBe('sheet.png')
        ->and($document->document['chapters'][0]['pages'][0]['panel_index'])->toBe(3)
        ->and($document->document['chapters'][0]['pages'][0]['alt_fa'])->toBe('تصویر سوم');

    unlink($path);
    File::deleteDirectory(storage_path('app/private/library/story/sheet-demo'));
});
