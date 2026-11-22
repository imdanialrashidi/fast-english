<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Where one learner stopped in one reading, against a content revision. */
class ReadingProgress extends Model
{
    protected $fillable = [
        'user_id',
        'node_id',
        'page_key',
        'position_ms',
        'revision',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'position_ms' => 'integer',
            'revision' => 'integer',
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
