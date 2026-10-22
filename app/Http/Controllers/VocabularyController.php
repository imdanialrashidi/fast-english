<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Models\Lesson;
use App\Models\VocabularyWord;
use App\Support\SpacedRepetition;
use App\Support\Vocabulary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * R4 vocabulary notebook (VOCAB-01): save lesson words, review with
 * Again/Hard/Good/Easy, track due/learning/known, remove. Every mutation
 * is owner-scoped server-side (VocabularyWordPolicy); a student can never
 * inspect or modify another student's words.
 *
 * Saving reuses the lesson glossary when a matching entry exists (same
 * meaning/example prefilled); manual notes are the student's own, never
 * presented as authoritative translations.
 */
class VocabularyController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $tab = (string) $request->query('tab', 'all');
        $tab = in_array($tab, ['all', 'due', 'learning', 'known'], true) ? $tab : 'all';
        $query = trim((string) $request->query('q', ''));
        $query = $query !== '' ? mb_substr($query, 0, 120) : null;

        // The props below read only lesson.level + topic.slug off these
        // eagers; the FKs stay so entries still match their parents.
        $words = VocabularyWord::query()
            ->where('user_id', $user->id)
            ->with(['lesson:id,topic_id,level', 'topic:id,slug'])
            ->when($tab === 'due', fn ($q) => $q
                ->where('status', 'learning')
                ->where('due_at', '<=', now()))
            ->when($tab === 'learning', fn ($q) => $q->where('status', 'learning'))
            ->when($tab === 'known', fn ($q) => $q->where('status', 'known'))
            ->when($query !== null, fn ($q) => $q->where('word', 'ilike', '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query).'%'))
            ->orderByRaw("case when status = 'learning' and due_at <= now() then 0 else 1 end")
            ->orderBy('due_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        // One grouped query for all three tab badges: the due badge needs
        // its due_at scope, which a plain status group cannot express, so
        // due stays a conditional sum inside the same row.
        $statusRows = VocabularyWord::where('user_id', $user->id)
            ->groupBy('status')
            ->selectRaw('status, count(*) as total, sum(case when status = ? and due_at <= ? then 1 else 0 end) as due', ['learning', now()])
            ->get();

        $dueCount = 0;
        $learningCount = 0;
        $knownCount = 0;
        foreach ($statusRows as $row) {
            if ($row->status === 'learning') {
                $learningCount = (int) $row->total;
                $dueCount = (int) $row->due;
            } elseif ($row->status === 'known') {
                $knownCount = (int) $row->total;
            }
        }

        // Public-slice Inertia transport (ADR-0002): the same owner-
        // scoped query, tabs, counts, and pagination. Props carry the
        // student's own words only (policy-checked); mutations stay on
        // the existing JSON endpoints with identical shapes.
        return Inertia::render('Words/Index', [
            'words' => $words->getCollection()->map(fn (VocabularyWord $entry) => [
                'id' => $entry->id,
                'word' => (string) $entry->word,
                'meaning_fa' => $entry->meaning_fa,
                'example_en' => $entry->example_en,
                'status' => (string) $entry->status,
                'is_due' => (bool) $entry->is_due,
                'due_at' => $entry->due_at?->toIso8601String(),
                'lesson_level' => $entry->lesson?->level,
                'reader_url' => $entry->lesson !== null && $entry->topic !== null
                    ? route('reader.show', ['topic' => $entry->topic->slug, 'level' => $entry->lesson->level])
                    : null,
            ])->all(),
            'pagination' => [
                'current_page' => $words->currentPage(),
                'last_page' => $words->lastPage(),
                'total' => $words->total(),
                'per_page' => $words->perPage(),
            ],
            'tab' => $tab,
            'activeQuery' => $query,
            'dueCount' => (int) $dueCount,
            'learningCount' => (int) $learningCount,
            'knownCount' => (int) $knownCount,
        ]);
    }

    /**
     * Owner-only CSV export. The file is a private response (global
     * PrivateNoStore), never a public URL or a cacheable asset. Cells
     * that start with a spreadsheet formula marker are prefixed with an
     * apostrophe so an exported word can never execute in Excel/Sheets.
     */
    public function export(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $words = VocabularyWord::query()
            ->where('user_id', $user->id)
            ->with(['lesson:id,topic_id,level', 'topic:id,slug'])
            ->orderBy('word')
            ->lazy(200);

        return response()->streamDownload(function () use ($words): void {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                return;
            }
            // UTF-8 BOM keeps Persian text readable in Excel.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['word', 'meaning_fa', 'example_en', 'status', 'due_at', 'lesson_level', 'topic_slug']);
            foreach ($words as $entry) {
                fputcsv($out, [
                    self::csvCell($entry->word),
                    self::csvCell($entry->meaning_fa),
                    self::csvCell($entry->example_en),
                    self::csvCell($entry->status),
                    $entry->due_at?->toIso8601String() ?? '',
                    self::csvCell($entry->lesson?->level),
                    self::csvCell($entry->topic?->slug),
                ]);
            }
            fclose($out);
        }, 'fast-english-words.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /**
     * Owner-only CSV import. The header must contain `word`; meaning and
     * example are optional. Existing words are updated only with the
     * non-empty note fields in the file; new words start in learning.
     * The whole file is one transaction, so a malformed row cannot leave
     * a half-imported notebook.
     */
    public function import(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:1024'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if ($handle === false) {
            throw ValidationException::withMessages(['file' => 'فایل CSV خوانده نشد.']);
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'فایل CSV خالی است.']);
        }

        $columns = [];
        foreach ($header as $index => $name) {
            $clean = mb_strtolower(trim((string) $name));
            if ($index === 0) {
                $clean = ltrim($clean, "\xEF\xBB\xBF");
            }
            $columns[$clean] = $index;
        }
        if (! array_key_exists('word', $columns)) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'ستون word در سرصفحه CSV لازم است.']);
        }

        $rows = [];
        $skipped = 0;
        while (($row = fgetcsv($handle)) !== false) {
            if (count($rows) >= 500) {
                fclose($handle);
                throw ValidationException::withMessages(['file' => 'حداکثر ۵۰۰ واژه در هر فایل مجاز است.']);
            }

            $word = self::csvValue($row, $columns, 'word');
            if ($word === '') {
                $skipped++;

                continue;
            }
            if (mb_strlen($word) > 120) {
                $skipped++;

                continue;
            }

            $rows[] = [
                'word' => $word,
                'meaning_fa' => mb_substr(self::csvValue($row, $columns, 'meaning_fa'), 0, 500),
                'example_en' => mb_substr(self::csvValue($row, $columns, 'example_en'), 0, 500),
                'lesson_level' => strtoupper(self::csvValue($row, $columns, 'lesson_level')),
                'topic_slug' => self::csvValue($row, $columns, 'topic_slug'),
                'status' => self::csvValue($row, $columns, 'status'),
            ];
        }
        fclose($handle);

        if ($rows === []) {
            throw ValidationException::withMessages(['file' => 'هیچ واژه معتبری در فایل پیدا نشد.']);
        }

        $created = 0;
        $updated = 0;
        DB::transaction(function () use ($user, $rows, &$created, &$updated): void {
            foreach ($rows as $row) {
                $lesson = null;
                if ($row['topic_slug'] !== '' && $row['lesson_level'] !== '') {
                    $lesson = Lesson::query()
                        ->where('status', 'published')
                        ->where('level', $row['lesson_level'])
                        ->whereHas('topic', fn ($topics) => $topics
                            ->where('status', 'published')
                            ->where('slug', $row['topic_slug']))
                        ->first();
                }

                $existing = VocabularyWord::query()
                    ->where('user_id', $user->id)
                    ->where('word_key', Vocabulary::key($row['word']))
                    ->first();

                if ($existing === null) {
                    $entry = Vocabulary::save(
                        $user,
                        $row['word'],
                        $row['meaning_fa'] !== '' ? $row['meaning_fa'] : null,
                        $row['example_en'] !== '' ? $row['example_en'] : null,
                        $lesson,
                        now(),
                    )['entry'];

                    $restore = [];
                    if ($lesson !== null) {
                        $restore['lesson_id'] = $lesson->id;
                        $restore['topic_id'] = $lesson->topic_id;
                    }
                    if (in_array($row['status'], ['learning', 'known'], true)) {
                        $restore['status'] = $row['status'];
                    }
                    if ($restore !== []) {
                        $entry->forceFill($restore)->save();
                    }
                    $created++;

                    continue;
                }

                $updates = Vocabulary::noteUpdates(
                    $existing,
                    $row['meaning_fa'] !== '',
                    $row['meaning_fa'] !== '' ? $row['meaning_fa'] : null,
                    $row['example_en'] !== '',
                    $row['example_en'] !== '' ? $row['example_en'] : null,
                    in_array($row['status'], ['learning', 'known'], true) ? $row['status'] : null,
                    now(),
                );
                if ($lesson !== null) {
                    $updates['lesson_id'] = $lesson->id;
                    $updates['topic_id'] = $lesson->topic_id;
                }
                if ($updates !== []) {
                    $existing->forceFill($updates)->save();
                    $updated++;
                }
            }
        });

        return response()->json([
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
        ])->withHeaders(NoStore::headers());
    }

    /** Owner-only bulk action: every learning word becomes known. */
    public function markAllKnown(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $count = VocabularyWord::query()
            ->where('user_id', $user->id)
            ->where('status', 'learning')
            ->update(['status' => 'known']);

        return response()->json(['known' => $count])->withHeaders(NoStore::headers());
    }

    private static function csvCell(?string $value): string
    {
        $clean = (string) ($value ?? '');

        return preg_match('/^[=+\-@\t\r]/', $clean) === 1 ? "'".$clean : $clean;
    }

    /** @param list<string|null> $row @param array<string, int> $columns */
    private static function csvValue(array $row, array $columns, string $name): string
    {
        $index = $columns[$name] ?? null;
        if ($index === null) {
            return '';
        }
        $value = trim((string) ($row[$index] ?? ''));
        // Undo the export-side formula guard on re-import.
        if (preg_match("/^'[=+\-@\t\r]/", $value) === 1) {
            $value = substr($value, 1);
        }

        return $value;
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $data = $request->validate([
            'word' => ['required', 'string', 'max:120'],
            'meaning_fa' => ['nullable', 'string', 'max:500'],
            'example_en' => ['nullable', 'string', 'max:500'],
            'lesson_id' => ['nullable', 'integer', 'exists:lessons,id'],
        ]);

        $lesson = null;
        if (! empty($data['lesson_id'])) {
            $lesson = Lesson::with('topic')->findOrFail($data['lesson_id']);
            if ($lesson->status !== 'published' || $lesson->topic->status !== 'published') {
                abort(404);
            }
            if (Gate::allows('view', $lesson) !== true) {
                abort(403);
            }
        }

        try {
            $result = Vocabulary::save(
                $user,
                (string) $data['word'],
                isset($data['meaning_fa']) ? (string) $data['meaning_fa'] : null,
                isset($data['example_en']) ? (string) $data['example_en'] : null,
                $lesson,
                now(),
            );
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?? 'خطا.'], 422)
                ->withHeaders(NoStore::headers());
        }

        if (! $result['created']) {
            return response()->json([
                'message' => 'این واژه قبلاً در دفترچه شما ذخیره شده است.',
                'id' => $result['existingId'],
            ], 422)->withHeaders(NoStore::headers());
        }

        $entry = $result['entry'];

        return response()->json([
            'id' => $entry->id,
            'word' => $entry->word,
            'due_at' => $entry->due_at?->toIso8601String(),
        ], 201)->withHeaders(NoStore::headers());
    }

    public function update(Request $request, VocabularyWord $word)
    {
        $user = $request->user();
        if ($user === null || Gate::allows('update', $word) !== true) {
            abort(403);
        }

        $data = $request->validate([
            'meaning_fa' => ['nullable', 'string', 'max:500'],
            'example_en' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:learning,known'],
        ]);

        $updates = Vocabulary::noteUpdates(
            $word,
            array_key_exists('meaning_fa', $data),
            array_key_exists('meaning_fa', $data) ? (string) $data['meaning_fa'] : null,
            array_key_exists('example_en', $data),
            array_key_exists('example_en', $data) ? (string) $data['example_en'] : null,
            ! empty($data['status']) ? (string) $data['status'] : null,
            now(),
        );

        $word->forceFill($updates)->save();

        return response()->json([
            'id' => $word->id,
            'status' => $word->status,
            'meaning_fa' => $word->meaning_fa,
            'example_en' => $word->example_en,
        ])->withHeaders(NoStore::headers());
    }

    public function destroy(Request $request, VocabularyWord $word)
    {
        $user = $request->user();
        if ($user === null || Gate::allows('delete', $word) !== true) {
            abort(403);
        }

        $word->delete();

        return response()->json(['deleted' => true])->withHeaders(NoStore::headers());
    }

    public function review(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $remaining = VocabularyWord::where('user_id', $user->id)
            ->where('status', 'learning')
            ->where('due_at', '<=', now())
            ->count();

        $card = VocabularyWord::where('user_id', $user->id)
            ->where('status', 'learning')
            ->where('due_at', '<=', now())
            ->with(['lesson:id,topic_id,level', 'topic:id,slug'])
            ->orderBy('due_at')
            ->orderBy('id')
            ->first();

        // Public-slice Inertia transport (ADR-0002): the same due-first
        // card selection. Grading stays on the JSON grade endpoint with
        // the deterministic SRS schedule untouched.
        return Inertia::render('Words/Review', [
            'card' => $card ? [
                'id' => $card->id,
                'word' => (string) $card->word,
                'meaning_fa' => $card->meaning_fa,
                'example_en' => $card->example_en,
                'reader_url' => $card->lesson !== null && $card->topic !== null
                    ? route('reader.show', ['topic' => $card->topic->slug, 'level' => $card->lesson->level])
                    : null,
            ] : null,
            'remaining' => (int) $remaining,
            'grades' => SpacedRepetition::GRADES,
        ]);
    }

    public function grade(Request $request, VocabularyWord $word)
    {
        $user = $request->user();
        if ($user === null || Gate::allows('update', $word) !== true) {
            abort(403);
        }

        $data = $request->validate([
            'grade' => ['required', 'in:again,hard,good,easy'],
        ]);

        try {
            $result = Vocabulary::grade($user, $word, $data['grade'], now());
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first() ?? 'خطا.'], 422)
                ->withHeaders(NoStore::headers());
        }

        $entry = $result['entry'];

        return response()->json([
            'id' => $entry->id,
            'due_at' => $entry->due_at?->toIso8601String(),
            'interval_days' => $entry->interval_days,
            'repetitions' => $entry->repetitions,
            'remaining' => $result['remaining'],
        ])->withHeaders(NoStore::headers());
    }
}
