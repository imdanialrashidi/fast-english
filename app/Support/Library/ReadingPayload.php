<?php

namespace App\Support\Library;

use App\Models\LibraryNode;
use App\Models\ReadingAttempt;
use App\Models\ReadingDocument;
use App\Models\ReadingProgress;

/**
 * Turns one stored document into the reader payload. Asset paths are
 * relative in the document and become authenticated URLs here; IELTS
 * answer keys and evidence never leave the server before a submission.
 */
final class ReadingPayload
{
    /** @return array<string, mixed> */
    public static function forNode(
        LibraryNode $node,
        ReadingDocument $document,
        ?ReadingProgress $progress,
        ?ReadingAttempt $attempt,
    ): array {
        $doc = is_array($document->document) ? $document->document : [];
        $meta = is_array($doc['meta'] ?? null) ? $doc['meta'] : [];

        $base = [
            'node' => [
                'id' => $node->id,
                'track' => $node->track,
                'kind' => $node->kind,
                'title_en' => $node->title_en,
                'title_fa' => $node->title_fa,
                'level' => $node->level,
                'cover_url' => $node->cover_path,
            ],
            'breadcrumbs' => LibraryPresenter::breadcrumbs($node),
            'revision' => $document->revision,
            'meta' => $meta,
            'endpoints' => [
                'progress' => route('library.progress', ['node' => $node->id]),
                'attempts' => $node->track === 'ielts' ? route('library.attempts', ['node' => $node->id]) : null,
            ],
            'progress' => $progress === null ? null : [
                'page_key' => $progress->page_key,
                'position_ms' => $progress->position_ms,
                'completed' => $progress->completed_at !== null,
                'same_revision' => $progress->revision === $document->revision,
            ],
        ];

        if ($node->track === 'ielts') {
            $passage = is_array($doc['passage'] ?? null) ? $doc['passage'] : [];
            $paragraphs = is_array($passage['paragraphs'] ?? null) ? $passage['paragraphs'] : [];
            $questions = is_array($doc['questions'] ?? null) ? $doc['questions'] : [];

            return $base + [
                'credit' => $meta['credit'] ?? null,
                'passage' => [
                    'title_en' => $passage['title_en'] ?? $node->title_en,
                    'subtitle_fa' => $passage['subtitle_fa'] ?? null,
                    'paragraphs' => array_map(fn (array $paragraph): array => self::paragraph($node, $document, $paragraph), $paragraphs),
                ],
                'questions' => array_map([self::class, 'publicQuestion'], $questions),
                'attempt' => $attempt === null ? null : ReadingGrader::publicResult($doc, $attempt->answers),
            ];
        }

        $chapters = is_array($doc['chapters'] ?? null) ? $doc['chapters'] : [];
        $sheet = is_array($meta['sheet'] ?? null) ? $meta['sheet'] : null;

        return $base + [
            'art' => $sheet === null ? null : [
                'url' => self::imageUrl($node, $document, (string) ($sheet['file'] ?? '')),
                'columns' => (int) ($sheet['columns'] ?? 2),
                'rows' => (int) ($sheet['rows'] ?? 3),
                'alt_fa' => $sheet['alt_fa'] ?? null,
            ],
            'chapters' => array_map(
                fn (array $chapter): array => self::chapter($node, $document, $chapter),
                $chapters,
            ),
        ];
    }

    /** @return array<string, mixed> */
    private static function chapter(LibraryNode $node, ReadingDocument $document, array $chapter): array
    {
        $pages = is_array($chapter['pages'] ?? null) ? $chapter['pages'] : [];

        return [
            'id' => (string) ($chapter['id'] ?? ''),
            'title_en' => $chapter['title_en'] ?? null,
            'title_fa' => $chapter['title_fa'] ?? null,
            'audio_url' => self::audioUrl($node, $document, $chapter['audio']['file'] ?? null),
            'duration_ms' => isset($chapter['audio']['duration_ms']) ? (int) $chapter['audio']['duration_ms'] : null,
            'pages' => array_map(fn (array $page): array => self::page($node, $document, $page), $pages),
        ];
    }

