<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * One node of the reading shelf: a series, level, book, test, unit or a
 * readable leaf. The tree is ordered by `sort_order`, never by filename or
 * id. A leaf is readable only when it owns a published ReadingDocument.
 */
class LibraryNode extends Model
{
    protected $fillable = [
        'parent_id',
        'track',
        'kind',
        'slug',
        'title_en',
        'title_fa',
        'subtitle_fa',
        'level',
        'cover_path',
        'sort_order',
        'status',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'sort_order' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('id');
    }

    public function document(): HasOne
    {
        return $this->hasOne(ReadingDocument::class, 'node_id');
    }

    /** @param  Builder<LibraryNode>  $query */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', '!=', 'hidden');
    }

    /** @param  Builder<LibraryNode>  $query */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    /** @param  Builder<LibraryNode>  $query */
    public function scopeTrack(Builder $query, string $track): Builder
    {
        return $query->where('track', $track);
    }

    public function isReadable(): bool
    {
        return $this->document !== null && $this->document->published_at !== null;
    }

    public function label(): string
    {
        return (string) ($this->title_fa ?: $this->title_en ?: $this->slug);
    }

    /**
     * The route path below /app/books. The track is part of every node slug,
     * so a leaf keeps a stable URL even when its parent is renamed.
     */
    public function path(): string
    {
        if ($this->parent_id === null) {
            return '';
        }

        $prefix = str_replace('_', '-', $this->track).'/';

        return str_starts_with((string) $this->slug, $prefix)
            ? substr((string) $this->slug, strlen($prefix))
            : (string) $this->slug;
    }

    /** @return list<LibraryNode> */
    public function ancestors(): array
    {
        $chain = [];
        $node = $this->parent;
        while ($node !== null) {
            array_unshift($chain, $node);
            $node = $node->parent;
        }

        return $chain;
    }

    public function url(): ?string
    {
        if ($this->status === 'hidden') {
            return null;
        }

        $track = str_replace('_', '-', $this->track);
        $path = $this->path();

        return $path === ''
            ? route('library.track', ['track' => $track])
            : route('library.node', ['track' => $track, 'path' => $path]);
    }
}
