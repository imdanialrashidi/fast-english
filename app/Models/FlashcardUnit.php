<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One unit of a flashcard book; the client calls it a "lesson" section. */
class FlashcardUnit extends Model
{
    protected $fillable = [
        'book_id',
        'number',
        'title_en',
        'title_fa',
        'subtitle',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(FlashcardBook::class, 'book_id');
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Flashcard::class, 'unit_id')->orderBy('sort_order')->orderBy('id');
    }
}
