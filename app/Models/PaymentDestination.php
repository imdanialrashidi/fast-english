<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * S5 payment destination (scope §14): card number, holder, bank,
 * transfer instructions, active flag. At most one active row (partial
 * unique index, enforced in the S5 migration).
 *
 * Real card data never lives in the repo: fixtures carry labelled TEST
 * values only (see S5PaymentFixtureSeeder). Production destinations are
 * entered by staff outside version control.
 */
class PaymentDestination extends Model
{
    use HasFactory;

    /** Obvious non-routable value for a new install; never a real card. */
    public const PLACEHOLDER_CARD = '0000000000000000';

    public const PLACEHOLDER_HOLDER = 'در انتظار تنظیم';

    public const PLACEHOLDER_BANK = 'در انتظار تنظیم';

    protected $fillable = [
        'card_number',
        'holder_name',
        'bank_name',
        'instructions',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * A destination is usable only when it is a real 16-digit card and
     * the placeholder labels have been replaced. The checkout and the
     * subscribe page share this rule, so a placeholder can never be shown
     * to a learner as a transfer target.
     */
    public function isConfigured(): bool
    {
        $number = preg_replace('/\D+/', '', (string) $this->card_number) ?? '';
        $holder = trim((string) $this->holder_name);
        $bank = trim((string) $this->bank_name);

        return preg_match('/^\d{16}$/', $number) === 1
            && $number !== self::PLACEHOLDER_CARD
            && $holder !== ''
            && $holder !== self::PLACEHOLDER_HOLDER
            && $bank !== ''
            && $bank !== self::PLACEHOLDER_BANK;
    }

    public function paymentRequests(): HasMany
    {
        return $this->hasMany(PaymentRequest::class, 'destination_id');
    }
}
