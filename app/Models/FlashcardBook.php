<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One coursebook in the books section. Units hang off the book; the
 * learner-facing progress is exercise attempts, not card schedules.
 */
class FlashcardBook extends Model
{
    protected $fillable = [
        'slug',
        'title_en',
        'title_fa',
        'level',
        'edition',
        'status',
        'sort_order',
    ];

    public function units(): HasMany
    {
        return $this->hasMany(FlashcardUnit::class, 'book_id');
    }
}