    /** @return array<string, mixed> */
    private static function page(LibraryNode $node, ReadingDocument $document, array $page): array
    {
        $words = is_array($page['words'] ?? null) ? $page['words'] : [];
        $sentences = is_array($page['sentences'] ?? null) ? $page['sentences'] : [];

        return [
            'id' => (string) ($page['id'] ?? ''),
            'number' => isset($page['number']) ? (int) $page['number'] : null,
            'label' => $page['label'] ?? null,
            'text_en' => (string) ($page['text_en'] ?? ''),
            'text_fa' => $page['text_fa'] ?? null,
            'panel_index' => isset($page['panel_index']) ? (int) $page['panel_index'] : null,
            'image_url' => self::imageUrl($node, $document, $page['image']['file'] ?? null),
            'alt_fa' => $page['alt_fa'] ?? null,
            'audio_url' => self::audioUrl($node, $document, $page['audio']['file'] ?? null),
            'audio_start_ms' => isset($page['audio']['start_ms']) ? (int) $page['audio']['start_ms'] : null,
            'audio_end_ms' => isset($page['audio']['end_ms']) ? (int) $page['audio']['end_ms'] : null,
            'sync_confidence' => isset($page['sync_confidence']) ? (float) $page['sync_confidence'] : null,
            'words' => array_map(fn (array $word): array => [
                'word' => (string) ($word['word'] ?? ''),
                'meaning_fa' => $word['meaning_fa'] ?? null,
                'definition_en' => $word['definition_en'] ?? null,
                'part_of_speech' => $word['part_of_speech'] ?? null,
                'start_utf16' => isset($word['start_utf16']) ? (int) $word['start_utf16'] : null,
                'end_utf16' => isset($word['end_utf16']) ? (int) $word['end_utf16'] : null,
                'audio_url' => self::audioUrl($node, $document, $word['audio']['file'] ?? null),
            ], $words),
            'sentences' => array_map(fn (array $sentence): array => [
                'start_utf16' => (int) ($sentence['start_utf16'] ?? 0),
                'end_utf16' => (int) ($sentence['end_utf16'] ?? 0),
                'start_ms' => isset($sentence['start_ms']) ? (int) $sentence['start_ms'] : null,
                'end_ms' => isset($sentence['end_ms']) ? (int) $sentence['end_ms'] : null,
                'text_fa' => $sentence['text_fa'] ?? null,
            ], $sentences),
        ];
    }

    /** @return array<string, mixed> */
    private static function paragraph(LibraryNode $node, ReadingDocument $document, array $paragraph): array
    {
        $page = self::page($node, $document, $paragraph);
        $page['label'] = $paragraph['label'] ?? $page['label'];

        return $page;
    }

    /** @param  array<string, mixed>  $question */
    public static function publicQuestion(array $question): array
    {
        return [
            'id' => (string) ($question['id'] ?? ''),
            'number' => isset($question['number']) ? (int) $question['number'] : null,
            'number_end' => isset($question['number_end']) ? (int) $question['number_end'] : null,
            'weight' => max(1, (int) ($question['weight'] ?? 1)),
            'type' => (string) ($question['type'] ?? 'choice'),
            'instructions_fa' => $question['instructions_fa'] ?? null,
            'prompt' => (string) ($question['prompt'] ?? ''),
            'options' => is_array($question['options'] ?? null) ? array_values($question['options']) : [],
            'word_limit' => isset($question['word_limit']) ? (int) $question['word_limit'] : null,
            'max_answers' => isset($question['max_answers']) ? (int) $question['max_answers'] : null,
        ];
    }

    private static function audioUrl(LibraryNode $node, ReadingDocument $document, ?string $file): ?string
    {
        if ($file === null || $file === '') {
            return null;
        }

        return route('library.audio', [
            'node' => $node->id,
            'file' => $file,
            'v' => $document->revision,
        ]);
    }

    private static function imageUrl(LibraryNode $node, ReadingDocument $document, ?string $file): ?string
    {
        if ($file === null || $file === '') {
            return null;
        }

        return route('library.image', [
            'node' => $node->id,
            'file' => $file,
            'v' => $document->revision,
        ]);
    }
}
