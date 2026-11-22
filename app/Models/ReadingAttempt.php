<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One submitted IELTS passage attempt; answers are the learner's raw map. */
class ReadingAttempt extends Model
{
    protected $fillable = [
        'user_id',
        'node_id',
        'answers',
        'score',
        'total',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'answers' => 'array',
            'score' => 'integer',
            'total' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function node(): BelongsTo
    {
        return $this->belongsTo(LibraryNode::class, 'node_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
