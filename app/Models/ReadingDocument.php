<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One immutable, versioned content document for a readable library leaf.
 * The app renders the document; it never parses a PDF at request time.
 */
class ReadingDocument extends Model
{
    protected $fillable = [
        'node_id',
        'schema_version',
        'revision',
        'document',
        'checksum',
        'page_count',
        'question_count',
        'word_count',
        'duration_ms',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'document' => 'array',
            'revision' => 'integer',
            'page_count' => 'integer',
            'question_count' => 'integer',
            'word_count' => 'integer',
            'duration_ms' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function node(): BelongsTo
    {
        return $this->belongsTo(LibraryNode::class, 'node_id');
    }
}
