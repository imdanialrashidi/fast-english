<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Backup extends Model
{
    public const STATUS_CREATING = 'creating';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_RESTORING = 'restoring';

    public const STATUS_RESTORED = 'restored';

    public const STATUS_RESTORE_FAILED = 'restore_failed';

    /** @var list<string> */
    public const STATUSES = [
        self::STATUS_CREATING,
        self::STATUS_COMPLETED,
        self::STATUS_FAILED,
        self::STATUS_RESTORING,
        self::STATUS_RESTORED,
        self::STATUS_RESTORE_FAILED,
    ];

    public const TYPE_MANUAL = 'manual';

    public const TYPE_PRE_RESTORE = 'pre_restore';

    public const TYPE_UPLOADED = 'uploaded';

    protected $fillable = [
        'filename',
        'disk',
        'type',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'manifest' => 'array',
            'size_bytes' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isActive(): bool
    {
        return in_array($this->status, [self::STATUS_CREATING, self::STATUS_RESTORING], true);
    }

    public function isRestorable(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_RESTORED], true);
    }
}
